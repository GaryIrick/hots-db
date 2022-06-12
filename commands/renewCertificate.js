const renewCertificate = require('../src/renewCertificate')

const run = async () => {
  await renewCertificate(console.log)
}

run()
