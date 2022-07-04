CREATE TABLE Talent
(
    TalentId smallint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Talent PRIMARY KEY,
    HeroId tinyint NOT NULL CONSTRAINT FK_Talent_Hero REFERENCES Hero(HeroId),
    Tier tinyint NOT NULL,
    Name nvarchar(100) NOT NULL,
    InternalName nvarchar(100) NOT NULL,
    Description nvarchar(1000) NOT NULL,
    SortOrder tinyint NOT NULL,
    Icon nvarchar(100) NOT NULL,
    IsActive bit NOT NULL
);
GO

CREATE UNIQUE INDEX UX_Talent_Hero_InternalName ON Talent(HeroId, InternalName)
GO
