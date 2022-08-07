const getFromNgs = require('./apis/getFromNgs')
const getCosmos = require('./db/getCosmos')
const { azure: { cosmos: { teamsContainer } } } = require('./config')

module.exports = async (log) => {
  const { returnObject } = await getFromNgs('team/get/registered')
  const container = await getCosmos(teamsContainer, true)
  let count = 0
  let keepGoing = true

  // Mark all active teams as inactive, and turn them back on when we find them below.
  const activeTeamsQuery = container.items.query('SELECT t.id FROM t WHERE t.isActive = true')

  while (keepGoing) {
    const response = await activeTeamsQuery.fetchNext()

    for (const activeTeam of response.resources) {
      await container.item(activeTeam.id, activeTeam.id).patch([
        { op: 'set', path: '/isActive', value: false },
        { op: 'set', path: '/status/isImported', value: false }
      ])
    }

    keepGoing = response.hasMoreResults
  }

  for (const teamData of returnObject) {
    const teamId = teamData._id
    const name = teamData.teamName
    const logo = teamData.logo
    const captain = teamData.captain
    const assistantCaptains = teamData.assistantCaptain
    const players = teamData.teamMembers.map(tm => tm.displayName)
    const division = teamData.divisionConcat || 'unknown'
    const foundTeam = await container.item(teamId, teamId).read()

    const team = foundTeam.resource || { id: teamId }
    team.name = name
    team.logo = logo
    team.players = players
    team.captain = captain
    team.assistantCaptains = assistantCaptains
    team.division = division
    team.isActive = true
    team.status = { ...foundTeam.status, isImported: false }

    await container.items.upsert(team)
    log(`Updated team ${team.name}.`)

    count++
  }

  return count
}
