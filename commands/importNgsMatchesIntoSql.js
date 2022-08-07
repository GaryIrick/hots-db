const importNgsMatchesIntoSql = require('../src/importNgsMatchesIntoSql')

const run = async (maxCount) => {
  await importNgsMatchesIntoSql(maxCount, console.log)
}

if (process.argv.length !== 3) {
  console.log('Usage: importNgsMatchesIntoSql <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
