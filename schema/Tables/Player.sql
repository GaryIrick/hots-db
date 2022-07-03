CREATE TABLE Player
(
    PlayerId uniqueidentifier NOT NULL CONSTRAINT PK_Player PRIMARY KEY,
    Region nvarchar(5) NOT NULL,
    ToonHandle nvarchar(25) NOT NULL
);
GO
