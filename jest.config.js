module.exports = {
  preset: 'react-native',
  // supercluster (et sa dépendance kdbush) sont publiés en ESM pur : ils doivent
  // passer par Babel comme les modules react-native, sinon Jest ne peut pas les charger.
  //
  // @react-navigation ajouté le 2026-08-07 (lot D24) : ces paquets n'ont PLUS de
  // build CommonJS depuis la v7 (`"main": "./lib/module/index.js"`), donc tout
  // test qui monte un vrai navigateur mourait sur « Unexpected token 'export' ».
  // C'est ce qu'exige `friendlyMatchWizardAtterrissage.test.js` : le tunnel
  // amical est une pile IMBRIQUÉE et l'écran d'arrivée n'est pas dedans, donc
  // seul le VRAI routeur dit où l'on atterrit. Coût mesuré avant/après sur la
  // suite complète : 142 suites, aucune régression, ~36 s.
  transformIgnorePatterns: [
    // eslint-disable-next-line max-len -- une seule expression, la couper la rendrait illisible
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|supercluster|kdbush)/)',
  ],
};
