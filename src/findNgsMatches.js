const postFromNgs = require('./apis/postFromNgs')
const getCosmos = require('./db/getCosmos')
const { ngs: { bucket }, azure: { cosmos: { matchesContainer, readWriteKey } } } = require('./config')

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

module.exports = async (season, log) => {
  const { returnObject } = await postFromNgs('schedule/fetch/matches', { season })
  const container = await getCosmos(matchesContainer, true)
  let count = 0

  for (const match of returnObject) {
    // We only care about matches that have been reported and have replays.
    if (match.reported && match.replays) {
      const matchId = match._id
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
        isCopied: false,
      }

      for (var i = 1; i <= 7; i++) {
        const replay = match.replays[i]

        // There was one replay that had .tempUrl, but not url, just skip it.  Data is broken, per Wraithling.
        if (replay && replay.url) {
          doc.games.push(replay.url)
        }
      }

      await container.items.upsert(doc)

      count++
    }
  }

  return count
}
