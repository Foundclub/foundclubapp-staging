/**
 * Capteurs de props du lot P7 (detection / recrutement).
 *
 * Une doublure de texte prouve qu'un bloc est MONTE ; elle ne prouve jamais
 * qu'un CHIFFRE est juste. Ces deux boites servent aux temoins qui doivent
 * lire ce que `EventDetails` descend reellement a ses enfants.
 *
 * Vit HORS de `__tests__/` : tout fichier place la-dedans est ramasse par Jest
 * comme une suite de tests, et une suite sans test echoue. Et dans un fichier a
 * part parce que les fabriques de `jest.mock` sont remontees en tete du fichier
 * de test : elles ne peuvent appeler qu'un module qu'elles `require` elles-memes.
 */

/** @type {{ props: any }} */
const capteurEntete = { props: null };

/** @type {{ props: any }} */
const capteurParticipants = { props: null };

module.exports = { capteurEntete, capteurParticipants };
