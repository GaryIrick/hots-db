CREATE FUNCTION GetPatchSortable(@patch VARCHAR(30))
RETURNS BIGINT
AS
BEGIN
    DECLARE @parts TABLE(idx TINYINT, part VARCHAR(10))
    INSERT INTO @parts SELECT ROW_NUMBER() OVER(ORDER BY CURRENT_TIMESTAMP), value from string_split(@patch, '.')
    DECLARE @sortable VARCHAR(50) = ''

    SET @sortable = @sortable + (SELECT part FROM @parts WHERE idx = 1)
    SET @sortable = @sortable + RIGHT('0000' + (SELECT part FROM @parts WHERE idx = 2), 4)
    SET @sortable = @sortable + RIGHT('0000' + (SELECT part FROM @parts WHERE idx = 3), 4)
    SET @sortable = @sortable + RIGHT('0000000' + (SELECT part FROM @parts WHERE idx = 4), 7)
    
    RETURN CAST(@sortable AS BIGINT)
END
