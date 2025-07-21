// We use msnodesqlv8 instead of just mssql because we to use Windows authentication against our local server.
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
      encrypt: true
    }
  }

  config.options.trustedConnection = true
  config.connectionString = 'Driver={ODBC Driver 17 for SQL Server};Server={#{server},#{port}};Database={#{database}};Trusted_Connection={#{trusted}};'

  return await sql.connect(config)
}
