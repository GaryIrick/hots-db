const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob')
const { DefaultAzureCredential } = require('@azure/identity')
const moment = require('moment')
const getSqlServer = require('./db/getSqlServer')

const {
  azure: { storage: { account, backupsContainer } },
  sqlServer: { database }
} = require('./config')

module.exports = async (log) => {
  log('Starting database backup.')
  const credential = new DefaultAzureCredential()
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential
  )

  const startsOn = new Date()
  const expiresOn = new Date()
  expiresOn.setHours(expiresOn.getHours() + 2)

  const userDelegationKey = await blobServiceClient.getUserDelegationKey(startsOn, expiresOn)

  const sasQueryParams = generateBlobSASQueryParameters({
    containerName: backupsContainer,
    permissions: BlobSASPermissions.parse('racw'),
    startsOn,
    expiresOn
  }, userDelegationKey, account)

  const containerUrl = `https://${account}.blob.core.windows.net/${backupsContainer}`
  const sasSignature = sasQueryParams.toString()

  const timestamp = moment().format('YYYYMMDDHHMM')
  const backupFileName = `${database}_${timestamp}.BAK`
  const backupUrl = `${containerUrl}/${backupFileName}`
  log(`Backing up to ${backupFileName}.`)

  const db = await getSqlServer()

  try {
    // Create SQL Server credential for Azure storage
    log('Creating SQL Server credential.')
    await db.request().query(`
      CREATE CREDENTIAL [${containerUrl}]
      WITH IDENTITY = 'SHARED ACCESS SIGNATURE',
      SECRET = '${sasSignature}'
    `)
    log('SQL Server credential created successfully.')

    // Backup database to Azure blob storage
    log(`Starting backup of database '${database}' to Azure.`)
    await db.request().query(`
      BACKUP DATABASE [${database}]
      TO URL = '${backupUrl}'
      WITH COMPRESSION
    `)
    log('Database backup completed successfully')
  } catch (error) {
    log(`Database backup failed: ${error.message}`)
    throw error
  } finally {
    try {
      // Drop the credential
      log('Dropping SQL Server credential.')
      await db.request().query(`DROP CREDENTIAL [${containerUrl}]`)
      log('SQL Server credential dropped successfully.')
    } catch (cleanupError) {
      log(`Warning: Failed to drop credential: ${cleanupError.message}`)
    }
    await db.close()
  }
}
