DECLARE @teamName nvarchar(100);
DECLARE @teamId uniqueidentifier;

DECLARE @seasons AS TABLE(Season int)
INSERT INTO @seasons
VALUES
  (13),
  (14),
  (15)
;

DECLARE @targetWinRate AS float = 0.00;

with heroes as
(
  SELECT
    h.Role,
    h.Name AS Hero,
	bs.PlayerName AS Player,
    0.0 + bs.Kills + bs.Assists AS Takedowns,
    0.0 + bs.Deaths AS Deaths,
    bs.IsWinner * 1.0 AS IsWinner
  FROM    
    BoxScoreEx bs
    JOIN Game g
      ON g.GameId = bs.GameId
    JOIN Hero h
      ON h.HeroId = bs.HeroId
    JOIN MatchGame mg
      ON mg.GameId = g.GameId
    JOIN Match m
      ON m.MatchId = mg.MatchId
  WHERE
	m.season in (13, 14, 15)
	AND m.division in ('B', 'C', 'D')
),
stats AS
(
  SELECT
    Role,
    Hero,
	Player,
    COUNT(*) AS Games,
    AVG(IsWinner) AS WinPercent,
    CASE WHEN SUM(Deaths) = 0 THEN SUM(Takedowns) ELSE SUM(Takedowns) / SUM(Deaths) END AS KDA
  FROM
    heroes
  GROUP BY
    Role,
    Hero,
	Player
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
