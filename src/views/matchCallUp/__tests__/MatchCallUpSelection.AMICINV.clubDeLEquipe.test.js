import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import MatchCallUpSelection from '../MatchCallUpSelection';

jest.setTimeout(30000);

// ==========================================================================
// 🤝 AMIC-INVITE (19/10, APRÈS 149) — LA SÉLECTION DES CONVOQUÉS D'UNE ÉQUIPE INVITÉE.
//
// 🎬 Banc natif des 15-16/10 (captures n35 / n42) : Valbrune U13 est INVITÉE chez
// Montrivage. Offre de Valbrune attribuée et relue — l'écran « Convoqués » de
// l'encadrant de Valbrune affiche quand même `match-callup-offer-wall`, et « Ajouter
// un joueur » n'est jamais atteint.
// 🧨 L'écran juge l'offre sur `clubId`. Les portes de la fiche lui envoyaient le club
// de l'HÔTE ; et quand `clubId` manque (site rechargé, adresse ouverte dans un nouvel
// onglet), il retombait LUI AUSSI sur l'hôte (`event.team.club`) au lieu du club de
// l'équipe qu'il compose (`teamId`).
// ⚖️ Contrat : l'équipe composée est jugée sur l'offre de SON club — c'est ce que fait
// le serveur (`resolveCompositionSubscriptionDecision`, il relit le club de l'équipe).
// Aucun élargissement : l'offre de l'hôte n'ouvre rien à l'invité.
// ROUGE avant : sans `clubId`, mur pour l'invité couvert, et renforts lus chez l'hôte.
// ==========================================================================

const mockNavigate = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockAuth = {};
/** @type {any} */
let mockEvent = null;
/** @type {any[]} Les filtres passés à la requête des équipes du club (les renforts). */
const mockTeamsFilters = [];

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// 🧨 Objet FIGE : le recreer a chaque rendu relance les effets qui en dependent.
const mockNavigation = { goBack: jest.fn(), navigate: mockNavigate, setParams: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

// Le VRAI fr.js : le temoin lit les phrases que l ecran montre.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const valeur = cle.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur !== 'string') return typeof options === 'string' ? options : cle;
        return valeur.replace(/{{(\w+)}}/g, (_c, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvent, isFetching: false }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any} */ filtres, /** @type {any} */ options) => {
    if (options?.enabled) mockTeamsFilters.push(filtres);
    return { data: { pages: [] }, isFetching: false };
  },
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: { arrowLeft: 1, chevronLeft: 1 },
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <VueRN>
          {children}
          {footerComponent}
        </VueRN>
      ) : null
    ),
  };
});

/**
 * Tout le texte visible de l arbre rendu.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
  .join(' | ');

/**
 * Le pressable le plus profond qui porte ce libelle, ou undefined.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const bouton = (arbre, libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
    && texteVisible({ root: noeud }).includes(libelle))
  .pop();

const CLUB_HOTE = 'club-montrivage';
const CLUB_INVITE = 'club-valbrune';
const EQUIPE_HOTE = 'team-montrivage-u13';
const EQUIPE_INVITEE = 'team-valbrune-u13';

// Le match du banc : Montrivage reçoit, Valbrune U13 est invitée.
const MATCH_AMICAL = {
  documentId: 'evt-amical',
  invitedTeams: [{
    club: { documentId: CLUB_INVITE, name: 'US Valbrune' },
    documentId: EQUIPE_INVITEE,
    name: 'Valbrune U13',
  }],
  team: {
    club: { documentId: CLUB_HOTE, name: 'Montrivage Olympique' },
    documentId: EQUIPE_HOTE,
    name: 'U13',
  },
};

const EFFECTIF = [
  { documentId: 'p1', firstname: 'Moussa', lastname: 'Diallo' },
  { documentId: 'p2', firstname: 'Hugo', lastname: 'Fofana' },
];

// Le niveau d'offre du compte, club par club (`getSubscriptionAccessLevelForClub`).
const couvert = (/** @type {string} */ clubCouvert) => ({
  getSubscriptionAccessLevelForClub: (/** @type {string} */ club) => (
    club === clubCouvert ? 'TEAM' : 'FREE'),
  subscriptionAccessLevel: 'FREE',
});

const MUR = 'La convocation est incluse dans l’offre Équipe';
const AJOUTER = 'Ajouter un joueur';

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte la sélection telle qu'une porte l'ouvre.
 * @param {{ auth: any, params: any }} entree - Le compte et les paramètres reçus.
 * @returns {Promise<any>} L'arbre rendu.
 */
const ouvrir = async ({ auth, params }) => {
  mockAuth = auth;
  mockEvent = MATCH_AMICAL;
  mockRouteParams = {
    canEdit: true,
    eventId: 'evt-amical',
    players: EFFECTIF,
    sport: 'football',
    ...params,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCallUpSelection />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

// Ce que la page d'un match amical envoie à la sélection, côté invité (après le lot) ;
// et l'arrivée SANS `clubId` (site rechargé : l'écran n'a plus que `eventId` / `teamId`).
const PORTE_INVITE = { clubId: CLUB_INVITE, teamId: EQUIPE_INVITEE, teamName: 'Valbrune U13' };
const SANS_CLUB_INVITE = { teamId: EQUIPE_INVITEE, teamName: 'Valbrune U13' };
const SANS_CLUB_HOTE = { teamId: EQUIPE_HOTE, teamName: 'U13' };

beforeEach(() => {
  mockNavigate.mockClear();
  mockTeamsFilters.length = 0;
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('AMIC-INVITE — invité AVEC l offre de son club : pas de mur', () => {
  test('porte de la fiche : la sélection s ouvre, « Ajouter un joueur » atteint', async () => {
    const arbre = await ouvrir({ auth: couvert(CLUB_INVITE), params: PORTE_INVITE });

    expect(texteVisible(arbre)).not.toContain(MUR);
    expect(texteVisible(arbre)).toContain('Moussa');

    await act(async () => { bouton(arbre, AJOUTER).props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.MatchCallUpManualPlayer,
      expect.objectContaining({ teamName: 'Valbrune U13' }),
    );
  });

  test('🔴 sans clubId (site rechargé) : le club de l équipe composée, pas l hôte', async () => {
    const arbre = await ouvrir({ auth: couvert(CLUB_INVITE), params: SANS_CLUB_INVITE });

    expect(texteVisible(arbre)).not.toContain(MUR);
    expect(bouton(arbre, AJOUTER)).toBeDefined();
  });

  test('🔴 et les renforts sont ceux de SON club, jamais les équipes de l hôte', async () => {
    await ouvrir({ auth: couvert(CLUB_INVITE), params: SANS_CLUB_INVITE });

    expect(mockTeamsFilters.length).toBeGreaterThan(0);
    mockTeamsFilters.forEach((filtres) => {
      expect(filtres).toEqual(expect.objectContaining({ clubId: CLUB_INVITE }));
    });
  });
});

describe('AMIC-INVITE — 🔒 invité SANS offre : le mur protège', () => {
  test('par la porte de la fiche : mur, et « Ajouter un joueur » hors d atteinte', async () => {
    const arbre = await ouvrir({ auth: couvert('aucun-club'), params: PORTE_INVITE });

    expect(texteVisible(arbre)).toContain(MUR);
    expect(bouton(arbre, AJOUTER)).toBeUndefined();
  });

  test('🔴 sans clubId, l offre de l HÔTE ne lui ouvre rien', async () => {
    const arbre = await ouvrir({ auth: couvert(CLUB_HOTE), params: SANS_CLUB_INVITE });

    expect(texteVisible(arbre)).toContain(MUR);
    expect(bouton(arbre, AJOUTER)).toBeUndefined();
  });
});

describe('AMIC-INVITE — 🔒 l hôte : inchangé', () => {
  test('hôte AVEC offre, sans clubId : pas de mur, renforts de son club', async () => {
    const arbre = await ouvrir({ auth: couvert(CLUB_HOTE), params: SANS_CLUB_HOTE });

    expect(texteVisible(arbre)).not.toContain(MUR);
    expect(bouton(arbre, AJOUTER)).toBeDefined();
    expect(mockTeamsFilters.length).toBeGreaterThan(0);
    mockTeamsFilters.forEach((filtres) => {
      expect(filtres).toEqual(expect.objectContaining({ clubId: CLUB_HOTE }));
    });
  });

  test('hôte SANS offre (l invité couvert n y change rien) : mur', async () => {
    const arbre = await ouvrir({
      auth: couvert(CLUB_INVITE),
      params: { ...SANS_CLUB_HOTE, clubId: CLUB_HOTE },
    });

    expect(texteVisible(arbre)).toContain(MUR);
    expect(bouton(arbre, AJOUTER)).toBeUndefined();
  });
});
