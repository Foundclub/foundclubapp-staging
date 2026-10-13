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
import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 🐞 COLL-FIX-PLANNING (02/10/2026), defaut G4 de la tournee T9 (capture T9_C29_6) : toucher un
// bloc du planning PLEIN ECRAN de la Ville faisait un ecran rouge « Couldn't find a navigation
// object » dans EcrireAuxDirigeants (useNavigation). En production : un plantage de l app.
//
// LA CAUSE : la fenetre du bas (BottomModal -> @gorhom/bottom-sheet) s affiche par un PORTAIL,
// monte AU-DESSUS du NavigationContainer (src/app/AppProviders.native.js). Tout ce qui est rendu
// dedans perd la navigation : un crochet de navigation y JETTE. Les doublures ci-dessous rejouent
// exactement cela, pour TOUTES les fenetres de l ecran (fiche du bloc, plage fermee, panneau
// d attribution) : un composant qui demanderait la navigation dans l une d elles plante ici.
// ROUGE avant le correctif : la fiche d un bloc plante des qu elle s ouvre.
// Harnais repris du temoin COLL-C4B.planningFermetures (les memes doublures).

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
const mockDansLaFenetre = require('react').createContext(false);

jest.mock('@react-navigation/native', () => {
  const horsNavigation = (/** @type {string} */ quoi) => {
    if (jest.requireActual('react').useContext(mockDansLaFenetre)) {
      throw new Error(`Couldn't find a ${quoi} object. Is your component inside NavigationContainer?`);
    }
  };
  return {
    useFocusEffect: () => horsNavigation('navigation'),
    useIsFocused: () => { horsNavigation('navigation'); return true; },
    useNavigation: () => { horsNavigation('navigation'); return mockNavigation; },
    useRoute: () => { horsNavigation('route'); return mockRoute; },
  };
});
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
  if (!isVisible) return null;
  return jest.requireActual('react').createElement(mockDansLaFenetre.Provider, { value: true }, children);
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

const mockOuvrir = jest.fn();
jest.mock('@/services/collectivite/collectiviteCanauxService', () => ({
  // Recolte (chef, 02/10) : depuis COLL-FIX-DEMANDES, l appui RETROUVE la conversation (GET, sans creer) ;
  // une conversation existante s ouvre. Ce temoin prouve toujours la meme chose : le bouton vit
  // hors navigation et ouvre la conversation par la navigation de l ecran.
  trouverConversationAvecLeClub: (/** @type {any} */ args) => mockOuvrir(args),
  ecrireLePremierMessageAuClub: jest.fn(),
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
    addListener: jest.fn(() => jest.fn()),
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
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
const avecFermeture = () => {
  const touche = { ...BLOC_DE_MON_CLUB, closure: { documentId: 'f1', kind: 'closure' } };
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
    ...reponse([touche, { ...BLOC_D_UN_AUTRE_CLUB, closure: null }, BLOC_EN_ATTENTE]),
    meta: { ...reponse([]).meta, closures: [FERMETURE_DU_JOUR] },
  });
};
const bande = () => grille().events.find((/** @type {any} */ e) => e.raw?.closureBand);

const blocDuClubB = () => grille().events
  .find((/** @type {any} */ e) => (e.club || e.raw?.club)?.documentId === 'club-B');
// L ecran perd la main (« blur ») : on rejoue ce que la navigation previent.
const quitterLEcran = async () => {
  const ecoutes = mockNavigation.addListener.mock.calls
    .filter((/** @type {any[]} */ [evenement]) => evenement === 'blur');
  expect(ecoutes.length).toBeGreaterThan(0);
  await act(async () => { ecoutes.forEach((/** @type {any[]} */ [, quand]) => quand()); });
};

describe('COLL-FIX-PLANNING G4 — les fenetres du planning de la Ville, hors navigation', () => {
  it('1. la fiche d un bloc s ouvre sans planter, « Ecrire aux dirigeants » compris', async () => {
    gereLaVille();
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(blocDuClubB()); });
    await attendre();
    expect(textes(arbre)).toContain('Qui occupe l’installation');
    expect(textes(arbre)).toContain('US Ville B');
    expect(parTexte(arbre, 'Écrire aux dirigeants')).toBeDefined();
  });

  it('2. l appui ouvre la conversation privee par la navigation de l ecran', async () => {
    gereLaVille();
    mockOuvrir.mockResolvedValue({ data: { documentId: 'conv-B' } });
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(blocDuClubB()); });
    await attendre();
    await act(async () => { parTexte(arbre, 'Écrire aux dirigeants').props.onPress(); });
    await attendre();
    expect(mockOuvrir).toHaveBeenCalledWith({ clubId: 'club-B', collectiviteId: 'ville-1' });
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('Conversation', expect.objectContaining({
      chatId: 'conv-B', espace: 'ville', title: 'US Ville B',
    }));
  });

  it('3. quitter l ecran ferme la fiche : la fenetre ne reste pas au-dessus de la conversation', async () => {
    gereLaVille();
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(blocDuClubB()); });
    await attendre();
    expect(textes(arbre)).toContain('Qui occupe l’installation');
    await quitterLEcran();
    expect(textes(arbre)).not.toContain('Qui occupe l’installation');
  });

  it('4. la plage fermee et le panneau d attribution s ouvrent aussi sans planter', async () => {
    /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([]);
    /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
      data: [],
      meta: {
        canManage: true,
        facility: { maxSlots: 2, name: 'Gymnase de la Ville', plateaux: [] },
        season: { validFrom: '2025-09-01', validUntil: '2026-06-30' },
      },
    });
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 2, needsConfirmation: false, occupants: [], peak: 0, remaining: 2, teamsAfter: 1,
      },
    });
    /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({
      data: { documentId: 'slot-neuf' },
    });
    gereLaVille();
    avecFermeture();
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(bande()); });
    await attendre();
    expect(textes(arbre)).toContain('Fermeture · travaux');
    await act(async () => { grille().onFreeSlotPress(new Date(2026, 2, 4), 10); });
    await attendre();
    // IPH09 : la confirmation n'apparaît qu'au récapitulatif. COLL-R-A7 (COL-005) : depuis une
    // heure libre, Jour, Horaires et Période sont sautés (la case les apporte) : 3 étapes.
    expect(parTexte(arbre, 'Attribuer pour la saison')).toBeUndefined();
    expect(textes(arbre)).toContain('Étape 1/3');
    const club = parTexte(arbre, 'US Ville B');
    expect(club.props.accessibilityRole).toBe('radio');
    await act(async () => { club.props.onPress(); });
    await attendre();
    for (let etape = 1; etape <= 2; etape += 1) {
      expect(textes(arbre)).toContain(`Étape ${etape}/3`);
      expect(attributeSeasonSlot).not.toHaveBeenCalled();
      const suivant = parTexte(arbre, 'Suivant');
      expect(suivant).toBeDefined();
      expect(suivant.props.disabled).not.toBe(true);
      // eslint-disable-next-line no-await-in-loop -- chaque étape dépend de la précédente
      await act(async () => { suivant.props.onPress(); });
      // eslint-disable-next-line no-await-in-loop -- attendre le rendu de l'étape suivante
      await attendre();
    }
    expect(textes(arbre)).toContain('Étape 3/3');
    await act(async () => { parTexte(arbre, 'Attribuer pour la saison').props.onPress(); });
    await attendre();
    expect(arbre.root.findAllByType(Text).length).toBeGreaterThan(0);
    expect(attributeSeasonSlot).toHaveBeenCalledTimes(1);
    expect(attributeSeasonSlot).toHaveBeenCalledWith('gym-ville', {
      club: 'club-B', endTime: '11:30', startTime: '10:00', weekday: 3,
    });
  });
});
