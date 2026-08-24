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

/**
 * R9 — la barre du bas. Elle porte `onJoin`, seul chemin qui ouvre le choix
 * du poste : sans ce capteur, aucun temoin ne peut OUVRIR ce selecteur.
 * @type {{ props: any }}
 */
const capteurBarreDuBas = { props: null };

/**
 * R9 — la modale de participation. Elle porte `contextNote`, la phrase qui
 * dit QUEL poste a ete choisi : c est la seule difference observable entre
 * « je postule au poste de gardien » et « je participe sans poste precis ».
 * @type {{ props: any }}
 */
const capteurModaleParticipation = { props: null };

module.exports = {
  capteurBarreDuBas,
  capteurEntete,
  capteurModaleParticipation,
  capteurParticipants,
};
