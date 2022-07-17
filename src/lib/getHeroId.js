const fixHeroName = require('./fixHeroName')

let heroMap

module.exports = async (db, name) => {
  name = fixHeroName(name)

  if (!heroMap) {
    heroMap = {}
    const heroes = await db.request()
      .query('SELECT HeroId, Name FROM Hero')

    for (const row of heroes.recordset) {
      heroMap[row.Name] = row.HeroId
    }
  }

  return heroMap[name]
}
