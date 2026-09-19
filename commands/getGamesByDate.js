const getGamesByDate = require('../src/getGamesByDate')

const run = async (startAfter, filename) => {
  const count = await getGamesByDate(startAfter, filename, console.log)
  console.log(`Counted ${count} games, wrote ${filename}.`)
}

if (process.argv.length > 4) {
  console.log('Usage: getGamesByDate [startAfterReplayId] [filename]')
  process.exit(1)
}

run(Number(process.argv[2] || 0), process.argv[3] || 'gamesByDate.csv')
