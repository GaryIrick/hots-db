// We use msnodesqlv8 instead of just mssql because we use Windows authentication against our local server.
const sql = require('mssql/msnodesqlv8')
const { sqlServer: db } = require('../config')

module.exports = async () => {
  const config = {
    server: db.hostname,
    database: db.database,
    connectionTimeout: 60 * 1000,
    requestTimeout: 30 * 60 * 1000,
    options: {
      enableArithAbort: true,
      encrypt: true,
      trustedConnection: true
    }
  }

  config.connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${db.hostname};Database=${db.database};Trusted_Connection=yes;`

  return await sql.connect(config)
}
