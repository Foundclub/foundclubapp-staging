/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal, Text, TouchableOpacity } from 'react-native';
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

// 🚧 COLL-C4B (02/10/2026), planche 2 du design HY521H1 page 4 : « P4v3-fermer-tel » ecran 4 et
// « P4v3-fermer-ordi » — LE PLANNING MARQUE LES FERMETURES. La plage fermee ou bloquee se pose dans
// la grille (`meta.closures` du serveur) ; la seance touchee garde sa place, « a deplacer » (D16) ;
// la mairie touche la plage pour Modifier ou Rouvrir, et une heure libre pour « Bloquer pour la
// Ville ». Harnais repris du temoin C2B des 5 vues (les memes doublures).
// ROUGES avant le lot : rien de cela n existait.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const PORTRAIT = { height: 844, width: 390 };
const PAYSAGE = { height: 390, width: 844 };

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

// COLL-R-A7 (COL-005) : le tunnel plein écran rend le vrai gabarit des tunnels ; la marge du dépôt.
jest.setTimeout(30000);
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

const vues = (/** @type {any} */ arbre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'tab'
    && String(noeud.props.testID || '').startsWith('vue-'));
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ vue) => {
  const bouton = arbre.root.findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud.props.testID === `vue-${vue}`);
  await act(async () => { bouton.props.onPress(); });
  await attendre();
};

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

describe('COLL-C4B planche 2 — les fermetures dans le planning', () => {
  it('1. la plage fermee se pose dans la grille ; la seance touchee garde sa place, « a deplacer »', async () => {
    avecFermeture();
    await rendre();
    const plage = bande();
    expect(plage).toBeDefined();
    expect(plage.title).toBe('Fermé · travaux');
    expect(plage.documentId).toBeNull();
    expect(new Date(plage.startAt).getHours()).toBe(8);
    expect(new Date(plage.endAt).getHours()).toBe(22);
    const touchee = grille().events.find((/** @type {any} */ e) => e.documentId === 'evt-A');
    expect(touchee.raw.closure).toEqual({ documentId: 'f1', kind: 'closure' });
    expect(grille().events.filter((/** @type {any} */ e) => !e.raw?.closureBand)).toHaveLength(3);
  });

  // 🎨 COLL-FIX2 (03/10), planche 25 (tournée T10, T10_C25_5) : un jour FERMÉ disait encore
  // « 1 place libre au plus chargé ».
  it('1b. un jour fermé : la ligne de la place dit la fermeture, pas une place libre', async () => {
    gereLaVille();
    avecFermeture();
    const arbre = await rendre();
    const ligne = textes(arbre).find((/** @type {string} */ texte) => / à la fois · /.test(texte));
    expect(ligne).toBe('2 équipes à la fois · fermeture ce jour-là');
  });

  it('2. la mairie touche la plage : Modifier ou Rouvrir', async () => {
    gereLaVille();
    avecFermeture();
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(bande()); });
    await attendre();
    expect(textes(arbre)).toContain('Fermeture · travaux');
    expect(textes(arbre)).toContain('Toute la journée');
    await act(async () => { parTexte(arbre, 'Modifier').props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteFermeture', {
      closureId: 'f1', collectiviteId: 'ville-1', facilityId: 'gym-ville', facilityName: 'Gymnase de la Ville',
    });
    await act(async () => { grille().onReadOnlyEventPress(bande()); });
    await attendre();
    await act(async () => { parTexte(arbre, 'Rouvrir').props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteInstallation', {
      collectiviteId: 'ville-1', facilityId: 'gym-ville', onglet: 'fermetures',
    });
  });

  it('3. une heure libre : « Bloquer pour la Ville », deja rempli du jour et des heures', async () => {
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
    gereLaVille();
    const arbre = await rendre();
    await act(async () => { grille().onFreeSlotPress(new Date(2026, 2, 4), 17); });
    await attendre();
    // IPH09 : la confirmation n'apparaît qu'au récapitulatif. COLL-R-A7 (COL-005) : depuis une
    // heure libre, Jour, Horaires et Période sont sautés (la case les apporte) : 3 étapes.
    // COLL-R-A7 (COL-005, planche P4v4-attribuer « Planning 3/3 ») : au téléphone, le tunnel
    // s'ouvre en PLEIN ÉCRAN et son bouton dit « Attribuer le créneau » (la période est au
    // récapitulatif). ROUGE avant : une feuille du bas, « Attribuer pour la saison ».
    expect(arbre.root.findByType(Modal).props.presentationStyle).toBe('fullScreen');
    expect(parTexte(arbre, 'Attribuer le créneau')).toBeUndefined();
    // A7-UX-2 (22/10, Adel « P2 oui ») : le club et l'équipe sur une étape : 3 → 2 étapes.
    expect(textes(arbre)).toContain('Étape 1/2');
    const club = parTexte(arbre, 'US Ville B');
    expect(club.props.accessibilityRole).toBe('radio');
    await act(async () => { club.props.onPress(); });
    await attendre();
    for (let etape = 1; etape <= 1; etape += 1) {
      expect(textes(arbre)).toContain(`Étape ${etape}/2`);
      expect(attributeSeasonSlot).not.toHaveBeenCalled();
      const suivant = parTexte(arbre, 'Suivant');
      expect(suivant).toBeDefined();
      expect(suivant.props.disabled).not.toBe(true);
      // eslint-disable-next-line no-await-in-loop -- chaque étape dépend de la précédente
      await act(async () => { suivant.props.onPress(); });
      // eslint-disable-next-line no-await-in-loop -- attendre le rendu de l'étape suivante
      await attendre();
    }
    expect(textes(arbre)).toContain('Étape 2/2');
    expect(parTexte(arbre, 'Attribuer le créneau')).toBeDefined();
    await act(async () => { parTexte(arbre, 'Bloquer pour la Ville').props.onPress(); });
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteFermeture', {
      collectiviteId: 'ville-1',
      date: '2026-03-04',
      endTime: '18:30',
      facilityId: 'gym-ville',
      facilityName: 'Gymnase de la Ville',
      mode: 'bloquer',
      startTime: '17:00',
    });
  });

  it('4. un membre lit la plage, sans la toucher ; aucun « Bloquer » pour lui', async () => {
    avecFermeture();
    const arbre = await rendre();
    expect(bande()).toBeDefined();
    expect(grille().onReadOnlyEventPress).toBeUndefined();
    expect(parTexte(arbre, 'Bloquer pour la Ville')).toBeUndefined();
  });

  it('5. la Liste dit « a deplacer » sur la seance touchee', async () => {
    avecFermeture();
    const arbre = await rendre();
    await choisir(arbre, 'list');
    expect(textes(arbre)).toContain('à déplacer');
  });

  it('6. telephone tourne : la semaine porte la plage aussi', async () => {
    mockDimensions = PAYSAGE;
    avecFermeture();
    await rendre();
    expect(grille().mode).toBe('week');
    expect(bande().title).toBe('Fermé · travaux');
    expect(vues).toBeDefined();
  });

  it('7. le planning porte le bandeau de la fermeture de la page, pour un membre aussi (planche 4)', async () => {
    avecFermeture();
    const lus = textes(await rendre());
    expect(lus).toContain('L’installation est fermée le mercredi 4 mars');
    expect(lus).toContain('Travaux.');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
