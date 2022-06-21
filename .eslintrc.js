module.exports = {
    "env": {
        "node": true
    },
    "extends": [
        "standard"
    ],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly",
        "__API_URL__": "readonly",
        "__OAUTH_URL__": "readonly",
        "localStorage": "readonly"
    },
    "parserOptions": {
        "ecmaFeatures": {
        },
        "ecmaVersion": 2018
    },
    "plugins": [
        'eslint-plugin-react',
        'eslint-plugin-react-hooks'
    ],
    "rules": {
        "react/jsx-uses-react": "error",
        "react/jsx-uses-vars": "error",
        'react/jsx-no-undef': "error",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn"
    },
    ignorePatterns: ["site_dist/**/*"]
};