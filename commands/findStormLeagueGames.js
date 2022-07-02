const findStormLeagueGames = require('../src/findStormLeagueGames')

const run = async (maxCount) => {
  const count = await findStormLeagueGames(maxCount, console.log)
  console.log(`Processed ${count} games.`)
}

if (process.argv.length !== 3) {
  console.log('Usage: findStormLeagueGames <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
