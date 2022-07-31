CREATE TABLE MatchGame
(
    MatchId uniqueidentifier NOT NULL CONSTRAINT FK_MatchGame_Match REFERENCES Match(MatchId) ON DELETE CASCADE,
    GameNumber tinyint NOT NULL,
    ReplayKey nvarchar(200) NOT NULL,
    GameId uniqueidentifier NOT NULL CONSTRAINT FK_MatchGame_Game REFERENCES Game(GameId),
    Winner nvarchar(4) NOT NULL
);
GO

CREATE UNIQUE INDEX UX_MatchGame_GameNumber ON MatchGame(MatchId, GameNumber);
GO