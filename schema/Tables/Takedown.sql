CREATE TABLE Takedown
(
    TakedownId uniqueidentifier NOT NULL CONSTRAINT PK_Takedown PRIMARY KEY,
    GameId uniqueidentifier NOT NULL CONSTRAINT FK_Takedown_GameId REFERENCES Game(GameId) ON DELETE CASCADE,
    VictimId tinyint NOT NULL CONSTRAINT FK_Takedown_Victim REFERENCES Hero(HeroId),
    Time smallint NOT NULL,
    Killer1Id tinyint NULL CONSTRAINT FK_Takedown_Killer1 REFERENCES Hero(HeroId),
    Killer2Id tinyint NULL CONSTRAINT FK_Takedown_Killer2 REFERENCES Hero(HeroId),
    Killer3Id tinyint NULL CONSTRAINT FK_Takedown_Killer3 REFERENCES Hero(HeroId),
    Killer4Id tinyint NULL CONSTRAINT FK_Takedown_Killer4 REFERENCES Hero(HeroId),
    Killer5Id tinyint NULL CONSTRAINT FK_Takedown_Killer5 REFERENCES Hero(HeroId),
);
GO
CREATE INDEX IX_Takedown_GameId
    ON Takedown(GameId);
GO
