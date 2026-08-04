const React = require('react');
const { Text } = require('react-native');

/**
 * Doublure d'un composant enfant : elle rend son NOM en texte visible.
 * Un test peut donc constater « ce bloc est bien rendu » sans dependre de
 * l'implementation de l'enfant, ni de la forme de l'arbre.
 *
 * Vit HORS de `__tests__/` : tout fichier place la-dedans est ramasse par Jest
 * comme une suite de tests, et une suite sans test echoue. Et dans un fichier a
 * part parce que les fabriques de `jest.mock` sont remontees en tete du fichier
 * de test : elles ne peuvent appeler qu'un module qu'elles `require` elles-memes.
 * @param {string} name - Nom rendu par la doublure.
 * @returns {() => any} - Le composant doublure.
 */
const makeTextDouble = (name) => function TextDouble() {
  return React.createElement(Text, null, name);
};

module.exports = { makeTextDouble };
