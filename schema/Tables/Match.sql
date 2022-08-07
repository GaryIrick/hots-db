CREATE TABLE Match
(
    MatchId uniqueidentifier NOT NULL CONSTRAINT PK_Match PRIMARY KEY,
    NgsMatchId nvarchar(50) NOT NULL,
    Season tinyint NOT NULL,
    Division nvarchar(15) NOT NULL,
    Coast nvarchar(10) NULL,
    HomeTeam nvarchar(200) NOT NULL,
    HomeNgsTeamId nvarchar(50) NOT NULL,
    AwayTeam nvarchar(200) NOT NULL,
    AwayNgsTeamId nvarchar(50) NOT NULL,
    Round tinyint NULL,
    IsPlayoffs bit NOT NULL,
    Caster nvarchar(200) NULL,
    VodLinks nvarchar(max) NULL
);
GO
