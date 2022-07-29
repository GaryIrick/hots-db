const { Worker } = require('worker_threads')

module.exports = (size, workerSourceFile) => {
  const workers = []
  const callbacks = {}
  let nextThread = 0

  for (let i = 0; i < size; i++) {
    const worker = new Worker(workerSourceFile)

    worker.on('message', ({ id, result }) => {
      callbacks[id](result)
      delete callbacks[id]
    })

    workers.push(worker)
  }

  return {
    runTask: async (id, args) => {
      // We assume all the tasks are roughly the same size, so we just do a simple round-robin for now.
      const whichThread = nextThread
      nextThread = (nextThread + 1) % size
      const whichWorker = workers[whichThread]

      const result = await new Promise((resolve, reject) => {
        callbacks[id] = (resultFromWorker) => {
          resolve(resultFromWorker)
        }

        whichWorker.postMessage({ id, args })
      })

      return result
    },

    shutdown: () => {
      for (const worker of workers) {
        worker.terminate()
      }
    }
  }
}
