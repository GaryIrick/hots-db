const delay = require('delay')
const agent = require('superagent')
const { ngs: { apiUrl } } = require('../config')

module.exports = async (route) => {
  const url = `${apiUrl}/${encodeURI(route)}`
  const get = agent
    .get(url)

  try {
    await delay(50)
    return (await get).body
  } catch (e) {
    await delay(1000)
    return (await get).body
  }
}
