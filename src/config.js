const acme = require('acme-client')

module.exports = {
  azure: {
    location: 'centralus',
    keyVault: 'hots-db-keys',
    resourceGroup: 'hots-db-resource-group',
    domainNamesResourceGroup: 'domain-names',
    domain: 'hots-helper.com',
    cdnProfile: 'hots-db-web-cdn',
    cdnEndpoint: 'hots-db-web-endpoint',
    certificateName: 'hots-helper-certificate'
  },
  acme: {
    caUrl: acme.directory.letsencrypt.production,
    email: 'garyirick@gmail.com'
  }
}
