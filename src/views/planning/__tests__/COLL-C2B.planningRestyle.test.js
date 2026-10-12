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

// 📐 COLL-C2B (02/10/2026), planche 4 du design HY521H1 : « P5-jour-tel », « P5-semaine-paysage »,
// « P5-semaine-ordi » — LE PLANNING D UNE INSTALLATION, RESTYLE. PLANNING-PORTRAIT en avait fait
// une partie (le jour tenu droit, la fiche d un bloc) : on part de la.
// Le vrai fr.js ecrit les phrases ; la grille est doublee (on lit ce qu elle recoit).
//
// Ce que ce temoin exige (ROUGE avant le lot) :
//   - la barre : « Planning · Gymnase de la Ville », « Mer. 4 mars » (le jour tenu droit) ;
//   - pour qui organise : la capacite en UNE ligne, la place en image (« 2 equipes a la fois ·
//     complet 18:30 – 19:30 ») ; une demande en attente ne compte pas dans la place ;
//   - la legende des couleurs, par club ; « Demande en attente » quand il y en a une ;
//   - la demande en attente se voit a sa place (la grille la recoit « en attente ») et la mairie
//     lit « 1 demande en attente » avec « Trancher » (qui mene a ses demandes) ;
//   - la fiche d un bloc dit l ORIGINE de la place (contrat C2A §7) ;
//   - un MEMBRE : ses seances en couleur, les autres en gris, « ton club » / « Autres clubs »,
//     et ni capacite, ni demande, ni « Trancher » ;
//   - la grille reste, voilee, pendant la lecture d une autre semaine ;
//   - aucun nom de personne, nulle part.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const COULEURS = jest.requireActual('@/theme/colors').default();
const PORTRAIT = { height: 844, width: 390 };
const PAYSAGE = { height: 390, width: 844 };
// COLL-R-APP-PLANNING (12/10, COL-014) — « en attente » ne dit plus que ce que la Ville peut
// encore trancher (fin pas passee) : la demande de ce fichier, du mercredi 4 mars 2026, est passee.
// Seul `Date` est fige, au dimanche 1er mars 2026 (avant elle, et pas « aujourd hui » pour la
// barre) ; les minuteries restent vraies (motif FIGER_LA_DATE, TEMOINS-DATES).
const FIGER_LA_DATE = {
  doNotFake: [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
    'clearInterval', 'setTimeout', 'clearTimeout',
  ],
  now: new Date('2026-03-01T12:00:00.000Z'),
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
const DIRIGEANT = { userData: { role: { name: 'Dirigeant', type: 'president' } } };
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
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle))
  .pop();
const parLibelle = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle);
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

describe('COLL-C2B planche 4 — la mairie lit le planning de son installation', () => {
  beforeEach(() => { gereLaVille(); });

  it('la barre : « Planning · Gymnase de la Ville », et le jour tenu droit', async () => {
    const lus = textes(await rendre());
    expect(lus).toContain('Planning · Gymnase de la Ville');
    expect(lus).toContain('Mer. 4 mars');
    expect(grille().mode).toBe('day');
  });

  it('la capacite en une ligne, en image ; la demande en attente n y compte pas', async () => {
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus).toContain('2 équipes à la fois · complet 18:30 – 19:30');
    const images = arbre.root.findAll((/** @type {any} */ noeud) => (
      noeud.props?.accessibilityLabel === 'Places prises : 2 sur 2'
      && noeud.props?.accessibilityRole === 'image'
    ));
    expect(images.length).toBeGreaterThan(0);
    // Plus de pastilles « Au plus charge : 2 sur 2 » ni « 3 evenements ».
    expect(lus.join(' | ')).not.toMatch(/Au plus chargé : \d sur \d|événements/);
  });

  it('la legende par club, et « Demande en attente »', async () => {
    const lus = textes(await rendre());
    expect(lus).toContain('AS Ville A');
    expect(lus).toContain('US Ville B');
    expect(lus).toContain('Demande en attente');
  });

  it('la demande en attente est a sa place, et « Trancher » mene aux demandes', async () => {
    const arbre = await rendre();
    const attente = grille().events
      .find((/** @type {any} */ evenement) => evenement.team?.name === 'U13');
    expect(attente.participationStatus).toBe('pending');
    expect(textes(arbre)).toContain('1 demande en attente sur ce jour.');
    await act(async () => { parTexte(arbre, 'Trancher').props.onPress(); });
    expect(mockNavigation.navigate)
      .toHaveBeenCalledWith('CollectiviteRequests', { collectiviteId: 'ville-1' });
  });

  it('la fiche d un bloc dit l origine de la place (contrat C2A §7)', async () => {
    const arbre = await rendre();
    const { events, onReadOnlyEventPress } = grille();
    await act(async () => {
      onReadOnlyEventPress(events
        .find((/** @type {any} */ evenement) => evenement.club?.name === 'US Ville B'));
    });
    await attendre();
    let lus = textes(arbre);
    expect(lus).toContain('Origine de la place');
    expect(lus).toContain('Créneau attribué : chaque mercredi, du 1 sept. au 30 juin');
    expect(lus).toContain('E-mail : contact@usvilleb.fr');

    await act(async () => {
      onReadOnlyEventPress(events
        .find((/** @type {any} */ evenement) => evenement.team?.name === 'U13'));
    });
    lus = textes(arbre);
    expect(lus).toContain('Demande en attente de décision');
  });

  it('aucun nom de personne, nulle part', async () => {
    const arbre = await rendre();
    const vus = [...textes(arbre)];
    const { events, onReadOnlyEventPress } = grille();
    await act(async () => { onReadOnlyEventPress(events[1]); });
    await attendre();
    vus.push(...textes(arbre));
    const lu = vus.join(' | ');
    SECRETS.forEach((secret) => expect(lu).not.toContain(secret));
  });
});

describe('COLL-C2B planche 4 — un dirigeant lit la place (vue gestionnaire, sans la fiche)', () => {
  it('la ligne de capacite, sans « Trancher »', async () => {
    mockAuth = DIRIGEANT;
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus).toContain('2 équipes à la fois · complet 18:30 – 19:30');
    expect(parTexte(arbre, 'Trancher')).toBeUndefined();
    expect(grille().onReadOnlyEventPress).toBeUndefined();
  });
});

describe('COLL-C2B planche 4 — un MEMBRE : son club en couleur, les autres en gris', () => {
  it('ni capacite, ni demande, ni « Trancher » ; « ton club » / « Autres clubs »', async () => {
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus.join(' | ')).not.toMatch(/équipes à la fois|demande en attente|place libre|complet/i);
    expect(parTexte(arbre, 'Trancher')).toBeUndefined();
    expect(lus).toContain('AS Ville A, ton club');
    expect(lus).toContain('Autres clubs');
    const { events } = grille();
    const autre = events
      .find((/** @type {any} */ evenement) => evenement.club?.name === 'US Ville B');
    const mien = events.find((/** @type {any} */ evenement) => evenement.documentId === 'evt-A');
    expect(autre.displayColor).toBe(COULEURS.neutral500);
    expect(mien.displayColor).not.toBe(COULEURS.neutral500);
  });
});

// 🐞 FINITIONS15 point 3 (tournée T14, C15a) — LE CRÉNEAU U15 DU MERCREDI : 17:30 – 19:00 dans
// l'onglet Créneaux et sur l'affiche, 18:00 – 19:00 dans la vue Liste du planning.
// CE QUI EST VRAI : le CRÉNEAU est 17:30 – 19:00. Sa ligne `season-slot` est la source unique des
// heures d'un créneau : l'onglet Créneaux (toSeasonSlotView), l'affiche (chiffres.ts) et le bloc
// d'un créneau SEUL au planning (toWindow ⇒ toDbTime, planning-slot.ts:993) la lisent. Un bloc de
// 18:00 ne peut donc pas être le créneau : c'est une SÉANCE du club posée dans le créneau, qui en
// prend la place (contrat C2A, planning-slot.ts:940-962) avec SES heures. Le défaut : sa ligne
// d'origine disait « Créneau attribué », sous des heures qui ne sont pas celles du créneau.
// La séance dit maintenant qu'elle en est une. ROUGE avant le lot.
const SEANCE_DANS_LE_CRENEAU = bloc({
  club: { documentId: 'club-B', name: 'US Ville B' },
  documentId: null,
  endAt: '2026-03-04T18:00:00.000Z',
  endTime: '19:00:00.000',
  isOwnClub: false,
  kind: 'event',
  origin: 'slot',
  slot: {
    documentId: 'slot-U15',
    source: 'attribution',
    validFrom: '2025-10-07',
    validUntil: '2026-06-30',
    weekday: 3,
  },
  startAt: '2026-03-04T17:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'U15' },
  title: 'US Ville B · U15',
});

describe('FINITIONS15 point 3 — une séance posée dans un créneau le dit', () => {
  beforeEach(() => { gereLaVille(); });

  it('la séance nomme son créneau ; le créneau seul garde sa ligne', async () => {
    const SEANCE = 'Séance du club dans son créneau : chaque mercredi, du 7 oct. au 30 juin';
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue(
      reponse([SEANCE_DANS_LE_CRENEAU, BLOC_D_UN_AUTRE_CLUB]),
    );
    const arbre = await rendre();
    const { events, onReadOnlyEventPress } = grille();

    await act(async () => {
      onReadOnlyEventPress(events
        .find((/** @type {any} */ evenement) => evenement.team?.name === 'U15'));
    });
    await attendre();
    let lus = textes(arbre);
    expect(lus).toContain(SEANCE);
    expect(lus).not.toContain('Créneau attribué : chaque mercredi, du 7 oct. au 30 juin');

    await act(async () => {
      onReadOnlyEventPress(events
        .find((/** @type {any} */ evenement) => evenement.team?.name === 'Seniors B'));
    });
    await attendre();
    lus = textes(arbre);
    expect(lus).toContain('Créneau attribué : chaque mercredi, du 1 sept. au 30 juin');
  });
});

describe('COLL-C2B planche 4 — la semaine, telephone tourne', () => {
  it('la barre dit la semaine ; la grille reste, voilee, pendant la lecture suivante', async () => {
    gereLaVille();
    mockDimensions = PAYSAGE;
    const arbre = await rendre();
    expect(textes(arbre)).toContain('2 – 8 mars 2026');
    expect(textes(arbre)).toContain('2 équipes à la fois · complet mer. 18:30 – 19:30');

    /** @type {any} */ (getFacilityPlanning).mockImplementation(() => new Promise(() => {}));
    await act(async () => { parLibelle(arbre, 'Semaine suivante').props.onPress(); });
    await attendre();
    const voiles = arbre.root
      .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'planning-voile');
    expect(voiles.length).toBeGreaterThan(0);
    expect(grille().events.length).toBe(3);
  });
});
