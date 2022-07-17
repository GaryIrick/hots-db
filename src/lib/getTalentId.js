const insertRow = require('../db/insertRow')
const getHeroId = require('./getHeroId')

const talentMap = {}

const findOrCreateTalent = async (db, heroName, talentName, tier) => {
  const findTalent = async () => {
    return await db.request()
      .input('heroName', heroName)
      .input('talentName', talentName)
      .query(`
      SELECT
        t.TalentId
      FROM
        Talent t
        JOIN Hero h
          ON h.HeroId = t.HeroId
      WHERE
        t.InternalName = @talentName
        AND h.Name = @heroName
    `)
  }

  const result = await findTalent()

  if (result.recordset.length) {
    return result.recordset[0].TalentId
  } else {
    await insertRow(db, 'Talent', {
      heroId: await getHeroId(db, heroName),
      tier,
      internalName: talentName,
      name: `Unknown Talent ${talentName}`,
      description: `Unknown Talent ${talentName}`,
      sortOrder: 99,
      icon: 'unknown',
      isActive: 0
    })

    const newResult = await findTalent()
    return newResult.recordset[0].TalentId
  }
}

module.exports = async (db, heroName, talentName, tier) => {
  if (!talentName) {
    // This means the player didn't pick that talent, the game probably ended
    // before they had a chance.
    return undefined
  }

  const key = `${heroName}-${talentName}`

  if (!talentMap[key]) {
    talentMap[key] = await findOrCreateTalent(db, heroName, talentName, tier)
  }

  return talentMap[key]
}
