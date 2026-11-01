import { useEffect, useSyncExternalStore } from 'react';

/**
 * REPRISE-PLACE (01/11/2026, point 7 de la recette du site) — ce qu'un écran dit de lui-même au
 * cadre du SITE : le titre de la barre fine (le nom du club, du joueur…, que le registre ne connaît
 * pas) et l'onglet à allumer quand il dépend de la donnée (sa propre fiche de club). Un magasin de
 * module, comme `playerMode.js` : un seul écran à la fois sur le site. Au téléphone, personne ne
 * le lit.
 * 🧪 Témoin : `__tests__/pageDuSite.test.js`.
 */

/** @typedef {{ onglet: string | null, titre: string | null }} PageDuSite */

const VIDE = Object.freeze({ onglet: null, titre: null });
/** @type {PageDuSite} */
let page = VIDE;
/** @type {Set<() => void>} */
const abonnes = new Set();

/**
 * Remplace la page déclarée et prévient les lecteurs.
 * @param {PageDuSite} suivante - La nouvelle page.
 * @returns {void}
 */
const poser = (suivante) => {
  if (suivante.titre === page.titre && suivante.onglet === page.onglet) return;
  page = suivante.titre === null && suivante.onglet === null ? VIDE : suivante;
  abonnes.forEach((prevenir) => prevenir());
};

/**
 * La page déclarée en ce moment.
 * @returns {PageDuSite} Le titre et l'onglet, `null` quand l'écran n'a rien dit.
 */
export const lirePageDuSite = () => page;

/**
 * S'abonne aux changements de la page.
 * @param {() => void} prevenir - Rappel.
 * @returns {() => void} Le désabonnement.
 */
const abonner = (prevenir) => {
  abonnes.add(prevenir);
  return () => { abonnes.delete(prevenir); };
};

/**
 * Lecture pour la barre fine et la coque du site.
 * @returns {PageDuSite} La page déclarée.
 */
export const usePageDuSite = () => useSyncExternalStore(abonner, lirePageDuSite, lirePageDuSite);

/**
 * Déclaration par l'écran : posée à chaque changement, effacée quand l'écran part.
 * @param {{ onglet?: string | null, titre?: string | null }} declaration - Ce que l'écran dit.
 * @returns {void}
 */
export const useDeclarerPageDuSite = ({ onglet = null, titre = null }) => {
  useEffect(() => {
    poser({ onglet, titre });
  }, [onglet, titre]);
  useEffect(() => () => poser(VIDE), []);
};
