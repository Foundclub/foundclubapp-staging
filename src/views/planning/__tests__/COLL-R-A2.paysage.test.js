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

// 📱 COLL-R-APP-PLANNING (12/10/2026), COL-009 — TELEPHONE COUCHE, le planning du Gymnase Cosec
// ne montrait qu UNE heure de grille : la barre, le bandeau de fermeture, deux lignes sur les
// places, « Demander un creneau » et la legende prenaient ~60 % de la hauteur (capture S12).
// Planche validee P5-semaine-paysage (base du design d Adel, 01/10) et remede « G43 B » du chef :
// UNE barre compacte (fleches, nom, dates, ligne de capacite, croix), le reste replie ; tout
// revient des qu on redresse le telephone. La fermeture reste lisible DANS la grille (hachures).
// Et le compte DOUBLE (il gere la Ville et dirige un club) voyait « Demander un creneau », le
// bouton d un club : il ne s affiche plus qu une fois SUR que le compte ne gere pas l installation.
// Incident 13 de la fiche : deux lignes redisaient « 1 place libre au plus charge ».
// Harnais repris de COLL-C3B.demandeEnAttente.test.js (les memes doublures).
// ROUGE avant le lot.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const PORTRAIT = { height: 844, width: 390 };

// COLL-R-APP-PLANNING (12/10) — la regle « a trancher » lit l HEURE : seul `Date` est fige (au
// mercredi 4 mars 2026, 12:00 UTC, avant les blocs de ce fichier), les minuteries restent vraies
// (act et react-query en dependent) — le motif FIGER_LA_DATE de TEMOINS-DATES.
const FIGER_LA_DATE = {
  doNotFake: [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
    'clearInterval', 'setTimeout', 'clearTimeout',
  ],
  now: new Date('2026-03-04T12:00:00.000Z'),
};
beforeEach(() => { jest.useFakeTimers(FIGER_LA_DATE); });
afterEach(() => { jest.useRealTimers(); });

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
const grille = () => mockTimelineProps[mockTimelineProps.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
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

const installationsDeLaVille = (/** @type {string[]} */ ids) => {
  /** @type {any} */ (getClubCollectiviteFacilities).mockResolvedValue({
    // eslint-disable-next-line max-len
    data: ids.map((id) => ({ collectivite: { name: 'Ville de Montrivage' }, documentId: id, name: id })),
  });
};

const PAYSAGE = { height: 390, width: 844 };
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const lire = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatir(texte.props.children).trim());
const textes = (/** @type {any} */ arbre) => lire(arbre.root);
const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === id);
const gereLaVille = () => {
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({
    data: [{ documentId: 'ville-1', name: 'Ville de Montrivage' }],
  });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({
    data: [{ documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville' }],
  });
};
// Une fermeture « Vacances » dans la semaine affichee : le bandeau la dit en portrait.
const FERMETURE = {
  documentId: 'f1',
  endDate: '2026-03-08',
  endTime: null,
  kind: 'closure',
  label: 'Vacances',
  reason: 'vacances',
  startDate: '2026-03-07',
  startTime: null,
};
const avecFermeture = () => {
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
    ...reponse([BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB, BLOC_EN_ATTENTE]),
    meta: { ...reponse([]).meta, closures: [FERMETURE] },
  });
};
// La barre du haut : la rangee qui porte la fleche de droite (« Semaine suivante » couche,
// « Jour suivant » droit).
const laBarre = (/** @type {any} */ arbre, /** @type {string} */ nomDeLaFleche) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === nomDeLaFleche)
  .parent;
const capacite = (/** @type {string[]} */ lus) => lus
  .filter((texte) => texte.startsWith('2 équipes à la fois · '));
// Attente bornee en TEMPS (2 s) que la mairie soit reconnue (la fiche des blocs s ouvre alors).
const attendreLaMairie = async () => {
  let essai = 0;
  while (typeof grille()?.onReadOnlyEventPress !== 'function' && essai < 100) {
    essai += 1;
    // eslint-disable-next-line no-await-in-loop
    await attendre();
  }
  expect(typeof grille().onReadOnlyEventPress).toBe('function');
};

describe('COL-009 — telephone couche : une seule barre, puis la grille', () => {
  beforeEach(() => {
    gereLaVille();
    avecFermeture();
  });

  it('couche : ni bandeau, ni legende, ni demandes ; la capacite DANS la barre', async () => {
    mockDimensions = PAYSAGE;
    const arbre = await rendre();
    await attendreLaMairie();
    expect(grille().mode).toBe('week');
    const lus = textes(arbre);
    expect(parTestId(arbre, 'planning-bandeau-fermeture')).toHaveLength(0);
    expect(lus).not.toContain('Demande en attente');
    expect(lus).not.toContain('US Ville B');
    expect(lus.join(' | ')).not.toMatch(/demandes? en attente cette semaine|Trancher/);
    const dansLaBarre = lire(laBarre(arbre, 'Semaine suivante'));
    expect(dansLaBarre).toContain('Planning · Gymnase de la Ville');
    expect(capacite(dansLaBarre)).toHaveLength(1);
    // Une seule fois : la ligne de capacite n est plus aussi au-dessus de la grille.
    expect(capacite(lus)).toHaveLength(1);
  });

  it('redresse : le bandeau, la legende et la ligne des demandes reviennent', async () => {
    const arbre = await rendre();
    await attendreLaMairie();
    const lus = textes(arbre);
    expect(parTestId(arbre, 'planning-bandeau-fermeture').length).toBeGreaterThan(0);
    expect(lus).toContain('Demande en attente');
    expect(lus).toContain('Trancher');
    // Tenu droit, la ligne de capacite reste sous la barre (planche P5-jour-tel).
    expect(capacite(lus)).toHaveLength(1);
    expect(capacite(lire(laBarre(arbre, 'Jour suivant')))).toHaveLength(0);
  });
});

describe('COL-009 — le compte double ne voit jamais « Demander un creneau » d un club', () => {
  const DIRIGEANT_DU_CLUB = {
    userData: {
      club: { documentId: 'club-A', name: 'AS Ville A' },
      role: { name: 'Dirigeant', type: 'president' },
    },
  };
  beforeEach(() => {
    mockAuth = DIRIGEANT_DU_CLUB;
    installationsDeLaVille(['gym-ville']);
  });

  it('tant que l app ne sait pas s il gere : ni bouton, ni phrase du dirigeant', async () => {
    /** @type {any} */ (getMyCollectivites).mockReturnValue(new Promise(() => {}));
    const lus = textes(await rendre());
    expect(lus).not.toContain('Demander un créneau');
    expect(lus.join(' | ')).not.toMatch(/Places encore libres|dépassements/);
  });

  it('si la lecture echoue : pas de bouton non plus (ni « oui » ni « non »)', async () => {
    /** @type {any} */ (getMyCollectivites).mockRejectedValue(new Error('reseau'));
    const lus = textes(await rendre());
    expect(lus).not.toContain('Demander un créneau');
  });

  it('un compte de club PUR (aucune Ville) : le bouton, une fois la lecture revenue', async () => {
    const lus = textes(await rendre());
    expect(lus).toContain('Demander un créneau');
  });

  it('le compte double, reconnu gestionnaire : jamais le bouton du club', async () => {
    gereLaVille();
    const arbre = await rendre();
    await attendreLaMairie();
    expect(textes(arbre)).not.toContain('Demander un créneau');
  });
});

describe('Incident 13 — une seule ligne dit les places libres', () => {
  it('un dirigeant lit « 1 place libre au plus chargé » une fois, pas deux', async () => {
    mockAuth = {
      userData: {
        club: { documentId: 'club-A', name: 'AS Ville A' },
        role: { name: 'Dirigeant', type: 'president' },
      },
    };
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue(reponse([BLOC_DE_MON_CLUB]));
    installationsDeLaVille(['gym-ville']);
    const lus = textes(await rendre());
    expect(lus).toContain('2 équipes à la fois · 1 place libre au plus chargé');
    expect(lus.join(' | ')).not.toMatch(/Places encore libres au moment le plus chargé/);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
