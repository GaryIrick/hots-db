CREATE TABLE ChatMessage
(
    GameId uniqueidentifier NOT NULL CONSTRAINT FK_ChatMessage_Game REFERENCES Game(GameId) ON DELETE CASCADE,
    PlayerId uniqueidentifier NOT NULL CONSTRAINT FK_ChatMessage_Player REFERENCES Player(PlayerId),
    MessageOrder smallint NOT NULL,
    Time int NOT NULL,
    Message nvarchar(max) NOT NULL,
    IsAllChat bit NOT NULL CONSTRAINT DF_ChatMessage_IsAllChat DEFAULT (0),
    CONSTRAINT PK_ChatMessage PRIMARY KEY (GameId, PlayerId, MessageOrder)
);
GO

CREATE INDEX IX_ChatMessage_GameId
    ON ChatMessage(GameId);
GO

CREATE INDEX IX_ChatMessage_PlayerId
    ON ChatMessage(PlayerId);
GO

