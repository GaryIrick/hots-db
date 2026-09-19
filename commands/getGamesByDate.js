const getGamesByDate = require('../src/getGamesByDate')

const run = async (filename) => {
  const count = await getGamesByDate(filename, console.log)
  console.log(`Counted ${count} games, wrote ${filename}.`)
}

if (process.argv.length > 3) {
  console.log('Usage: getGamesByDate [filename]')
  process.exit(1)
}

run(process.argv[2] || 'gamesByDate.csv')
