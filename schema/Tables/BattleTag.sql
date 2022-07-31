CREATE TABLE BattleTag
(
    PlayerId uniqueidentifier NOT NULL,
    Name nvarchar(100) NOT NULL,
    Tag nvarchar(10) NOT NULL,
    LastSeen datetime NOT NULL,
    CONSTRAINT PK_BattleTag PRIMARY KEY(PlayerId, Name, Tag),
    CONSTRAINT FK_BattleTag_Player FOREIGN KEY (PlayerId) REFERENCES Player(PlayerId) ON DELETE CASCADE
);
GO

CREATE INDEX IX_BattleTag_Player ON BattleTag(PlayerId);
GO
