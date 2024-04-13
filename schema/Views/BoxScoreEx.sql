CREATE VIEW BoxScoreEx
AS
SELECT
  bs.*,
  CASE WHEN (bs.Team = g.WinningTeam) THEN 1 ELSE 0 END AS IsWinner,
  h.Name AS Hero,
  h.Role AS Role,
  p.Name as PlayerName,
  p.BattleTag as PlayerTag,
  g.Date
FROM
  BoxScore bs
  JOIN Game g
    ON g.GameId = bs.GameId
  JOIN Hero h
    ON h.HeroId = bs.HeroId
  join Player p
    on p.PlayerId = bs.PlayerId

GO
