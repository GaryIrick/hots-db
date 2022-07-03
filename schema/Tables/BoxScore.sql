CREATE TABLE BoxScore
(
    GameId uniqueidentifier NOT NULL CONSTRAINT FK_PlayerGame_Game REFERENCES Game(GameId) ON DELETE CASCADE,
    PlayerId uniqueidentifier NOT NULL CONSTRAINT FK_PlayerGame_Player REFERENCES Player(PlayerId),
    HeroId tinyint NOT NULL CONSTRAINT FK_BoxScore_Hero REFERENCES Hero(HeroId),
    Team tinyint NOT NULL,
    Party tinyint NULL,
    Kills tinyint NOT NULL,
    Assists tinyint NOT NULL,
    Deaths tinyint NOT NULL,
    OutnumberedDeaths tinyint NOT NULL,
    TimeSpentDead int NOT NULL,
    HeroDamage int NOT NULL,
    SiegeDamage int NOT NULL,
    Healing int NOT NULL,
    DamageTaken int NOT NULL,
    Xp int NOT NULL,
    MercCaptures int NOT NULL,
    EnemyCcTime int NOT NULL,
    EnemySilenceTime int NOT NULL,
    EnemyRootTime int NOT NULL,
    EnemyStunTime int NOT NULL,
    Globes int NOT NULL,
    Talent1Id smallint NULL CONSTRAINT FK_BoxScore_Talent1 REFERENCES Talent(TalentId),
    Talent2Id smallint NULL CONSTRAINT FK_BoxScore_Talent2 REFERENCES Talent(TalentId),
    Talent3Id smallint NULL CONSTRAINT FK_BoxScore_Talent3 REFERENCES Talent(TalentId),
    Talent4Id smallint NULL CONSTRAINT FK_BoxScore_Talent4 REFERENCES Talent(TalentId),
    Talent5Id smallint NULL CONSTRAINT FK_BoxScore_Talent5 REFERENCES Talent(TalentId),
    Talent6Id smallint NULL CONSTRAINT FK_BoxScore_Talent6 REFERENCES Talent(TalentId),
    Talent7Id smallint NULL CONSTRAINT FK_BoxScore_Talent7 REFERENCES Talent(TalentId),
    CONSTRAINT PK_BoxScore PRIMARY KEY (GameId, PlayerId)
);
GO

CREATE INDEX IX_BoxScore_PlayerId
    ON BoxScore(PlayerId);
GO

CREATE INDEX IX_BoxScore_GameId
    ON BoxScore(GameId);
GO
