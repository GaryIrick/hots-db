const parseReplays = require('../src/parseReplays')

module.exports = async function (context, req) {
  const count = await parseReplays(100, context.log)

  context.res = {
    body: { count },
    headers: {
      'Content-Type': 'application/json'
    }
  }
}
