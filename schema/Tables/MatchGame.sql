CREATE TABLE MatchGame
(
    MatchId uniqueidentifier NOT NULL CONSTRAINT FK_MatchGame_Match REFERENCES Match(MatchId) ON DELETE CASCADE,
    GameNumber tinyint NOT NULL,
    ReplayKey nvarchar(200) NOT NULL,
    GameId uniqueidentifier NOT NULL CONSTRAINT FK_MatchGame_Game REFERENCES Game(GameId) ON DELETE CASCADE,
    Winner nvarchar(10) NOT NULL,
    CONSTRAINT PK_MatchGame PRIMARY KEY (MatchId, GameNumber)
);
GO

CREATE UNIQUE INDEX UX_MatchGame_GameNumber ON MatchGame(MatchId, GameNumber);
GO

CREATE INDEX IX_MatchGame_Game ON MatchGame(GameId);
GO