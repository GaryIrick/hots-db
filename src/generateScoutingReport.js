const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { mean, orderBy } = require('lodash')
const { combinations } = require('combinatorial-generators')
const getCosmos = require('./db/getCosmos')
const getCompressedJson = require('./lib/getCompressedJson')
const changeExtension = require('./lib/changeExtension')
const { azure: { cosmos: { teamsContainer }, storage: { account, sqlImportContainer } } } = require('./config')

const getTeamData = async (container, id) => {
  const query = container.item(id, id)
  const result = await query.read()
  return result.resource
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

const addCombos = (combos, heroes, size, isWin) => {
  for (const possibleCombo of combinations(heroes, size)) {
    const heroList = orderBy(possibleCombo).join(' + ')

    let combo = combos.find(h => h.heroList === heroList)

    if (!combo) {
      combo = { heroList, count: 0, wins: [] }
      combos.push(combo)
    }

    combo.count++
    combo.wins.push(isWin ? 1 : 0)
  }
}

const showCombos = (size, combos, log) => {
  for (const combo of orderBy(combos, ['winRate', 'count'], ['desc', 'desc']).filter(c => c.count > 1)) {
    log(`${size},${combo.heroList},${combo.count},${combo.winRate},`)
  }
}

module.exports = async (ngsTeamId, startSeason, endSeason, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const sqlImportFilesystem = datalake.getFileSystemClient(sqlImportContainer)
  const container = await getCosmos(teamsContainer, true)
  const teamData = await getTeamData(container, ngsTeamId)

  log(`Team: ${teamData.name}`)

  const heroes = []
  const bans = []
  const duos = []
  const trios = []
  const quartets = []
  const quintets = []
  const maps = []

  for (const season of teamData.seasons.filter(s => s.season >= startSeason && s.season <= endSeason)) {
    for (const match of season.matches) {
      for (const game of match.games) {
        const importPath = getSqlImportPath(season.season, game)
        const json = await getCompressedJson(sqlImportFilesystem, importPath)
        const team = pickTeam(json, game.isWin)

        let map = maps.find(m => m.name === game.map)

        if (!map) {
          map = { name: game.map, wins: 0, losses: 0, picks: 0 }
          maps.push(map)
        }

        if (game.isWin) {
          console.log('WIN on ' + game.map)
          map.wins++
        } else {
          console.log('LOSS on ' + game.map)
          map.losses++
        }

        if (team.teamNumber === json.firstPickTeam) {
          console.log('PICK on ' + game.map)
          map.picks++
        }

        const heroesThisGame = []

        for (const player of team.players) {
          if (!teamData.players.includes(`${player.name}#${player.tag}`)) {
            // This player is not on the active roster, skip it.
            continue
          }

          heroesThisGame.push(player.hero)

          let hero = heroes.find(h => h.hero === player.hero)

          if (!hero) {
            hero = { hero: player.hero, count: 0, rounds: [], wins: [] }
            heroes.push(hero)
          }

          hero.count++
          hero.rounds.push(player.round)
          hero.wins.push(game.isWin ? 1 : 0)
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

        const heroNames = team.players.map(p => p.hero)

        addCombos(duos, heroNames, 2, game.isWin)
        addCombos(trios, heroNames, 3, game.isWin)
        addCombos(quartets, heroNames, 4, game.isWin)
        addCombos(quintets, heroNames, 5, game.isWin)
      }
    }
  }

  for (const hero of heroes) {
    hero.winRate = mean(hero.wins)
    hero.averagePickRound = mean(hero.rounds)
  }

  for (const ban of bans) {
    ban.averagePickRound = mean(ban.rounds)
  }

  for (const combo of duos.concat(trios).concat(quartets).concat(quintets)) {
    combo.winRate = mean(combo.wins)
  }

  log('\nHEROES\n')

  for (const hero of orderBy(heroes, ['winRate'], ['desc'])) {
    log(`${hero.hero},${hero.count},${hero.winRate},${hero.averagePickRound}`)
  }

  log('\nBANS\n')

  for (const ban of orderBy(bans, ['winRate'], ['desc'])) {
    log(`${ban.hero},${ban.count},${ban.averagePickRound}`)
  }

  log('\nCOMBOS\n')

  showCombos(2, duos, log)
  showCombos(3, trios, log)
  showCombos(4, quartets, log)
  showCombos(5, quintets, log)

  log('\nMAPS\n')

  for (const map of maps) {
    log(`${map.name},${map.wins},${map.losses},${map.picks}`)
  }
}
