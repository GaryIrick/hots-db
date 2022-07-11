const importReplaysIntoSql = require('../src/importReplaysIntoSql')

const run = async (maxCount) => {
  const count = await importReplaysIntoSql(maxCount, console.log)
  console.log(`Imported ${count} replays.`)
}

if (process.argv.length !== 3) {
  console.log('Usage: importReplaysIntoSql <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
