const copyNgsMatches = require('../src/copyNgsMatches')

module.exports = async function (request, context) {
  const body = await request.json()
  const maxCount = body.maxCount

  if (!Number.isInteger(maxCount)) {
    return {
      jsonBody: { error: 'maxCount must be an integer' },
      status: 400
    }
  }

  const count = await copyNgsMatches(Number(maxCount), (msg) => { context.log(msg) })

  return { jsonBody: { count } }
}
