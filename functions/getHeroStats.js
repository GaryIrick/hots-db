const moment = require('moment')

module.exports = async function (request, context) {
  const startDate = moment(request.query.get('startDate')).toDate()
  const endDate = moment(request.query.get('endDate')).toDate()
  context.log(`start=${startDate}, end=${endDate}`)

  return {
    jsonBody: [
      {
        hero: 'Kael\'thas',
        winRate: 0.51,
        role: 'Ranged Assassin'
      },
      {
        hero: 'Li-Ming',
        winRate: 0.55,
        role: 'Ranged Assassin'
      },
      {
        hero: 'Jaina',
        winRate: 0.47,
        role: 'Ranged Assassin'
      },
      {
        hero: 'Thrall',
        winRate: 0.48,
        role: 'Bruiser'
      },
      {
        hero: 'Imperius',
        winRate: 0.51,
        role: 'Bruiser'
      },
      {
        hero: 'Stukov',
        winRate: 0.56,
        role: 'Healer'
      },
      {
        hero: 'Anduin',
        winRate: 0.54,
        role: 'Healer'
      },
      {
        hero: 'Muradin',
        winRate: 0.52,
        role: 'Tank'
      },
      {
        hero: 'E.T.C.',
        winRate: 0.45,
        role: 'Tank'
      }
    ]
  }
}
