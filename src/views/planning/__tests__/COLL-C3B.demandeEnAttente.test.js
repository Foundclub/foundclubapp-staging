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

import { retenirVue, VUES } from '@/utils/planning/installationPlanningViews';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 🏛️ COLL-C3B (02/10/2026) — point 4 du lot (design HY521H1, P8v2-demande, etat 4 : « Comme dans
// ton planning ») : la demande EN ATTENTE d un club se voit « en attente » a sa place dans le
// planning de l installation, meme pour un joueur du club (avant : seuls ceux qui organisent).
// La grille la dessine alors en pointilles orange (PlanningWeekTimelineView.COLL-C3B.test.js).
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
const COULEURS = jest.requireActual('@/theme/colors').default();

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

describe('COLL-C3B — point 4 : la demande en attente du club, a sa place', () => {
  // Un joueur du club lit la demande de SON club « en attente » (« Comme dans ton planning ») ;
  // avant, seuls ceux qui organisent la voyaient en attente.
  // eslint-disable-next-line max-len
  it('point 4 : la demande en attente DU CLUB se voit « en attente » a sa place, meme d un joueur', async () => {
    // eslint-disable-next-line max-len
    mockAuth = { userData: { club: { documentId: 'club-A' }, role: { name: 'Joueur', type: 'joueur' } } };
    installationsDeLaVille(['gym-ville']);
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue(reponse([
      BLOC_DE_MON_CLUB,
      { ...BLOC_EN_ATTENTE, documentId: 'evt-attente', isOwnClub: true },
    ]));
    await rendre();
    const attente = grille().events.find((/** @type {any} */ e) => e.raw?.origin === 'request');
    expect(attente.participationStatus).toBe('pending');
  });
});

// 🏛️ COLL-R-APP-PLANNING (12/10), COL-014 — « Trancher » ouvrait « En attente (0) ».
// Lu en prod par le chef : a Demouville, UNE demande a la Ville restee en attente, samedi 10/10
// 12:00 – 13:00 UTC, FIN PASSEE. La liste « En attente » l ecarte (regle T05 du serveur) ; le
// bandeau, la legende et la liste du jour comptaient toute place `pending` — et une seance qui
// attend SON DIRIGEANT (D32, aucune demande a la Ville) passait aussi pour une « demande ».
// UNE regle (installationPlanningViews : origine « demande », en attente, fin pas passee) pour le
// bandeau, la legende et la liste du jour. Une demande non tranchee dont la date est passee reste
// DESSINEE (rien n est detruit, T05), en gris, « Non tranchee, date passee », et n est pas comptee.
// Le calcul de place ne change pas : une place en attente, quelle qu elle soit, n en prend pas.
// ROUGE avant le lot.
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.testID === id);
const gereLaVille = () => {
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({
    data: [{ documentId: 'ville-1', name: 'Ville de Montrivage' }],
  });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({
    data: [{ documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville' }],
  });
};
// Le matin du mercredi 4 mars, 08:00 – 09:00 (Paris) : passe a 12:00 UTC.
const DEMANDE_PASSEE = {
  ...BLOC_EN_ATTENTE,
  club: { documentId: 'club-B', name: 'US Ville B' },
  endAt: '2026-03-04T08:00:00.000Z',
  endTime: '09:00:00.000',
  startAt: '2026-03-04T07:00:00.000Z',
  startTime: '08:00:00.000',
  team: { name: 'U11' },
  title: 'US Ville B · U11',
};
// D32 : posee dans le creneau du club deja complet, elle attend son DIRIGEANT, pas la Ville.
const SEANCE_QUI_ATTEND_SON_DIRIGEANT = {
  ...BLOC_EN_ATTENTE,
  club: { documentId: 'club-B', name: 'US Ville B' },
  origin: 'club',
  team: { name: 'U15' },
  title: 'US Ville B · U15',
};
// Une ABSENCE ne se lit qu une fois la mairie reconnue (ses deux lectures revenues) : sinon le
// bandeau manque parce que l app ne sait pas encore, et le temoin serait vert pour rien. Attente
// bornee en TEMPS (2 s), pas en tours (instable sous charge).
const rendreEnMairie = async () => {
  const arbre = await rendre();
  let essai = 0;
  while (typeof grille()?.onReadOnlyEventPress !== 'function' && essai < 100) {
    essai += 1;
    // eslint-disable-next-line no-await-in-loop
    await attendre();
  }
  expect(typeof grille().onReadOnlyEventPress).toBe('function');
  return arbre;
};
const blocDe = (/** @type {string} */ equipe) => [...grille().events]
  .reverse()
  .find((/** @type {any} */ evenement) => evenement.team?.name === equipe);

describe('COL-014 — la Ville ne compte que ce qu elle a encore a trancher', () => {
  beforeEach(() => {
    gereLaVille();
    // La vue choisie est RETENUE sur l appareil : le temoin « Liste » la laisserait au suivant.
    retenirVue(VUES.jour);
  });

  it('une demande a la date passee : dessinee en gris, ni comptee ni « en attente »', async () => {
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue(
      reponse([BLOC_DE_MON_CLUB, DEMANDE_PASSEE]),
    );
    const arbre = await rendreEnMairie();
    const lus = textes(arbre);
    expect(lus.join(' | ')).not.toMatch(/demandes? en attente sur ce jour|Trancher/);
    expect(lus).not.toContain('Demande en attente');
    const passee = blocDe('U11');
    expect(passee).toBeDefined();
    expect(passee.participationStatus).not.toBe('pending');
    expect(passee.displayColor).toBe(COULEURS.neutral500);
    // La fiche du bloc le dit.
    await act(async () => { grille().onReadOnlyEventPress(passee); });
    expect(textes(arbre)).toContain('Non tranchée, date passée');
  });

  it('bandeau, legende et liste du jour : le meme nombre que la liste « En attente »', async () => {
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue(
      reponse([BLOC_DE_MON_CLUB, BLOC_EN_ATTENTE, DEMANDE_PASSEE]),
    );
    const arbre = await rendreEnMairie();
    let lus = textes(arbre);
    expect(lus).toContain('1 demande en attente sur ce jour.');
    expect(lus).toContain('Demande en attente');
    expect(blocDe('U13').participationStatus).toBe('pending');
    // La vue Liste : « En attente » pour la demande a trancher, « date passee » pour l autre.
    await act(async () => { parTestId(arbre, 'vue-list').props.onPress(); });
    await attendre();
    lus = textes(arbre);
    expect(lus.filter((texte) => texte.startsWith('En attente :'))).toEqual([
      'En attente : AS Ville A · U13',
    ]);
    expect(lus).toContain('Non tranchée, date passée');
  });

  it('la seance qui attend son dirigeant n est pas une « demande en attente »', async () => {
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue(
      reponse([BLOC_DE_MON_CLUB, SEANCE_QUI_ATTEND_SON_DIRIGEANT]),
    );
    const arbre = await rendreEnMairie();
    const lus = textes(arbre);
    expect(lus.join(' | ')).not.toMatch(/demandes? en attente sur ce jour|Trancher/);
    expect(lus).not.toContain('Demande en attente');
    expect(blocDe('U15').participationStatus).not.toBe('pending');
    // Le calcul de place ne change pas : elle ne prend toujours pas de place.
    expect(lus).toContain('2 équipes à la fois · 1 place libre au plus chargé');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
