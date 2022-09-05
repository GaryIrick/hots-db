const fs = require('fs')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { mean, orderBy, take } = require('lodash')
const { combinations } = require('combinatorial-generators')
const xl = require('excel4node')
const chroma = require('chroma-js')
const getCosmos = require('./db/getCosmos')
const getCompressedJson = require('./lib/getCompressedJson')
const changeExtension = require('./lib/changeExtension')
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
  subHeader: '#D9E1F2'
}

const getTeamByName = async (container, teamName) => {
  const query = container.items.query(`SELECT * FROM t WHERE t.name = '${teamName}'`)
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
  return `processed/ngs/season-${season}/${changeExtension(game.replayKey, 'import.json.gz')}`
}

const addCombos = (combos, picks, size, isWin) => {
  for (const possibleCombo of combinations(picks, size)) {
    const heroList = orderBy(possibleCombo).join(' + ')

    let combo = combos.find(h => h.heroList === heroList)

    if (!combo) {
      combo = { heroList, count: 0, isWin: [] }
      combos.push(combo)
    }

    combo.count++
    combo.isWin.push(isWin ? 1 : 0)
  }
}

const getTeamData = async (teamsContainer, sqlImportFilesystem, teamName, startSeason, endSeason, log) => {
  const teamData = await getTeamByName(teamsContainer, teamName)

  const picks = []
  const opponentPicks = []
  const bans = []
  const duos = []
  const trios = []
  const quartets = []
  const quintets = []
  const maps = []
  const opponentBans = []

  for (const season of teamData.seasons.filter(s => s.season >= startSeason && s.season <= endSeason)) {
    for (const match of season.matches) {
      for (const game of match.games) {
        const importPath = getSqlImportPath(season.season, game)
        let json
        try {
          json = await getCompressedJson(sqlImportFilesystem, importPath)
        } catch (e) {
          log(`MISSING GAME for ${teamName}: ${importPath}`)
          // This game is missing, just ignore it.
          continue
        }
        const team = pickTeam(json, game.isWin)
        const otherTeam = pickTeam(json, !game.isWin)

        let map = maps.find(m => m.name === game.map)

        if (!map) {
          map = { name: game.map, wins: 0, losses: 0, picks: 0 }
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
          console.log(`${teamName},${hero.hero},${game.isWin ? 'WIN' : 'LOSS'}`)
        }

        for (const player of otherTeam.players) {
          let hero = opponentPicks.find(h => h.hero === player.hero)

          if (!hero) {
            hero = { hero: player.hero, count: 0, rounds: [], isWin: [] }
            opponentPicks.push(hero)
          }

          hero.count++
          hero.rounds.push(player.round)
          hero.isWin.push(game.isWin ? 1 : 0)
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

        const heroNames = team.players.map(p => p.hero)

        addCombos(duos, heroNames, 2, game.isWin)
        addCombos(trios, heroNames, 3, game.isWin)
        addCombos(quartets, heroNames, 4, game.isWin)
        addCombos(quintets, heroNames, 5, game.isWin)
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

  for (const combo of duos.concat(trios).concat(quartets).concat(quintets)) {
    combo.winRate = mean(combo.isWin)
  }

  return {
    name: teamName,
    maps,
    picks,
    opponentPicks,
    bans,
    opponentBans,
    combos: duos.concat(trios).concat(quartets).concat(quintets)
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

const fillMapSheet = (ws, ourMaps, theirMaps) => {
  const firstMapRow = 5
  let mapRow = firstMapRow
  let lastMapRow = firstMapRow

  for (const mapName of currentMapPool) {
    ws.cell(mapRow, 1).string(mapName)
    const ourMap = ourMaps.find(m => m.name === mapName)
    const theirMap = theirMaps.find(m => m.name === mapName)

    if (ourMap) {
      const winRate = ourMap.wins / (ourMap.wins + ourMap.losses)
      ws.cell(mapRow, 2).string(`${ourMap.wins} - ${ourMap.losses}`)
      ws.cell(mapRow, 3).number(winRate).style(getWinRateStyle(winRate))

      if (ourMap.picks > 0) {
        ws.cell(mapRow, 4).number(ourMap.picks)
      }
    }

    if (theirMap) {
      const winRate = theirMap.wins / (theirMap.wins + theirMap.losses)
      ws.cell(mapRow, 6).string(`${theirMap.wins} - ${theirMap.losses}`)
      ws.cell(mapRow, 7).number(winRate).style(getWinRateStyle(winRate))

      if (theirMap.picks > 0) {
        ws.cell(mapRow, 8).number(theirMap.picks)
      }
    }

    lastMapRow = mapRow
    mapRow++
  }

  ws.column(1).width = 30
  ws.column(5).width = 5
  ws.cell(firstMapRow, 2, lastMapRow, 8).style({ alignment: { horizontal: 'center' } })
  ws.cell(firstMapRow, 3, lastMapRow, 3).style({ numberFormat: '#%; -#%; 0%' })
  ws.cell(firstMapRow, 7, lastMapRow, 7).style({ numberFormat: '#%; -#%; 0%' })

  ws.cell(1, 1, 1, 8, true)
    .string('Maps')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })
  ws.cell(3, 2, 3, 4, true)
    .string('Us')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(3, 6, 3, 8, true)
    .string('Them')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(4, 2)
    .string('Record')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 3)
    .string('Win %')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 4)
    .string('Picked')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 6)
    .string('Record')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 7)
    .string('Win %')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
  ws.cell(4, 8)
    .string('Picked')
    .style({ alignment: { horizontal: 'center' }, fill: getFill(colors.subHeader) })
}

const fillForAndAgainstSheet = (ws, ourTeamData, theirTeamData) => {
  ws.cell(1, 1, 1, 15, true)
    .string('For and Against')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.topHeader) })

  const heroCount = 10
  const firstUsRow = 4
  const firstThemRow = firstUsRow + heroCount + 2
  const minGames = 2

  ws.cell(firstUsRow - 1, 1, firstUsRow - 1, 3, true)
    .string('For Us - Good')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(firstUsRow - 1, 5, firstUsRow - 1, 7, true)
    .string('For Us - Bad')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  ws.cell(firstUsRow - 1, 9, firstUsRow - 1, 11, true)
    .string('Against Us - Good')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(firstUsRow - 1, 13, firstUsRow - 1, 15, true)
    .string('Against Us - Bad')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  ws.cell(firstThemRow - 1, 1, firstThemRow - 1, 3, true)
    .string('For Them - Good')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(firstThemRow - 1, 5, firstThemRow - 1, 7, true)
    .string('For Them - Bad')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  ws.cell(firstThemRow - 1, 9, firstThemRow - 1, 11, true)
    .string('Against Them - Good')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })
  ws.cell(firstThemRow - 1, 13, firstThemRow - 1, 15, true)
    .string('Against Them - Bad')
    .style({ alignment: { horizontal: 'center' }, font: { bold: true }, fill: getFill(colors.subHeader) })

  const ourGoodPicks = take(orderBy(ourTeamData.picks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['desc', 'desc']), heroCount)
  const ourBadPicks = take(orderBy(ourTeamData.picks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['asc', 'asc']), heroCount)
  const ourOpponentGoodPicks = take(orderBy(ourTeamData.opponentPicks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['asc', 'asc']), heroCount)
  const ourOpponentBadPicks = take(orderBy(ourTeamData.opponentPicks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['desc', 'desc']), heroCount)

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
    ws.cell(currentRow, 10).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 11).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(1 - pick.winRate))
    currentRow++
  }

  currentRow = firstUsRow

  for (const pick of ourOpponentBadPicks) {
    ws.cell(currentRow, 13).string(pick.hero)
    ws.cell(currentRow, 14).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 15).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getLossRateStyle(pick.winRate))
    currentRow++
  }

  const theirGoodPicks = take(orderBy(theirTeamData.picks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['desc', 'desc']), heroCount)
  const theirBadPicks = take(orderBy(theirTeamData.picks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['asc', 'asc']), heroCount)
  const theirOpponentGoodPicks = take(orderBy(theirTeamData.opponentPicks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['asc', 'asc']), heroCount)
  const theirOpponentBadPicks = take(orderBy(theirTeamData.opponentPicks.filter(p => p.count >= minGames), ['winRate', 'wins'], ['desc', 'desc']), heroCount)

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
    ws.cell(currentRow, 10).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 11).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getWinRateStyle(1 - pick.winRate))
    currentRow++
  }

  currentRow = firstThemRow

  for (const pick of theirOpponentBadPicks) {
    ws.cell(currentRow, 13).string(pick.hero)
    ws.cell(currentRow, 14).string(`${pick.wins} - ${pick.losses}`).style({ alignment: { horizontal: 'center' } })
    ws.cell(currentRow, 15).number(pick.winRate).style({ alignment: { horizontal: 'center' }, numberFormat: '#%; -#%; 0%' }).style(getLossRateStyle(pick.winRate))
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

const generateWorkbook = async (ourTeamData, theirTeamData) => {
  const wb = new xl.Workbook()
  const mapSheet = wb.addWorksheet('Maps')
  const forAndAgainstSheet = wb.addWorksheet('For And Against')
  const picksSheet = wb.addWorksheet('Draft Picks')
  const bansSheet = wb.addWorksheet('Bans')
  const bansAgainstSheet = wb.addWorksheet('Bans Against')

  fillMapSheet(mapSheet, ourTeamData.maps, theirTeamData.maps)
  fillForAndAgainstSheet(forAndAgainstSheet, ourTeamData, theirTeamData)
  fillPicksSheet(picksSheet, orderBy(theirTeamData.picks, p => 0 - p.count))
  fillBansSheet(bansSheet, 'Bans', orderBy(theirTeamData.bans, b => 0 - b.count))
  fillBansSheet(bansAgainstSheet, 'Opponent Bans', orderBy(theirTeamData.opponentBans, b => 0 - b.count))

  return await wb.writeToBuffer()
}

module.exports = async (ourTeam, theirTeam, startSeason, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const sqlImportFilesystem = datalake.getFileSystemClient(sqlImportContainerName)
  const teamsContainer = await getCosmos(teamsContainerName, true)

  const ourTeamData = await getTeamData(teamsContainer, sqlImportFilesystem, ourTeam, startSeason, currentSeason, log)
  const theirTeamData = await getTeamData(teamsContainer, sqlImportFilesystem, theirTeam, startSeason, currentSeason, log)

  const xlsx = await generateWorkbook(ourTeamData, theirTeamData)
  fs.writeFileSync(`${ourTeam.replace(/ /g, '')}-vs-${theirTeam.replace(/ /g, '')}.xlsx`, xlsx)
}
