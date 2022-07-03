CREATE TABLE Hero
(
    HeroId tinyint NOT NULL CONSTRAINT PK_Hero PRIMARY KEY,
    Name nvarchar(20) NOT NULL,
    Role nvarchar(20) NOT NULL,
    Type nvarchar(20) NOT NULL
)
