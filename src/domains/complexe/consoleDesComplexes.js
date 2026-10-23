/**
 * E-S01 — LA CONSOLE DES COMPLEXES (SuperAdmin) — RESA-L5B-2 (20/10/2026), planche ES01, plan
 * :1806-1850, serveur RESA-L4 (`/superadmin/complexes`, services/console.ts) : ce que la liste et
 * la fiche calculent sans le serveur. Le serveur garde chaque droit (policy is-superadmin) et
 * relit le motif ; l'écran ne fait que l'annoncer.
 *
 * Témoin : `consoleDesComplexes.test.js`.
 */

import { getZonedDateParts } from '@/utils/parisTime';

/**
 * Les parties de Paris d'un instant, ou null.
 * @param {unknown} iso - L'instant.
 * @returns {any} Les parties (`day`, `month`, `hour`, `minute`), ou null.
 */
const partiesDeParis = (iso) => {
  const instant = new Date(String(iso || ''));
  if (!iso || Number.isNaN(instant.getTime())) return null;
  return getZonedDateParts(instant);
};

const deux = (/** @type {unknown} */ nombre) => String(nombre).padStart(2, '0');

/**
 * « 13/10 », le jour de PARIS d'un instant.
 * @param {unknown} iso - L'instant.
 * @returns {string} Le jour, ou ''.
 */
export const jourCourt = (iso) => {
  const parties = partiesDeParis(iso);
  return parties ? `${deux(parties.day)}/${deux(parties.month)}` : '';
};

/**
 * « 21 h 10 », l'heure de PARIS d'un instant.
 * @param {unknown} iso - L'instant.
 * @returns {string} L'heure, ou ''.
 */
export const heureCourte = (iso) => {
  const parties = partiesDeParis(iso);
  return parties ? `${Number(parties.hour)} h ${deux(parties.minute)}` : '';
};

/** Les onglets de la liste, dans l'ordre de la planche. */
export const ONGLETS_CONSOLE = Object.freeze(['a-traiter', 'tous', 'suspendus']);

/** Le motif d'une suspension ou d'un retrait : comme la suspension de compte (serveur). */
export const MOTIF_MIN = 3;
export const MOTIF_MAX = 300;

/**
 * Le motif est-il recevable (3 à 300 caractères, espaces resserrés comme le serveur) ?
 * @param {unknown} texte - Le motif saisi.
 * @returns {boolean} Vrai s'il est recevable.
 */
export const motifValide = (texte) => {
  const motif = String(texte ?? '').replace(/\s+/g, ' ').trim();
  return motif.length >= MOTIF_MIN && motif.length <= MOTIF_MAX;
};

/**
 * Les pastilles d'une ligne de la liste (planche : « 2 signalements », « Suspendu », « Nouveau »).
 * Un complexe retiré ne porte que « Retiré ».
 * @param {Record<string, any>} ligne - `status`, `signalementsATraiter`, `nouveau`.
 * @returns {Array<{ cle: string, nombre?: number }>} Les pastilles, dans l'ordre.
 */
export const pastillesDuComplexe = (ligne) => {
  if (ligne?.status === 'retire') return [{ cle: 'retire' }];
  const pastilles = [];
  const signalements = Number(ligne?.signalementsATraiter) || 0;
  if (signalements > 0) pastilles.push({ cle: 'signalements', nombre: signalements });
  if (ligne?.status === 'suspendu') pastilles.push({ cle: 'suspendu' });
  if (ligne?.nouveau) pastilles.push({ cle: 'nouveau' });
  return pastilles;
};

/**
 * Les gestes que l'état du complexe permet (le serveur refuse les autres : 409).
 * @param {Record<string, any>} complexe - `status`.
 * @returns {{ reactiver: boolean, retirer: boolean, suspendre: boolean, verifier: boolean }} Les
 *   gestes.
 */
export const gestesPossibles = (complexe) => {
  const statut = String(complexe?.status || '');
  const vivant = statut !== 'retire';
  return {
    reactiver: statut === 'suspendu',
    retirer: vivant,
    suspendre: statut === 'actif',
    verifier: vivant,
  };
};

/**
 * Un nom court : le prénom et l'initiale du nom (jamais un numéro ni une adresse).
 * @param {Record<string, any> | null | undefined} personne - `firstname`, `lastname`.
 * @returns {string} « Sofia L. », ou ''.
 */
export const nomCourt = (personne) => {
  const prenom = String(personne?.firstname || '').trim();
  const initiale = String(personne?.lastname || '').trim().charAt(0);
  return [prenom, initiale ? `${initiale.toUpperCase()}.` : ''].filter(Boolean).join(' ');
};

const ACTIONS_DU_JOURNAL = Object.freeze({
  SUPERADMIN_COMPLEXE_REPORT_TREATED: 'signalementTraite',
  SUPERADMIN_COMPLEXE_RESTORED: 'reactive',
  SUPERADMIN_COMPLEXE_RETIRED: 'retire',
  SUPERADMIN_COMPLEXE_SUSPENDED: 'suspendu',
  SUPERADMIN_COMPLEXE_UNVERIFIED: 'nonVerifie',
  SUPERADMIN_COMPLEXE_VERIFIED: 'verifie',
});

/**
 * Le journal de la fiche : les gestes connus du serveur (le plus récent d'abord), puis la création
 * (sans validation, D6). Une action inconnue ne s'affiche pas.
 * @param {Record<string, any>} fiche - `complexe.createdAt`, `journal[]`.
 * RESA-FIN-APP-3 (23/10/2026) : l'auteur du geste (`auteurNom`, « Superadmin T. »), sinon null.
 * @returns {Array<{ auteur: string | null, cle: string, motif: string | null,
 *   quand: string | null }>} Les lignes.
 */
export const lignesDuJournal = (fiche) => {
  const gestes = (Array.isArray(fiche?.journal) ? fiche.journal : [])
    .map((/** @type {any} */ ligne) => ({
      auteur: ligne?.auteurNom ? String(ligne.auteurNom) : null,
      cle: /** @type {Record<string, string>} */ (ACTIONS_DU_JOURNAL)[String(ligne?.action)],
      motif: ligne?.reason ? String(ligne.reason) : null,
      quand: ligne?.timestamp || null,
    }))
    .filter((ligne) => Boolean(ligne.cle));
  const cree = fiche?.complexe?.createdAt || null;
  return cree ? [...gestes, {
    auteur: null, cle: 'cree', motif: null, quand: cree,
  }] : gestes;
};
