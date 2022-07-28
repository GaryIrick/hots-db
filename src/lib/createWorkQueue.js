const uuid = require('uuid').v4

module.exports = (size, fn) => {
  const queued = []
  let running = []

  const kickOff = (args) => {
    const id = uuid()
    const promise = fn(args)
    promise.id = id
    promise.then(() => {
      running = running.filter(r => r.id !== id)

      // If we just finished an item, we should always have room to start 1 more.
      const nextArgs = queued.shift()

      if (nextArgs) {
        kickOff(nextArgs)
      }
    })

    running.push(promise)
  }

  return {
    enqueue: (args) => {
      // If we have room, start it up immediately, if not, queue it up.
      if (running.length < size) {
        kickOff(args)
      } else {
        queued.push(args)
      }
    },

    drain: async () => {
      while (running.length > 0) {
        await Promise.all(running)
      }
    }
  }
}
