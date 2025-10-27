const fs = require('fs')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { mean, orderBy, take } = require('lodash')
const moment = require('moment')
const xl = require('excel4node')
const chroma = require('chroma-js')
const getCosmos = require('./db/getCosmos')
const getHeroWinRatesData = require('./lib/getHeroWinRatesData')
const getCompressedJson = require('./lib/getCompressedJson')
const changeExtension = require('./lib/changeExtension')
const getFromNgs = require('./apis/getFromNgs')

const {
  azure: {
    cosmos: {
      teamsContainer: teamsContainerName
    },
    storage:
    {
      account,
      sqlImportContainer: sqlImportContainerName
    }
  },
  ngs: {
    currentMapPool,
    currentSeason
  }
} = require('./config')

const colors = {
  topHeader: '#FCE4D6',
  subHeader: '#D9E1F2',
  wonGame: '#D9EAD3',
  lostGame: '#F4CCCC',
  pickedMap: '#CFE2F3',
  ban: '#EAD1DC',
  pick: '#FCE5CD',
  opponentBan: '#D0E0E3',
  healer: '#D9EAD3',
  rangedAssassin: '#F4CCCC',
  meleeAssassin: '#EC9337',
  tank: '#FFF2CC',
  bruiser: '#CFE2F3',
  support: '#DDDDDD',
  bronze: '#DAB79A',
  silver: '#C0D2E2',
  gold: '#F7D77D',
  platinum: '#DCC5FF',
  diamond: '#80E5FF',
  master: '#ed79e5',
  unranked: '#FFFFFF'
}

const getTeamByName = async (container, teamName) => {
  const query = container.items.query(`SELECT * FROM t WHERE t.name = '${teamName.replace(/'/g, '\\\'')}'`)
  const response = await query.fetchNext()
  if (response.resources.length === 0) {
    throw new Error(`Team ${teamName} does not exist.`)
  } else if (response.resources.length > 1) {
    throw new Error(`Multiple teams named ${teamName} exist.`)
  }

  return response.resources[0]
}

const firstPickRounds = [1, 2, 2, 3, 3]
const secondPickRounds = [1, 1, 2, 2, 3]

const getPickRound = (pickNumber, isFirstPickTeam) => {
  return isFirstPickTeam ? firstPickRounds[pickNumber - 1] : secondPickRounds[pickNumber - 1]
}

const pickTeam = (json, isWin) => {
  const teamNumber = isWin ? json.winningTeam : (json.winningTeam === 1 ? 2 : 1)
  const properTeam = json.teams.filter(t => t.team === teamNumber)[0]
  const players = []

  for (let i = 0; i < properTeam.players.length; i++) {
    const player = properTeam.players[i]
    players.push({
      name: player.name,
      tag: player.tag,
      hero: player.hero,
      order: i + 1,
      round: getPickRound(i + 1, teamNumber === json.firstPickTeam)
    })
  }

  return {
    teamNumber,
    players,
    bans: properTeam.bans
  }
}

const getSqlImportPath = (season, game) => {
  return `processed/ngs/season-${`${season}`.padStart(2, 0)}/${changeExtension(game.replayKey, 'import.json.gz')}`
}

const getTeamData = async (teamsContainer, sqlImportFilesystem, teamName, startSeason, endSeason, log) => {
  const teamData = await getTeamByName(teamsContainer, teamName)

  const picks = []
  const opponentPicks = []
  const bans = []
  const maps = []
  const opponentBans = []
  const currentSeasonMatches = []

  for (const season of (teamData.seasons || []).filter(s => s.season >= startSeason && s.season <= endSeason)) {
    for (const match of season.matches) {
      const gamesForMatch = []

      for (const mapBan of match.mapBans) {
        let map = maps.find(m => m.name === mapBan)

        if (!map) {
          map = { name: mapBan, wins: 0, losses: 0, picks: 0, bans: 0 }
          maps.push(map)
        }

        map.bans++
      }

      for (const game of match.games) {
        const importPath = getSqlImportPath(season.season, game)
        let json
        try {
          json = await getCompressedJson(sqlImportFilesystem, importPath)
        } catch (e) {
          log(`MISSING GAME for ${teamName}: ${importPath} from ${match.id}`)
          // This game is missing, just ignore it.
          continue
        }
        const team = pickTeam(json, game.isWin)
        const otherTeam = pickTeam(json, !game.isWin)

        let map = maps.find(m => m.name === game.map)

        if (!map) {
          map = { name: game.map, wins: 0, losses: 0, picks: 0, bans: 0 }
          maps.push(map)
        }

        if (game.isWin) {
          map.wins++
        } else {
          map.losses++
        }

        if (team.teamNumber !== json.firstPickTeam) {
          map.picks++
        }

        gamesForMatch.push({
          map: game.map,
          pickedMap: team.teamNumber !== json.firstPickTeam,
          isWin: game.isWin,
          team,
          otherTeam
        })

        for (const player of team.players) {
          if (!teamData.players.includes(`${player.name}#${player.tag}`)) {
            // This player is not on the active roster, skip them.
            continue
          }

          let hero = picks.find(h => h.hero === player.hero)

          if (!hero) {
            hero = { hero: player.hero, count: 0, rounds: [], isWin: [] }
            picks.push(hero)
          }

          hero.count++
          hero.rounds.push(player.round)
          hero.isWin.push(game.isWin ? 1 : 0)
        }

        for (const player of otherTeam.players) {
          let hero = opponentPicks.find(h => h.hero === player.hero)

          if (!hero) {
            hero = { hero: player.hero, count: 0, rounds: [], isWin: [] }
            opponentPicks.push(hero)
          }

          hero.count++
          hero.rounds.push(player.round)
          hero.isWin.push(game.isWin ? 0 : 1)
        }

        for (const ban of team.bans) {
          let bannedHero = bans.find(b => b.hero === ban.hero)

          if (!bannedHero) {
            bannedHero = { hero: ban.hero, count: 0, rounds: [] }
            bans.push(bannedHero)
          }

          bannedHero.count++
          bannedHero.rounds.push(ban.round)
        }

        for (const ban of otherTeam.bans) {
          let bannedHero = opponentBans.find(b => b.hero === ban.hero)

          if (!bannedHero) {
            bannedHero = { hero: ban.hero, count: 0, rounds: [] }
            opponentBans.push(bannedHero)
          }

          bannedHero.count++
          bannedHero.rounds.push(ban.round)
        }
      }

      if (season.season >= currentSeason - 1) {
        currentSeasonMatches.push({
          date: match.date,
          opponent: match.opponent.name,
          games: gamesForMatch
        })
      }
    }
  }

  for (const pick of picks) {
    pick.winRate = mean(pick.isWin)
    pick.count = pick.isWin.length
    pick.wins = pick.isWin.filter(isWin => isWin).length
    pick.losses = pick.isWin.filter(isWin => !isWin).length
    pick.averagePickRound = mean(pick.rounds)
  }

  for (const pick of opponentPicks) {
    pick.winRate = mean(pick.isWin)
    pick.count = pick.isWin.length
    pick.wins = pick.isWin.filter(isWin => isWin).length
    pick.losses = pick.isWin.filter(isWin => !isWin).length
    pick.averagePickRound = mean(pick.rounds)
  }

  for (const ban of bans) {
    ban.averageBanRound = mean(ban.rounds)
  }

  for (const ban of opponentBans) {
    ban.averageBanRound = mean(ban.rounds)
  }

  return {
    name: teamName,
    currentSeasonMatches,
    maps,
    picks,
    opponentPicks,
    bans,
    opponentBans
  }
}

const getFill = (color) => ({ type: 'pattern', patternType: 'solid', fgColor: color })
const winRateScale = chroma.scale(['white', chroma('green')])
const lossRateScale = chroma.scale(['white', chroma('red')])

const getWinRateStyle = (winRate) => {
  // If there's no color, don't set a style at all.  This prevents the border from disappearing,
  // so it doesn't look weird.
  if (winRate !== 0) {
    return { fill: { type: 'pattern', patternType: 'solid', fgColor: winRateScale(winRate).hex() } }
  } else {
    return {}
  }
}

const getLossRateStyle = (winRate) => {
  // If there's no color, don't set a style at all.  This prevents the border from disappearing,
  // so it doesn't look weird.
  if (winRate !== 0) {
    return { fill: { type: 'pattern', patternType: 'solid', fgColor: lossRateScale(winRate).hex() } }
  } else {
    return {}
  }
}

const getRoleColor = (role) => {
  switch (role) {
    case 'Healer':
      return colors.healer
    case 'Ranged Assassin':
      return colors.rangedAssassin
    case 'Melee Assassin':
      return colors.meleeAssassin
    case 'Tank':
      return colors.tank
    case 'Bruiser':
      return colors.bruiser
    case 'Support':
      return colors.support
    default:
      return undefined
  }
}

const getRankColor = (rankInfo) => {
  if (rankInfo.metal) {
    return colors[rankInfo.metal.toLowerCase()]
  } else {
    return colors.unranked
  }
}

const playerCache = {}

const getHighestRank = (rankHistory) => {
  const rankOrder = ['Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Unranked']

  const sortedHistory = rankHistory
    .filter(h => h.hlRankMetal !== undefined && h.hlRankDivision !== undefined)
    .sort((a, b) => {
      const aMetalRank = rankOrder.indexOf(a.hlRankMetal)
      const bMetalRank = rankOrder.indexOf(b.hlRankMetal)

      if (aMetalRank !== -1 && bMetalRank !== -1 && aMetalRank !== bMetalRank) {
        return aMetalRank - bMetalRank
      }

      return a.hlRankMetal === 'Master' ? b.hlRankDivision - a.hlRankDivision : a.hlRankDivision - b.hlRankDivision
    })

  return sortedHistory.length > 0 ? sortedHistory[0] : { hlRankMetal: 'Unranked', hlRankDivision: 0 }
}

const getPlayerRank = async (fullTag) => {
  let rankInfo = playerCache[fullTag]

  if (!rankInfo) {
    const playerData = await getFromNgs(`user/get?user=${encodeURIComponent(fullTag)}`)

    const bestRank = playerData.returnObject ? getHighestRank(playerData.returnObject.verifiedRankHistory) : null

    rankInfo = bestRank
      ? {
          metal: bestRank.hlRankMetal,
          division: bestRank.hlRankDivision
        }
      : { metal: 'Unranked', division: 0 }
    playerCache[fullTag] = rankInfo
  }

  return rankInfo
}

const fillMapSheet = (ws, ourMaps, theirMaps) => {
  const firstMapRow = 5
  let mapRow = firstMapRow
  let lastMapRow = firstMapRow

  for (const mapName of currentMapPool) {
    ws.cell(mapRow, 2).string(mapName)
    const ourMap = ourMaps.find(m => m.name === mapName)
    const theirMap = theirMaps.find(m => m.name === mapName)

    if (ourMap) {
      if (ourMap.wins + ourMap.losses > 0) {
        const winRate = ourMap.wins / (ourMap.wins + ourMap.losses)
        ws.cell(mapRow, 3).string(`${ourMap.wins} - ${ourMap.losses}`)
        ws.cell(mapRow, 4).number(winRate).style(getWinRateStyle(winRate))
      }

      if (ourMap.picks > 0) {
        ws.cell(mapRow, 5).number(ourMap.picks)
      }

      if (ourMap.bans > 0) {
        ws.cell(mapRow, 6).number(ourMap.bans)
      }
    }

    if (theirMap) {
      if (theirMap.wins + theirMap.losses > 0) {
        const winRate = theirMap.wins / (theirMap.wins + theirMap.losses)
        ws.cell(mapRow, 8).string(`${theirMap.wins} - ${theirMap.losses}`)
        ws.cell(mapRow, 9).number(winRate).style(getWinRateStyle(winRate))
      }

      if (theirMap.picks > 0) {
        ws.cell(mapRow, 10).number(theirMap.picks)
      }

      if (theirMap.bans > 0) {
        ws.cell(mapRow, 11).number(theirMap.bans)
      }
    }

    lastMapRow = mapRow
    mapRow++
  }

  ws.column(1).width = 5
  ws.column(2).width = 30
  ws.column(7).width = 5
  ws.cell(firstMapRow, 3, lastMapRow, 11).style({ alignment: { horizontal: 'center' } })
  ws.cell(firstMapRow, 4, lastMapRow, 4).style({ numberFormat: '#%; -#%; 0%' })
  ws.cell(firstMapRow, 8, lastMapRow, 9).style({ numberFormat: '#%; -#%; 0%' })

  ws.cell(1, 2, 1, 11, true)
    .string('Maps')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })
  ws.cell(3, 3, 3, 6, true)
    .string('Us')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(3, 8, 3, 11, true)
    .string('Them')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(4, 3)
    .string('Record')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 4)
    .string('Win %')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 5)
    .string('Picked')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 6)
    .string('Banned')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 8)
    .string('Record')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 9)
    .string('Win %')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 10)
    .string('Picked')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 11)
    .string('Banned')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
}

const fillHeroesSheet = async (ws, heroData, title) => {
  ws.cell(1, 1, 1, 10, true).string(title).style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })
  ws.cell(3, 1).string('Role').style({ font: { bold: true } })
  ws.cell(3, 2).string('Hero').style({ font: { bold: true } })
  ws.cell(3, 3).string('Player').style({ font: { bold: true } })
  ws.cell(3, 4).string('Source').style({ font: { bold: true }, alignment: { horizontal: 'center' } })
  ws.cell(3, 5).string('Games').style({ font: { bold: true }, alignment: { horizontal: 'center' } })
  ws.cell(3, 6).string('Win %').style({ font: { bold: true }, alignment: { horizontal: 'center' } })
  ws.cell(3, 7).string('KDA').style({ font: { bold: true }, alignment: { horizontal: 'center' } })
  ws.cell(3, 8, 3, 10).string('Notes').style({ font: { bold: true }, alignment: { horizontal: 'center' } })
  ws.row(3).filter()
  ws.column(8).width = 20
  ws.column(9).width = 20
  ws.column(10).width = 20

  let currentRow = 4

  for (const row of heroData) {
    ws.cell(currentRow, 1).string(row.role).style({ fill: getFill(getRoleColor(row.role)) })
    ws.cell(currentRow, 2).string(row.hero)
    ws.cell(currentRow, 3).string(row.player).style({ fill: getFill(getRankColor(await getPlayerRank(`${row.player}#${row.tag}`))) })
    ws.cell(currentRow, 4).string(row.source).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 5).number(row.games).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 6).number(row.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(row.winRate))
    ws.cell(currentRow, 7).number(row.kda).style({ alignment: { horizontal: 'center' }, numberFormat: '0.0' })

    currentRow++
  }

  ws.column(1).width = 16
  ws.column(2).width = 15
  ws.column(3).width = 20
}

const fillWithAndAgainstSheet = (ws, ourTeamData, theirTeamData) => {
  ws.cell(1, 1, 1, 15, true)
    .string('With and Against')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })

  const heroCount = 15
  const firstUsRow = 4
  const firstThemRow = firstUsRow + heroCount + 2
  const minGames = 2

  ws.cell(firstUsRow - 1, 1, firstUsRow - 1, 7, true)
    .string('When We Pick')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  ws.cell(firstUsRow - 1, 9, firstUsRow - 1, 15, true)
    .string('When We Face')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  ws.cell(firstThemRow - 1, 1, firstThemRow - 1, 7, true)
    .string('When They Pick')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  ws.cell(firstThemRow - 1, 9, firstThemRow - 1, 15, true)
    .string('When They Face')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  const ourGoodPicks = take(orderBy(ourTeamData.picks.filter(p => p.count >= minGames && p.winRate >= 0.5), ['winRate', 'wins'], ['desc', 'desc']), heroCount)
  const ourBadPicks = take(orderBy(ourTeamData.picks.filter(p => p.count >= minGames && p.winRate <= 0.5), ['winRate', 'losses'], ['asc', 'desc']), heroCount)
  const ourOpponentGoodPicks = take(orderBy(ourTeamData.opponentPicks.filter(p => p.count >= minGames && p.winRate <= 0.5), ['winRate', 'losses'], ['asc', 'desc']), heroCount)
  const ourOpponentBadPicks = take(orderBy(ourTeamData.opponentPicks.filter(p => p.count >= minGames && p.winRate >= 0.5), ['winRate', 'wins'], ['desc', 'desc']), heroCount)

  let currentRow = firstUsRow

  for (const pick of ourGoodPicks) {
    ws.cell(currentRow, 1).string(pick.hero)
    ws.cell(currentRow, 2).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 3).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(pick.winRate))
    currentRow++
  }

  currentRow = firstUsRow

  for (const pick of ourBadPicks) {
    ws.cell(currentRow, 5).string(pick.hero)
    ws.cell(currentRow, 6).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 7).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getLossRateStyle(1 - pick.winRate))
    currentRow++
  }

  currentRow = firstUsRow

  for (const pick of ourOpponentGoodPicks) {
    ws.cell(currentRow, 9).string(pick.hero)
    ws.cell(currentRow, 10).string(`${pick.losses} - ${pick.wins}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 11).number(1 - pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(1 - pick.winRate))
    currentRow++
  }

  currentRow = firstUsRow

  for (const pick of ourOpponentBadPicks) {
    ws.cell(currentRow, 13).string(pick.hero)
    ws.cell(currentRow, 14).string(`${pick.losses} - ${pick.wins}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 15).number(1 - pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getLossRateStyle(pick.winRate))
    currentRow++
  }

  const theirGoodPicks = take(orderBy(theirTeamData.picks.filter(p => p.count >= minGames && p.winRate >= 0.5), ['winRate', 'wins'], ['desc', 'desc']), heroCount)
  const theirBadPicks = take(orderBy(theirTeamData.picks.filter(p => p.count >= minGames && p.winRate <= 0.5), ['winRate', 'losses'], ['asc', 'desc']), heroCount)
  const theirOpponentGoodPicks = take(orderBy(theirTeamData.opponentPicks.filter(p => p.count >= minGames && p.winRate <= 0.5), ['winRate', 'losses'], ['asc', 'desc']), heroCount)
  const theirOpponentBadPicks = take(orderBy(theirTeamData.opponentPicks.filter(p => p.count >= minGames && p.winRate >= 0.5), ['winRate', 'wins'], ['desc', 'desc']), heroCount)

  currentRow = firstThemRow

  for (const pick of theirGoodPicks) {
    ws.cell(currentRow, 1).string(pick.hero)
    ws.cell(currentRow, 2).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 3).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(pick.winRate))
    currentRow++
  }

  currentRow = firstThemRow

  for (const pick of theirBadPicks) {
    ws.cell(currentRow, 5).string(pick.hero)
    ws.cell(currentRow, 6).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 7).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getLossRateStyle(1 - pick.winRate))
    currentRow++
  }

  currentRow = firstThemRow

  for (const pick of theirOpponentGoodPicks) {
    ws.cell(currentRow, 9).string(pick.hero)
    ws.cell(currentRow, 10).string(`${pick.losses} - ${pick.wins}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 11).number(1 - pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(1 - pick.winRate))
    currentRow++
  }

  currentRow = firstThemRow

  for (const pick of theirOpponentBadPicks) {
    ws.cell(currentRow, 13).string(pick.hero)
    ws.cell(currentRow, 14).string(`${pick.losses} - ${pick.wins}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 15).number(1 - pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getLossRateStyle(pick.winRate))
    currentRow++
  }
}

const fillPicksSheet = (ws, picks) => {
  ws.cell(1, 1, 1, 4, true)
    .string('Draft Picks')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })

  ws.cell(3, 1).string('Hero').style({ font: { bold: true } })
  ws.cell(3, 2).string('Count').style({ alignment: { horizontal: 'center' }, font: { bold: true } })
  ws.cell(3, 3).string('Win Rate').style({ alignment: { horizontal: 'center' }, font: { bold: true } })
  ws.cell(3, 4).string('Avg Pick Round').style({ alignment: { horizontal: 'center' }, font: { bold: true } })

  const firstRow = 4
  let currentRow = firstRow

  for (const pick of picks) {
    ws.cell(currentRow, 1).string(pick.hero)
    ws.cell(currentRow, 2).number(pick.count).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 3).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(pick.winRate))
    ws.cell(currentRow, 4).number(pick.averagePickRound).style({ alignment: { horizontal: 'center' }, numberFormat: '0.00' })
    currentRow++
  }

  ws.column(1).width = 15
  ws.column(2).width = 15
  ws.column(3).width = 15
  ws.column(4).width = 19
  ws.row(3).filter()
}

const fillBansSheet = (ws, title, bans) => {
  ws.cell(1, 1, 1, 3, true)
    .string(title)
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })

  ws.cell(3, 1).string('Hero').style({ font: { bold: true } })
  ws.cell(3, 2).string('Count').style({ alignment: { horizontal: 'center' }, font: { bold: true } })
  ws.cell(3, 3).string('Avg Ban Round').style({ alignment: { horizontal: 'center' }, font: { bold: true } })

  const firstRow = 4
  let currentRow = firstRow

  for (const ban of bans) {
    ws.cell(currentRow, 1).string(ban.hero)
    ws.cell(currentRow, 2).number(ban.count).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 3).number(ban.averageBanRound).style({ alignment: { horizontal: 'center' }, numberFormat: '0.00' })
    currentRow++
  }

  ws.column(1).width = 15
  ws.column(2).width = 15
  ws.column(3).width = 18
  ws.row(3).filter()
}

const fillMatchHistorySheet = async (ws, matches) => {
  const players = []

  for (const match of matches) {
    for (const game of match.games) {
      for (const player of game.team.players) {
        let foundPlayer = players.find(p => p.name === player.name)

        if (!foundPlayer) {
          foundPlayer = { name: player.name, tag: player.tag, count: 0 }
          players.push(foundPlayer)
        }

        foundPlayer.count++
      }
    }
  }

  const sortedPlayers = orderBy(players, ['count', 'name'], ['desc', 'asc'])
  const playerCount = sortedPlayers.length

  ws.cell(1, 1, 1, 18 + sortedPlayers.length, true).string('Match History').style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })
  ws.cell(4, 3).string('Blue = Map Pick')

  for (let playerIndex = 0; playerIndex < sortedPlayers.length; playerIndex++) {
    const rankInfo = await getPlayerRank(`${sortedPlayers[playerIndex].name}#${sortedPlayers[playerIndex].tag}`)

    if (rankInfo.metal && rankInfo.metal !== 'Unranked') {
      ws.cell(3, 5 + playerIndex).string(`${rankInfo.metal} ${rankInfo.division}`).style({ alignment: { horizontal: 'center' }, fill: getFill(getRankColor(rankInfo)) })
    }

    ws.cell(4, 5 + playerIndex).string(sortedPlayers[playerIndex].name).style({ alignment: { horizontal: 'center' }, font: { bold: true } })
  }

  ws.cell(4, 6 + playerCount, 4, 8 + playerCount, true).string('Bans').style({ alignment: { horizontal: 'center' }, fill: getFill(colors.ban) })
  ws.cell(4, 10 + playerCount, 4, 14 + playerCount, true).string('Picks In Order').style({ alignment: { horizontal: 'center' }, fill: getFill(colors.pick) })
  ws.cell(4, 16 + playerCount, 4, 18 + playerCount, true).string('Banned By Opponent').style({ alignment: { horizontal: 'center' }, fill: getFill(colors.opponentBan) })

  ws.cell(5, 3).string('Map').style({ font: { bold: true } })

  let currentRow = 6

  for (const match of matches) {
    ws.cell(currentRow, 1).string(match.opponent)
    ws.cell(currentRow, 2).string(match.date).style({ alignment: { horizontal: 'center' } })

    for (const game of match.games) {
      ws.cell(currentRow, 3).string(game.map)

      if (game.pickedMap) {
        ws.cell(currentRow, 3).style({ fill: getFill(colors.pickedMap) })
      }

      for (let playerIndex = 0; playerIndex < sortedPlayers.length; playerIndex++) {
        const player = sortedPlayers[playerIndex]
        const foundPlayer = game.team.players.find(p => p.name === player.name)

        if (foundPlayer) {
          ws.cell(currentRow, 5 + playerIndex).string(foundPlayer.hero).style({ alignment: { horizontal: 'center' } })
        }

        ws.cell(currentRow, 5 + playerIndex)
          .style({ fill: getFill(game.isWin ? colors.wonGame : colors.lostGame) })
      }

      for (let banIndex = 0; banIndex < game.team.bans.length; banIndex++) {
        ws.cell(currentRow, 6 + playerCount + banIndex)
          .string(game.team.bans[banIndex].hero)
          .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.ban) })
      }

      for (let pickIndex = 0; pickIndex < game.team.players.length; pickIndex++) {
        ws.cell(currentRow, 10 + playerCount + pickIndex)
          .string(game.team.players[pickIndex].hero)
          .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.pick) })
      }

      for (let banAgainstIndex = 0; banAgainstIndex < game.otherTeam.bans.length; banAgainstIndex++) {
        ws.cell(currentRow, 16 + playerCount + banAgainstIndex)
          .string(game.otherTeam.bans[banAgainstIndex].hero)
          .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.opponentBan) })
      }

      currentRow++
    }

    currentRow++
  }

  ws.column(1).width = 18
  ws.column(2).width = 12
  ws.column(3).width = 22
  ws.column(4).width = 2
  ws.column(5 + playerCount).width = 2
  ws.column(9 + playerCount).width = 2
  ws.column(15 + playerCount).width = 2

  for (let playerCol = 5; playerCol <= 5; playerCol++) {
    ws.column(playerCol).width = 13
  }

  for (let banCol = 6 + playerCount; banCol <= 8 + playerCount; banCol++) {
    ws.column(banCol).width = 11
  }

  for (let pickCol = 10 + playerCount; pickCol <= 14 + playerCount; pickCol++) {
    ws.column(pickCol).width = 11
  }

  for (let opponentBanCol = 16 + playerCount; opponentBanCol <= 18 + playerCount; opponentBanCol++) {
    ws.column(opponentBanCol).width = 11
  }

  // Add filter to map column
  ws.row(5).filter({
    firstRow: 5,
    firstColumn: 3,
    lastRow: currentRow - 1,
    lastColumn: 3
  })
}

const generateWorkbook = async (ourTeamData, theirTeamData, startSeason) => {
  const wb = new xl.Workbook()
  const mapSheet = wb.addWorksheet('Maps')
  const heroesThisSeasonSheet = wb.addWorksheet('Hero Win Rates - This Season')
  const heroesAllTimeSheet = wb.addWorksheet('Hero Win Rates - All Time')
  const withAndAgainstSheet = wb.addWorksheet('With And Against')
  const picksSheet = wb.addWorksheet('Draft Picks')
  const bansSheet = wb.addWorksheet('Bans')
  const bansAgainstSheet = wb.addWorksheet('Banned By Opponent')
  const matchHistorySheet = wb.addWorksheet('Match History')
  wb.addWorksheet('Notes')

  const heroesThisSeason = await getHeroWinRatesData(theirTeamData.name, startSeason, currentSeason, false)
  const heroesAllTime = await getHeroWinRatesData(theirTeamData.name, 1, currentSeason, true)

  fillMapSheet(mapSheet, ourTeamData.maps, theirTeamData.maps)
  await fillHeroesSheet(heroesThisSeasonSheet, heroesThisSeason, 'Hero Win Rates - This Season')
  await fillHeroesSheet(heroesAllTimeSheet, heroesAllTime, 'Hero Win Rates - All Time')
  fillWithAndAgainstSheet(withAndAgainstSheet, ourTeamData, theirTeamData)
  fillPicksSheet(picksSheet, orderBy(theirTeamData.picks, p => 0 - p.count))
  fillBansSheet(bansSheet, 'Bans', orderBy(theirTeamData.bans, b => 0 - b.count))
  fillBansSheet(bansAgainstSheet, 'Banned By Opponent', orderBy(theirTeamData.opponentBans, b => 0 - b.count))
  await fillMatchHistorySheet(matchHistorySheet, orderBy(theirTeamData.currentSeasonMatches, ['date'], ['desc']))

  return await wb.writeToBuffer()
}

module.exports = async (ourTeam, theirTeam, startSeason, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const sqlImportFilesystem = datalake.getFileSystemClient(sqlImportContainerName)
  const teamsContainer = await getCosmos(teamsContainerName, true)

  const ourTeamData = await getTeamData(teamsContainer, sqlImportFilesystem, ourTeam, startSeason, currentSeason, log)
  const theirTeamData = await getTeamData(teamsContainer, sqlImportFilesystem, theirTeam, startSeason, currentSeason, log)

  const xlsx = await generateWorkbook(ourTeamData, theirTeamData, startSeason)
  fs.writeFileSync(`${ourTeam.replace(/[^a-zA-Z0-9]/g, '')}-vs-${theirTeam.replace(/[^a-zA-Z0-9]/g, '')}-${moment().format('YYYY-MM-DD')}.xlsx`, xlsx)
}
