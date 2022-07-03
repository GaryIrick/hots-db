const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const getFromHeroesProfile = require('./apis/getFromHeroesProfile')
const getSqlServer = require('./db/getSqlServer')

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

  for (const name of Object.keys(heroes)) {
    const { id: heroId, new_role: role, type } = heroes[name]

    const sql = `
      MERGE Hero AS tgt
      USING
      (
        SELECT 
          @heroId AS HeroId, 
          @name AS Name, 
          @role AS Role, 
          @type AS Type
      ) AS src
        ON src.HeroId = tgt.HeroId
      WHEN NOT MATCHED THEN
        INSERT (HeroId, Name, Role, Type)
        VALUES (src.HeroId, src.Name, src.Role, src.Type)
      WHEN MATCHED THEN UPDATE SET
        tgt.Name = src.Name,
        tgt.Role = src.Role,
        tgt.Type = src.Type
    `

    await db
      .request()
      .input('heroId', heroId)
      .input('name', name)
      .input('role', role)
      .input('type', type)
      .query(sql)
  }

  await db.close()
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
        @TalentId AS TalentId, 
        @heroId AS HeroId,
        @tier AS Tier,
        @name AS Name,
        @internalName AS InternalName,
        @description AS Description,
        @sortOrder AS SortOrder,
        @icon As Icon,
        @isActive AS IsActive
      ) AS src
        ON src.TalentId = tgt.TalentId
      WHEN NOT MATCHED THEN
        INSERT (TalentId, HeroId, Tier, Name, InternalName, Description, SortOrder, Icon, IsActive)
        VALUES (src.TalentId, src.HeroId, src.Tier, src.Name, src.InternalName, src.Description, src.SortOrder, src.Icon, src.IsActive)
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
        .input('talentId', talent.talent_id)
        .input('heroId', talent.id)
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

  await db.close()
}

module.exports = async (log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const configFilesystem = datalake.getFileSystemClient(configContainer)
  const heroesFile = configFilesystem.getFileClient('heroes.json')
  const talentsFile = configFilesystem.getFileClient('talents.json')
  const heroes = await getFromHeroesProfile('Heroes')
  const talents = await getFromHeroesProfile('Heroes/Talents')
  await heroesFile.upload(Buffer.from(JSON.stringify(heroes)))
  await talentsFile.upload(Buffer.from(JSON.stringify(talents)))

  await syncHeroes(heroes)
  await syncTalents(talents)
}