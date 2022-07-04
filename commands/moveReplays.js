const moveReplays = require('../src/moveReplays')

const run = async () => {
  await moveReplays(console.log)
}

run()
