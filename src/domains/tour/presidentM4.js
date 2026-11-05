import { homeTarget, teamHubTarget } from '@/domains/tour/guideCommon';
import t from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide Dirigeant·e, M4 « Gérer les demandes » (pack `05_` §M4 ; carte du 05/11 §3, §5-4 et §5-7).
 * La demande d'exemple vit au rendu de `RequestsHub`, tant que l'étape porte `tourExample` : rien
 * en cache, donc rien à purger, et elle ne revient pas après une reprise. Aucune écriture.
 * « Voir le profil » n'est pas proposé : un faux profil n'a pas de fiche.
 */

/**
 * M3 a créé une équipe : on est sur « Mes équipes », qui a la barre d'onglets.
 * @param {any} ctx - Contexte du guide.
 * @returns {boolean} Vrai si l'équipe vient d'être créée.
 */
const teamCreated = (ctx) => Boolean(ctx?.created?.['team.created']);

const EXAMPLE = 'membershipRequest';

export const M4_MISSIONS = [
  {
    gaugeStep: 25,
    id: 'president_m4',
    locked: true,
    get title() { return t('missions.m4', 'Gérer les demandes'); },
  },
];

export const M4_STEPS = [
  {
    // L'alerte « Félicitations » passe devant et n'a pas de rappel : cette bulle se lit après elle.
    bubblePlacement: 'top',
    id: 'm3-ok',
    missionId: 'president_m4',
    navTarget: teamHubTarget,
    get nextLabel() { return t('understood', 'Compris'); },
    get text() {
      return t(
        'm3-ok',
        'Ton équipe t’attend dans « Mes équipes ». Pas besoin de toutes les créer : tes coachs '
          + 'peuvent créer les leurs, si tu le leur permets.',
      );
    },
    veil: false,
    when: teamCreated,
  },
  {
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'm4-back1',
    missionId: 'president_m4',
    resumeFrom: 'm4-card',
    targets: ['dock.home'],
    get text() { return t('m4-back1', 'Dernière mission : les demandes. Retourne à l’accueil.'); },
    when: teamCreated,
  },
  {
    // M3 refusée ou passée : on n'est pas sur un écran à barre d'onglets, le guide ramène.
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'm4-home',
    missionId: 'president_m4',
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.home'],
    get text() { return t('m4-back1', 'Dernière mission : les demandes. Retourne à l’accueil.'); },
    when: (/** @type {any} */ ctx) => !teamCreated(ctx),
  },
  {
    advanceOn: { key: RouteNames.RequestsHub, type: 'route' },
    id: 'm4-card',
    missionId: 'president_m4',
    navTarget: homeTarget,
    targets: ['home.card.manage-requests'],
    get text() { return t('m4-card', 'Ouvre « Demandes ».'); },
  },
  {
    advanceOn: { key: 'requests.filter.club', type: 'interaction' },
    id: 'm4-filter',
    missionId: 'president_m4',
    resumeFrom: 'm4-card',
    targets: ['rf-club'],
    get text() {
      return t('m4-filter', 'Les demandes pour rejoindre le club arrivent dans le filtre « Club ». '
        + 'Touche-le.');
    },
    tourExample: EXAMPLE,
  },
  {
    id: 'm4-card2',
    missionId: 'president_m4',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'm4-card',
    targets: ['req-card'],
    // Décision 10 : le coach de M2 est déjà membre, il ne passera jamais par ici.
    get text() {
      return t(
        'm4-card2',
        'Attention : cette demande est FAUSSE, cette personne n’existe pas. Un coach que tu '
          + 'ajoutes est déjà membre : seuls ceux qui s’inscrivent seuls arrivent ici.',
      );
    },
    tourExample: EXAMPLE,
  },
  {
    // La fenêtre « Félicitations » est un `Modal` : pas de cadre dessus, validé au geste.
    advanceOn: { key: 'membershipRequest.accepted.example', type: 'interaction' },
    completesMission: true,
    id: 'm4-accept',
    missionId: 'president_m4',
    resumeFrom: 'm4-card',
    targets: ['req-card'],
    get text() {
      return t(
        'm4-accept',
        'Entraîne-toi : touche Accepter. Personne ne rejoindra vraiment ton club.',
      );
    },
    tourExample: EXAMPLE,
  },
];
