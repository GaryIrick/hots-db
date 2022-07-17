module.exports = (heroName) => {
  // The parser gets rid of the accent, we fix it up to match the actual name of the hero.
  if (heroName === 'Lucio') {
    return 'Lúcio'
  } else {
    return heroName
  }
}
