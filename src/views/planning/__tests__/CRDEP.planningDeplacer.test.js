/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getMyCollectivites,
} from '@/services/collectivite/collectiviteService';
import { getFacilityPlanning } from '@/services/facility/facilityService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 🚚 COLL-R-DEPLACER A8 (14/10/2026, COL-013, décision d'Adel « D9 = b ») — LE PLANNING D'UNE INSTALLATION :
//   - côté VILLE, la fiche « Qui occupe l'installation » d'une séance touchée dit ENFIN la fermeture et
//     offre « Proposer une autre place » (planche P5v4-deplacer-ville-tel écran 1 b) ; une proposition
//     en attente se lit « Proposition envoyée … » (écran 6 b) ;
//   - côté CLUB, l'appui sur un bloc « à déplacer » de son club ouvre « Déplacer la séance » pour qui peut
//     la déplacer (planche P5v4-deplacer-tel écran 1) ; sinon la fiche, comme avant.
// ROUGES avant le lot : la fiche ne disait rien de la fermeture, aucun geste ; le bloc ouvrait la fiche.
// Harnais repris de COLL-C4B.planningFermetures.test.js (les mêmes doublures).

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const PORTRAIT = { height: 844, width: 390 };

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {any} */
let mockAuth;
/** @type {any} */
let mockDimensions = PORTRAIT;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { arrowLeft: 1, arrowRight: 2, close: 3 },
      Spaces: espaces,
    }),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock('@/components/organisms/planningWeekTimelineView', () => function TimelineMock(
  /** @type {any} */ props,
) {
  mockTimelineProps.push(props);
  return null;
});
/** @type {any[]} */
const mockCalendarProps = [];
jest.mock('@/components/organisms/planningCalendarView', () => function CalendarMock(
  /** @type {any} */ props,
) {
  mockCalendarProps.push(props);
  return null;
});
/** @type {any} */
let mockVueRetenue;
const mockSetItem = jest.fn();
jest.mock('@/platform/storage', () => ({
  ...jest.requireActual('@/platform/storage'),
  getItem: () => mockVueRetenue,
  setItem: (/** @type {any[]} */ ...args) => mockSetItem(...args),
}));
/** @type {any[]} */
const mockInputProps = [];
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN,
  } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/utils/device/orientation', () => ({
  lockToLandscape: jest.fn(),
  lockToPortrait: jest.fn(),
  unlockAllOrientations: jest.fn(),
}));
jest.mock('@/services/event/eventService', () => ({
  getClubPlanning: jest.fn(),
  getMyPlanning: jest.fn(),
}));
jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getClubSharedPlanning: jest.fn(),
  getCMPlanning: jest.fn(),
}));
// COLL-C4B-BIS (03/10) : le planning lit aussi les fermetures (panneau sur ordinateur, bandeau).
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(async () => ({ data: [], meta: {} })),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteClubs: jest.fn(),
  getCollectiviteInstallations: jest.fn(),
  getMyCollectivites: jest.fn(),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));

// Des secrets semes : si l un s affiche, la mairie lirait une personne.
const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr'];
const PERSONNE = { email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1] };

const bloc = (/** @type {any} */ champs) => ({
  createdBy: PERSONNE,
  endAt: '2026-03-04T18:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  kind: 'event',
  leagueMatch: false,
  origin: 'club',
  pending: false,
  plateau: null,
  slot: null,
  startAt: '2026-03-04T17:00:00.000Z',
  startTime: '18:00:00.000',
  ...champs,
});
const BLOC_DE_MON_CLUB = bloc({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: 'evt-A',
  isOwnClub: true,
  team: { name: 'Seniors A', trainers: [PERSONNE] },
  title: 'AS Ville A · Seniors A',
});
const BLOC_D_UN_AUTRE_CLUB = bloc({
  club: { documentId: 'club-B', name: 'US Ville B', president: PERSONNE },
  documentId: null,
  endAt: '2026-03-04T19:00:00.000Z',
  endTime: '20:00:00.000',
  isOwnClub: false,
  kind: 'slot',
  origin: 'slot',
  slot: {
    documentId: 'slot-B',
    source: 'attribution',
    validFrom: '2025-09-01',
    validUntil: '2026-06-30',
    weekday: 3,
  },
  startAt: '2026-03-04T17:30:00.000Z',
  startTime: '18:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
});
const BLOC_EN_ATTENTE = bloc({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: null,
  isOwnClub: false,
  origin: 'request',
  pending: true,
  team: { name: 'U13' },
  title: 'AS Ville A · U13',
});

const reponse = (/** @type {any[]} */ blocs) => ({
  data: blocs,
  meta: {
    facility: {
      capacityConflictMode: 'pending_validation',
      documentId: 'gym-ville',
      maxSlots: 2,
      name: 'Gymnase de la Ville',
      plateaux: [],
    },
  },
});

const JOUEUR = { userData: { role: { name: 'Joueur', type: 'joueur' } } };
const gereLaVille = () => {
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({
    data: [{ documentId: 'ville-1', name: 'Ville de Montrivage' }],
  });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({
    data: [{ documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville' }],
  });
};

/** @type {any[]} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });
};
const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PlanningWeekFullscreen />
      </QueryClientProvider>,
    );
  });
  await attendre();
  await attendre();
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants).replace(/\u00a0/g, ' ');
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle))
  .pop();
const grille = () => mockTimelineProps[mockTimelineProps.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockCalendarProps.length = 0;
  mockInputProps.length = 0;
  mockVueRetenue = undefined;
  mockDimensions = PORTRAIT;
  mockAuth = JOUEUR;
  mockNavigation = {
    goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
  };
  mockRoute = {
    params: {
      contextDetailLabel: 'Gymnase de la Ville',
      date: '2026-03-04T10:00:00.000Z',
      facilityId: 'gym-ville',
      sourceType: 'facility',
    },
  };
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue(
    reponse([BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB, BLOC_EN_ATTENTE]),
  );
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({ data: [] });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({ data: [] });
  /** @type {any} */ (getCollectiviteClubs).mockResolvedValue({
    data: [{ documentId: 'club-B', email: 'contact@usvilleb.fr', name: 'US Ville B' }],
  });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

const FERMETURE_DU_JOUR = {
  documentId: 'f1',
  endDate: '2026-03-04',
  endTime: null,
  kind: 'closure',
  label: null,
  reason: 'travaux',
  startDate: '2026-03-04',
  startTime: null,
};
const PROPOSITION = {
  date: '2026-03-04',
  documentId: 'prop-1',
  endTime: '19:30',
  facility: { documentId: 'stade-ville', name: 'Stade municipal' },
  startTime: '18:00',
  status: 'pending',
};
// Le bloc d'une séance du club A touchée par la fermeture, tel que le serveur le rend à la VILLE qui gère :
// pas de `documentId` (elle n'est pas du club), mais `eventId` (de quoi proposer) et la proposition.
const toucheeVueParLaVille = (/** @type {any} */ relocationProposal = null) => ({
  ...BLOC_DE_MON_CLUB,
  closure: { documentId: 'f1', kind: 'closure' },
  documentId: null,
  eventId: 'evt-A',
  isOwnClub: false,
  relocationProposal,
});
const servir = (/** @type {any[]} */ blocs) => {
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
    ...reponse(blocs),
    meta: { ...reponse([]).meta, closures: [FERMETURE_DU_JOUR] },
  });
};
const blocDe = (/** @type {string} */ titre) => grille().events.find((/** @type {any} */ e) => e.title === titre);

describe('CRDEP — la Ville propose une autre place depuis son planning', () => {
  it('la fiche « Qui occupe » dit la fermeture et offre « Proposer une autre place »', async () => {
    gereLaVille();
    servir([toucheeVueParLaVille()]);
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(blocDe('AS Ville A · Seniors A')); });
    await attendre();
    const lus = textes(arbre);
    expect(lus).toContain('Touchée par la fermeture le mercredi 4 mars');
    expect(lus).toContain('À déplacer par le club. Vous pouvez lui proposer une place.');
    await act(async () => { parTexte(arbre, 'Proposer une autre place').props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('EventStack', {
      params: { as: 'ville', eventId: 'evt-A', mode: 'deplacer' }, screen: 'EventEdit',
    });
  });

  it('une proposition en attente : « Proposition envoyée … » ; la Ville peut en proposer une autre', async () => {
    gereLaVille();
    servir([toucheeVueParLaVille(PROPOSITION)]);
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(blocDe('AS Ville A · Seniors A')); });
    await attendre();
    expect(textes(arbre)).toContain('Proposition envoyée : Stade municipal · mer. 4 mars · 18:00 – 19:30');
    expect(parTexte(arbre, 'Proposer une autre place')).toBeDefined();
  });

  it('une séance non touchée : ni phrase de fermeture, ni geste', async () => {
    gereLaVille();
    servir([{ ...BLOC_D_UN_AUTRE_CLUB, closure: null }]);
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(blocDe('US Ville B · Seniors B')); });
    await attendre();
    expect(textes(arbre).some((/** @type {string} */ texte) => texte.startsWith('Touchée par la fermeture'))).toBe(false);
    expect(parTexte(arbre, 'Proposer une autre place')).toBeUndefined();
  });
});

describe('CRDEP — le club touche son bloc « à déplacer »', () => {
  const touchee = { ...BLOC_DE_MON_CLUB, closure: { documentId: 'f1', kind: 'closure' } };

  it('qui peut la déplacer : « Déplacer la séance »', async () => {
    mockAuth = { ...JOUEUR, canManageEvent: () => true };
    servir([touchee]);
    await rendre();
    await act(async () => { grille().onEventPress(blocDe('AS Ville A · Seniors A')); });
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('EventStack', {
      params: { eventId: 'evt-A', mode: 'deplacer' }, screen: 'EventEdit',
    });
  });

  it('un joueur : la fiche, comme avant', async () => {
    servir([touchee]);
    await rendre();
    await act(async () => { grille().onEventPress(blocDe('AS Ville A · Seniors A')); });
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('EventStack', {
      params: { eventId: 'evt-A' }, screen: 'EventDetails',
    });
  });
});
