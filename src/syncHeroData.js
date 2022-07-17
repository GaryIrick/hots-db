const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { orderBy } = require('lodash')
const getFromHeroesProfile = require('./apis/getFromHeroesProfile')
const putUncompressedJson = require('./lib/putUncompressedJson')
const getSqlServer = require('./db/getSqlServer')
const camelCaseRow = require('./db/camelCaseRow')

const {
  azure: { storage: { account, configContainer } }
} = require('./config')

const getTier = (level) => {
  switch (level) {
    case 1:
      return 1
    case 4:
      return 2
    case 7:
      return 3
    case 10:
      return 4
    case 13:
      return 5
    case 16:
      return 6
    case 20:
      return 7
    default:
      throw new Error(`Unknown talent level ${level}`)
  }
}

const syncHeroes = async (heroes) => {
  const db = await getSqlServer()

  for (const name of orderBy(Object.keys(heroes), [k => heroes[k].release_date, k => heroes[k].name])) {
    const { attribute_id: internalName, new_role: role, type, release_date: releaseDate } = heroes[name]

    const sql = `
      MERGE Hero AS tgt
      USING
      (
        SELECT 
          @name,
          @internalName,
          @role,
          @type,
          @releaseDate
      ) AS src (Name, InternalName, Role, Type, ReleaseDate)
        ON src.Name = tgt.Name
      WHEN NOT MATCHED THEN
        INSERT (Name, InternalName, Role, Type, ReleaseDate)
        VALUES (src.Name, src.InternalName, src.Role, src.Type, ReleaseDate)
      WHEN MATCHED THEN UPDATE SET
        tgt.Name = src.Name,
        tgt.InternalName = src.InternalName,
        tgt.Role = src.Role,
        tgt.Type = src.Type,
        tgt.ReleaseDate = src.ReleaseDate
    `

    await db
      .request()
      .input('name', name)
      .input('internalName', internalName)
      .input('role', role)
      .input('type', type)
      .input('releaseDate', releaseDate)
      .query(sql)
  }

  const allHeroes = await db
    .request()
    .query('SELECT Name, InternalName, Role, Type FROM Hero ORDER BY HeroId')

  await db.close()

  return allHeroes.recordset.map(camelCaseRow)
}

const syncTalents = async (talents) => {
  const db = await getSqlServer()

  // Set all talents to inactive, we'll turn them back on as we see them.  If
  // a talent is no longer in the game, it won't match in the MERGE below.
  await db
    .request()
    .query('UPDATE Talent SET IsActive = 0')

  for (const heroName of Object.keys(talents)) {
    for (const talent of talents[heroName]) {
      if (talent.level === 0) {
        // Talents with a level of 0 were removed from the game, ignore them.  If we see them
        // in a replay, we'll add them back in as appropriate.
        continue
      }

      const sql = `
      MERGE Talent AS tgt
      USING 
      (
        SELECT 
          (SELECT h.HeroId FROM Hero h WHERE h.InternalName = @heroInternalName),
          @tier,
          @name,
          @internalName,
          @description,
          @sortOrder,
          @icon,
          @isActive
      ) AS src (HeroId, Tier, Name, InternalName, Description, SortOrder, Icon, IsActive)
        ON src.HeroId = tgt.HeroId
        AND src.InternalName = tgt.InternalName
      WHEN NOT MATCHED THEN
        INSERT (HeroId, Tier, Name, InternalName, Description, SortOrder, Icon, IsActive)
        VALUES (src.HeroId, src.Tier, src.Name, src.InternalName, src.Description, src.SortOrder, src.Icon, src.IsActive)
      WHEN MATCHED THEN UPDATE SET
        tgt.Tier = src.Tier,
        tgt.HeroId = src.HeroId,
        tgt.Name = src.Name,
        tgt.InternalName = src.InternalName,
        tgt.Description = src.Description,
        tgt.SortOrder = src.SortOrder,
        tgt.Icon = src.Icon,
        tgt.IsActive = src.IsActive
    `

      await db
        .request()
        .input('heroInternalName', talent.attribute_id)
        .input('tier', getTier(talent.level))
        .input('name', talent.title)
        .input('internalName', talent.talent_name)
        .input('description', talent.description)
        .input('sortOrder', Number(talent.sort))
        .input('icon', talent.icon)
        .input('isActive', talent.status === 'playable' ? 1 : 0)
        .query(sql)
    }
  }

  const allTalents = await db
    .request()
    .query(`
      SELECT
        h.Name AS Hero,
        t.Tier,
        t.Name,
        t.InternalName,
        t.Description,
        t.SortOrder,
        t.Icon,
        t.IsActive
      FROM
        Talent t
        JOIN Hero h
          ON h.HeroId = t.HeroId
      ORDER BY
        h.Name,
        t.Tier,
        t.SortOrder
    `)

  await db.close()

  return allTalents.recordset
    .map(camelCaseRow)
    .map(r => Object.assign(r, { isActive: !!r.isActive }))
}

module.exports = async (log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const configFilesystem = datalake.getFileSystemClient(configContainer)

  const heroes = await getFromHeroesProfile('Heroes')
  const allHeroes = await syncHeroes(heroes)
  await putUncompressedJson(configFilesystem, 'heroes.json', allHeroes)

  const talents = await getFromHeroesProfile('Heroes/Talents')
  const allTalents = await syncTalents(talents)
  await putUncompressedJson(configFilesystem, 'talents.json', allTalents)
}
