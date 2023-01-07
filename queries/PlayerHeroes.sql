DECLARE @teamName nvarchar(100);
DECLARE @teamId uniqueidentifier;

SET @teamName = ''

SELECT @teamId = TeamId FROM Team WHERE Name = @teamName;

DECLARE @sources as TABLE(source nvarchar(4))
INSERT INTO @sources
VALUES
  ('hp'),
  ('ngs')

DECLARE @seasons AS TABLE(Season int)
INSERT INTO @seasons
VALUES
  (6),
  (7),
  (8),
  (9),
  (10),
  (11),
  (12),
  (13),
  (14)
;

DECLARE @targetWinRate AS float = 0.00;

WITH players AS
(
  SELECT
    p.Name,
    p.PlayerId
  FROM
    Player p
  WHERE
    p.BattleTag in
    (
      'Rackham#1819',
      'WENlS#11638',
      'Tiger#14285',
      'Aaron#12738',
      'Emtinoh#1609',
      'Aura#1724'
    )
),
heroes AS
(
  SELECT
    h.Role,
    h.Name AS Hero,
    p.Name AS Player,
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
      m.Season IS NULL
      OR m.Season IN (SELECT Season FROM @seasons)
    )
),
stats AS
(
  SELECT
    Role,
    Hero,
    Player,
    UPPER(Source) AS Source,
    COUNT(*) AS Games,
    AVG(IsWinner) AS WinPercent,
    CASE WHEN SUM(Deaths) = 0 THEN SUM(Takedowns) ELSE SUM(Takedowns) / SUM(Deaths) END AS KDA
  FROM
    heroes
  GROUP BY
    Player,
    Source,
    Role,
    Hero
)
SELECT
  *
FROM
  stats
WHERE
  WinPercent >= @targetWinRate
ORDER BY
  Role,
  WinPercent DESC,
  Hero,
  Games DESC
