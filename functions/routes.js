const { app } = require('@azure/functions')
const findStormLeagueGames = require('./findStormLeagueGames')
const copyNgsMatches = require('./copyNgsMatches')
const getHeroStats = require('./getHeroStats')
const getOpenApiSpec = require('./getOpenApiSpec.js')
const getManifest = require('./getManifest.js')

const addRoute = (route, verb, func) => {
  app.http(route, {
    methods: [verb],
    authLevel: 'anonymous',
    handler: func
  })
}

addRoute('find-storm-league-games', 'POST', findStormLeagueGames)
addRoute('copy-ngs-matches', 'POST', copyNgsMatches)
addRoute('hero-stats', 'GET', getHeroStats)
addRoute('openapi', 'GET', getOpenApiSpec)

app.http('manifest', {
  methods: ['GET'],
  route: '.well-known/ai-plugin.json',
  authLevel: 'anonymous',
  handler: getManifest
})
