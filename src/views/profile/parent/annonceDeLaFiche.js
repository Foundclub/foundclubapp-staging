import { useSyncExternalStore } from 'react';

/**
 * PAR-L5L6 (13/10, design parent E05 et E08) — LE RESULTAT DU DERNIER GESTE SUR UNE FICHE.
 *
 * « Mes enfants » doit DIRE ce qui vient de se passer : « La fiche d'Anissa est supprimée. »,
 * « La fiche d'Anissa est créée. » (aujourd'hui : aucun message). Le geste a souvent lieu sur
 * UN AUTRE ecran (le formulaire, la fiche de l enfant), puis on revient a la liste.
 *
 * ⛔ Pourquoi pas un parametre de navigation : sur le site, les parametres d une route passent
 * dans l adresse (`buildWebPath` les recopie en requete). Le prenom d un enfant n a rien a
 * faire dans une URL. L annonce vit donc ici, en memoire, le temps d etre lue — et la liste
 * l efface quand on la quitte.
 */

/** @typedef {{ documentId?: string, firstname: string, type: 'creee' | 'supprimee' }} Annonce */

/** @type {Annonce | null} */
let annonce = null;
/** @type {Set<() => void>} */
const abonnes = new Set();

const prevenir = () => abonnes.forEach((abonne) => abonne());

/**
 * Pose l annonce du geste qui vient de reussir (elle remplace la precedente).
 * @param {Annonce} nouvelle - Le geste et l enfant.
 * @returns {void}
 */
export const annoncer = (nouvelle) => {
  annonce = nouvelle || null;
  prevenir();
};

/**
 * Efface l annonce (la liste qu on quitte, un geste suivant).
 * @returns {void}
 */
export const effacerLAnnonce = () => {
  if (annonce === null) return;
  annonce = null;
  prevenir();
};

/**
 * Abonne un ecran aux changements de l annonce.
 * @param {() => void} abonne - Prevenu a chaque changement.
 * @returns {() => void} - Le desabonnement.
 */
const sAbonner = (abonne) => {
  abonnes.add(abonne);
  return () => { abonnes.delete(abonne); };
};

const lire = () => annonce;

/**
 * L annonce en cours, ou rien.
 * @returns {Annonce | null} - Le dernier geste reussi.
 */
export const useAnnonceDeLaFiche = () => useSyncExternalStore(sAbonner, lire, lire);
