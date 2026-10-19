import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getMyPlanning } from '@/services/event/eventService';
import { getFacilityPlanning } from '@/services/facility/facilityService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 🗓️ R17-VUE (19/10/2026, REC17-010) — LE PLEIN ECRAN S OUVRE LA OU IL Y A QUELQUE CHOSE.
//
// Plannings perso, club, omnisport : la vue de base suit le telephone (tenu droit : le jour ;
// tourne : la semaine). Jour vide ⇒ la semaine ; semaine vide mais un evenement plus tard ⇒ le
// MOIS de ce prochain evenement (UNE lecture bornee) ; rien ⇒ la vue de base et son etat vide.
// Installation de la Ville : la regle passe AVANT la vue retenue sur l appareil ; la vue retenue
// ne sert que si la regle garde la vue de base. La regle ne joue qu a une arrivee sur AUJOURD HUI
// (un plein ecran ouvert sur une autre date garde cette date et sa vue).

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
// Mercredi 21 octobre 2026, midi (semaine du 19 au 25).
const AUJOURDHUI_ISO = '2026-10-21T10:00:00.000Z';

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockDimensions = PORTRAIT;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {any[]} */
const mockCalendarProps = [];
/** @type {any} */
let mockVueRetenue;
const mockSetItem = jest.fn();

jest.setTimeout(30000);
jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 21, 12, 0, 0),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { role: { name: 'Joueur', type: 'joueur' } } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({
    addListener: () => () => {}, goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(),
  }),
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
jest.mock('@/components/organisms/planningCalendarView', () => function CalendarMock(
  /** @type {any} */ props,
) {
  mockCalendarProps.push(props);
  return null;
});
jest.mock('@/platform/storage', () => ({
  ...jest.requireActual('@/platform/storage'),
  getItem: () => mockVueRetenue,
  setItem: (/** @type {any[]} */ ...args) => mockSetItem(...args),
}));
jest.mock('@/components/molecules/input/Input', () => function InputMock() { return null; });
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
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
  getCollectiviteClubs: jest.fn(async () => ({ data: [] })),
  getCollectiviteInstallations: jest.fn(async () => ({ data: [] })),
  getMyCollectivites: jest.fn(async () => ({ data: [] })),
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

/**
 * Un creneau, a midi heure de Paris.
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {any} Le bloc.
 */
const bloc = (jour) => ({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: `evt-${jour}`,
  endAt: `${jour}T11:00:00.000Z`,
  endTime: '13:00:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville' },
  hasExplicitTime: true,
  isOwnClub: true,
  kind: 'event',
  origin: 'club',
  pending: false,
  startAt: `${jour}T10:00:00.000Z`,
  startTime: '12:00:00.000',
  team: { name: 'U13' },
  title: 'AS Ville A · U13',
});
/**
 * La reponse du serveur pour une periode, selon le jour de debut demande.
 * @param {Record<string, any[]>} parPlage - Les blocs, par jour de debut.
 * @returns {(plage: any) => Promise<any>} La lecture doublee.
 */
const serveur = (parPlage) => async (/** @type {any} */ plage) => ({
  data: parPlage[plage.from] || [],
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

/** @type {Array<{ arbre: any, client: QueryClient }>} */
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
const grille = () => mockTimelineProps[mockTimelineProps.length - 1];
const calendrier = () => mockCalendarProps[mockCalendarProps.length - 1];
const lues = (/** @type {jest.Mock} */ lecture, /** @type {number} */ rang = 0) => lecture
  .mock.calls.map((/** @type {any[]} */ appel) => `${appel[rang].from}>${appel[rang].to}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockCalendarProps.length = 0;
  mockVueRetenue = undefined;
  mockDimensions = PORTRAIT;
  mockRoute = { params: { date: AUJOURDHUI_ISO, sourceType: 'personal' } };
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('R17-VUE — plein ecran perso (club et omnisport : meme chemin)', () => {
  test('1 CARACTERISATION — tenu droit, aujourd hui plein : le JOUR, une lecture', async () => {
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({
      '2026-10-19': [bloc('2026-10-21')],
    }));
    await rendre();
    expect(grille().mode).toBe('day');
    expect(lues(/** @type {any} */ (getMyPlanning))).toEqual(['2026-10-19>2026-10-25']);
  });

  test('2 ROUGE-AVANT — tenu droit, aujourd hui vide, samedi plein : la SEMAINE', async () => {
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({
      '2026-10-19': [bloc('2026-10-24')],
    }));
    const arbre = await rendre();
    expect(grille().mode).toBe('week');
    expect(textes(arbre)).toContain('19 oct. - 25 oct. 2026');
  });

  test('3 ROUGE-AVANT — semaine vide, un match le 3 novembre : le MOIS de novembre', async () => {
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({
      '2026-10-26': [bloc('2026-11-03')],
      '2026-11-01': [bloc('2026-11-03')],
    }));
    const arbre = await rendre();
    expect(lues(/** @type {any} */ (getMyPlanning))).toEqual([
      '2026-10-19>2026-10-25', '2026-10-26>2026-11-25', '2026-11-01>2026-11-30',
    ]);
    expect([calendrier().currentDate.getMonth(), calendrier().currentDate.getDate()])
      .toEqual([10, 3]);
    expect(calendrier().events).toHaveLength(1);
    expect(textes(arbre)).toContain('Novembre 2026');
  });

  test('4 — rien plus tard : le jour, avec « Aucun créneau cette semaine »', async () => {
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({}));
    const arbre = await rendre();
    expect(textes(arbre)).toContain('Aucun créneau cette semaine');
    expect(textes(arbre)).toContain('Semaine suivante');
    expect(lues(/** @type {any} */ (getMyPlanning))).toHaveLength(2);
  });

  test('5 — ouvert sur une AUTRE date : la regle ne joue pas', async () => {
    mockRoute = { params: { date: '2026-10-23T10:00:00.000Z', sourceType: 'personal' } };
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({
      '2026-10-19': [bloc('2026-10-21')],
    }));
    await rendre();
    expect(grille().mode).toBe('day');
    expect(grille().currentDate.getDate()).toBe(23);
    expect(lues(/** @type {any} */ (getMyPlanning))).toEqual(['2026-10-19>2026-10-25']);
  });

  test('6 — le mois decide, « Ouvrir la journée » : le jour choisi est GARDE', async () => {
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({
      '2026-10-26': [bloc('2026-11-03')],
      '2026-11-01': [bloc('2026-11-03')],
      '2026-11-02': [bloc('2026-11-03')],
    }));
    const arbre = await rendre();
    const ouvrir = arbre.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud.findAllByType(Text)
        .some((/** @type {any} */ t) => aplatir(t.props.children) === 'Ouvrir la journée'));
    await act(async () => { ouvrir.props.onPress(); });
    await attendre();
    expect(grille().mode).toBe('day');
    expect(grille().currentDate.getDate()).toBe(3);
  });
});

describe('R17-VUE — la phrase « Téléphone à l’horizontale » (tri du chef, point 1 A)', () => {
  const PHRASE = 'Téléphone à l’horizontale : toute la semaine.';

  test('11 ROUGE-AVANT — tenu droit, la semaine deja affichee : la phrase disparait', async () => {
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({
      '2026-10-19': [bloc('2026-10-24')],
    }));
    const arbre = await rendre();
    expect(grille().mode).toBe('week');
    expect(textes(arbre)).not.toContain(PHRASE);
  });

  test('12 CARACTERISATION — tenu droit, la vue jour : la phrase reste', async () => {
    /** @type {any} */ (getMyPlanning).mockImplementation(serveur({
      '2026-10-19': [bloc('2026-10-21')],
    }));
    const arbre = await rendre();
    expect(grille().mode).toBe('day');
    expect(textes(arbre)).toContain(PHRASE);
  });
});

describe('R17-VUE — plein ecran d une installation de la Ville', () => {
  beforeEach(() => {
    mockRoute = {
      params: {
        contextDetailLabel: 'Gymnase de la Ville',
        date: AUJOURDHUI_ISO,
        facilityId: 'gym-ville',
        sourceType: 'facility',
      },
    };
  });

  test('7 — aujourd hui plein : la regle garde la base, la vue RETENUE s applique', async () => {
    mockVueRetenue = 'month';
    /** @type {any} */ (getFacilityPlanning).mockImplementation(
      (/** @type {string} */ _id, /** @type {any} */ plage) => serveur({
        '2026-10-01': [bloc('2026-10-21')],
        '2026-10-19': [bloc('2026-10-21')],
      })(plage),
    );
    await rendre();
    expect(calendrier().currentDate.getDate()).toBe(21);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  test('8 ROUGE-AVANT — aujourd hui vide, vendredi plein : SEMAINE, pas la retenue', async () => {
    mockVueRetenue = 'month';
    /** @type {any} */ (getFacilityPlanning).mockImplementation(
      (/** @type {string} */ _id, /** @type {any} */ plage) => serveur({
        '2026-10-19': [bloc('2026-10-23')],
      })(plage),
    );
    await rendre();
    expect(grille().mode).toBe('week');
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  test('9 ROUGE-AVANT — semaine vide : UNE lecture de 31 jours, puis le mois suivant', async () => {
    /** @type {any} */ (getFacilityPlanning).mockImplementation(
      (/** @type {string} */ _id, /** @type {any} */ plage) => serveur({
        '2026-10-26': [bloc('2026-11-03')],
        '2026-11-01': [bloc('2026-11-03')],
      })(plage),
    );
    await rendre();
    expect(lues(/** @type {any} */ (getFacilityPlanning), 1)).toContain('2026-10-26>2026-11-25');
    expect([calendrier().currentDate.getMonth(), calendrier().currentDate.getDate()])
      .toEqual([10, 3]);
  });

  test('10 — telephone tourne a l arrivee : la semaine (D6 A), pleine : rien de plus', async () => {
    mockDimensions = PAYSAGE;
    /** @type {any} */ (getFacilityPlanning).mockImplementation(
      (/** @type {string} */ _id, /** @type {any} */ plage) => serveur({
        '2026-10-19': [bloc('2026-10-23')],
      })(plage),
    );
    await rendre();
    expect(grille().mode).toBe('week');
    expect(lues(/** @type {any} */ (getFacilityPlanning), 1)).toEqual(['2026-10-19>2026-10-25']);
  });
});
