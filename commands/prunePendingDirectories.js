const prunePendingDirectories = require('../src/prunePendingDirectories')

const run = async () => {
  await prunePendingDirectories(console.log)
}

run().then(() => console.log('Done.'))
