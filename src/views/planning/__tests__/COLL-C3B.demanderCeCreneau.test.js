import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getMyCollectivites,
} from '@/services/collectivite/collectiviteService';
// eslint-disable-next-line max-len
import { getClubCollectiviteFacilities, getFacilityPlanning } from '@/services/facility/facilityService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 🏛️ COLL-C3B (02/10/2026) — design HY521H1, P8v2-demande (tel et ordi) : LE CLUB DEMANDE DEPUIS
// LE PLANNING de l installation de la Ville. Un DIRIGEANT ou un ENTRAINEUR d un club rattache
// touche une heure libre ⇒ « Demander un creneau », deja rempli du jour et de l heure ; et sa
// demande en attente se voit « en attente » a sa place (point 4 du lot).
// ROUGE avant le lot : aucune heure ne se touchait pour un club, aucun bouton, et la demande en
// attente du club se lisait comme une seance ordinaire.
// Harnais repris de COLL-C2B.planningRestyle.test.js (les memes doublures).

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
// COLL-C3B-BIS (planche 43) : l'ordinateur ouvre la demande en panneau ; le téléphone, en écran.
let mockDesktop = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockDesktop }));
// Le panneau est l'écran « Demander un créneau » (témoin à part : ClubSlotRequest.test.js) :
// ici, ce que le planning lui passe, et ce qu'il fait du brouillon qu'il rend.
/** @type {any[]} */
const mockPanneaux = [];
jest.mock('@/views/collectivite/ClubSlotRequest', () => function ClubSlotRequestMock(
  /** @type {any} */ props,
) {
  mockPanneaux.push(props);
  return null;
});
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
jest.mock('@/components/organisms/planningCalendarView', () => function CalendarMock() {
  return null;
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
jest.mock('@/services/facility/facilityService', () => ({
  getClubCollectiviteFacilities: jest.fn(),
  getFacilityPlanning: jest.fn(),
}));
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
  return String(enfants);
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
  mockPanneaux.length = 0;
  mockDesktop = false;
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

// Le dirigeant de AS Ville A, club rattache a la Ville proprietaire du gymnase.
const DIRIGEANT_DU_CLUB = {
  userData: { club: { documentId: 'club-A' }, role: { name: 'Dirigeant', type: 'president' } },
};
const installationsDeLaVille = (/** @type {string[]} */ ids) => {
  /** @type {any} */ (getClubCollectiviteFacilities).mockResolvedValue({
    // eslint-disable-next-line max-len
    data: ids.map((id) => ({ collectivite: { name: 'Ville de Montrivage' }, documentId: id, name: id })),
  });
};

// COLL-C3B-BIS (03/10) — planche 43, P8v2-demande-ordi (états A et B). ROUGE avant : sur
// ordinateur aussi, l'heure touchée quittait le planning pour un écran entier, et rien ne se
// dessinait dans la grille pendant la saisie.
// eslint-disable-next-line max-len
describe('COLL-C3B-BIS — planche 43 : sur ordinateur, la demande en panneau, la place en pointillé', () => {
  const ouvrir = async () => {
    mockAuth = DIRIGEANT_DU_CLUB;
    mockDesktop = true;
    installationsDeLaVille(['gym-ville']);
    await rendre();
    await act(async () => { grille().onFreeSlotPress(new Date(2026, 2, 4, 12, 0, 0), 18); });
    await attendre();
    return mockPanneaux[mockPanneaux.length - 1];
  };
  const brouillonsDeLaGrille = () => (grille().events || [])
    .filter((/** @type {any} */ evenement) => evenement?.raw?.brouillon === true);

  // eslint-disable-next-line max-len
  it('une heure libre ouvre le PANNEAU, rempli du jour et de l heure ; on reste sur le planning', async () => {
    const panneau = await ouvrir();
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(panneau).toEqual(expect.objectContaining({
      enPanneau: true,
      initial: {
        clubId: 'club-A',
        date: '2026-03-04',
        endTime: '19:30',
        facilityId: 'gym-ville',
        startTime: '18:00',
      },
    }));
  });

  // eslint-disable-next-line max-len
  it('pendant la saisie, « U13 ? » en pointillé dans la grille ; fermer le panneau l efface', async () => {
    const panneau = await ouvrir();
    await act(async () => {
      panneau.onBrouillon({
        date: '2026-03-04',
        endTime: '19:30',
        equipe: 'U13',
        facilityId: 'gym-ville',
        startTime: '18:00',
      });
    });
    await attendre();
    const [brouillon] = brouillonsDeLaGrille();
    expect(brouillon).toBeDefined();
    // Les pointillés orange de la grille : une place demandée, en attente (contrat C2A §7).
    expect(brouillon.raw).toEqual(expect.objectContaining({ origin: 'request', pending: true }));
    expect(brouillon.title).toBe('U13 ?');
    expect(brouillon.startTime).toBe('18:00');
    await act(async () => { mockPanneaux[mockPanneaux.length - 1].onFermer(); });
    await attendre();
    expect(brouillonsDeLaGrille()).toHaveLength(0);
  });

  it('au téléphone, rien ne change : l écran « Demander un créneau »', async () => {
    mockAuth = DIRIGEANT_DU_CLUB;
    installationsDeLaVille(['gym-ville']);
    await rendre();
    act(() => { grille().onFreeSlotPress(new Date(2026, 2, 4, 12, 0, 0), 18); });
    const attendu = expect.objectContaining({ facilityId: 'gym-ville', startTime: '18:00' });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ClubSlotRequest', attendu);
  });
});

describe('COLL-C3B — le club demande depuis le planning d une installation de la Ville', () => {
  // eslint-disable-next-line max-len
  it('un dirigeant touche une heure libre ⇒ « Demander un créneau », rempli du jour et de l heure', async () => {
    mockAuth = DIRIGEANT_DU_CLUB;
    installationsDeLaVille(['gym-ville']);
    const arbre = await rendre();
    expect(typeof grille().onFreeSlotPress).toBe('function');
    act(() => { grille().onFreeSlotPress(new Date(2026, 2, 4, 12, 0, 0), 18); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ClubSlotRequest', {
      clubId: 'club-A',
      date: '2026-03-04',
      endTime: '19:30',
      facilityId: 'gym-ville',
      startTime: '18:00',
    });
    const bouton = parTexte(arbre, 'Demander un créneau');
    expect(bouton).toBeDefined();
    act(() => { bouton.props.onPress(); });
    // eslint-disable-next-line max-len
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('ClubSlotRequest', expect.objectContaining({
      clubId: 'club-A', facilityId: 'gym-ville',
    }));
  });

  it('un JOUEUR ne demande pas : aucune heure ne se touche, aucun bouton', async () => {
    // eslint-disable-next-line max-len
    mockAuth = { userData: { club: { documentId: 'club-A' }, role: { name: 'Joueur', type: 'joueur' } } };
    installationsDeLaVille(['gym-ville']);
    const arbre = await rendre();
    expect(grille().onFreeSlotPress).toBeUndefined();
    expect(textes(arbre)).not.toContain('Demander un créneau');
  });

  it('une installation qui n est pas celle d une Ville du club : rien a demander', async () => {
    mockAuth = DIRIGEANT_DU_CLUB;
    installationsDeLaVille(['autre-gymnase']);
    const arbre = await rendre();
    expect(grille().onFreeSlotPress).toBeUndefined();
    expect(textes(arbre)).not.toContain('Demander un créneau');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
