module.exports = {
  env: {
    node: true
  },
  extends: [
    'standard'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    __API_URL__: 'readonly',
    __OAUTH_URL__: 'readonly',
    localStorage: 'readonly'
  },
  parserOptions: {
    ecmaFeatures: {
    },
    ecmaVersion: 2018
  },
  plugins: [
  ],
  rules: {
  },
  ignorePatterns: ['site_dist/**/*']
}
