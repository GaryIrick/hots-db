const getFromNgs = require('./apis/getFromNgs')
const getCosmos = require('./db/getCosmos')
const { azure: { cosmos: { teamsContainer } } } = require('./config')

module.exports = async (log) => {
  // E_NOTIMPL:  This might change after the season gets started.
  const { returnObject } = await getFromNgs('team/get/registered')
  const container = await getCosmos(teamsContainer, true)
  let count = 0

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

    await container.items.upsert(team)
    log(`Updated team ${team.name}.`)

    count++
  }

  return count
}
