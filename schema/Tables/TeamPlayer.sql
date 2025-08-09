CREATE TABLE TeamPlayer
(
	TeamId uniqueidentifier NOT NULL CONSTRAINT FK_TeamPlayer_Team REFERENCES Team(TeamId) ON DELETE CASCADE,
	NgsBattleTag nvarchar(120) NOT NULL,
	IsCaptain BIT NOT NULL CONSTRAINT DF_TeamPlayer_Captain DEFAULT(0),
	IsAssistantCaptain BIT NOT NULL CONSTRAINT DF_TeamPlayer_AssistantCaptain DEFAULT(0),
	CONSTRAINT PK_TeamPlayer PRIMARY KEY (TeamId, NgsBattleTag)
);
GO

CREATE INDEX IX_TeamPlayer_TeamId ON TeamPlayer(TeamId);
GO
