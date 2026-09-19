const fs = require('fs')
const getFromHeroesProfile = require('./apis/getFromHeroesProfile')

// Pick up where a previous run left off.  The highest replay ID in the file is the last one counted.
const readCsv = (filename) => {
  const counts = {}

  if (!fs.existsSync(filename)) {
    return counts
  }

  const lines = fs.readFileSync(filename, 'utf8').split('\n').slice(1)

  for (const line of lines) {
    const match = line.match(/^([^,]*),"(.*)",(\d+),(\d+)$/)

    if (match) {
      const [, date, gameType, count, highestReplayId] = match
      counts[`${date}|${gameType}`] = { date, gameType, count: Number(count), highestReplayId: Number(highestReplayId) }
    }
  }

  return counts
}

const writeCsv = (filename, counts) => {
  const rows = Object.values(counts).sort((a, b) =>
    a.date.localeCompare(b.date) || a.gameType.localeCompare(b.gameType))
  const lines = ['Date,GameType,Count,HighestReplayId']

  for (const { date, gameType, count, highestReplayId } of rows) {
    lines.push(`${date},"${gameType}",${count},${highestReplayId}`)
  }

  // Write to a temp file and rename, so stopping mid-write can't leave a partial CSV.
  const tempFilename = `${filename}.tmp`
  fs.writeFileSync(tempFilename, lines.join('\n') + '\n')
  fs.renameSync(tempFilename, filename)
}

module.exports = async (filename, log) => {
  // Keyed by `${date}|${gameType}`.
  const counts = readCsv(filename)
  let after = Math.max(0, ...Object.values(counts).map(c => c.highestReplayId))
  let total = 0

  log(`starting after replay ${after}`)

  while (true) {
    const { replays, next_after: nextAfter, max_replay_id: maxReplayId } = await getFromHeroesProfile('replays', { after })

    if (!replays || replays.length === 0) {
      break
    }

    for (const replay of replays) {
      const date = (replay.game_date || '').substring(0, 10)
      const gameType = replay.game_type
      const key = `${date}|${gameType}`
      const entry = counts[key] || (counts[key] = { date, gameType, count: 0, highestReplayId: replay.replayID })

      entry.count++
      entry.highestReplayId = Math.max(entry.highestReplayId, replay.replayID)
    }

    total += replays.length
    after = nextAfter || replays[replays.length - 1].replayID
    log(`counted ${total} replays, up to ${after} of ${maxReplayId}`)

    writeCsv(filename, counts)
  }

  return total
}
