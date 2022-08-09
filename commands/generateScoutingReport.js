const generateScoutingReport = require('../src/generateScoutingReport')

const run = async (ngsTeamId, startSeason, endSeason) => {
  await generateScoutingReport(ngsTeamId, startSeason, endSeason, console.log)
}

if (process.argv.length !== 5) {
  console.log('Usage: generateImports <NGS team ID> <startSeason> <endSeason>')
  process.exit(1)
}

run(process.argv[2], Number(process.argv[3]), Number(process.argv[4]))
