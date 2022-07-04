CREATE TABLE Hero
(
    HeroId tinyint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Hero PRIMARY KEY,
    Name nvarchar(20) NOT NULL,
    InternalName nvarchar(10) NOT NULL,
    Role nvarchar(20) NOT NULL,
    Type nvarchar(20) NOT NULL
);
GO