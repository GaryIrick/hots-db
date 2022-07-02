const findStormLeagueGames = require('../src/findStormLeagueGames')

module.exports = async function (context, req) {
  const { count, mostRecent } = await findStormLeagueGames(1000, context.log)

  context.res = {
    body: { count, mostRecent },
    headers: {
      'Content-Type': 'application/json'
    }
  }
}
