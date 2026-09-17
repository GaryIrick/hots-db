const getFromHeroesProfile = require('./apis/getFromHeroesProfile')

// We don't use this data, but Heroes Profile expects API consumers to call it.
module.exports = async (log) => {
  const params = { limit: 5000 }
  let count = 0
  let hasMore = true

  while (hasMore) {
    const { changes, next_since: nextSince, next_after_id: nextAfterId, has_more: more } = await getFromHeroesProfile('players/privacy/changes', params)
    count += changes.length
    log(`found ${changes.length} privacy changes`)

    params.since = nextSince
    params.after_id = nextAfterId
    hasMore = more
  }

  return count
}
