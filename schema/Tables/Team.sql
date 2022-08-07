CREATE TABLE Team
(
	TeamId uniqueidentifier NOT NULL CONSTRAINT PK_Team PRIMARY KEY,
	Name nvarchar(100) NOT NULL,
	NgsTeamId nvarchar(50) NOT NULL, 
    Division NVARCHAR(15) NOT NULL, 
    Coast NVARCHAR(10) NULL,
	IsActive bit NOT NULL CONSTRAINT DF_Team_IsActive DEFAULT (0)
);
GO

CREATE UNIQUE INDEX IX_Team_NgsTeamId ON Team(NgsTeamId);
GO
