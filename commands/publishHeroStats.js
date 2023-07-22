const publishHeroStats = require('../src/publishHeroStats')

const run = async (start, end) => {
  const dateCount = await publishHeroStats(start, end, console.log)
  console.log(`Processed ${dateCount} dates.`)
}

if (process.argv.length !== 4) {
  console.log('Usage: publishHeroStats <start_date> <end_date>')
  process.exit(1)
}

run(process.argv[2], process.argv[3])
