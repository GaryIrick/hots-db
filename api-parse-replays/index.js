const parseReplays = require('../src/parseReplays')

module.exports = async function (context, req) {
  const maxCount = req.body.maxCount

  if (!Number.isInteger(maxCount)) {
    context.res = {
      body: { error: 'maxCount must be an integer' },
      headers: {
        'Content-Type': 'application/json'
      },
      status: 400,
      isRaw: true
    }

    return
  }

  const count = await parseReplays(Number(maxCount), context.log)

  context.res = {
    body: { count },
    headers: {
      'Content-Type': 'application/json'
    }
  }
}
