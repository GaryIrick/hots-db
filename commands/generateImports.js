const generateImports = require('../src/generateImports')

const run = async (maxCount) => {
  const count = await generateImports(maxCount, console.log)
  console.log(`Processed ${count} replays.`)
}

if (process.argv.length !== 3) {
  console.log('Usage: generateImports <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
