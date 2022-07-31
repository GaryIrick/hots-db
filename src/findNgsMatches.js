const { uniqBy, orderBy, keys } = require('lodash')
const moment = require('moment')
const postFromNgs = require('./apis/postFromNgs')
const getCosmos = require('./db/getCosmos')
const { azure: { cosmos: { matchesContainer, teamsContainer } } } = require('./config')

const maps = [
  'Alterac Pass',
  'Battlefield of Eternity',
  'Blackheart\'s Bay',
  'Braxis Holdout',
  'Cursed Hollow',
  'Dragon Shire',
  'Garden of Terror',
  'Hanamura Temple',
  'Haunted Mines',
  'Infernal Shrines',
  'Sky Temple',
  'Tomb of the Spider Queen',
  'Towers of Doom',
  'Volskaya Foundry',
  'Warhead Junction'
]

const getBans = (match, homeOrAway) => {
  const bans = []

  if (match.mapBans) {
    const banOne = match.mapBans[`${homeOrAway}One`]
    const banTwo = match.mapBans[`${homeOrAway}Two`]

    if (banOne) {
      bans.push(banOne)
    }

    if (banTwo) {
      bans.push(banTwo)
    }
  }

  return bans
}

const importMatches = async (matchesData, container, log) => {
  let count = 0

  // We only care about matches that have been reported and have replays.
  for (const match of matchesData) {
    if (match.reported && match.replays) {
      const matchId = match.matchId
      const existingMatch = await container.item(matchId, matchId).read()

      if (existingMatch.resource) {
        // We've already seen this match, skip it.
        continue
      }

      const doc = {
        id: matchId,
        season: match.season,
        type: match.type,
        round: match.round,
        isPlayoffs: match.type === 'tournament',
        division: match.divisionConcat || 'unknown',
        games: [],
        homeTeam: {
          id: match.home.id,
          name: match.home.teamName,
          mapBans: getBans(match, 'home'),
          score: match.home.score,
          domination: !!match.home.dominator
        },
        awayTeam: {
          id: match.away.id,
          name: match.away.teamName,
          mapBans: getBans(match, 'away'),
          score: match.away.score,
          domination: !!match.away.dominator
        },
        caster: match.casterName,
        vodLinks: match.vodLinks,
        status: {}
      }

      for (let i = 1; i <= 7; i++) {
        const replay = match.replays[i]

        // There was one replay that had .tempUrl, but not url, just skip it.  Data is broken, per Wraithling.
        if (replay && replay.url) {
          doc.games.push({
            replayKey: replay.url,
            winner: match.other[`${i}`] ? (match.other[`${i}`].winner) : undefined
          })
        }
      }

      await container.items.upsert(doc)
      log(`Updated match ${doc.id}.`)

      count++
    }
  }

  return count
}

const findMapFromReplayKey = (replayKey) => {
  for (const map of maps) {
    if (replayKey.indexOf(map.replace(/ /g, '_')) >= 0) {
      return map
    }
  }

  return 'unknown'
}

const getMatchDate = (match) => {
  let date

  if (match.scheduledTime) {
    if (match.scheduledTime.startTime) {
      date = new Date(Number(match.scheduledTime.startTime))
    } else if (match.scheduledTime.endTime) {
      date = new Date(Number(match.scheduledTime.endTime))
    }
  }

  if (date) {
    return moment(date).format('YYYY-MM-DD')
  } else {
    return undefined
  }
}

const normalizeMatch = (match, ourSide) => {
  const theirSide = ourSide === 'home' ? 'away' : 'home'

  const normalizedMatch = {
    id: match.matchId,
    side: ourSide,
    round: match.round,
    isPlayoffs: match.type === 'tournament',
    opponent: {
      id: match[theirSide].id,
      name: match[theirSide].teamName
    },
    mapBans: getBans(match, ourSide),
    opponentMapBans: getBans(match, theirSide),
    caster: match.casterName,
    vodLinks: match.vodLinks,
    score: match[ourSide].score,
    opponentScore: match[theirSide].score,
    games: [],
    date: getMatchDate(match)
  }

  for (const gameIndex of keys(match.replays).filter(k => k !== '_id')) {
    const replayKey = match.replays[`${gameIndex}`].url

    // There is some bad data out there where .url is missing, but .tempUrl is set.
    // Per Wraithling, this is bad data, ignore it.
    if (replayKey) {
      normalizedMatch.games.push({
        map: findMapFromReplayKey(replayKey),
        replayKey,
        // Some matches are missing the winner information in the "other" block, so we put "undefined" instead of "true/false" there.
        // It's up to whoever looks at the data to know about this wrinkle, since those are both falsy.
        isWin: match.other[`${gameIndex}`] ? (match.other[`${gameIndex}`].winner === ourSide) : undefined
      })
    }
  }

  return normalizedMatch
}

const updateTeam = async (teamData, season, homeMatches, awayMatches, container) => {
  const matches = homeMatches.map(m => normalizeMatch(m, 'home')).concat(awayMatches.map(m => normalizeMatch(m, 'away', season)))
  const foundTeam = await container.item(teamData.id, teamData.id).read()
  const team = foundTeam.resource || { id: teamData.id, name: teamData.name, logo: teamData.logo }
  const seasons = (team.seasons || []).filter(s => s.season !== season)
  seasons.push({
    season,
    matches: orderBy(matches, m => m.date),
    division: homeMatches.concat(awayMatches)[0].divisionConcat || 'unknown'
  })
  team.seasons = orderBy(seasons, s => s.season)

  await container.items.upsert(team)
}

const updateTeams = async (matchesData, season, container, log) => {
  const allTeams = []
  const matches = []

  for (const match of matchesData) {
    if (!match.reported || match.forfeit || !match.home || !match.away || !match.replays || match.replays.length === 0) {
      continue
    }

    const home = { id: match.home.id, name: match.home.teamName, logo: match.home.logo }
    const away = { id: match.away.id, name: match.away.teamName, logo: match.away.logo }

    matches.push(match)
    allTeams.push(home)
    allTeams.push(away)
  }

  const uniqueTeams = uniqBy(allTeams, t => t.id)

  for (const team of uniqueTeams) {
    await updateTeam(team, season, matches.filter(m => m.home.id === team.id), matches.filter(m => m.away.id === team.id), container)
    log(`Updated team ${team.name}.`)
  }
}

module.exports = async (season, log) => {
  const { returnObject } = await postFromNgs('schedule/fetch/matches', { season })
  const containerForMatches = await getCosmos(matchesContainer, true)
  const containerForTeams = await getCosmos(teamsContainer, true)

  await updateTeams(returnObject, season, containerForTeams, log)
  const matchCount = await importMatches(returnObject, containerForMatches, log)

  return matchCount
}
