const parseReplays = require('../src/parseReplays')

const run = async (maxCount) => {
  const count = await parseReplays(maxCount, console.log)
  console.log(`Processed ${count} replays.`)
}

if (process.argv.length !== 3) {
  console.log('Usage: parseReplays <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
