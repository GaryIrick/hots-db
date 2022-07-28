const { parentPort } = require('worker_threads')
const parser = require('hots-parser')
const addAdditionalParseInfo = require('./addAdditionalParseInfo')

const work = ({ id, args: { replayFile } }) => {
  const parse = parser.processReplay(replayFile, { getBMData: false, overrideVerifiedBuild: true })

  if (parse.status === 1) {
    addAdditionalParseInfo(replayFile, parse)
    // This is noise, just remove it.
    delete parse.filename
  }

  parentPort.postMessage({ id, result: parse })
}

parentPort.on('message', (msg) => {
  work(msg)
})
