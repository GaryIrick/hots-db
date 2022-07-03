import mssql = require('mssql')

declare function getSqlServer(): Promise<mssql.ConnectionPool>
export = getSqlServer
