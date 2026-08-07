module.exports = {
  extends: ['@react-native',
    'plugin:jsdoc/recommended-error',
    'airbnb',
    'plugin:perfectionist/recommended-alphabetical-legacy',
    'eslint:recommended'],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vendor/**'],
  parserOptions: {
    ecmaVersion: 'latest',
    jsx: true,
    project: './jsconfig.json',
  },
  plugins: ['jsdoc'],
  root: true,
  rules: {
    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 'off',
    // Desactivee volontairement (decision Adel 2026-07-18) : le poste de dev est
    // sous Windows avec core.autocrlf=true, qui convertit les LF en CRLF au
    // checkout. La regle produisait alors 12 554 warnings artificiels sur du code
    // non modifie, faisant echouer lint:no-regression (baseline prise sous Unix le
    // 12/05) et masquant les vrais signaux. Les fins de ligne restent normalisees
    // dans git via .gitattributes ; c'est la le bon endroit pour les gerer.
    'linebreak-style': 'off',
    'max-len': ['warn', {
      code: 100,
      ignoreComments: false,
      ignorePattern: '',
      ignoreStrings: false,
      ignoreTemplateLiterals: false,
      ignoreUrls: true,
      ignoreRegExpLiterals: true,
      ignoreTrailingComments: false,
    }],
    'no-use-before-define': ['warn', {
      classes: false,
      functions: false,
      variables: false,
    }],
    'react-native/no-inline-styles': 'off',
    'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx'] }],
    'react/jsx-uses-react': 'off',
    'react/prop-types': 'off', // We are using JSDoc instead
    'react/react-in-jsx-scope': 'off',
    // import order
    'perfectionist/sort-imports': ['error', {
      customGroups: {
        value: {
          components: '@/components/.+',
          domains: '@/domains/.+',
          navigation: '@/navigation/.+',
          screens: '@/views/.+',
          services: '@/services/.+',
          store: '@/store/.+',
          theme: '@/theme/.+',
          utils: '@/utils/.+',
        },
      },
      groups: [
        'type',
        'builtin',
        'external',
        ['theme', 'store', 'domains'],
        ['components', 'screens'],
        'navigation',
        'services',
        'utils',
        'unknown',
      ],
      newlinesBetween: 'always',
      type: 'alphabetical',
    }],
    // JSDOC Rules
    'jsdoc/check-access': 1,
    'jsdoc/check-alignment': 1,
    'jsdoc/check-param-names': 1,
    'jsdoc/check-property-names': 1,
    'jsdoc/check-tag-names': 1,
    'jsdoc/check-types': 1,
    'jsdoc/check-values': 1,
    'jsdoc/empty-tags': 1,
    'jsdoc/multiline-blocks': 1,
    'jsdoc/no-multi-asterisks': 1,
    'jsdoc/no-undefined-types': 0,
    'jsdoc/require-description': 1,
    'jsdoc/require-jsdoc': 1,
    'jsdoc/require-param': 1,
    'jsdoc/require-param-description': 0,
    'jsdoc/require-param-name': 1,
    'jsdoc/require-param-type': 1,
    'jsdoc/require-property': 1,
    'jsdoc/require-property-description': 0,
    'jsdoc/require-property-name': 1,
    'jsdoc/require-property-type': 1,
    'jsdoc/require-returns': 1,
    'jsdoc/require-returns-check': 1,
    'jsdoc/require-returns-description': 0,
    'jsdoc/require-returns-type': 1,
    'jsdoc/tag-lines': 1,
    'jsdoc/valid-types': 1,
  },
  settings: {
    'import/resolver': {
      alias: {
        // `.native.js` / `.web.js` ajoutées le 2026-08-07 (D30). Sans elles, le
        // résolveur d'ESLint ne voit AUCUN des modules résolus par plateforme —
        // le motif que `@/platform/device`, `@/platform/maps` et compagnie
        // utilisent depuis toujours. Chacun de ces `index.js` payait deux
        // erreurs gelées (`import/no-unresolved` + `import/extensions`) pour un
        // import parfaitement valide côté Metro et côté Vite.
        extensions: ['.js', '.jsx', '.json', '.native.js', '.web.js'],
        map: [
          ['@', './src'],
        ],
      },
    },
    perfectionist: {
      partitionByComment: true,
      type: 'alphabetical',
    },
  },
};
