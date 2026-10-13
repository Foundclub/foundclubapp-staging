/**
 * PAR-L7 (13/10, design parent E01 / E02 / E03) — MES ENFANTS, EN BREF.
 *
 * L'accueil (la carte « Mes enfants »), « Mon compte » (le nombre) et « Mon profil » (le bloc)
 * disent la MÊME chose d'un enfant : son prénom et où il en est — « Anissa · U11 Filles »,
 * « Martin · Demande en attente » —, trois au plus puis « + 2 autres ». Une seule règle pour
 * les trois, et c'est celle de la pastille de « Mes enfants » (`etatDeLEnfant`) : jamais un
 * enfant « en équipe » à l'accueil et « sans équipe » dans sa liste.
 *
 * Ce fichier ne touche ni le réseau ni un écran (le crochet `useMesEnfantsEnBref` lit, ce
 * fichier répond) : un témoin le lit sans rien monter.
 */
import { demandesDe, etatDeLEnfant } from '@/views/profile/parent/demandesDeLEnfant';

/**
 * Les rôles du club qui peuvent avoir des enfants dans l'app : le serveur leur ouvre les fiches
 * (`declared-child.mine`) et les liens (`parent-link-request.asParent`) — admin `src/index.ts`,
 * blocs Joueur, Entraîneur, Dirigeant et Parent. « Avoir des enfants » est une CAPACITÉ, pas un
 * privilège de rôle (GO Adel du 07/09) ; le super admin et un compte sans rôle n'y ont pas droit.
 */
const ROLES_QUI_ONT_DES_ENFANTS = Object.freeze(['parent', 'player', 'coach', 'president']);

/**
 * Ce rôle de compte peut-il avoir des enfants dans l'app ?
 * @param {unknown} roleKey - Le rôle du COMPTE (`getUserRoleKey`).
 * @returns {boolean} - Vrai pour les quatre rôles du club.
 */
export const peutAvoirDesEnfants = (roleKey) => ROLES_QUI_ONT_DES_ENFANTS
  .includes(/** @type {any} */ (roleKey));

/** Combien d'enfants on nomme avant « + 2 autres ». */
export const MAX_LIGNES = 3;

/**
 * Une liste lue, ou une liste vide.
 * @param {unknown} valeur - Ce que le serveur a rendu.
 * @returns {any[]} - La liste.
 */
const liste = (valeur) => (Array.isArray(valeur) ? valeur : []);

/**
 * Où en est une fiche (un enfant sans compte), en quelques mots.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @param {any} fiche - La fiche (`GET /declared-children/mine`).
 * @param {any[]} demandes - Toutes les demandes lues (`/club-interest-requests/mine`).
 * @returns {string} - « U11 Filles », « Demande en attente » ou « Pas encore d'équipe ».
 */
const etatDeLaFiche = (t, fiche, demandes) => {
  const etat = etatDeLEnfant(fiche, demandesDe(fiche?.documentId, demandes));
  if (etat.ton === 'ok') return etat.equipes[0] || etat.club || t('myChildren.list.state.inTeam');
  if (etat.ton === 'attente') return t('myChildren.list.state.pending', { count: etat.enAttente });
  return t('myChildren.screen.noTeam');
};

/**
 * @typedef {{
 *   cle: string,
 *   prenom: string,
 *   etat: string,
 *   cible: { id: string, type: 'compte' | 'fiche' },
 * }} LigneDEnfant
 */

/**
 * Mes enfants en bref : les comptes reliés d'abord, puis les fiches — l'ordre de « Mes
 * enfants » (STATS-FIX2).
 * @param {{
 *   t: (cle: string, options?: any) => string,
 *   fiches?: unknown,
 *   comptesRelies?: unknown,
 *   demandes?: unknown,
 * }} entree - Ce que les trois lectures ont rendu, et la traduction.
 * @returns {{ lignes: LigneDEnfant[], reste: number, total: number }} - Les lignes à montrer
 *   (`MAX_LIGNES` au plus), combien restent, et combien d'enfants en tout.
 */
export const mesEnfantsEnBref = ({
  comptesRelies, demandes, fiches, t,
}) => {
  const lesDemandes = liste(demandes);
  /** @type {LigneDEnfant[]} */
  const toutes = [
    ...liste(comptesRelies).map((compte) => ({
      cible: { id: String(compte?.documentId || ''), type: /** @type {const} */ ('compte') },
      cle: `compte-${compte?.documentId}`,
      etat: t('myChildren.list.state.hasAccount'),
      prenom: String(compte?.firstname || compte?.lastname || '').trim(),
    })),
    ...liste(fiches).map((enfant) => ({
      cible: { id: String(enfant?.documentId || ''), type: /** @type {const} */ ('fiche') },
      cle: `fiche-${enfant?.documentId}`,
      etat: etatDeLaFiche(t, enfant, lesDemandes),
      prenom: String(enfant?.firstname || enfant?.lastname || '').trim(),
    })),
  ];
  return {
    lignes: toutes.slice(0, MAX_LIGNES),
    reste: Math.max(0, toutes.length - MAX_LIGNES),
    total: toutes.length,
  };
};

/**
 * Une ligne telle qu'elle se lit : « Anissa · U11 Filles ».
 * @param {LigneDEnfant} ligne - La ligne.
 * @returns {string} - Le texte.
 */
export const texteDeLaLigne = (ligne) => `${ligne.prenom} · ${ligne.etat}`;

/**
 * Ce que la carte « Mes enfants » de l'accueil écrit sous son titre (design E01) : une ligne
 * par enfant nommé, puis « + 2 autres » s'il en reste.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @param {ReturnType<typeof mesEnfantsEnBref>} bref - Mes enfants en bref.
 * @returns {string[]} - Les lignes, dans l'ordre.
 */
export const lignesAAfficher = (t, bref) => [
  ...bref.lignes.map(texteDeLaLigne),
  ...(bref.reste > 0 ? [t('myChildren.summary.more', { count: bref.reste })] : []),
];
