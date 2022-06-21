const copyNgsMatches = require('../src/copyNgsMatches')

module.exports = async function (context, req) {
  const count = await copyNgsMatches(context.log)

  context.res = {
    body: { count },
    headers: {
      'Content-Type': 'application/json'
    }
  }
}
