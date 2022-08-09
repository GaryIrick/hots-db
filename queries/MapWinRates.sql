DECLARE @teamName nvarchar(100)
SET @teamName = ''
DECLARE @startSeason int = 13
DECLARE @endSeason int = 14

DECLARE @maps TABLE(Map nvarchar(50), MapOrder int)

INSERT INTO @maps
SELECT 'Alterac Pass', 1 UNION
SELECT 'Battlefield of Eternity', 2 UNION
SELECT 'Braxis Holdout', 3 UNION
SELECT 'Cursed Hollow', 4 UNION
SELECT 'Dragon Shire', 5 UNION
SELECT 'Garden of Terror', 6 UNION
SELECT 'Infernal Shrines', 7 UNION
SELECT 'Sky Temple', 8 UNION
SELECT 'Tomb of the Spider Queen', 9 UNION
SELECT 'Towers of Doom', 10  UNION
SELECT 'Volskaya Foundry', 11

DECLARE @teamId uniqueidentifier
DECLARE @playerIds TABLE(PlayerId uniqueidentifier)
DECLARE @gameIds TABLE(GameId uniqueidentifier)


SELECT @teamId = TeamId FROM Team WHERE Name = @teamName
INSERT INTO @playerIds
SELECT PlayerId FROM TeamPlayer WHERE TeamId = @teamId

;
WITH games as
(
  SELECT DISTINCT
    g.GameId,
    g.Map,
    bs.Team,
    CASE WHEN (bs.Team = g.WinningTeam) THEN 1 ELSE 0 END AS Win,
    CASE WHEN (bs.Team = g.WinningTeam) THEN 0 ELSE 1 END AS Loss,
    mp.MapOrder
  FROM
    MatchGame mg
    JOIN Game g
      ON g.GameId = mg.GameId
    JOIN Match m  
      ON m.MatchId = mg.MatchId
    JOIN BoxScoreEx bs
      ON bs.GameId = mg.GameId
    JOIN @playerIds p
      ON p.PlayerId = bs.PlayerId
    JOIN @maps mp
      ON mp.Map = g.Map
  WHERE
    m.Season >= @startSeason and m.Season <= @endSeason
  GROUP BY
    g.GameId,
    g.Map,
    bs.Team,
    g.WinningTeam,
    mp.MapOrder
  HAVING COUNT(*) > 2
)
SELECT
  mp.Map,
  SUM(Win) AS Wins,
  SUM(Loss) AS Losses,
    CASE 
        WHEN SUM(Win + Loss) > 0 THEN CAST(SUM(Win) AS VARCHAR) + ' - ' + CAST(SUM(Loss) AS VARCHAR)
        ELSE ''
    END AS Record,
    CASE 
        WHEN SUM(Win + Loss) > 0 THEN CAST(ROUND(CAST(SUM(Win) AS float) / (SUM(Win) + SUM(Loss)), 2) AS varchar)
        ELSE ''
    END AS WinPct
FROM
  @maps mp
  LEFT JOIN games g
    on g.Map = mp.Map
GROUP BY
  mp.Map,
  mp.MapOrder
ORDER BY
  mp.MapOrder