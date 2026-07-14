import { getSimulationRoster } from '@/domains/tactical/simulationRosters';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Tour guidé v2 (plan docs/PLAN_TOUR_GUIDE_V2_2026_07_10.md).
 * Un tour = une liste ordonnée d'étapes qui naviguent directement sur les
 * vraies pages. Deux familles d'étapes :
 * - `explore` : l'utilisateur découvre la page, valide via le bouton du bandeau ;
 * - `action`  : validée automatiquement par un signal métier (bus guidanceRuntime).
 * Chaque étape porte son message de succès, affiché avant d'enchaîner.
 * @typedef {{
 *   fallbackTarget?: { params?: any; routeName: string };
 *   id: string;
 *   instruction: string;
 *   manualLabel?: string;
 *   isAlreadyDone?: (context: any) => boolean;
 *   navTarget: { params?: any; routeName: string };
 *   skipLabel?: string;
 *   success: { key?: string; type: 'action' | 'interaction' | 'manual' | 'route' };
 *   successMessage: string;
 *   title: string;
 * }} TourStep
 */

const planningTarget = {
  params: { screen: RouteNames.MyEventList },
  routeName: RouteNames.HomeTab,
};
const messagingTarget = {
  params: { screen: RouteNames.Chat },
  routeName: RouteNames.HomeTab,
};
const teamHubTarget = {
  params: { screen: RouteNames.MyTeamList },
  routeName: RouteNames.HomeTab,
};
const homeTarget = {
  // L'accueil (HomeHub) est enregistre sous 'SearchHome' dans le SearchStack.
  params: { screen: 'SearchHome' },
  routeName: RouteNames.HomeTab,
};
const teamWizardTarget = {
  params: (/** @type {any} */ context) => ({
    params: { clubId: context?.userData?.club?.documentId },
    screen: RouteNames.TeamWizardName,
  }),
  routeName: RouteNames.TeamStack,
};
const eventWizardTarget = {
  params: { screen: RouteNames.EventWizardType },
  routeName: RouteNames.EventStack,
};
const offersRecapTarget = { routeName: RouteNames.GuideOffersRecap };
const profileEditTarget = {
  params: { screen: RouteNames.ProfileEdit },
  routeName: RouteNames.ProfileStack,
};
const searchEventsTarget = {
  params: { activeType: 'events' },
  routeName: RouteNames.SearchHub,
};

/**
 * Sport de la simulation de composition : sport de l'équipe entraînée, sinon
 * sport préféré, sinon football (même heuristique que l'ancien catalogue).
 * @param {any} context
 * @returns {string}
 */
const resolveSimulationSport = (context) => {
  const userData = context?.userData;
  const trainedTeamSport = (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : [])
    .map((/** @type {any} */ team) => team?.activities?.[0]?.name)
    .find(Boolean);
  return trainedTeamSport || userData?.preferredSport || 'football';
};

const compositionSimulationTarget = {
  params: (/** @type {any} */ context) => {
    const simulationSport = resolveSimulationSport(context);
    return {
      params: {
        canEdit: true,
        editorMode: 'event',
        players: getSimulationRoster(simulationSport),
        simulationMode: true,
        sport: simulationSport,
      },
      screen: RouteNames.TacticalBoardV2,
    };
  },
  routeName: RouteNames.EventStack,
};

/** @type {TourStep[]} */
const COACH_TOUR_STEPS = [
  {
    // Sans equipe, rien n'est possible (evenement, compo...) : le tour commence ici.
    // Sautee automatiquement si le coach a deja une equipe (isAlreadyDone).
    fallbackTarget: homeTarget,
    id: 'coach_create_team',
    instruction: 'Crée ton équipe — tout le reste en découle (ta 1ʳᵉ équipe est offerte).',
    isAlreadyDone: (/** @type {any} */ context) => (
      (Array.isArray(context?.userData?.trainedTeams) && context.userData.trainedTeams.length > 0)
      || (Array.isArray(context?.userData?.myTeams) && context.userData.myTeams.length > 0)
    ),
    navTarget: teamWizardTarget,
    skipLabel: 'Créer plus tard',
    success: { key: 'team.created', type: 'action' },
    successMessage: '🎉 Ton équipe est créée !',
    title: 'Crée ton équipe',
  },
  {
    // Semi-etape pedagogique : le coach apprend OU se cree un evenement (carte
    // de l'accueil) — la validation = arrivee sur le tunnel evenement.
    fallbackTarget: homeTarget,
    id: 'coach_find_event_card',
    instruction: 'Ton équipe est prête ! Sur ton accueil, touche la carte « Ajouter un événement ».',
    manualLabel: "M'y emmener",
    navTarget: homeTarget,
    success: { key: RouteNames.EventWizardType, type: 'route' },
    successMessage: "Bien trouvé ! C'est ici que tout se crée.",
    title: 'Trouve la carte « Ajouter un événement »',
  },
  {
    fallbackTarget: planningTarget,
    id: 'coach_create_event',
    instruction: 'Crée ton premier événement — il est offert.',
    navTarget: eventWizardTarget,
    skipLabel: 'Créer plus tard',
    success: { key: 'event.created', type: 'action' },
    successMessage: '🎉 Ton événement offert est en ligne !',
    title: 'Ton premier événement',
  },
  {
    id: 'coach_follow_event',
    instruction: 'Ouvre ton événement depuis le planning : présents, absents, retards et arrivées se suivent ici.',
    manualLabel: "J'ai vu",
    navTarget: planningTarget,
    success: { type: 'manual' },
    successMessage: 'Tu sais suivre ton événement.',
    title: 'Suivre ton événement',
  },
  {
    id: 'coach_composition',
    instruction: "Prépare ta compo — terrain d'essai, rien n'est publié.",
    // Échappatoire : le bandeau garde le bouton manuel même sur cette étape à signal.
    manualLabel: "J'ai testé",
    navTarget: compositionSimulationTarget,
    // Émis par TacticalBoard au tap sur « Publier » en mode simulation guidée.
    success: { key: 'composition.simulated.published', type: 'action' },
    successMessage: 'Compo maîtrisée ! (Publier une convocation = offre Équipe)',
    title: 'Préparer une composition',
  },
  {
    id: 'coach_planning',
    instruction: 'Ton planning regroupe toute ta semaine.',
    manualLabel: "J'ai vu",
    navTarget: planningTarget,
    success: { type: 'manual' },
    successMessage: 'Planning en poche.',
    title: 'Ton planning',
  },
  {
    id: 'coach_team',
    instruction: 'Ton espace équipe : invite tes joueur·se·s avec le lien de partage.',
    manualLabel: "J'ai vu",
    navTarget: teamHubTarget,
    success: { type: 'manual' },
    successMessage: 'Ton équipe est prête à grandir.',
    title: 'Ton équipe',
  },
  {
    id: 'coach_messaging',
    instruction: 'Le groupe de ton équipe est déjà créé.',
    manualLabel: "J'ai vu",
    navTarget: messagingTarget,
    success: { type: 'manual' },
    successMessage: 'Communication en place.',
    title: 'Ta messagerie',
  },
  {
    id: 'coach_offers',
    instruction: 'Voici ce que chaque offre débloque — à toi de jouer.',
    manualLabel: 'Terminer le tour',
    navTarget: offersRecapTarget,
    success: { type: 'manual' },
    successMessage: 'Tour terminé 🎉 Bienvenue chez toi.',
    title: 'Les offres FoundClub',
  },
];

/** @type {TourStep[]} */
const PLAYER_TOUR_STEPS = [
  {
    id: 'player_planning',
    instruction: 'Retrouve ici tous tes événements et ton agenda.',
    manualLabel: "J'ai vu",
    navTarget: planningTarget,
    success: { type: 'manual' },
    successMessage: 'Ton planning est prêt !',
    title: 'Mon planning',
  },
  {
    id: 'player_participation',
    instruction: 'Trouve un événement qui te plaît et réponds présent·e.',
    manualLabel: 'Plus tard',
    navTarget: searchEventsTarget,
    success: { key: 'event.participation.created', type: 'action' },
    successMessage: 'Première participation enregistrée !',
    title: 'Répondre présent·e',
  },
  {
    id: 'player_messaging',
    instruction: 'Le groupe de ton équipe est déjà là — chat illimité, pour toujours.',
    manualLabel: "J'ai vu",
    navTarget: messagingTarget,
    success: { type: 'manual' },
    successMessage: 'Tu sais où parler à ton équipe.',
    title: 'Messagerie',
  },
  {
    id: 'player_profile',
    instruction: 'Complète ton profil sportif pour être repéré·e.',
    manualLabel: 'Terminer le tour',
    navTarget: profileEditTarget,
    success: { type: 'manual' },
    successMessage: 'Profil au top — tour terminé 🎉',
    title: 'Mon profil',
  },
];

/** @type {TourStep[]} */
const PRESIDENT_TOUR_STEPS = [
  {
    id: 'president_club',
    instruction: 'Ton espace club : infos, logo, coordonnées.',
    manualLabel: "J'ai vu",
    navTarget: homeTarget,
    success: { type: 'manual' },
    successMessage: 'Ton club a une vitrine.',
    title: 'Ta fiche club',
  },
  {
    id: 'president_teams',
    instruction: 'Gère toutes les équipes de ton club ici.',
    manualLabel: "J'ai vu",
    navTarget: teamHubTarget,
    success: { type: 'manual' },
    successMessage: "Vue d'ensemble acquise.",
    title: 'Les équipes du club',
  },
  {
    id: 'president_planning',
    instruction: 'Le planning du club : terrains, salles et créneaux colorés par installation.',
    manualLabel: "J'ai vu",
    navTarget: planningTarget,
    success: { type: 'manual' },
    successMessage: 'Installations repérées (offre Club).',
    title: 'Installations & planning',
  },
  {
    fallbackTarget: planningTarget,
    id: 'president_events',
    instruction: 'Crée un événement pour ton club — le premier est offert.',
    navTarget: eventWizardTarget,
    skipLabel: 'Créer plus tard',
    success: { key: 'event.created', type: 'action' },
    successMessage: '🎉 Ton événement offert est en ligne !',
    title: 'Ton premier événement',
  },
  {
    id: 'president_messaging',
    instruction: 'Groupes de discussion du club.',
    manualLabel: "J'ai vu",
    navTarget: messagingTarget,
    success: { type: 'manual' },
    successMessage: 'Communication club vue.',
    title: 'Communication',
  },
  {
    id: 'president_offers',
    instruction: "L'offre Club débloque tout ça d'un coup.",
    manualLabel: 'Terminer le tour',
    navTarget: offersRecapTarget,
    success: { type: 'manual' },
    successMessage: 'Tour terminé 🎉',
    title: "L'offre Club",
  },
];

/** @type {Record<string, { steps: TourStep[] }>} */
export const TOUR_PROFILES = Object.freeze({
  coach: { steps: COACH_TOUR_STEPS },
  player: { steps: PLAYER_TOUR_STEPS },
  president: { steps: PRESIDENT_TOUR_STEPS },
});

/**
 * @param {string | null | undefined} profileKey
 * @returns {{ steps: TourStep[] } | null}
 */
export const getTourProfile = (profileKey) => (
  TOUR_PROFILES[/** @type {keyof typeof TOUR_PROFILES} */ (String(profileKey || ''))] || null
);
