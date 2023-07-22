const { uniq } = require('lodash')
const getCosmos = require('./db/getCosmos')
const getSqlServer = require('./db/getSqlServer')
const { azure: { cosmos: { heroStatsContainer } } } = require('./config')

const getData = async (startDate, endDate) => {
  const db = await getSqlServer()

  const sql = `
    SELECT
      CAST(YEAR(g.Date) AS varchar) + CAST(FORMAT(MONTH(g.Date), '00') AS varchar) + CAST(FORMAT(DAY(g.Date), '00') as varchar) AS Date,
      h.InternalName,
      SUM(CASE WHEN bs.IsWinner = 1 THEN 1 ELSE 0 END) AS Wins,
      SUM(CASE WHEN bs.IsWinner = 1 THEN 0 ELSE 1 END) AS Losses
    FROM
      BoxScoreEx bs
      JOIN Game g
        ON g.GameId = bs.GameId
      JOIN Hero h
        ON h.HeroId = bs.HeroId
    WHERE
      g.Date BETWEEN @startDate AND @endDate
    GROUP BY
      g.Date,
      h.InternalName
    ORDER BY
      g.Date
  `

  const response = await db
    .request()
    .input('startDate', startDate)
    .input('endDate', endDate)
    .query(sql)

  await db.close()

  return response.recordset.map(row => ({
    date: row.Date,
    internalName: row.InternalName,
    wins: row.Wins,
    losses: row.Losses
  }))
}

module.exports = async (startDate, endDate, log) => {
  const container = await getCosmos(heroStatsContainer, true)

  const data = await getData(startDate, endDate)

  const dates = uniq(data.map(row => row.date))

  for (const date of dates) {
    const item = { id: date, date, heroes: [] }
    const dataForDay = data.filter(row => row.date === date)

    for (const row of dataForDay) {
      item.heroes.push({ name: row.internalName, wins: row.wins, losses: row.losses })
    }

    await container.items.upsert(item)
    log(`Updated ${date}.`)
  }

  return dates.length
}
