const { app } = require('@azure/functions')
const findStormLeagueGames = require('./findStormLeagueGames')
const copyNgsMatches = require('./copyNgsMatches')

const addRoute = (route, verb, func) => {
  app.http(route, {
    methods: [verb],
    authLevel: 'anonymous',
    handler: func
  })
}

addRoute('find-storm-league-games', 'POST', findStormLeagueGames)
addRoute('copy-ngs-matches', 'POST', copyNgsMatches)
