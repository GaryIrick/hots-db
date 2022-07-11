module.exports = (regionId) => {
  switch (regionId) {
    case 1:
      return 'NA'
    case 2:
      return 'EU'
    case 3:
      return 'KR'
    case 5:
      return 'CN'
    default:
      return `R${regionId}`
  }
}
