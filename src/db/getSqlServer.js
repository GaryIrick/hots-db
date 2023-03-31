// We use msnodesqlv8 instead of just mssql because we to use Windows authentication against our local server.
const sql = require('mssql/msnodesqlv8')
const { sqlServer: db } = require('../config')

module.exports = async () => {
  const config = {
    server: db.hostname,
    database: db.database,
    connectionTimeout: 60 * 1000,
    requestTimeout: 10 * 60 * 1000,
    options: {
      enableArithAbort: true,
      encrypt: true
    },
    beforeConnect: (bcConfig) => {
      // The Driver SQL Server Native Client has been removed from SQL Server 2022.
      // Source https://learn.microsoft.com/en-us/sql/relational-databases/native-client/applications/installing-sql-server-native-client?view=sql-server-ver16
      // ODBC Driver 17 for SQL Server is tested working well with SQL Server 2019 & 2022 */
      bcConfig.conn_str = bcConfig.conn_str.replace('SQL Server Native Client 11.0', 'ODBC Driver 17 for SQL Server')
    }
  }

  config.options.trustedConnection = true
  config.connectionString = 'Driver={SQL Server Native Client 11.0};Server={#{server},#{port}};Database={#{database}};Trusted_Connection={#{trusted}};'

  return await sql.connect(config)
}
