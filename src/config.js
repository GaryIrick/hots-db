const acme = require('acme-client')

// Squelch the warning about Javascript extraction when the parser gets loaded.
process.env.LOGLEVEL = 'error'

// Squelch the warning from the AWS SDK.
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1'

module.exports = {
  azure: {
    location: 'centralus',
    keyVault: 'hots-db-keys',
    resourceGroup: 'hots-db-resource-group',
    functionAppName: 'hots-db-functions',
    functionAppUrl: 'https://hots-db-functions.azurewebsites.net',
    storage: {
      account: 'hotsdbdata',
      configContainer: 'config',
      rawContainer: 'raw',
      parsedContainer: 'parsed',
      sqlImportContainer: 'sql-import',
      sparkImportContainer: 'spark-import',
      backupsContainer: 'database-backups'
    },
    cosmos: {
      account: 'hots-db-cosmos',
      database: 'hots',
      readOnlyKey: 'cosmos-read-only-key',
      readWriteKey: 'cosmos-read-write-key',
      matchesContainer: 'ngs-matches',
      teamsContainer: 'ngs-teams'
    }
  },
  sqlServer: {
    hostname: 'localhost',
    database: 'replays',
    backupDirectory: 'D:\\MSSQL\\Backup'
  },
  aws: {
    credentialsSecretName: 'aws-credentials'
  },
  google: {
    credentialsSecretName: 'google-credentials'
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
    currentSeason: 20,
    currentMapPool: [
      'Alterac Pass',
      'Battlefield of Eternity',
      'Braxis Holdout',
      'Cursed Hollow',
      'Dragon Shire',
      'Garden of Terror',
      'Infernal Shrines',
      'Sky Temple',
      'Tomb of the Spider Queen',
      'Towers of Doom',
      'Volskaya Foundry'
    ]
  },
  replaysByDivisionDirectory: 'D:\\ReplaysByDivision',
  cacheDirectory: 'T:\\hots-db-cache'
}
