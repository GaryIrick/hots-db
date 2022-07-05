// Parts of this were taken from ReplayServerBattlelobby.cs in Heroes.ReplayParser, available here:
//
// https://github.com/barrett777/Heroes.ReplayParser

const { uniq, keys, orderBy } = require('lodash')
const { MPQArchive } = require('empeeku/mpyq')
const crypto = require('crypto')
const parser = require('hots-parser')

class BitReader {
  constructor (stream) {
    this.stream = stream
    this.cursor = 0
    this.currentByte = 0
    this.bytesRead = 0
  }

  read (numBits) {
    let value = 0

    while (numBits > 0) {
      const bytePos = this.cursor & 7
      const bitsLeftInByte = 8 - bytePos

      if (bytePos === 0) {
        this.currentByte = this.stream[this.bytesRead++]
      }

      const bitsToRead = (bitsLeftInByte > numBits) ? numBits : bitsLeftInByte
      value = (value << bitsToRead) | (this.currentByte >> bytePos) & ((1 << bitsToRead) - 1)
      this.cursor += bitsToRead
      numBits -= bitsToRead
    }

    return value
  }

  readBytes (numBytes) {
    const bytes = []

    for (let i = 0; i < numBytes; i++) {
      bytes.push(this.read(8))
    }

    return bytes
  }

  readBlobPrecededWithLength (numBitsForLength) {
    const stringLength = this.read(numBitsForLength)
    this.alignToByte()
    return this.readBytes(stringLength)
  }

  readString (length) {
    const buffer = Buffer.from(this.readBytes(length))
    // Convert the buffer to a string
    return buffer.toString('utf8')
  }

  readBoolean () {
    return this.read(1) === 1
  }

  readBitArray (numBits) {
    const array = []

    for (let i = 0; i < numBits; i++) {
      array.push(this.readBoolean())
    }

    return array
  }

  alignToByte () {
    if ((this.cursor & 7) > 0) {
      this.cursor = (this.cursor & 0x7ffffff8) + 8
    }
  }
}

const getPartyMap = (lobby, build) => {
  const bitReader = new BitReader(lobby)

  let i
  const dependenciesLength = bitReader.read(6)

  for (i = 0; i < dependenciesLength; i++) {
    bitReader.readBlobPrecededWithLength(10)
  }

  const s2maCacheHandlesLength = bitReader.read(6)

  for (i = 0; i < s2maCacheHandlesLength; i++) {
    bitReader.alignToByte()
    const firstFour = bitReader.readString(4)

    if (firstFour !== 's2ma') {
      throw new Error(`expected s2ma, got ${firstFour}`)
    }

    bitReader.readBytes(36)
  }

  bitReader.alignToByte()

  for (;;) {
    // Keep going until we find the first "s2mh".
    if (bitReader.readString(4) === 's2mh') {
      bitReader.bytesRead -= 4
      break
    } else {
      bitReader.bytesRead -= 3
    }
  }

  for (i = 0; i < s2maCacheHandlesLength; i++) {
    bitReader.alignToByte()

    const firstFour = bitReader.readString(4)

    if (firstFour !== 's2mh') {
      throw new Error(`expected s2mh, got ${firstFour}`)
    }

    bitReader.readBytes(36)
  }

  const collectionSize = build >= 48027 ? bitReader.read(16) : bitReader.read(32)

  if (collectionSize > 8000) {
    throw new Error('collectionSize is too big')
  }

  const playerCollection = []

  for (i = 0; i < collectionSize; i++) {
    if (build >= 55929) {
      bitReader.readBytes(8)
    } else {
      playerCollection.push(bitReader.readString(bitReader.readByte()))
    }
  }

  if (bitReader.read(32) !== collectionSize) {
    throw new Error('skinArrayLength not equal to collectionSize')
  }

  for (i = 0; i < collectionSize; i++) {
    for (let j = 0; j < 16; j++) {
      bitReader.read(8)
      bitReader.read(8)
    }
  }

  if (build >= 85027) {
    bitReader.read(8)
  }

  bitReader.read(32)
  bitReader.readBytes(4)
  const playerListLength = bitReader.read(5)

  const partyPlayers = []

  for (i = 0; i < playerListLength; i++) {
    bitReader.read(32)
    bitReader.read(5)
    bitReader.read(8)
    bitReader.read(32)
    bitReader.read(32)
    bitReader.read(64)
    bitReader.read(8)
    bitReader.read(32)
    bitReader.read(32)
    const idLength = bitReader.read(7) + 2
    bitReader.alignToByte()
    bitReader.readString(idLength)
    let partyValue
    bitReader.read(6)

    if (build <= 47479) {
      bitReader.read(8)
      bitReader.read(32)
      bitReader.readString(idLength)
    }

    bitReader.read(2)
    bitReader.readBytes(25)
    bitReader.read(24)

    // Co-op games would have an additional 8 bits to read here, but we never parse those

    bitReader.read(7)

    if (!bitReader.readBoolean()) {
      if (build >= 51609 || build === 47903 || build === 47479) {
        bitReader.readBitArray(bitReader.read(12))
      } else if (build > 47219) {
        bitReader.readBytes(bitReader.read(15) * 2)
      } else {
        bitReader.readBitArray(bitReader.read(9))
      }
    }

    bitReader.readBoolean()

    if (build > 61718) {
      bitReader.readBoolean()
      bitReader.readBoolean()
    }

    if (build > 66977) {
      bitReader.readBoolean()
    }

    if (bitReader.readBoolean()) {
      partyValue = bitReader.read(32) + bitReader.read(32)
    }

    bitReader.readBoolean()

    const battleTag = Buffer.from(bitReader.readBlobPrecededWithLength(7)).toString('utf8')

    if (build >= 52860) {
      bitReader.read(32)
    }

    if (build >= 69947) {
      bitReader.readBoolean()
    }

    if (partyValue) {
      partyPlayers.push({ battleTag, partyValue })
    }
  }

  const partyValues = uniq(partyPlayers.map(p => p.partyValue))
  const partyMap = {}

  partyPlayers.forEach(player => {
    partyMap[player.battleTag] = partyValues.indexOf(player.partyValue) + 1
  })

  return partyMap
}

module.exports = (replayPath, parse) => {
  // We could add this to hots-parser so we don't read the file multiple times, but it happens very quickly.
  // I also don't want to take on the maintenance effort of keeping hots-parser up to date if this changes
  // since parsing the party information is not part of the Blizzard-provided protocol files.
  const archive = new MPQArchive(replayPath)
  const lobby = archive.readFile('replay.server.battlelobby')

  if (lobby) {
    // At least one replay was found without the battlelobby, so skip it if it's missing.
    const partyMap = getPartyMap(lobby, parse.match.version.m_build)

    for (const playerId of keys(parse.players)) {
      const player = parse.players[playerId]
      parse.players[playerId].party = partyMap[`${player.name}#${player.tag}`]
    }
  }

  // Storing this here means we don't have to do something silly like rely on the blob path,
  // which would be different for NGS and HeroesProfile data.
  const { initdata } = parser.parse(replayPath, ['initdata'])
  let hashValue = ''

  for (const playerId of orderBy(keys(parse.players).map(p => Number(p.split('-')[3])), id => id)) {
    hashValue += playerId
  }

  hashValue += `${initdata.m_syncLobbyState.m_gameDescription.m_randomValue}`
  const md5 = crypto.createHash('md5').update(hashValue).digest('hex')
  const byteOrder = [3, 2, 1, 0, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15]
  let fingerprint = ''

  // Not sure why we swap the bytes around, but this matches what Heroes Profile does.
  for (const index of byteOrder) {
    fingerprint += md5.slice(index * 2, (index * 2) + 2)
  }

  parse.fingerprint = fingerprint
}
