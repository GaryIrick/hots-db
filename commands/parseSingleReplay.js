const parseSingleReplay = require('../src/parseSingleReplay')

const run = async (filename) => {
  const status = await parseSingleReplay(filename, console.log)
  console.log(`Status=${status}`)
}

if (process.argv.length !== 3) {
  console.log('Usage: parseSingleReplay <filename>')
  process.exit(1)
}

run(process.argv[2])
