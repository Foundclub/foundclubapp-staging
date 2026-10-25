/**
 * PAR-L7 (13/10, design parent E01 / E02 / E03) — MES ENFANTS, EN BREF.
 *
 * « Mon profil » (le bloc) dit d'un enfant son prénom et où il en est — « Anissa · U11 Filles »,
 * « Martin · Demande en attente » —, trois au plus puis « + 2 autres » ; « Mon compte » en lit le
 * nombre, l'accueil le nombre et les prénoms (la carte d'un sportif, le bandeau du mode parent).
 * La règle de l'état est celle de la pastille de « Mes enfants » (`etatDeLEnfant`) : jamais un
 * enfant « en équipe » ici et « sans équipe » dans sa liste.
 * REC17-001 (décision d'Adel du 17/10) : la carte « Mes enfants » de l'accueil ne nomme plus
 * les enfants (une seule entrée) ; ses lignes et leurs destinations sont retirées d'ici.
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
 * @returns {{ lignes: LigneDEnfant[], reste: number, total: number, resume: ResumeDesEnfants }}
 *   - Les lignes à montrer (`MAX_LIGNES` au plus), combien restent, combien d'enfants en tout,
 *   et le résumé de la carte d'accueil (REC17-001-B).
 */
export const mesEnfantsEnBref = ({
  comptesRelies, demandes, fiches, t,
}) => {
  const lesDemandes = liste(demandes);
  // REC17-001-B (22/10) — le résumé de la carte d'accueil, avec la règle de « Mes enfants ».
  const etats = liste(fiches)
    .map((enfant) => etatDeLEnfant(enfant, demandesDe(enfant?.documentId, lesDemandes)));
  /** @type {ResumeDesEnfants} */
  const resume = {
    comptes: liste(comptesRelies).length,
    demandesEnAttente: etats.reduce((somme, etat) => somme + etat.enAttente, 0),
    enEquipe: etats.filter((etat) => etat.ton === 'ok').length,
    sansEquipe: etats.filter((etat) => etat.ton === 'neutre').length,
  };
  /** @type {LigneDEnfant[]} */
  const toutes = [
    ...liste(comptesRelies).map((compte) => ({
      cle: `compte-${compte?.documentId}`,
      etat: t('myChildren.list.state.hasAccount'),
      prenom: String(compte?.firstname || compte?.lastname || '').trim(),
    })),
    ...liste(fiches).map((enfant) => ({
      cle: `fiche-${enfant?.documentId}`,
      etat: etatDeLaFiche(t, enfant, lesDemandes),
      prenom: String(enfant?.firstname || enfant?.lastname || '').trim(),
    })),
  ];
  return {
    lignes: toutes.slice(0, MAX_LIGNES),
    reste: Math.max(0, toutes.length - MAX_LIGNES),
    resume,
    total: toutes.length,
  };
};

/**
 * @typedef {{
 *   comptes: number,
 *   demandesEnAttente: number,
 *   enEquipe: number,
 *   sansEquipe: number,
 * }} ResumeDesEnfants
 */

/**
 * REC17-001-B (choix d'Adel « carte B » du 22/10, planche 14 du parcours parent) — LA pastille
 * de la carte d'accueil : la plus urgente, sans prénom. Une demande qui attend passe avant un
 * enfant sans équipe, qui passe avant « Tous en équipe ». Un enfant qui a son compte ne dit pas
 * son équipe : avec lui, pas de « Tous en équipe » (on ne l'affirme pas sans le savoir).
 * @param {{ total: number, resume?: ResumeDesEnfants }} bref - Ce que rend `mesEnfantsEnBref`.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @returns {{ texte: string, ton: 'attente' | 'compte' | 'ok' } | null} - La pastille, ou rien.
 */
export const pastilleDeLaCarte = (bref, t) => {
  const resume = bref?.resume;
  if (!resume || !bref.total) return null;
  if (resume.demandesEnAttente > 0) {
    return {
      texte: t('homeHub.cards.search.myChildren.pending', { count: resume.demandesEnAttente }),
      ton: 'attente',
    };
  }
  if (resume.sansEquipe > 0) {
    return {
      texte: t('homeHub.cards.search.myChildren.noTeam', { count: resume.sansEquipe }),
      ton: 'compte',
    };
  }
  if (resume.enEquipe === bref.total) {
    return { texte: t('homeHub.cards.search.myChildren.allInTeam'), ton: 'ok' };
  }
  return null;
};

/**
 * Ce qu'entend le lecteur d'écran sur la carte : « Mes enfants, 2 enfants, 1 demande en
 * attente ». Tant que les lectures n'ont pas répondu (`connu` faux), le titre seul.
 * @param {{ connu?: boolean, total: number, resume?: ResumeDesEnfants }} bref - Le bref lu.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @returns {string} - Le libellé.
 */
export const libelleDeLaCarte = (bref, t) => {
  const titre = t('homeHub.cards.search.myChildren.title');
  if (!bref?.connu) return titre;
  if (!bref.total) return [titre, t('homeHub.cards.search.myChildren.empty')].join(', ');
  const pastille = pastilleDeLaCarte(bref, t);
  return [
    titre,
    t('homeHub.cards.search.myChildren.count', { count: bref.total }),
    pastille?.texte,
  ].filter(Boolean).join(', ');
};
