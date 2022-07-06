CREATE TABLE Game
(
    GameId uniqueidentifier NOT NULL CONSTRAINT PK_Game PRIMARY KEY,
    Source nvarchar(200) NOT NULL,
    PatchSortable bigint NOT NULL,
    Region nvarchar(2) NOT NULL,
    Map nvarchar(40) NOT NULL,
    Date datetime NOT NULL,
    FirstPick tinyint NOT NULL,
    Winner tinyint NOT NULL,
    Length int NOT NULL,
    Patch AS ((((((CONVERT(varchar(5),FLOOR(PatchSortable/(1000000000000000.)))+'.')+CONVERT(varchar(5),FLOOR((PatchSortable/(100000000000.))%(10000))))+'.')+CONVERT(varchar(5),FLOOR((PatchSortable/(10000000))%(10000))))+'.')+CONVERT(varchar(5),FLOOR(PatchSortable%(10000))))
);
GO