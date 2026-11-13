import i18next from 'i18next';
import { Platform } from 'react-native';

import {
  extendStep,
  hasTeamNow,
  homeTarget,
  planningTarget,
  teamHubTarget,
  teamWizardSteps,
  trainsTeamInClub,
  WIZARD,
  wizardStep,
} from '@/domains/tour/guideCommon';
import { exampleMatch } from '@/domains/tour/tourExamples';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { RouteNames } from '@/navigation/routeNames';

import { isDesktopWeb } from '@/responsive/isDesktopWeb';

/**
 * Guide E · Entraîneur·e (TUTOE, pack `design_handoff_tutoriels/02_GUIDE_E_ENTRAINEUR.md`,
 * validé par Adel le 26/10 « 2- ok go »). Les ids d'étape sont ceux du
 * prototype (`ge2-guide.jsx`). Rien n'est prérempli : chaque étape attend le
 * vrai geste (`advanceOn`). Le guide ne navigue qu'au départ, à la reprise et
 * sur une étape `navigateOnEnter` (B2 : le match d'exemple n'a pas de carte).
 *
 * ponytail: B2 entre directement dans « Convoquer » sur le match d'exemple :
 * pas de carte d'exemple dans le planning, pas d'onglet Convocation de la
 * fiche, pas de message local dans le canal. Aucune écriture n'est possible,
 * mais le chemin « planning › match › Convocation » n'est que dit dans la
 * bulle. Sortie : insérer `exampleMatch` dans le cache du planning (pack 01 §6).
 */

/**
 * Texte d'une bulle, par i18n avec repli français.
 * @param {string} id - Id de l'étape ou du texte.
 * @param {string} fallback - Texte français.
 * @param {Record<string, any>} [values] - Interpolation.
 * @returns {string} Texte.
 */
const t = (id, fallback, values) => String(
  i18next.t(`tourCatalog.coach.${id}`, fallback, values),
);

const eventWizardTarget = {
  params: { screen: RouteNames.EventWizardType },
  routeName: RouteNames.EventStack,
};
const friendlySearchTarget = {
  params: { activeType: 'amicaux' },
  routeName: RouteNames.SearchHub,
};

/**
 * GUIDE-FINITIONS-3 R2-1 (rejeu 2, A03-A15) : un coach qui rejoint son club en
 * route gardait la bulle d'une étape « club » pendant tout le tunnel, et l'équipe
 * créée ne validait pas M1. Depuis toute étape de M1 hors tunnel : chaque écran
 * du tunnel ouvre SA bulle, et l'équipe réellement créée valide la mission.
 * @type {any[]}
 */
const M1_ESCAPES = [
  {
    completes: true, goto: 'm2-card', key: 'team.created', type: 'action',
  },
  // FIN-GUIDE, point 1 : équipe reprise ou reconnue dans la question de M1.
  {
    completes: true, goto: 'm2-card', key: 'team.trained', type: 'action',
  },
  ...[
    ['tw2', RouteNames.TeamWizardDescription],
    ['tw3', RouteNames.TeamWizardSection],
    ['tw4', RouteNames.TeamWizardActivity],
    ['tw5', RouteNames.TeamWizardCategory],
    ['tw6', RouteNames.TeamWizardLevel],
    ['tw7', RouteNames.TeamWizardTrainers],
    ['tw8', RouteNames.TeamWizardRecap],
  ].map(([goto, key]) => ({ goto, key, type: 'route' })),
];
/**
 * Sorties d'une étape de M1 hors tunnel, échappatoires en tête (la 1re qui
 * correspond gagne : `{ not: Club }` de m1-back aurait pris les écrans du tunnel).
 * @param {any} [advanceOn] - Sorties propres de l'étape.
 * @returns {any[]} Sorties.
 */
const withM1Escapes = (advanceOn) => [
  ...M1_ESCAPES,
  ...(Array.isArray(advanceOn) ? advanceOn : [advanceOn]).filter(Boolean),
];

/**
 * Le coach avait un club au départ du guide.
 * @param {any} ctx
 * @returns {boolean}
 */
const hadClub = (ctx) => Boolean(ctx?.flags?.hadClub);
/**
 * Le coach avait une équipe au départ du guide.
 * @param {any} ctx
 * @returns {boolean}
 */
const hadTeam = (ctx) => Boolean(ctx?.flags?.hadTeam);
/**
 * Le coach a un club accepté MAINTENANT (profil relu), pas seulement au départ :
 * rejoint pendant une pause ou hors du guide (GUIDE-REPRISE N3).
 * @param {any} ctx
 * @returns {boolean}
 */
const hasClubNow = (ctx) => Boolean(ctx?.userData?.club?.documentId);
/**
 * Demande d'adhésion qui attend un dirigeant, sans club accepté (L1 GUIDE-ATTENTE).
 * @param {any} ctx
 * @returns {boolean}
 */
const isJoinPending = (ctx) => {
  const requests = ctx?.userData?.clubMembershipRequests;
  return !hasClubNow(ctx) && (Array.isArray(requests) ? requests : [])
    .some((/** @type {any} */ request) => request?.state === 'pending');
};
/**
 * Demande pour rejoindre une équipe qui attend le club (FIN-GUIDE, point 1). Une ligne
 * `invite`, c'est le staff qui l'invite : ce n'est pas sa demande.
 * @param {any} ctx
 * @returns {boolean}
 */
const isTeamJoinPending = (ctx) => (Array.isArray(ctx?.userData?.teamMembershipRequests)
  ? ctx.userData.teamMembershipRequests
  : [])
  .some((/** @type {any} */ request) => request?.state === 'pending'
    && request?.direction !== 'invite');
/**
 * Branche « trouve ton club » : ni équipe, ni club (au départ comme maintenant),
 * ni demande en attente. Sinon la bulle « Pas de club ? » s'affichait sur le
 * tunnel équipe d'un coach qui avait déjà son club (N3, capture K4).
 * @param {any} ctx
 * @returns {boolean}
 */
const needsClub = (ctx) => !hadTeam(ctx) && !hadClub(ctx)
  && !hasClubNow(ctx) && !isJoinPending(ctx);
/**
 * Suite « club rejoint » : seulement si le club a été rejoint PENDANT le guide.
 * @param {any} ctx
 * @returns {boolean}
 */
const joinedInGuide = (ctx) => !hadTeam(ctx) && !hadClub(ctx)
  && Boolean(ctx?.created?.['club.joined']);
/**
 * FIN-GUIDE, point 1 : la question « Es-tu entraîneur·e d'une de ces équipes ? » se pose à qui a
 * un club, n'entraîne rien et n'attend aucune réponse.
 * @param {any} ctx
 * @returns {boolean}
 */
const canAskTeamChoice = (ctx) => !hadTeam(ctx) && !hasTeamNow(ctx) && hasClubNow(ctx)
  && !isTeamJoinPending(ctx);

// Raisons des quotas, dites par le guide (la feuille de l'offre dit le reste).
const teamQuota = () => t('refusal.teamQuota', 'Ton offre gratuite compte déjà toutes ses équipes : '
  + 'une nouvelle équipe demande l’offre Équipe. Rien n’a été créé.');
// M3 GRATUIT (05/11) : une série d'un compte gratuit ne pose que ses dates offertes.
const isFreePlan = (/** @type {any} */ ctx) => Boolean(ctx?.flags?.isFreePlan);
const hasPaidPlan = (/** @type {any} */ ctx) => !isFreePlan(ctx);
const eventQuota = () => t('refusal.eventQuota', 'Ton offre gratuite compte déjà tous ses événements : '
  + 'un nouvel événement demande l’offre Équipe. Rien n’a été créé.');

const MISSIONS = [
  {
    gaugeStep: 25,
    // Le tunnel équipe ne repose pas la question : TourTeamChoice l'a posée.
    asksTeamChoice: true,
    id: 'coach_m1',
    locked: true,
    // GUIDE-RELANCE : refus de l'écran (clé du signal ⇒ raison dite par le guide).
    refusals: {
      get 'club.join.unavailable'() {
        return t('refusal.clubPartner', 'Ce club passe par son dirigeant : « Je dirige ce club » '
          + 'remplace « C’est mon club ». Choisis un autre club, ou passe cette mission.');
      },
      get 'paywall.club-tier-team-limit'() { return teamQuota(); },
      get 'paywall.team-limit'() { return teamQuota(); },
    },
    /**
     * GUIDE-FINITIONS-2 n° 20 : l'ouverture d'un coach sans club annonce l'étape
     * « club » de M1 (la plus longue), absente des 4 missions (capture 75).
     * @param {any} flags - Situation au départ (`buildFlags`).
     * @returns {string | null} Ligne sous la mission, ou rien.
     */
    openingDetail: (flags) => (flags?.hadClub || flags?.hadTeam || flags?.joinPending
      ? null
      : t('missions.m1-club', 'D’abord, trouve ton club (ou crée-le)')),
    // Passée (quota) alors qu'une équipe existe : M2-M4 restent ouvertes.
    satisfiedBy: hasTeamNow,
    get title() { return t('missions.m1', 'Créer ton équipe'); },
  },
  {
    gaugeStep: 25,
    id: 'coach_m2',
    locked: true,
    needs: ['coach_m1'],
    get title() { return t('missions.m2', 'Inviter tes joueur·se·s'); },
  },
  {
    gaugeStep: 25,
    id: 'coach_m3',
    locked: true,
    needs: ['coach_m1'],
    refusals: {
      get 'paywall.event-limit'() { return eventQuota(); },
      get 'paywall.match-limit'() { return eventQuota(); },
    },
    get title() { return t('missions.m3', "Programmer l'entraînement de la semaine"); },
  },
  {
    gaugeStep: 25,
    id: 'coach_m4',
    locked: true,
    // « Publier une annonce » demande une équipe encadrée (FriendlyMatchWizardTeam).
    needs: ['coach_m1'],
    refusals: {
      get 'friendly.publish.refused'() {
        return t('refusal.friendly', 'L’annonce n’a pas pu être publiée.');
      },
    },
    // GUIDE-FINITIONS-2 n° 26 : l'acte essentiel est l'annonce, pas « Rechercher ».
    get title() { return t('missions.m4', 'Proposer un match amical'); },
  },
  {
    estimatedSeconds: 15,
    gaugeStep: 0,
    id: 'coach_b1',
    locked: false,
    get title() { return t('missions.b1', 'Voir qui vient et relancer'); },
  },
  {
    estimatedSeconds: 35,
    gaugeStep: 0,
    id: 'coach_b2',
    locked: false,
    get title() { return t('missions.b2', 'Convoquer pour un match'); },
  },
];

/**
 * FIN-GUIDE, point 4 : on peut inviter sans passer par le lien du menu (« + » de la fiche, feuille
 * d'invitation). Une invitation envoyée valide M2 ; un lien repartagé ou un SMS, on demande.
 * @type {any[]}
 */
const M2_ELSEWHERE = [
  {
    completes: true, goto: 'm3-dock', key: 'team.invite.sent', type: 'action',
  },
  {
    completes: true, goto: 'm3-dock', key: 'team.invite.shared', type: 'action',
  },
  { goto: 'm2-sent', key: 'team.invite.dismissed', type: 'interaction' },
  { goto: 'm2-sent', key: 'team.invite.returned', type: 'interaction' },
  // GUIDE-STORES : le retour Android quitte le menu et la fiche ; ni ⋮ ni repli sur Mes équipes.
  { goto: 'm2-card', key: RouteNames.MyTeamList, type: 'route' },
];

const STEPS = [
  {
    id: 'open',
    kind: 'opening',
    navTarget: homeTarget,
  },

  // ── M1 · Créer ton équipe ────────────────────────────────────────────────
  {
    // FIN-GUIDE, point 1 (Adel, 02/11) : « si y'a des équipes ça pose la question, sinon créer la
    // vôtre ». Écran plein cadre `TourTeamChoice` ; un club sans équipe passe tout de suite à la
    // suite. Le coach déjà entraîneur d'une équipe n'arrive jamais ici : M1 est validée au départ.
    advanceOn: withM1Escapes({ goto: 'm1-wait-team', key: 'team.requested', type: 'action' }),
    id: 'm1-choice',
    kind: 'teamChoice',
    missionId: 'coach_m1',
    when: canAskTeamChoice,
  },
  {
    // La demande attend le club : même attente que `m1-wait`, sans bloquer. Acceptée, M1 se valide
    // seule (`liveMission`) ; refusée, la reprise repose la question.
    advanceOn: withM1Escapes(),
    id: 'm1-wait-team',
    missionId: 'coach_m1',
    navTarget: teamHubTarget,
    get nextLabel() { return t('understood', 'Compris'); },
    get pausedLabel() { return t('m1-wait-team-pill', 'En attente de ton équipe · Reprendre'); },
    pauseOnNext: true,
    resumeFrom: 'm1-choice',
    get text() {
      return t(
        'm1-wait-team',
        'Ta demande pour rejoindre ton équipe attend la réponse du club. Le guide t’attend : dès '
          + 'qu’elle est acceptée, ta mission 1 est validée. En attendant, explore l’app librement.',
      );
    },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && isTeamJoinPending(ctx),
  },
  {
    advanceOn: withM1Escapes({ key: RouteNames.MyTeamList, type: 'route' }),
    id: 'm1-dock',
    missionId: 'coach_m1',
    navTarget: homeTarget,
    targets: ['dock.teams'],
    get text() {
      return Platform.OS === 'web'
        ? t('m1-dock-site', 'Commence par ton équipe. Ouvre l’onglet entouré.')
        : t('m1-dock', 'Commence par ton équipe. Ouvre l’onglet Équipes.');
    },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !isTeamJoinPending(ctx),
  },
  {
    // L1 GUIDE-ATTENTE (décision « 1- A » de l'audit : le guide attend, et le dit).
    // La demande d'adhésion attend un dirigeant : le tunnel équipe la refuse, et
    // « Nouvelle équipe » ↔ « J'ai compris » tournait en boucle (rejeu, captures
    // 03-05). « Compris » met le guide en pause ; reprise sur Équipes quand le
    // club a répondu. Sans serveur : le remodelage de l'adhésion (registre des
    // mineurs, ligne 49) créera l'équipe tout de suite ; le tunnel n'étant plus
    // refusé, cette étape ne s'affichera plus.
    advanceOn: withM1Escapes(),
    id: 'm1-wait',
    missionId: 'coach_m1',
    navTarget: teamHubTarget,
    get nextLabel() { return t('understood', 'Compris'); },
    get pausedLabel() { return t('m1-wait-pill', 'En attente du club · Reprendre'); },
    pauseOnNext: true,
    // Club accepté : la question de M1 d'abord (son équipe existe peut-être déjà).
    resumeFrom: 'm1-choice',
    get text() {
      return t(
        'm1-wait',
        'Ta demande pour rejoindre ton club attend la réponse d’un dirigeant. Le guide t’attend : '
          + 'dès qu’il accepte, reprends-le ici, tu créeras ton équipe. En attendant, explore '
          + 'l’app librement.',
      );
    },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && isJoinPending(ctx),
  },
  {
    advanceOn: withM1Escapes([
      // GUIDE-FINITIONS-2 n° 2 : la demande est passée « en attente » après l'entrée
      // dans l'étape (pause, demande faite hors du guide) ; le tunnel montre alors
      // « Ton adhésion est en attente » : le guide attend avec lui, pas de tw1.
      {
        goto: 'm1-wait', key: RouteNames.TeamWizardName, type: 'route', when: isJoinPending,
      },
      // Club rejoint dans le guide, question posée : tout droit au tunnel (FIN-GUIDE).
      {
        goto: 'tw1', key: RouteNames.TeamWizardName, type: 'route', when: joinedInGuide,
      },
      { key: RouteNames.TeamWizardName, type: 'route' },
    ]),
    id: 'm1-new',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['teams.fab', 'teams.newTeam'],
    get text() { return t('m1-new', 'Touche « Nouvelle équipe ».'); },
    variants: [{
      targets: ['teams.fab'],
      get text() { return t('m1-new-fab', 'Crée ton équipe avec ce bouton.'); },
    }],
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !isJoinPending(ctx),
  },
  // Branche sans club : l'écran « Il te faut d'abord un club » du tunnel équipe.
  {
    advanceOn: withM1Escapes([
      { key: 'clubGate.search', type: 'interaction' },
      { goto: 'm1-cw', key: 'clubGate.notFound', type: 'interaction' },
    ]),
    id: 'm1-gate',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['clubGate.actions'],
    get text() {
      return t(
        'm1-gate',
        'Une équipe appartient toujours à un club. Commence par trouver le tien. Pas de club ? « '
          + 'Je ne trouve pas mon club » te guidera pour le créer.',
      );
    },
    // Club arrivé pendant la bulle (profil relu) : la bulle passe au tunnel (R2-1).
    recheck: true,
    when: needsClub,
  },
  {
    advanceOn: withM1Escapes({ key: RouteNames.Club, type: 'route' }),
    bubblePlacement: 'top',
    id: 'm1-csearch',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['search.result.0'],
    get text() { return t('m1-csearch', 'Tape le nom de ton club, puis ouvre sa fiche.'); },
    // Taper le nom puis ouvrir la fiche : le champ doit rester libre (CALIBRAGE-2).
    veil: false,
    when: needsClub,
  },
  {
    advanceOn: withM1Escapes([
      { key: 'club.joined', type: 'action' },
      // Club qui a un dirigeant : la demande attend (L1 GUIDE-ATTENTE).
      { goto: 'm1-wait', key: 'club.requested', type: 'action' },
    ]),
    id: 'm1-mine',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    // GUIDE-TEXTES (audit du 28/10, capture 89) : la bulle nomme le bouton
    // affiché ; un club qui a un dirigeant n'a que « Demander à rejoindre ».
    targets: ['club.itsMine'],
    get text() { return t('m1-mine', 'C’est ton club ? Touche « C’est mon club ! ».'); },
    variants: [{
      targets: ['club.askToJoin'],
      get text() {
        return t('m1-mine-ask', 'C’est ton club ? Demande à le rejoindre : un dirigeant validera.');
      },
    }],
    when: needsClub,
  },
  {
    advanceOn: withM1Escapes({ key: 'club.joined.ack', type: 'interaction' }),
    bubblePlacement: 'top',
    id: 'm1-ok',
    missionId: 'coach_m1',
    // Club rejoint : la reprise ne repasse plus par « trouve ton club » (N3).
    resumeFrom: 'm1-dock2',
    get text() { return t('m1-ok', 'Tu fais maintenant partie du club. Touche OK.'); },
    when: joinedInGuide,
  },
  {
    // FIN-GUIDE, point 1 : un club rejoint a peut-être déjà ses équipes : la question d'abord.
    advanceOn: withM1Escapes([
      {
        goto: 'm1-choice', not: RouteNames.Club, type: 'route', when: canAskTeamChoice,
      },
      { not: RouteNames.Club, type: 'route' },
    ]),
    id: 'm1-back',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock2',
    // Décision d'Adel 4- A (28/10) : cadre sur la flèche, bulle dessous, et le
    // geste du bord (seul retour d'un iPhone). Rien n'est bloqué : le glissement
    // depuis le bord doit passer.
    targets: ['header.back'],
    get text() {
      return t(
        'm1-back',
        'Reviens en arrière : touche la flèche en haut à gauche, ou glisse ton doigt depuis le '
          + 'bord gauche de l’écran.',
      );
    },
    veil: false,
    when: joinedInGuide,
  },
  {
    advanceOn: withM1Escapes([
      { key: RouteNames.MyTeamList, type: 'route' },
      { goto: 'tw1', key: RouteNames.TeamWizardName, type: 'route' },
    ]),
    id: 'm1-dock2',
    missionId: 'coach_m1',
    // Reprise de la suite « club rejoint » : depuis l'accueil.
    navTarget: homeTarget,
    resumeFrom: 'm1-dock2',
    targets: ['dock.teams'],
    get text() { return t('m1-dock2', 'Retourne dans Équipes pour créer ton équipe.'); },
    when: joinedInGuide,
  },
  {
    advanceOn: withM1Escapes({ goto: 'tw1', key: RouteNames.TeamWizardName, type: 'route' }),
    id: 'm1-new2',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock2',
    targets: ['teams.fab', 'teams.newTeam'],
    get text() { return t('m1-new2', 'Ton club est rejoint : touche « Nouvelle équipe ».'); },
    when: joinedInGuide,
  },
  {
    // Variante « Je ne trouve pas mon club » : tunnel de création de club
    // (écrans non capturés, l'app fait foi) — une bulle commune en haut.
    advanceOn: { goto: 'm1-dock2', key: 'club.created', type: 'action' },
    bubblePlacement: 'top',
    id: 'm1-cw',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: WIZARD,
    get text() {
      return t('m1-cw', 'Crée ton club : remplis chaque écran, puis Suivant.');
    },
    when: () => false,
  },
  ...teamWizardSteps({
    missionId: 'coach_m1',
    texts: {
      sheet: () => t(
        'm1-sheet',
        'Ton club a déjà des équipes : tu pourrais en rejoindre une. Ici, crée la tienne.',
      ),
      tw1: () => t(
        'tw1',
        'Donne un nom à ton équipe : tape-le ou choisis une suggestion, puis Suivant.',
      ),
      tw2: () => t('tw2', 'Optionnel : décris ton équipe, ou passe cette étape.'),
      tw3: () => t('tw3', 'Choisis la section, puis Suivant.'),
      tw4: () => t('tw4', 'Cherche ton sport (tape « foot »), choisis-le, puis Suivant.'),
      tw5: () => t('tw5', 'La catégorie d’âge de l’équipe, puis Suivant.'),
      tw6: () => t('tw6', 'Le niveau de compétition. Tu peux aussi continuer sans.'),
      tw7: () => t('tw7', 'Coche-toi comme coach de l’équipe, puis Suivant.'),
      tw8: () => t('tw8', 'Tout est bon ? Crée ton équipe.'),
    },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx),
  }),

  // ── M2 · Inviter tes joueur·se·s ─────────────────────────────────────────
  {
    advanceOn: { key: RouteNames.TeamDetails, type: 'route' },
    // FIN-GUIDE, point 1 : M1 validée d'emblée, on est encore sur l'accueil : on montre le chemin.
    fallback: {
      targets: ['dock.teams'],
      get text() {
        return Platform.OS === 'web'
          ? t('m1-find-dock-site', 'Ton équipe est déjà là : ouvre l’onglet entouré.')
          : t('m1-find-dock', 'Ton équipe est déjà là : ouvre l’onglet Équipes.');
      },
    },
    id: 'm2-card',
    missionId: 'coach_m2',
    navTarget: teamHubTarget,
    targets: ['teams.trained.0'],
    get text() { return t('m2-card', 'Fais entrer tes joueur·se·s : ouvre ton équipe.'); },
  },
  {
    advanceOn: [{ key: 'team.actions.open', type: 'interaction' }, ...M2_ELSEWHERE],
    id: 'm2-more',
    missionId: 'coach_m2',
    resumeFrom: 'm2-card',
    targets: ['team.more'],
    get text() { return t('m2-more', 'Les actions de l’équipe sont rangées dans ce menu.'); },
  },
  {
    advanceOn: [{ key: 'teamActions.shareLink', type: 'interaction' }, ...M2_ELSEWHERE],
    bubblePlacement: 'top',
    // Menu refermé (reprise, retour) : on remontre le bouton ⋮ au lieu d'une
    // bulle « en haut » posée dessus (GUIDE-ENTETE, émulateur 28/10).
    fallback: {
      targets: ['team.more'],
      get text() { return t('m2-more', 'Les actions de l’équipe sont rangées dans ce menu.'); },
    },
    id: 'm2-share',
    missionId: 'coach_m2',
    resumeFrom: 'm2-card',
    targets: ['teamActions.shareLink'],
    get text() { return t('m2-share', 'Le plus simple : un lien d’invitation.'); },
  },
  {
    // Feuille de partage du système : bulle compacte en haut, sans voile.
    // GUIDE-E-CORR (TG-14, tournée du 07/11) : « C'est envoyé » s'affichait ici, feuille encore
    // ouverte, et validait M2 sans envoi. Ce que chaque plateforme dit (teamInviteShare) :
    // - iPhone : « partagé » = envoi certain ; feuille fermée sans choisir d'app = « annulé » ;
    //   app choisie puis abandonnée = AUCUNE réponse (RCTActionSheetManager ne rappelle pas) ;
    // - Android : jamais rien (le module rend « partagé » dès l'ouverture du sélecteur) ;
    // - site : navigator.share rend un envoi, ou une erreur à l'abandon ; la copie, rien de sûr.
    // Envoi certain : M2 validée. Annulé : `m2-cancel`, sans bouton qui valide. Inconnu : on
    // demande (`m2-sent`). Le bouton « Continuer » est l'issue d'une feuille qui ne répond jamais :
    // il mène à la question, il ne valide rien.
    advanceOn: [
      {
        completes: true, goto: 'm3-dock', key: 'team.invite.shared', type: 'action',
      },
      {
        completes: true, goto: 'm3-dock', key: 'team.invite.sent', type: 'action',
      },
      { goto: 'm2-cancel', key: 'team.invite.dismissed', type: 'interaction' },
      { goto: 'm2-sent', key: 'team.invite.returned', type: 'interaction' },
      { goto: 'm2-card', key: RouteNames.MyTeamList, type: 'route' },
    ],
    // La fiche garde son titre et ses onglets lisibles (capture 4 d'Adel).
    belowTargets: ['team.tabs'],
    bubblePlacement: 'top',
    id: 'm2-pick',
    missionId: 'coach_m2',
    get nextLabel() { return t('m2-pick-next', 'Continuer'); },
    resumeFrom: 'm2-card',
    get text() {
      // GUIDES-SITE-CORR S28 (tournée du site, 09/11), puis GUIDES-SITE-CORR-2 (M1096, 10/11) : la
      // fenêtre Partager de Windows ne se fermait pas ; sur un ordinateur, le lien est désormais
      // COPIÉ (teamInviteShare) et la bulle le dit. Le site sur un téléphone garde son partage.
      return isDesktopWeb()
        ? t(
          'm2-pick-site',
          'Le lien est copié : colle-le dans le groupe de ton équipe. Chacun·e rejoint en un '
            + 'geste.',
        )
        : t('m2-pick', 'Envoie-le sur le groupe de ton équipe. Chacun·e rejoint en un geste.');
    },
  },
  {
    // GUIDE-FINITIONS-3 n° 22, GUIDE-E-CORR (TG-14) : le résultat est inconnu (Android, SMS,
    // feuille muette). Le coach répond ; sinon il rouvre le menu (retour à m2-share).
    advanceOn: [
      { goto: 'm2-share', key: 'team.actions.open', type: 'interaction' },
      {
        completes: true, goto: 'm3-dock', key: 'team.invite.shared', type: 'action',
      },
      {
        completes: true, goto: 'm3-dock', key: 'team.invite.sent', type: 'action',
      },
      { goto: 'm2-card', key: RouteNames.MyTeamList, type: 'route' },
    ],
    // La fiche garde ses onglets lisibles, comme « Envoie-le » (capture 4 d'Adel).
    belowTargets: ['team.tabs'],
    bubblePlacement: 'top',
    completesMission: true,
    id: 'm2-sent',
    missionId: 'coach_m2',
    get nextLabel() { return t('m2-sent-next', 'Oui, c’est envoyé'); },
    resumeFrom: 'm2-card',
    targets: ['team.more'],
    get text() {
      // M1096 : sur un ordinateur, on arrive ici juste après la copie du lien ; la bulle le dit.
      if (isDesktopWeb()) {
        return t(
          'm2-sent-site',
          'Lien copié : colle-le dans le groupe de ton équipe. C’est fait ? Touche « Oui, c’est '
            + 'envoyé ». Sinon, rouvre ce menu pour le copier.',
        );
      }
      return t(
        'm2-sent',
        'Tu l’as envoyé ? Si oui, touche « Oui, c’est envoyé ». Sinon, rouvre ce menu pour le '
          + 'partager.',
      );
    },
    veil: false,
  },
  {
    // GUIDE-E-CORR (TG-14) : la plateforme dit « annulé ». Rien ne valide M2 ici : le menu
    // rouvre le partage. `when` : seulement par le `goto` de m2-pick.
    advanceOn: [
      { goto: 'm2-share', key: 'team.actions.open', type: 'interaction' },
      {
        completes: true, goto: 'm3-dock', key: 'team.invite.shared', type: 'action',
      },
      {
        completes: true, goto: 'm3-dock', key: 'team.invite.sent', type: 'action',
      },
      { goto: 'm2-sent', key: 'team.invite.returned', type: 'interaction' },
      { goto: 'm2-card', key: RouteNames.MyTeamList, type: 'route' },
    ],
    belowTargets: ['team.tabs'],
    bubblePlacement: 'top',
    id: 'm2-cancel',
    missionId: 'coach_m2',
    resumeFrom: 'm2-card',
    targets: ['team.more'],
    get text() {
      return t(
        'm2-cancel',
        'Partage fermé : rien n’est parti. Rouvre ce menu pour envoyer le lien.',
      );
    },
    veil: false,
    when: () => false,
  },

  // ── M3 · Programmer l'entraînement ───────────────────────────────────────
  {
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'm3-dock',
    missionId: 'coach_m3',
    // GUIDE-STORES : la mission 2 finit sur la fiche d'équipe, qui n'a pas de barre d'onglets.
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.home'],
    get text() { return t('m3-dock', 'Programme maintenant ta séance : ouvre l’accueil.'); },
  },
  {
    advanceOn: { key: RouteNames.EventWizardType, type: 'route' },
    id: 'm3-card',
    missionId: 'coach_m3',
    resumeFrom: 'm3-dock',
    targets: ['home.card.manage-add-event'],
    get text() { return t('m3-card', 'Touche « Ajouter un événement ».'); },
  },
  {
    advanceOn: { key: RouteNames.EventWizardTeam, type: 'route' },
    bubblePlacement: 'top',
    id: 'm3-type',
    missionId: 'coach_m3',
    navTarget: eventWizardTarget,
    resumeFrom: 'm3-type',
    targets: ['eventWizard.type.training'],
    get text() { return t('m3-type', 'Choisis « Entraînement ».'); },
  },
  {
    advanceOn: { key: RouteNames.EventWizardLocation, type: 'route' },
    bubblePlacement: 'top',
    id: 'm3-team',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    // GUIDE-STORES : un coach de plusieurs équipes doit pouvoir choisir la sienne.
    targets: ['teamWizard.field', 'teamWizard.next'],
    get text() { return t('m3-team', 'Rattache la séance à ton équipe.'); },
  },
  {
    // DATESDABORD (staging, 25/10) : le lieu vient AVANT « Date & horaire ».
    advanceOn: { key: RouteNames.EventWizardLogistics, type: 'route' },
    bubblePlacement: 'top',
    bubbles: [
      // Courtes (arbitrage du chef, 28/10) : la bulle tient entre l'en-tête et le champ.
      () => t('m3-place-1', 'Club : une installation du club. Extérieur : une autre adresse.'),
      () => t('m3-place-2', 'Ton club a des installations ? Touche celle de ta séance.'),
      () => t('m3-place-3', 'Ton terrain n’y est pas ? Choisis « Extérieur » et tape son adresse.'),
      () => t('m3-place-4', 'Choisis ton lieu, puis Suivant.'),
    ],
    id: 'm3-place',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    // Ajout d'une installation (FacilityForm) : une bulle par champ.
    subGuides: [{
      anchor: 'facility.name',
      bubbles: [
        // G93 : le refus n'arrive qu'à « Créer » ; on prévient avant de faire remplir.
        ['facility.name', () => t('m3-fac-0', 'Il faut l’offre Club. Sinon, '
          + 'reviens : « Extérieur ».')],
        ['facility.name', () => t('m3-fac-1', 'Donne un nom à l’installation et choisis son type '
          + '(obligatoire).')],
        ['facility.address', () => t('m3-fac-2', 'Adresse obligatoire : choisis-la dans la liste '
          + 'proposée.')],
        ['facility.conflict', () => t('m3-fac-3', 'Si deux équipes réservent le même créneau : '
          + '« Demande à valider », un dirigeant tranche ; « Autoriser et notifier », c’est '
          + 'réservé tout de suite et le bureau est prévenu.')],
        ['facility.capacity', () => t('m3-fac-4', 'Capacité : combien d’équipes peuvent '
          + 'l’utiliser en même temps. Ex. 2 pour un terrain coupé en deux.')],
        ['facility.color', () => t('m3-fac-5', 'La couleur de l’installation dans le planning, '
          + 'pour la repérer d’un coup d’œil.')],
        ['facility.create', () => t('m3-fac-6', 'Tout est bon ? Crée-la : elle sera '
          + 'sélectionnée pour ta séance.')],
      ],
      // G93 : offre refusée, la mission continue par « Extérieur » ; la bulle donne le chemin.
      refused: {
        key: 'paywall.facility-manage-required',
        text: () => t('m3-fac-refused', 'Sans offre Club : ferme l’offre, touche '
          + '« Annuler », puis « Extérieur ».'),
      },
    }],
    targets: WIZARD,
    get text() { return t('m3-place-4', 'Choisis ton lieu, puis Suivant.'); },
  },
  {
    // Sans offre : ni invitation à répéter, ni bulle par zone de la feuille « Répéter ».
    advanceOn: { key: RouteNames.EventWizardAccess, type: 'route' },
    bubblePlacement: 'top',
    id: 'm3-when-free',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    targets: ['eventWizard.when', 'teamWizard.next'],
    get text() {
      return t(
        'm3-when-free',
        'Touche la date et les heures, puis Suivant. Répéter chaque semaine demande '
          + 'l’offre Équipe.',
      );
    },
    veil: false,
    when: isFreePlan,
  },
  {
    // Sélecteurs de date et feuille « Répéter » : rien n'est bloqué (voile coupé).
    advanceOn: { key: RouteNames.EventWizardAccess, type: 'route' },
    bubblePlacement: 'top',
    id: 'm3-when',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    targets: ['eventWizard.when', 'eventWizard.repeat', 'teamWizard.next'],
    get text() {
      return t(
        'm3-when',
        'Touche la date et les heures. Chaque semaine ? Touche « Chaque semaine » ou '
          + '« Plus d’options ». Puis Suivant.',
      );
    },
    // Feuille « Répéter » ouverte : une bulle par zone (pack 02, M3).
    subGuides: [{
      anchor: 'repeat.frequency',
      bubbles: [
        ['repeat.frequency', () => t('m3-rep-1', 'Fréquence : « Hebdomadaire » pour une séance '
          + 'chaque semaine, « Mensuel » pour une fois par mois.')],
        ['repeat.interval', () => t('m3-rep-2', 'Intervalle : 1 = toutes les semaines. Touche + '
          + 'pour passer à toutes les 2 semaines, et ainsi de suite.')],
        ['repeat.days', () => t('m3-rep-3', 'Jours : le jour de ta séance est déjà coché. Touche '
          + 'un autre jour si tu t’entraînes 2 fois par semaine.')],
        ['repeat.end', () => t('m3-rep-4', 'Date de fin : jusqu’à quand la séance se répète. '
          + 'Touche pour la changer.')],
        ['repeat.apply', () => t('m3-rep-5', 'Tout est bon ? Appuie sur Appliquer.')],
      ],
    }],
    veil: false,
    when: hasPaidPlan,
  },
  wizardStep('m3-access', 'coach_m3', RouteNames.EventWizardDescription, 'm3-type', () => t(
    'm3-access',
    'Pour un entraînement, garde Privé : ton équipe et tes invités.',
  )),
  wizardStep('m3-desc', 'coach_m3', RouteNames.EventWizardRecap, 'm3-type', () => t(
    'm3-desc',
    'Écris une consigne pour ton équipe (ex. : rendez-vous 15 min avant). Sinon, passe.',
  )),
  {
    advanceOn: { key: 'event.created', type: 'action' },
    bubblePlacement: 'top',
    id: 'm3-create-free',
    listScrolls: true,
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    targets: ['eventWizard.occurrences', 'teamWizard.next'],
    get text() { return t('m3-create-free', 'Vérifie le récap, puis crée ta séance !'); },
    when: isFreePlan,
  },
  {
    advanceOn: { key: 'event.created', type: 'action' },
    bubblePlacement: 'top',
    id: 'm3-create',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    targets: ['eventWizard.occurrences', 'teamWizard.next'],
    get text() {
      return t(
        'm3-create',
        'Vérifie le récap : si ta séance se répète, elle s’arrête à la date de fin choisie dans '
          + '« Répéter ». Crée !',
      );
    },
    // GUIDE-STORES : un récap à vérifier doit pouvoir défiler sous le voile.
    listScrolls: true,
    when: hasPaidPlan,
  },
  {
    bubblePlacement: 'top',
    completesMission: true,
    id: 'm3-page',
    missionId: 'coach_m3',
    get nextLabel() { return t('understood', 'Compris'); },
    get text() { return t('m3-page', 'Ta séance est en ligne.'); },
  },

  // ── M4 · Rechercher ──────────────────────────────────────────────────────
  {
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'm4-back',
    missionId: 'coach_m4',
    // GUIDE-STORES : la mission 3 finit sur la fiche de la séance, sans barre d'onglets.
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.home'],
    get text() {
      return t('m4-back', 'Ta séance est en ligne. Dernière mission : retourne à l’accueil.');
    },
  },
  {
    // GUIDE-E-CORR (TG-15, tournée du 07/11) : la mission « Proposer un match amical » commençait
    // par « Les profils… » sur la carte Profils, puis trois onglets en icônes seules. Elle part
    // maintenant de la carte « Matchs amicaux », qui ouvre l'onglet où l'on crée l'annonce.
    advanceOn: { goto: 'm4-frc', key: RouteNames.SearchHub, type: 'route' },
    id: 'm4-card',
    missionId: 'coach_m4',
    resumeFrom: 'm4-back',
    targets: ['home.card.search-amicaux'],
    get text() {
      return t('m4-card', 'Propose un match amical : ouvre « Matchs amicaux ».');
    },
  },
  {
    advanceOn: { key: RouteNames.FriendlyMatchWizardTeam, type: 'route' },
    id: 'm4-frc',
    missionId: 'coach_m4',
    navTarget: friendlySearchTarget,
    resumeFrom: 'm4-frc',
    targets: ['friendly.create'],
    get text() { return t('m4-frc', 'À toi : crée ton annonce de match amical.'); },
  },
  ...(/** @type {Array<[string, string, () => string]>} */ ([
    // AMICAUX-FORMAT (10/11/2026) : apres l equipe vient le format (etape 2/8), sa bulle a lui.
    ['m4-am1', RouteNames.FriendlyMatchWizardFormat, () => t(
      'm4-am1',
      'Touche l’équipe qui cherche un adversaire.',
    )],
    ['m4-amf', RouteNames.FriendlyMatchWizardHosting, () => t(
      'm4-amf',
      'Choisis le format : combien contre combien. La durée habituelle est déjà cochée, '
        + 'change-la si besoin.',
    )],
    ['m4-am2', RouteNames.FriendlyMatchWizardDates, () => t(
      'm4-am2',
      'Tu reçois sur ton terrain, tu te déplaces, ou les deux. « Les deux » touche le '
        + 'plus d’équipes.',
    )],
    ['m4-am3', RouteNames.FriendlyMatchWizardLocation, () => t(
      'm4-am3',
      'Choisis un jour (l’heure est facultative), puis « Ajouter cette date ». '
        + 'Propose-en plusieurs : tu auras plus de réponses.',
    )],
    ['m4-am4', RouteNames.FriendlyMatchWizardOpponent, () => t(
      'm4-am4',
      'Tape ta ville, ou touche ton terrain s’il est proposé. Puis choisis jusqu’où '
        + 'tu te déplaces.',
    )],
    ['m4-am5', RouteNames.FriendlyMatchWizardDescription, () => t(
      'm4-am5',
      'On a coché la catégorie et le niveau de ton équipe. Ajoute-en d’autres, ou touche « Peu '
        + 'importe, je prends tout ».',
    )],
    ['m4-am6', RouteNames.FriendlyMatchWizardRecap, () => t(
      'm4-am6',
      'Un mot pour les autres coachs et qui arbitre : c’est facultatif. Sinon, « Passer cette '
        + 'étape ».',
    )],
  ])).map(([id, nextRoute, text]) => extendStep(
    wizardStep(id, 'coach_m4', nextRoute, 'm4-frc', text),
    // Les dates passent par des sélecteurs : rien n'est bloqué à cette étape.
    id === 'm4-am3' ? { veil: false } : {},
  )),
  {
    advanceOn: { key: 'friendlyMatch.ad.published', type: 'action' },
    bubblePlacement: 'top',
    completesMission: true,
    id: 'm4-am7',
    missionId: 'coach_m4',
    resumeFrom: 'm4-frc',
    targets: ['teamWizard.next'],
    get text() {
      return t(
        'm4-am7',
        'Tout est bon ? Publie : les équipes de ta zone pourront te proposer un match.',
      );
    },
    // GUIDE-STORES : un récap à vérifier doit pouvoir défiler sous le voile.
    listScrolls: true,
  },

  { id: 'palier', kind: 'milestone' },

  // ── B1 · Voir qui vient et relancer (bonus, sur la vraie séance de M3) ──
  {
    advanceOn: { key: RouteNames.MyEventList, type: 'route' },
    id: 'b1-dock',
    missionId: 'coach_b1',
    // Après le palier ou B1, on est loin du dock : le guide ramène à l'accueil.
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.planning'],
    get text() { return t('b1-dock', 'Pour savoir qui vient : ouvre le planning.'); },
  },
  {
    advanceOn: { key: RouteNames.EventDetails, type: 'route' },
    bubblePlacement: 'top',
    id: 'b1-card',
    missionId: 'coach_b1',
    resumeFrom: 'b1-dock',
    // La carte de LA séance créée en M3 (pack 02, B1) ; inconnue : bulle seule.
    // GUIDE-FINITIONS-2 N11 : sa prochaine date pas encore finie (capture 39 : la
    // séance du jour « déjà passée ») ; une progression d'avant n'a que la 1re.
    targetsFor: (/** @type {any} */ context) => {
      const created = context?.created?.['event.created'];
      const now = Date.now();
      const next = (Array.isArray(created?.dates) ? created.dates : []).find(
        (/** @type {any} */ date) => new Date(date?.endDate || date?.date).getTime() > now,
      );
      const eventId = next?.documentId || created?.documentId;
      // GUIDE-FINITIONS-3 R2-3 (C02) : sans la séance de M3 (bonus relancé depuis
      // Mon compte, séances du jour finies), la prochaine séance du planning.
      return [...(eventId ? [`planning.event.${eventId}`] : []), 'planning.event.next'];
    },
    // R2-3 (A17) : aucune séance à venir, « Ouvre ta séance » n'avait pas de cible.
    fallback: {
      targets: ['planning.fab'],
      get text() {
        return t(
          'b1-card-none',
          'Aucune séance à venir dans ton planning : programme-en une avec ce bouton, ou passe '
            + 'ce bonus.',
        );
      },
    },
    // N11 bis (capture 39) : le bouton flottant chevauchait la carte cadrée.
    hidesFloatingAction: true,
    get text() { return t('b1-card', 'Ouvre ta séance.'); },
  },
  {
    advanceOn: [
      { key: 'event.relance.sent', type: 'action' },
      // Équipe encore vide (signalée par la fiche) : b1-vide.
      { goto: 'b1-vide', key: 'event.participants.empty', type: 'action' },
    ],
    completesMission: true,
    // GUIDE-BULLE-RELANCE (décision d'Adel « 318 B », 13/11) : sur le SITE, un entraînement n'a
    // pas de bouton « Relancer » (pas de relance depuis l'ordinateur). La fiche du site pose
    // alors l'ancre `event.relance.telephone` ; le téléphone ne la pose jamais. « Passer ce
    // bonus » est le bouton de toute bulle de bonus (`skipMission`).
    fallback: {
      targets: ['event.relance.telephone'],
      get text() {
        return t(
          'b1-relance-site',
          'Pour relancer tes joueur·se·s, fais-le depuis ton téléphone, sur cette séance. Ici, '
            + 'tu peux passer ce bonus.',
        );
      },
    },
    id: 'b1-relance',
    missionId: 'coach_b1',
    resumeFrom: 'b1-dock',
    targets: ['event.relance'],
    get text() {
      return t(
        'b1-relance',
        'Plus bas : les participants. Personne n’a encore répondu : relance-les en un clic.',
      );
    },
  },
  {
    // Décision d'Adel « 2- A » (28/10) : équipe vide, visite simple ; la fiche
    // montre de faux profils d'exemple qui répondent, sans rien envoyer.
    bubblePlacement: 'top',
    completesMission: true,
    id: 'b1-vide',
    missionId: 'coach_b1',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'b1-dock',
    targets: ['event.participants'],
    get text() {
      return t('b1-vide', 'Ici, tu verras qui vient dès que tes joueur·se·s répondront.');
    },
    // Seulement par le `goto` de b1-relance : une relance réussie le saute.
    when: (/** @type {any} */ ctx) => Boolean(ctx?.created?.['event.participants.empty']),
    // GUIDE-STORES : « ici » montre une liste qui doit rester lisible et défiler.
    veil: false,
  },

  // ── B2 · Convoquer pour un match (bonus SIMULÉ : rien n'est envoyé) ──────
  {
    advanceOn: { key: RouteNames.MyEventList, type: 'route' },
    id: 'b2-dock',
    missionId: 'coach_b2',
    // Après le palier ou B1, le guide emmène directement au planning (audit 47-49 :
    // l'aller-retour par l'accueil ne servait à rien).
    navigateOnEnter: true,
    navTarget: planningTarget,
    targets: ['dock.planning'],
    get text() { return t('b2-dock', 'Tes matchs sont dans le planning : ouvre-le.'); },
  },
  {
    bubblePlacement: 'top',
    id: 'b2-where',
    missionId: 'coach_b2',
    get nextLabel() { return t('b2-where-next', 'Essayer'); },
    resumeFrom: 'b2-dock',
    get text() {
      return t(
        'b2-where',
        'Pour un vrai match : ouvre-le ici, onglet « Convocation », puis « Préparer la '
          + 'convocation ». On s’entraîne sur un match d’exemple contre US Monpeyroux : rien '
          + 'ne sera envoyé.',
      );
    },
  },
  {
    advanceOn: [
      { key: RouteNames.MatchCompositionStart, type: 'route' },
      { goto: 'b2-pub', key: RouteNames.MatchCompositionBoard, type: 'route' },
    ],
    bubblePlacement: 'top',
    // GUIDE-PETIT-ECRAN (R3-21) : dans la place gardée sous le titre, au-dessus
    // de la liste ; en haut, elle cachait toutes les lignes à 720×1280, texte 1,3.
    bubbleSlot: true,
    id: 'b2-list',
    missionId: 'coach_b2',
    navigateOnEnter: true,
    navTarget: {
      params: (/** @type {any} */ context) => ({
        params: exampleMatch(context),
        screen: RouteNames.MatchCallUpSelection,
      }),
      routeName: RouteNames.EventStack,
    },
    resumeFrom: 'b2-dock',
    get text() {
      // Une formation demande au moins la moitié de ses titulaires (matchCompositionUtils).
      return t('b2-list', 'Coche au moins la moitié d’une équipe, puis Suivant.');
    },
    veil: false,
  },
  {
    advanceOn: { key: RouteNames.MatchCompositionBoard, type: 'route' },
    bubblePlacement: 'top',
    id: 'b2-start',
    missionId: 'coach_b2',
    resumeFrom: 'b2-dock',
    // GUIDE-FINITIONS-3 R2-4 (A20) : « Terrain vide », en tête de liste, restait sous la bulle.
    bubbleSlot: true,
    get text() { return t('b2-start', 'Pars d’une formation ou d’un terrain vide.'); },
    veil: false,
  },
  {
    advanceOn: { key: 'composition.simulated.published', type: 'action' },
    bubblePlacement: 'top',
    completesMission: true,
    id: 'b2-pub',
    missionId: 'coach_b2',
    resumeFrom: 'b2-dock',
    get text() {
      return t(
        'b2-pub',
        // GUIDE-FINITIONS-2 N8 : match d'exemple, rien ne part (capture 46).
        'Glisse tes joueur·se·s sur les postes, puis publie. Sur un vrai match, la compo part '
          + 'dans le canal de l’équipe ; ici, rien n’est envoyé.',
      );
    },
    veil: false,
  },

  { id: 'close', kind: 'closing' },
];

/**
 * GUIDE-RELANCE (décision d'Adel 3- A, 28/10) : « Revoir le guide sans rien
 * créer ». Une étape par mission, qui emmène sur l'écran et le décrit ; on
 * avance au bouton, aucun geste réel n'est attendu. Jouées seulement en visite
 * (`review`, voir `isStepAvailable`).
 * @param {string} id - Id de l'étape.
 * @param {string} missionId - Mission.
 * @param {any} navTarget - Écran montré.
 * @param {string[]} targets - Ancres encadrées.
 * @param {() => string} text - Texte de la bulle.
 * @returns {any} Étape.
 */
const reviewStep = (id, missionId, navTarget, targets, text) => ({
  id,
  missionId,
  navTarget,
  get nextLabel() { return t('review.next', 'Suivant'); },
  review: true,
  targets,
  get text() { return text(); },
  veil: false,
});

const REVIEW_STEPS = [
  reviewStep('rv-m1', 'coach_m1', teamHubTarget, ['teams.fab', 'teams.newTeam'], () => t(
    'rv-m1',
    'Tes équipes sont ici. Le bouton entouré en crée une : un nom, une catégorie, '
      + 'un niveau.',
  )),
  reviewStep('rv-m2', 'coach_m2', teamHubTarget, ['teams.trained.0'], () => t(
    'rv-m2',
    'Dans la fiche d’une équipe, « ⋮ » puis « Partager un lien d’invitation » '
      + 'envoie l’invitation à tes joueur·se·s.',
  )),
  extendStep(reviewStep('rv-m3', 'coach_m3', homeTarget, ['home.card.manage-add-event'], () => t(
    'rv-m3',
    'Depuis l’accueil, « Ajouter un événement » programme une séance : le type, l’équipe, '
        + 'le lieu, l’horaire.',
  )), {
    // GUIDE-FINITIONS-3 R2-7 (R03) : la visite restait sur Équipes ; la carte de
    // l'accueil absente, on montre l'onglet au lieu de parler d'un autre écran.
    fallback: {
      targets: ['dock.home'],
      get text() {
        return t(
          'rv-m3-dock',
          'Les séances se programment sur l’accueil (cet onglet) : « Ajouter un événement », puis '
            + 'le type, l’équipe, le lieu, l’horaire.',
        );
      },
    },
  }),
  reviewStep('rv-m4', 'coach_m4', friendlySearchTarget, ['friendly.create'], () => t(
    'rv-m4',
    'Rechercher trouve des clubs, des événements et des matchs amicaux. Ici, « Créer un match '
      + 'amical » publie ton annonce.',
  )),
  // GUIDE-FINITIONS-2 N10 : la visite finissait sans un mot, sur Rechercher (capture 14).
  extendStep(reviewStep('rv-end', '', homeTarget, [], () => t(
    'rv-end',
    'C’est tout pour la visite : rien n’a été créé. Le guide se relance depuis Mon compte.',
  )), {
    get nextLabel() { return t('review.end', 'Terminer'); },
  }),
];

// FIN-GUIDE2 (Adel « 1- A », 02/11) : 03/11 00:00 à Paris. Le rattrapage du 29/10 a daté les
// comptes déjà inscrits, ils tombent avant.
const GUIDE_OFFER_SINCE = Date.parse('2026-11-02T23:00:00.000Z');

/**
 * Vrai si cette fin d'inscription, datée par le serveur, ouvre droit à la proposition du guide.
 *
 * ponytail: un ancien compte que le rattrapage n'a pas daté reçoit sa date au prochain lancement,
 * et voit donc une proposition qu'il peut refuser. Sortie : envoyer `createdAt` dans le profil.
 * @param {string | null | undefined} completedAt - `onboardingCompletedAt` du profil.
 * @returns {boolean} Vrai à partir de la frontière ; faux sans date ou date illisible.
 */
export const isGuideOfferDate = (completedAt) => (
  Date.parse(String(completedAt)) >= GUIDE_OFFER_SINCE
);

export const COACH_GUIDE = Object.freeze({
  /**
   * Situation au départ, figée pour tout le guide (un club rejoint en route ne
   * doit pas faire sauter la suite de la branche « sans club »).
   * @param {any} context - Personne connectée (`userData`), son niveau d'offre
   *   (`subscriptionAccessLevel`), et ce qu'elle vient de créer (profil pas encore relu, FIN-GUIDE
   *   point 2).
   * @returns {{ firstName: string; hadClub: boolean; hadTeam: boolean; isFreePlan: boolean;
   *   joinPending: boolean }} Drapeaux.
   */
  buildFlags: ({ created, subscriptionAccessLevel, userData }) => ({
    firstName: String(userData?.firstname || userData?.firstName || ''),
    hadClub: Boolean(userData?.club?.documentId),
    isFreePlan: subscriptionAccessLevel === 'FREE',
    // n° 20 : l'ouverture ne dit pas « trouve ton club » à qui attend déjà le sien.
    joinPending: isJoinPending({ userData }),
    // Seules les équipes qu'il entraîne (décision du chef, 27/10), dans son club courant.
    hadTeam: trainsTeamInClub(userData) || Boolean(created?.['team.created']),
  }),
  /**
   * FIN-GUIDE, point 1 : déjà coach d'une équipe ⇒ mission 1 validée, au départ ou dès que le
   * profil relu le dit (demande acceptée, guide gardé sur le téléphone).
   * @param {any} ctx - Contexte du guide.
   * @returns {{ flags: any; goto: string; missionId: string } | null} Mission, étape qui suit.
   */
  liveMission: (ctx) => (hadTeam(ctx) || trainsTeamInClub(ctx?.userData)
    ? { flags: { hadTeam: true }, goto: 'm2-card', missionId: 'coach_m1' }
    : null),
  // Mon compte : la rangée du guide.
  accountLabelKey: 'profile.actions.coachGuide',
  bonusFromMission: 'coach_b1',
  /**
   * Bilan de la clôture : ce qui existe pour de vrai grâce au guide.
   * @param {(key: string, ...args: any[]) => string} text - `t` de l'écran.
   * @param {{ created?: any; flags?: any }} state - Ce qui a été créé, et la situation au départ.
   * @returns {string[]} Lignes.
   */
  closingLines: (text, { created, flags }) => [
    created?.['club.joined']
      ? text('tourCatalog.coach.close.club', '{{club}} rejoint', {
        club: created['club.joined'].clubName
          || text('tourCatalog.coach.close.yourClub', 'Ton club'),
        ...SANS_ECHAPPEMENT,
      })
      : null,
    created?.['team.created']
      ? text('tourCatalog.coach.close.team', '{{team}} créée', {
        team: created['team.created'].teamName
          || text('tourCatalog.coach.close.yourTeam', 'Ton équipe'),
        ...SANS_ECHAPPEMENT,
      })
      // n° 29 : l'équipe d'un coach qui l'avait déjà, ou reconnue dans la question de M1.
      : ((flags?.hadTeam || created?.['team.trained'])
        && text('tourCatalog.coach.close.teamReady', 'Ton équipe, déjà prête')) || null,
    created?.['team.invite.shared']
      ? text('tourCatalog.coach.close.link', "Lien d'invitation partagé")
      : null,
    created?.['team.invite.sent']
      ? text('tourCatalog.coach.close.invited', 'Invitation envoyée')
      : null,
    created?.['event.created']
      // n° 29 : pluriel d'i18next (`sessions_one` / `sessions_other`), plus de « (s) ».
      ? text('tourCatalog.coach.close.sessions', {
        count: Number(created['event.created'].occurrences) || 1,
        defaultValue_one: '{{count}} séance programmée',
        defaultValue_other: '{{count}} séances programmées',
      })
      : null,
    created?.['friendlyMatch.ad.published']
      ? text('tourCatalog.coach.close.friendly', 'Annonce de match amical publiée')
      : null,
  ].filter(Boolean),
  // Le match d'exemple de B2 : la clôture dit qu'il n'a rien laissé.
  exampleMissionId: 'coach_b2',
  gaugeLabelKey: 'tourGuide.ringLabel',
  gaugeSpokenKey: 'tourGuide.teamReady',
  isOfferDate: isGuideOfferDate,
  get kicker() { return t('kicker', 'Guide entraîneur·e'); },
  // Le palier dit « prêt » seulement si cette mission est faite.
  keyMissionId: 'coach_m1',
  missions: MISSIONS,
  offerMessageKey: 'tourGuide.offer.message',
  // Retenus même avant le départ : le guide part souvent juste après (Bienvenue).
  preStartSignals: ['team.created'],
  steps: [...STEPS, ...REVIEW_STEPS],
  version: 3,
});
