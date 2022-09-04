DECLARE @team nvarchar(100) = '';
DECLARE @minGames int = 2;

DECLARE @seasons AS TABLE(Season int)
INSERT INTO @seasons
VALUES
  (13),(14)
;

WITH
heroes AS
(
  SELECT
    h.Name AS Hero,
    CASE WHEN g.IsWinner = 1 THEN 1 ELSE 0 END AS HeroWin,
    CASE WHEN g.IsWinner = 1 THEN 0 ELSE 1 END AS HeroLoss,
    bs.IsWinner AS WithTeam
  FROM
    BoxScoreEx bs
    JOIN Hero h
      ON h.HeroId = bs.HeroId
    JOIN GameForTeam g
      ON g.GameId = bs.GameId
    JOIN MatchGame mg
      ON mg.GameId = g.GameId
    JOIN Match m
      ON m.MatchId = mg.MatchId
  WHERE
    m.Season IN (SELECT Season FROM @seasons)
    AND g.Team = @team
),
records AS
(
    SELECT
        Hero,
        WithTeam,
        SUM(CASE WHEN WithTeam = 1 THEN HeroWin ELSE HeroLoss END) AS TeamWins,
        SUM(CASE WHEN WithTeam = 1 THEN HeroLoss ELSE HeroWin END) AS TeamLosses
    FROM
        heroes
    GROUP BY
        Hero,
        WithTeam
),
recordsWithPercent AS
(
    SELECT
        Hero,
        WithTeam,
        TeamWins,
        TeamLosses,
        ROUND(CAST(TeamWins AS float) / CAST(TeamWins + TeamLosses AS float), 2) AS WinPct
    FROM
        records
    WHERE
        TeamWins + TeamLosses >= @minGames
),
ranked AS
(
    SELECT
        CASE WHEN WithTeam = 1 THEN 'With' ELSE 'Against' END AS WithOrAgainst,
        Hero,
        TeamWins,
        TeamLosses,
        WinPct,
        ROW_NUMBER() OVER(PARTITION BY WithTeam ORDER BY WinPct DESC, TeamWins + TeamLosses DESC) AS Rank
    FROM
        recordsWithPercent
)
SELECT
    WithOrAgainst,
    Hero,
    CAST(TeamWins AS varchar) + ' - ' + CAST(TeamLosses AS varchar) AS Record,
    WinPct
FROM
    ranked
WHERE
    Rank <= 10
ORDER BY
    WithOrAgainst DESC,
    Rank ASC
    
