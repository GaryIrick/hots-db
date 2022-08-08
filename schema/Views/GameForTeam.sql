CREATE VIEW GameForTeam
AS

SELECT
  m.HomeTeam as Team,
  m.HomeNgsTeamId AS NgsTeamId,
  m.AwayTeam as Opponent,
  m.AwayNgsTeamId AS OpponentNgsTeamId,
  m.Season,
  m.Division,
  m.Coast,
  m.MatchId,
  mg.GameId,
  CASE WHEN mg.Winner = 'home' THEN 1 ELSE 0 END AS IsWinner
FROM
  Match m
  JOIN MatchGame mg
    ON mg.MatchId = m.MatchId

UNION

SELECT
  m.AwayTeam AS Team,
  m.AwayNgsTeamId AS NgsTeamId,
  m.HomeTeam As Opponent,
  m.HomeNgsTeamId AS OpponentNgsTeamId,
  m.Season,
  m.Division,
  m.Coast,
  m.MatchId,
  mg.GameId,
  CASE WHEN mg.Winner = 'away' THEN 1 ELSE 0 END AS IsWinner
FROM
  Match m
  JOIN MatchGame mg
    ON mg.MatchId = m.MatchId
