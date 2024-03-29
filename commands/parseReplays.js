const parseReplays = require('../src/parseReplays')

const run = async (maxCount) => {
  const count = await parseReplays(maxCount, console.log)
  console.log(`Processed ${count} replays.`)
}

if (process.argv.length !== 3) {
  console.log('Usage: parseReplays <maxCount>')
  process.exit(1)
}

const start = new Date()
run(Number(process.argv[2])).then(() => {
  const end = new Date()
  console.log(`Elapsed time: ${end - start}`)
})
