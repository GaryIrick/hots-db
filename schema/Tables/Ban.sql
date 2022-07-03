CREATE TABLE Ban
(
    GameId uniqueidentifier NOT NULL CONSTRAINT FK_Ban_Game REFERENCES Game(GameId) ON DELETE CASCADE,
    Team tinyint NOT NULL,
    Round tinyint NOT NULL,
    BanOrder tinyint NOT NULL,
    HeroId tinyint NOT NULL,
    CONSTRAINT PK_Ban PRIMARY KEY(GameId, Team, Round, BanOrder)
);
GO

CREATE INDEX IX_Ban_GameId
    ON Ban(GameId);
GO