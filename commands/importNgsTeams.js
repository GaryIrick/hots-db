const importNgsTeams = require('../src/importNgsTeams')

const run = async (maxCount) => {
  await importNgsTeams(maxCount, console.log)
}

if (process.argv.length !== 3) {
  console.log('Usage: importNgsTeams <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
