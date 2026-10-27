import i18next from 'i18next';

import { COACH_GUIDE } from '@/domains/tour/coachGuide';

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

/**
 * L'ACCUEIL, la ou le tour raccompagne l'utilisateur quand il se termine.
 *
 * D23 (defaut ⑥) — l'onglet « Accueil » heberge tout le `SearchStack` : le hub
 * de recherche s'EMPILE dessus. Une etape qui y navigue (par exemple
 * `player_participation`) laisse donc l'onglet gare sur « Rechercher ». Sans
 * ce retour explicite, la fin du tour abandonnait l'utilisateur la, sans
 * chemin evident vers l'accueil. `navigate` vers un ecran deja empile y revient
 * en DEPILANT : c'est exactement ce qu'il faut ici.
 */
export const TOUR_HOME_TARGET = homeTarget;
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

/** @type {TourStep[]} */
const PLAYER_TOUR_STEPS = [
  {
    id: 'player_planning',
    get instruction() {
      return i18next.t(
        'tourCatalog.playerPlanning.instruction',
        'Retrouve ici tous tes événements et ton agenda.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.playerPlanning.manualLabel', "J'ai vu");
    },
    navTarget: planningTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t('tourCatalog.playerPlanning.successMessage', 'Ton planning est prêt !');
    },
    get title() {
      return i18next.t('tourCatalog.playerPlanning.title', 'Mon planning');
    },
  },
  {
    id: 'player_participation',
    get instruction() {
      return i18next.t(
        'tourCatalog.playerParticipation.instruction',
        'Trouve un événement qui te plaît et réponds présent·e.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.playerParticipation.manualLabel', 'Plus tard');
    },
    navTarget: searchEventsTarget,
    success: { key: 'event.participation.created', type: 'action' },
    get successMessage() {
      return i18next.t(
        'tourCatalog.playerParticipation.successMessage',
        'Première participation enregistrée !',
      );
    },
    get title() {
      return i18next.t('tourCatalog.playerParticipation.title', 'Répondre présent·e');
    },
  },
  {
    id: 'player_messaging',
    get instruction() {
      return i18next.t(
        'tourCatalog.playerMessaging.instruction',
        'Le groupe de ton équipe est déjà là — chat illimité, pour toujours.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.playerMessaging.manualLabel', "J'ai vu");
    },
    navTarget: messagingTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t(
        'tourCatalog.playerMessaging.successMessage',
        'Tu sais où parler à ton équipe.',
      );
    },
    get title() {
      return i18next.t('tourCatalog.playerMessaging.title', 'Messagerie');
    },
  },
  {
    id: 'player_profile',
    get instruction() {
      return i18next.t(
        'tourCatalog.playerProfile.instruction',
        'Complète ton profil sportif pour être repéré·e.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.playerProfile.manualLabel', 'Terminer le tour');
    },
    navTarget: profileEditTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t(
        'tourCatalog.playerProfile.successMessage',
        'Profil au top — tour terminé',
      );
    },
    get title() {
      return i18next.t('tourCatalog.playerProfile.title', 'Mon profil');
    },
  },
];

/** @type {TourStep[]} */
const PRESIDENT_TOUR_STEPS = [
  {
    id: 'president_club',
    get instruction() {
      return i18next.t(
        'tourCatalog.presidentClub.instruction',
        'Ton espace club : infos, logo, coordonnées.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.presidentClub.manualLabel', "J'ai vu");
    },
    navTarget: homeTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t('tourCatalog.presidentClub.successMessage', 'Ton club a une vitrine.');
    },
    get title() {
      return i18next.t('tourCatalog.presidentClub.title', 'Ta fiche club');
    },
  },
  {
    id: 'president_teams',
    get instruction() {
      return i18next.t(
        'tourCatalog.presidentTeams.instruction',
        'Gère toutes les équipes de ton club ici.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.presidentTeams.manualLabel', "J'ai vu");
    },
    navTarget: teamHubTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t('tourCatalog.presidentTeams.successMessage', "Vue d'ensemble acquise.");
    },
    get title() {
      return i18next.t('tourCatalog.presidentTeams.title', 'Les équipes du club');
    },
  },
  {
    id: 'president_planning',
    get instruction() {
      return i18next.t(
        'tourCatalog.presidentPlanning.instruction',
        'Le planning du club : terrains, salles et créneaux colorés par installation.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.presidentPlanning.manualLabel', "J'ai vu");
    },
    navTarget: planningTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t(
        'tourCatalog.presidentPlanning.successMessage',
        'Installations repérées (offre Club).',
      );
    },
    get title() {
      return i18next.t('tourCatalog.presidentPlanning.title', 'Installations & planning');
    },
  },
  {
    fallbackTarget: planningTarget,
    id: 'president_events',
    get instruction() {
      return i18next.t(
        'tourCatalog.presidentEvents.instruction',
        'Crée un événement pour ton club — le premier est offert.',
      );
    },
    navTarget: eventWizardTarget,
    get skipLabel() {
      return i18next.t('tourCatalog.presidentEvents.skipLabel', 'Créer plus tard');
    },
    success: { key: 'event.created', type: 'action' },
    get successMessage() {
      return i18next.t(
        'tourCatalog.presidentEvents.successMessage',
        'Ton événement offert est en ligne !',
      );
    },
    get title() {
      return i18next.t('tourCatalog.presidentEvents.title', 'Ton premier événement');
    },
  },
  {
    id: 'president_messaging',
    get instruction() {
      return i18next.t(
        'tourCatalog.presidentMessaging.instruction',
        'Groupes de discussion du club.',
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.presidentMessaging.manualLabel', "J'ai vu");
    },
    navTarget: messagingTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t('tourCatalog.presidentMessaging.successMessage', 'Communication club vue.');
    },
    get title() {
      return i18next.t('tourCatalog.presidentMessaging.title', 'Communication');
    },
  },
  {
    id: 'president_offers',
    get instruction() {
      return i18next.t(
        'tourCatalog.presidentOffers.instruction',
        "L'offre Club débloque tout ça d'un coup.",
      );
    },
    get manualLabel() {
      return i18next.t('tourCatalog.presidentOffers.manualLabel', 'Terminer le tour');
    },
    navTarget: offersRecapTarget,
    success: { type: 'manual' },
    get successMessage() {
      return i18next.t('tourCatalog.presidentOffers.successMessage', 'Tour terminé');
    },
    get title() {
      return i18next.t('tourCatalog.presidentOffers.title', "L'offre Club");
    },
  },
];

/** @type {Record<string, any>} */
export const TOUR_PROFILES = Object.freeze({
  // TUTOE (27/10) : le guide Entraîneur à missions remplace l'ancien tour coach.
  coach: COACH_GUIDE,
  player: { steps: PLAYER_TOUR_STEPS },
  president: { steps: PRESIDENT_TOUR_STEPS },
});

/**
 * @param {string | null | undefined} profileKey
 * @returns {any}
 */
export const getTourProfile = (profileKey) => (
  TOUR_PROFILES[/** @type {keyof typeof TOUR_PROFILES} */ (String(profileKey || ''))] || null
);
