module.exports = {
  preset: 'react-native',
  // supercluster (et sa dépendance kdbush) sont publiés en ESM pur : ils doivent
  // passer par Babel comme les modules react-native, sinon Jest ne peut pas les charger.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|supercluster|kdbush)/)',
  ],
};
