const pruneDirectories = require('../src/pruneDirectories')

const run = async () => {
  await pruneDirectories()
}

run().then(() => console.log('Done.'))
