const importNgsTeamsIntoSql = require('../src/importNgsTeamsIntoSql')

const run = async (maxCount) => {
  await importNgsTeamsIntoSql(maxCount, console.log)
}

if (process.argv.length !== 3) {
  console.log('Usage: importNgsTeamsIntoSql <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
