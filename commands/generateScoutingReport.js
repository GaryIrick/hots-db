const generateScoutingReport = require('../src/generateScoutingReport')

const run = async (ourTeam, theirTeam, startSeason) => {
  await generateScoutingReport(ourTeam, theirTeam, startSeason, console.log)
}

if (process.argv.length !== 5) {
  console.log('Usage: generateScoutingReport <our team name> <their team name> <startSeason>')
  process.exit(1)
}

run(process.argv[2], process.argv[3], Number(process.argv[4]))
