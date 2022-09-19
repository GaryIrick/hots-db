DECLARE @teamName nvarchar(100);

SET @teamName = ''

DECLARE @players AS TABLE(PlayerId uniqueidentifier,
  Name nvarchar(50))

INSERT INTO @players
SELECT
  p.PlayerId,
  p.Name
FROM
  TeamPlayer tp
  JOIN Player p
  ON p.PlayerId = tp.PlayerId
  JOIN Team t
  ON t.TeamId = tp.TeamId
WHERE
  t.Name = @teamName

;
WITH
  games
  AS
  (
    SELECT
      g.Date,
      g.Map,
      bs.GameId,
      bs.PlayerId,
      bs.PlayerName,
      bs.Hero,
      bs.IsWinner,
      COUNT(*) OVER(PARTITION BY bs.GameId) AS StackSize
    FROM
      BoxScoreEx bs
      JOIN Game g
      ON g.GameId = bs.GameId
    WHERE
    bs.PlayerId IN (SELECT PlayerId
    FROM @players)
  )
SELECT
  DENSE_RANK() OVER(ORDER BY Date DESC, GameId) AS Game,
  StackSize,
  CAST(Date as date) AS Date,
  Map,
  PlayerName,
  Hero,
  CASE WHEN IsWinner = 1 THEN 'Win' ELSE 'Loss' END AS WinLoss
FROM
  Games
WHERE
  StackSize >= 2
ORDER BY
  Date DESC, GameId