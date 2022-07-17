CREATE TABLE ChatMessage
(
    GameId uniqueidentifier NOT NULL CONSTRAINT FK_ChatMessage_Game REFERENCES Game(GameId) ON DELETE CASCADE,
    PlayerId uniqueidentifier NOT NULL CONSTRAINT FK_ChatMessage_Player REFERENCES Player(PlayerId),
    MessageOrder smallint NOT NULL,
    Time int NOT NULL,
    Message nvarchar(max) NOT NULL,
    CONSTRAINT PK_ChatMessage PRIMARY KEY (GameId, PlayerId, MessageOrder)
);
GO

CREATE INDEX IX_ChatMessage_GameId
    ON ChatMessage(GameId);
GO

CREATE INDEX IX_ChatMessage_PlayerId
    ON ChatMessage(PlayerId);
GO

