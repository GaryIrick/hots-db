CREATE TABLE Player
(
    PlayerId uniqueidentifier NOT NULL CONSTRAINT PK_Player PRIMARY KEY,
    ToonHandle nvarchar(25) NOT NULL,
    Region nvarchar(5) NOT NULL,
    Name nvarchar(100) NOT NULL,
    Tag nvarchar(10) NOT NULL,
    BattleTag AS Name + '#' + Tag
);
GO

CREATE INDEX IX_Player_ToonHandle ON Player(ToonHandle) INCLUDE(Region);
GO