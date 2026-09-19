const fs = require('fs')
const getFromHeroesProfile = require('./apis/getFromHeroesProfile')

// Rewrite the CSV every so often so a crash doesn't lose everything.
const pagesPerSave = 100

const writeCsv = (filename, counts) => {
  const rows = Object.values(counts).sort((a, b) =>
    a.date.localeCompare(b.date) || a.gameType.localeCompare(b.gameType))
  const lines = ['Date,GameType,Count,LowestReplayId']

  for (const { date, gameType, count, lowestReplayId } of rows) {
    lines.push(`${date},"${gameType}",${count},${lowestReplayId}`)
  }

  fs.writeFileSync(filename, lines.join('\n') + '\n')
}

module.exports = async (startAfter, filename, log) => {
  // Keyed by `${date}|${gameType}`.
  const counts = {}
  let after = startAfter
  let total = 0
  let pages = 0

  while (true) {
    const { replays, next_after: nextAfter, max_replay_id: maxReplayId } = await getFromHeroesProfile('replays', { after })

    if (!replays || replays.length === 0) {
      break
    }

    for (const replay of replays) {
      const date = (replay.game_date || '').substring(0, 10)
      const gameType = replay.game_type
      const key = `${date}|${gameType}`
      const entry = counts[key] || (counts[key] = { date, gameType, count: 0, lowestReplayId: replay.replayID })

      entry.count++
      entry.lowestReplayId = Math.min(entry.lowestReplayId, replay.replayID)
    }

    total += replays.length
    after = nextAfter || replays[replays.length - 1].replayID
    log(`counted ${total} replays, up to ${after} of ${maxReplayId}`)

    if (++pages % pagesPerSave === 0) {
      writeCsv(filename, counts)
    }
  }

  writeCsv(filename, counts)

  return total
}
