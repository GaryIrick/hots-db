CREATE TABLE TeamPlayer
(
	TeamId uniqueidentifier NOT NULL CONSTRAINT FK_TeamPlayer_Team REFERENCES Team(TeamId) ON DELETE CASCADE,
	PlayerId uniqueidentifier NOT NULL CONSTRAINT FK_TeamPlayer_Player REFERENCES Player(PlayerId) ON DELETE CASCADE,
	IsCaptain BIT NOT NULL CONSTRAINT DF_TeamPlayer_Captain DEFAULT(0),
	IsAssistantCaptain BIT NOT NULL CONSTRAINT DF_TeamPlayer_AssistantCaptain DEFAULT(0),
	CONSTRAINT PK_TeamPlayer PRIMARY KEY (TeamId, PlayerId)
);
GO

CREATE INDEX IX_TeamPlayer_TeamId ON TeamPlayer(TeamId);
GO

CREATE INDEX IX_TeamPlayer_PlayerId ON TeamPlayer(PlayerId);
GO
