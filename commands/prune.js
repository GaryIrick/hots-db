const prune = require('../src/prune')

const run = async () => {
  await prune(console.log)
}

run().then(() => console.log('Done.'))
