import { act } from 'react-test-renderer';

// MSGLIVE — LE FAUX FIL TÉLÉPHONIQUE, en un seul exemplaire.
//
// Ce n'est pas une suite de témoins : c'est le socket de doublure qu'ils
// partagent. Il vit ici, et pas dans le fichier de témoin, pour deux raisons :
//
//   1. une fabrique `jest.mock(...)` est HISSÉE avant tout le fichier : elle ne
//      peut pas se servir d'une variable déclarée dans ce même fichier, sauf à
//      la faire passer par un module ;
//   2. tout fichier `.js` posé dans un dossier `__tests__` est lu par Jest
//      COMME un témoin, et meurt sur « votre suite doit contenir au moins un
//      test ». `src/testSupport/` est l'endroit prévu pour ça dans ce dépôt.
//
// ⚠️ AUCUN `jest.fn()` ICI, et c'est délibéré : hors d'un fichier de test, la
// variable globale `jest` n'existe pas pour ESLint (`no-undef`), et les quatre
// autres doublures de `src/testSupport/` s'en passent déjà. Un simple tableau
// d'appels rend le même service.

/** Les abonnés, par nom d'événement. @type {Map<string, Function[]>} */
export const abonnes = new Map();

/** Ce que l'écran a envoyé au serveur. @type {Array<{ nom: string, charge: any }>} */
export const envois = [];

export const socketDeTest = {
  emit: (/** @type {string} */ nom, /** @type {any} */ charge) => {
    envois.push({ charge, nom });
  },
  off: (/** @type {string} */ nom, /** @type {Function} */ fn) => {
    const liste = abonnes.get(nom) || [];
    abonnes.set(nom, liste.filter((candidat) => candidat !== fn));
  },
  on: (/** @type {string} */ nom, /** @type {Function} */ fn) => {
    const liste = abonnes.get(nom) || [];
    liste.push(fn);
    abonnes.set(nom, liste);
  },
};

/**
 * Joue un événement serveur, exactement comme le vrai socket le ferait.
 * @param {string} nom - Nom de l'événement diffusé par le serveur.
 * @param {any} charge - Charge utile de l'événement.
 * @returns {void}
 */
export const emettreDuServeur = (nom, charge) => {
  act(() => {
    [...(abonnes.get(nom) || [])].forEach((fn) => fn(charge));
  });
};

/**
 * Oublie tous les abonnements et tous les envois entre deux témoins.
 * @returns {void}
 */
export const reinitialiserSocketDeTest = () => {
  abonnes.clear();
  envois.length = 0;
};

export default socketDeTest;
