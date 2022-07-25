const findNgsMatches = require('../src/findNgsMatches')

module.exports = async function (context, req) {
  const season = req.body.season

  if (!Number.isInteger(season)) {
    context.res = {
      body: { error: 'season must be an integer' },
      headers: {
        'Content-Type': 'application/json'
      },
      status: 400,
      isRaw: true
    }

    return
  }

  const count = await findNgsMatches(Number(season), context.log)

  context.res = {
    body: { count },
    headers: {
      'Content-Type': 'application/json'
    }
  }
}
