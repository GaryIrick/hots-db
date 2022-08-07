const { capitalize } = require('lodash')

module.exports = (divisionName) => {
  if (!divisionName) {
    return {
      division: 'Unknown',
      coast: null
    }
  }

  if (divisionName.includes('-')) {
    const parts = divisionName.split('-')

    return {
      division: capitalize(parts[0]),
      coast: capitalize(parts[1])
    }
  } else {
    return {
      division: capitalize(divisionName),
      coast: null
    }
  }
}
