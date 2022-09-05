const generateScoutingReport = require('../src/generateScoutingReport')

const run = async (ourTeam, theirTeam, startSeason, endSeason) => {
  await generateScoutingReport(ourTeam, theirTeam, startSeason, endSeason, console.log)
}

if (process.argv.length !== 6) {
  console.log('Usage: generateImports <our team name> <their team name> <startSeason> <endSeason>')
  process.exit(1)
}

run(process.argv[2], process.argv[3], Number(process.argv[4]), Number(process.argv[5]))
