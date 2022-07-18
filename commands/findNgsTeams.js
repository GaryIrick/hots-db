const findNgsTeams = require('../src/findNgsTeams')

const run = async () => {
  const count = await findNgsTeams(console.log)
  console.log(`Found ${count} teams.`)
}

run()
