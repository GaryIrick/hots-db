const { lowerFirst } = require('lodash')

module.exports = (row) => {
  const camelCased = {}

  for (const key of Object.keys(row)) {
    camelCased[lowerFirst(key)] = row[key]
  }

  return camelCased
}
