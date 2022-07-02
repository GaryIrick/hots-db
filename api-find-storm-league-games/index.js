const findStormLeagueGames = require('../src/findStormLeagueGames')

module.exports = async function (context, req) {
  const count = await findStormLeagueGames(1000, context.log)

  context.res = {
    body: { count },
    headers: {
      'Content-Type': 'application/json'
    }
  }
}
