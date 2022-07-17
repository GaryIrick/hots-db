CREATE TABLE Game
(
    GameId uniqueidentifier NOT NULL CONSTRAINT PK_Game PRIMARY KEY,
    Fingerprint NVARCHAR(50) NOT NULL,
    Source nvarchar(3) NOT NULL,
    PatchSortable bigint NOT NULL,
    Region nvarchar(2) NOT NULL,
    Map nvarchar(40) NOT NULL,
    Date datetime NOT NULL,
    FirstPickTeam tinyint NOT NULL,
    WinningTeam tinyint NOT NULL,
    Length int NOT NULL,
    Patch AS ((((((CONVERT(varchar(5),FLOOR(PatchSortable/(1000000000000000.)))+'.')+CONVERT(varchar(5),FLOOR((PatchSortable/(100000000000.))%(10000))))+'.')+CONVERT(varchar(5),FLOOR((PatchSortable/(10000000))%(10000))))+'.')+CONVERT(varchar(5),FLOOR(PatchSortable%(100000))))
);
GO

CREATE INDEX IX_Game_Fingerprint ON Game(Fingerprint);
GO
