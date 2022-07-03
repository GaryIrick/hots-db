const acme = require('acme-client')

module.exports = {
  azure: {
    location: 'centralus',
    keyVault: 'hots-db-keys',
    resourceGroup: 'hots-db-resource-group',
    cdn: {
      domainNamesResourceGroup: 'domain-names',
      domain: 'hots-helper.com',
      cdnProfile: 'hots-db-web-cdn',
      cdnEndpoint: 'hots-db-web-endpoint',
      certificateName: 'hots-helper-certificate'
    },
    storage: {
      account: 'hotsdbdata',
      configContainer: 'config',
      rawContainer: 'raw',
      parsedContainer: 'parsed',
      sqlContainer: 'sql'
    },
    cosmos: {
      account: 'hots-db-cosmos',
      database: 'hots',
      readOnlyKey: 'cosmos-read-only-key',
      readWriteKey: 'cosmos-read-write-key',
      matchesContainer: 'ngs-matches'
    }
  },
  sqlServer: {
    hostname: 'localhost',
    database: 'replays2',
    backupDirectory: 'D:\\MSSQL\\Backup'
  },
  aws: {
    credentialsSecretName: 'aws-credentials'
  },
  acme: {
    caUrl: acme.directory.letsencrypt.production,
    email: 'garyirick@gmail.com'
  },
  heroesProfile: {
    apiUrl: 'https://api.heroesprofile.com/api',
    secretName: 'heroes-profile-api-key'
  },
  ngs: {
    apiUrl: 'https://www.nexusgamingseries.org/api',
    bucket: 'ngs-replay-storage',
    currentSeason: 13
  }
}
