CREATE TABLE MapBan
(
    MatchId uniqueidentifier NOT NULL CONSTRAINT FK_MapBan_Match REFERENCES Match(MatchId) ON DELETE CASCADE,
    Map nvarchar(40) NOT NULL,
    Team nvarchar(200) NOT NULL
);
GO
