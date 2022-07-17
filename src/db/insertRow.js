const { join, upperFirst } = require('lodash')

module.exports = async (db, table, values) => {
  const columns = Object.keys(values).map(k => upperFirst(k))
  const variables = Object.keys(values).map(k => `@${k}`)

  const sql = `INSERT INTO ${table} (${join(columns, ',')}) VALUES (${join(variables, ',')})`

  const request = db.request()

  for (const key of Object.keys(values)) {
    request.input(key, values[key])
  }

  await request.query(sql)
}
