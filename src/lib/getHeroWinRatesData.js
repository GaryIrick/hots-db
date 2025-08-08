const getSqlServer = require('../db/getSqlServer')

const sql = `
  DECLARE @teamId uniqueidentifier;

  SELECT @teamId = TeamId FROM Team WHERE Name = @teamName;

  DECLARE @sources as TABLE(source nvarchar(4))
  INSERT INTO @sources
  VALUES
    __sources__

  DECLARE @seasons AS TABLE(Season int)
  INSERT INTO @seasons
  VALUES
    __seasons__
  ;

  WITH raw_players AS
  (
    SELECT
      tp.PlayerId,
      bt.Name,
      bt.Tag AS Tag,
      ROW_NUMBER() OVER (PARTITION BY tp.PlayerId ORDER BY CASE WHEN bt.Tag = '0000' THEN 1 ELSE 0 END, bt.LastSeen DESC) AS rnk
    FROM
      TeamPlayer tp
      JOIN BattleTag bt
        ON bt.PlayerId = tp.PlayerId
    WHERE
      tp.TeamId = @teamId
  ),
  players AS
  (
    SELECT
      *
    FROM
      raw_players
    WHERE
      rnk = 1
  ),
  heroes AS
  (
    SELECT
      h.Role,
      h.Name AS Hero,
      p.Name AS Player,
      p.Tag,
      g.Source,
      0.0 + bs.Kills + bs.Assists AS Takedowns,
      0.0 + bs.Deaths AS Deaths,
      bs.IsWinner * 1.0 AS IsWinner
    FROM
      players p
      JOIN BoxScoreEx bs
        ON bs.PlayerId = p.PlayerId
      JOIN Game g
        ON g.GameId = bs.GameId
      JOIN Hero h
        ON h.HeroId = bs.HeroId
      LEFT JOIN MatchGame mg
        ON mg.GameId = g.GameId
      LEFT JOIN Match m
        ON m.MatchId = mg.MatchId
    WHERE
      g.Source IN (SELECT source FROM @sources)
      AND
      (
        (m.Season IN (SELECT Season FROM @seasons))
        OR
        (g.Source <> 'ngs')
      )
  ),
  stats AS
  (
    SELECT
      Role,
      Hero,
      Player,
      Tag,
      UPPER(Source) AS Source,
      COUNT(*) AS Games,
      AVG(IsWinner) AS WinPercent,
      CASE WHEN SUM(Deaths) = 0 THEN SUM(Takedowns) ELSE SUM(Takedowns) / SUM(Deaths) END AS KDA
    FROM
      heroes
    GROUP BY
      Player,
      Tag,
      Source,
      Role,
      Hero
  )
  SELECT
    *
  FROM
    stats
  ORDER BY
    Role,
    WinPercent DESC,
    Hero,
    Games DESC
`

module.exports = async (teamName, firstSeason, lastSeason, includeHeroesProfile) => {
  const seasons = []

  for (let season = firstSeason; season <= lastSeason; season++) {
    seasons.push(season)
  }

  const sqlToRun = sql
    .replace('__seasons__', seasons.map(s => `(${s})`).join(','))
    .replace('__sources__', includeHeroesProfile ? '(\'hp\'), (\'ngs\')' : '(\'ngs\')')

  const db = await getSqlServer()

  const response = await db
    .request()
    .input('teamName', teamName)
    .query(sqlToRun)

  await db.close()

  return response.recordset.map(row => ({
    role: row.Role,
    hero: row.Hero,
    player: row.Player,
    tag: row.Tag,
    source: row.Source,
    games: row.Games,
    winRate: row.WinPercent,
    kda: row.KDA
  }))
}
