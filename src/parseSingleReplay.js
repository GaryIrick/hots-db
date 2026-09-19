const fs = require('fs')
const parser = require('hots-parser')
const addAdditionalParseInfo = require('./lib/addAdditionalParseInfo')

module.exports = async (filename, log) => {
  const parse = parser.processReplay(filename, { getBMData: true, overrideVerifiedBuild: true })

  if (parse.status === 1) {
    addAdditionalParseInfo(filename, parse)
    fs.writeFileSync(`${filename}.json`, JSON.stringify(parse, null, 2))
  }

  return parse.status
}
