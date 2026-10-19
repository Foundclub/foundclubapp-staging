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
  closeFacility,
  listFacilityClosures,
  previewFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 🖥️ COLL-C4B-BIS (03/10/2026), point 1 — planche 25 du plan, design HY521H1 page 4,
// « P4v3-fermer-ordi » : SUR ORDINATEUR, fermer, bloquer et modifier s ouvrent dans le PANNEAU DE
// DROITE du planning (« le panneau a droite, la semaine a gauche ») ; pendant la saisie, le jour
// ferme se pose dans la grille et les seances touchees se cernent. Harnais du temoin C4B planche 2.
// ROUGES avant le lot : le planning naviguait vers l ecran plein, sans rien dessiner.

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
let mockOrdinateur = true;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
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
// SITE-VILLE-FINITIONS (T19) : « De » et « À » d un blocage sont des selecteurs d heure ; meme releve.
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => function TimePickerInputMock(/** @type {any} */ props) {
    mockInputProps.push({ ...props, onChangeText: props.onChange });
    return null;
  },
);
/** @type {any[]} */
const mockDateProps = [];
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock(/** @type {any} */ props) {
    mockDateProps.push(props);
    return null;
  },
);
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
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
  mockCalendarProps.length = 0;
  mockInputProps.length = 0;
  mockDateProps.length = 0;
  mockOrdinateur = true;
  /** @type {any} */ (previewFacilityClosure).mockResolvedValue({
    data: {
      clubs: [], clubsCount: 0, sessions: [], sessionsCount: 0,
    },
  });
  /** @type {any} */ (listFacilityClosures).mockResolvedValue({ data: [], meta: {} });
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
const avecFermeture = () => {
  const touche = { ...BLOC_DE_MON_CLUB, closure: { documentId: 'f1', kind: 'closure' } };
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
    ...reponse([touche, { ...BLOC_D_UN_AUTRE_CLUB, closure: null }, BLOC_EN_ATTENTE]),
    meta: { ...reponse([]).meta, closures: [FERMETURE_DU_JOUR] },
  });
};
const bande = () => grille().events.find((/** @type {any} */ e) => e.raw?.closureBand);

const champ = (/** @type {string} */ libelle) => mockInputProps.filter((props) => props.label === libelle).pop();
const date = (/** @type {string} */ libelle) => mockDateProps.filter((props) => props.label === libelle).pop();
const panneau = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'fermeture-panneau')[0];
const bandes = () => grille().events.filter((/** @type {any} */ e) => e.raw?.closureBand);
const seanceA = () => grille().events.find((/** @type {any} */ e) => e.documentId === 'evt-A');

describe('COLL-C4B-BIS point 1 — sur ordinateur, le panneau a droite du planning', () => {
  it('1. ouvert par l adresse (« fermeture=fermer ») : le panneau « Fermer l installation », sans ecran plein', async () => {
    gereLaVille();
    mockRoute.params = { ...mockRoute.params, fermeture: 'fermer' };
    const arbre = await rendre();
    expect(panneau(arbre)).toBeDefined();
    expect(textes(arbre)).toContain('Fermer l’installation');
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('2. pendant la saisie, le jour ferme se pose dans la grille et la seance touchee se cerne', async () => {
    gereLaVille();
    mockRoute.params = { ...mockRoute.params, fermeture: 'fermer' };
    await rendre();
    expect(bandes()).toHaveLength(0);
    await act(async () => { date('Du').onChange('04/03/2026'); });
    await attendre();
    expect(bandes()).toHaveLength(1);
    expect(bandes()[0].title).toBe('Fermé · travaux');
    expect(seanceA().raw.closure).toEqual(expect.objectContaining({ kind: 'closure' }));
  });

  it('3. une heure libre : « Bloquer pour la Ville » ouvre le panneau, deja rempli, sans naviguer', async () => {
    gereLaVille();
    const arbre = await rendre();
    await act(async () => { grille().onFreeSlotPress(new Date(2026, 2, 4), 17); });
    await attendre();
    await act(async () => { parTexte(arbre, 'Bloquer pour la Ville').props.onPress(); });
    await attendre();
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('CollectiviteFermeture', expect.anything());
    expect(panneau(arbre)).toBeDefined();
    expect(textes(arbre)).toContain('Bloquer un créneau');
    expect(date('Jour').value).toBe('04/03/2026');
    expect(champ('De').value).toBe('17:00');
    expect(champ('À').value).toBe('18:30');
    // Deja lisible, le blocage se dessine : une plage des 17:00, et la seance de 18:00 cernee.
    expect(new Date(bandes()[0].startAt).getHours()).toBe(17);
    expect(seanceA().raw.closure).toEqual(expect.objectContaining({ kind: 'block' }));
  });

  it('4. la plage touchee : « Modifier » ouvre le panneau de la fermeture, relue au serveur', async () => {
    gereLaVille();
    avecFermeture();
    /** @type {any} */ (listFacilityClosures).mockResolvedValue({
      data: [{ ...FERMETURE_DU_JOUR, facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville' } }],
      meta: { canManage: true },
    });
    const arbre = await rendre();
    await act(async () => { grille().onReadOnlyEventPress(bande()); });
    await attendre();
    await act(async () => { parTexte(arbre, 'Modifier').props.onPress(); });
    await attendre();
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('CollectiviteFermeture', expect.anything());
    expect(textes(arbre)).toContain('Modifier la fermeture');
    expect(date('Du').value).toBe('04/03/2026');
  });

  it('5. la croix ferme le panneau ; le brouillon s efface de la grille', async () => {
    gereLaVille();
    mockRoute.params = { ...mockRoute.params, fermeture: 'fermer' };
    const arbre = await rendre();
    await act(async () => { date('Du').onChange('04/03/2026'); });
    await attendre();
    expect(bandes()).toHaveLength(1);
    const croix = arbre.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud.props.testID === 'fermeture-panneau-fermer');
    await act(async () => { croix.props.onPress(); });
    await attendre();
    expect(panneau(arbre)).toBeUndefined();
    expect(bandes()).toHaveLength(0);
  });

  it('6. telephone : « Bloquer pour la Ville » ouvre toujours l ecran plein', async () => {
    mockOrdinateur = false;
    gereLaVille();
    const arbre = await rendre();
    await act(async () => { grille().onFreeSlotPress(new Date(2026, 2, 4), 17); });
    await attendre();
    await act(async () => { parTexte(arbre, 'Bloquer pour la Ville').props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteFermeture', expect.objectContaining({ mode: 'bloquer' }));
  });
});

// 🖥️ COLL-C4B-BIS (03/10/2026), point 2 — « P4v3-fermer-ordi » : la semaine HACHUREE. Le planning
// donne la plage a la grille dans TOUTES les vues (la vue Jour a plateaux l oubliait : photo T10
// T10_C25_5, aucune plage), et une semaine fermee sans seance se dessine au lieu de « Aucun
// creneau cette semaine ».
describe('COLL-C4B-BIS point 2 — la plage dans toutes les vues', () => {
  it('7. vue Jour a plateaux : la plage est donnee a la grille', async () => {
    avecFermeture();
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
      ...reponse([BLOC_DE_MON_CLUB]),
      meta: {
        ...reponse([]).meta,
        closures: [FERMETURE_DU_JOUR],
        facility: { ...reponse([]).meta.facility, plateaux: ['Côté tribune', 'Côté parking'] },
      },
    });
    mockOrdinateur = false;
    await rendre();
    expect(grille().lanes).toBeDefined();
    expect(bandes()).toHaveLength(1);
  });

  it('8. une semaine fermee sans seance : la grille et sa plage, pas « Aucun creneau »', async () => {
    /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
      ...reponse([]),
      meta: { ...reponse([]).meta, closures: [FERMETURE_DU_JOUR] },
    });
    mockOrdinateur = false;
    const arbre = await rendre();
    expect(textes(arbre)).not.toContain('Aucun créneau cette semaine');
    expect(bandes()).toHaveLength(1);
  });
});

// 🖥️ COLL-C4B-BIS (03/10/2026), point 4 — la vue Mois recoit les fermetures du mois.
describe('COLL-C4B-BIS point 4 — le mois connait les fermetures', () => {
  it('9. la vue Mois recoit les fermetures (et le brouillon du panneau) a marquer', async () => {
    avecFermeture();
    mockOrdinateur = false;
    const arbre = await rendre();
    const mois = arbre.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud.props.testID === 'vue-month');
    await act(async () => { mois.props.onPress(); });
    await attendre();
    expect(mockCalendarProps[mockCalendarProps.length - 1].closures).toEqual([FERMETURE_DU_JOUR]);
  });
});

// 🖥️ COLL-C4B-BIS (03/10/2026), point 5 — « un jour ferme dit 1 place libre » (T10) : la Liste du
// planning recoit les fermetures ; le mercredi ferme n est plus « Libre toute la journee ».
describe('COLL-C4B-BIS point 5 — un jour ferme n a aucune place', () => {
  it('10. la Liste : le jour ferme se dit ferme, sans « Attribuer »', async () => {
    gereLaVille();
    avecFermeture();
    mockOrdinateur = false;
    const arbre = await rendre();
    const liste = arbre.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud.props.testID === 'vue-list');
    await act(async () => { liste.props.onPress(); });
    await attendre();
    const ferme = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === 'fermeture-2026-03-04');
    expect(ferme).toHaveLength(1);
    const libre = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === 'libre-2026-03-04');
    expect(libre).toHaveLength(0);
  });
});

// 🖥️ COLL-C4B-BIS (03/10/2026), point 6 — LE BANDEAU CHEZ UN MEMBRE suit la periode concernee
// (P3b-actu-tel ecran 6 : « tant que la fermeture dure ou approche »), pas seulement la page :
// limite nommee par C4B (commit 461815de, « pas celle qui approche la semaine suivante »).
describe('COLL-C4B-BIS point 6 — le bandeau suit la fermeture qui dure ou approche', () => {
  it('11. un joueur, semaine sans fermeture : le bandeau dit celle de mardi prochain (meta.bandeau)', async () => {
    mockOrdinateur = false;
    /** @type {any} */ (listFacilityClosures).mockResolvedValue({
      data: [],
      meta: {
        bandeau: {
          documentId: 'f2', endDate: '2026-03-10', kind: 'closure', reason: 'vacances', startDate: '2026-03-10',
        },
        canManage: false,
      },
    });
    const lus = textes(await rendre());
    expect(listFacilityClosures).toHaveBeenCalledWith('gym-ville', { status: 'active' });
    expect(lus).toContain('L’installation est fermée le mardi 10 mars');
    expect(lus).toContain('Vacances.');
  });

  it('12. la fermeture de la page passe avant celle qui approche', async () => {
    mockOrdinateur = false;
    avecFermeture();
    /** @type {any} */ (listFacilityClosures).mockResolvedValue({
      data: [],
      meta: {
        bandeau: {
          documentId: 'f2', endDate: '2026-03-10', kind: 'closure', reason: 'vacances', startDate: '2026-03-10',
        },
      },
    });
    const lus = textes(await rendre());
    expect(lus).toContain('L’installation est fermée le mercredi 4 mars');
  });
});

// 🟨 SITE-VILLE-FINITIONS (08/10), tournée T19 (site, SITE_A21c) — « fermer A » (décision du chef
// d orchestre du 07/10) : après « Fermer », l onglet « Fermetures » de l installation s ouvre.
// VILLE-T18A l avait posé sur l écran plein (téléphone) ; dans le PANNEAU de droite (ordinateur),
// le site restait sur le planning. Bloquer et modifier ne bougent pas. ROUGE avant.
describe('SVF 4b — fermer A aussi dans le panneau de droite', () => {
  const parID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
    .findAll((/** @type {any} */ noeud) => noeud.props?.testID === testID
      && typeof noeud.props?.onPress === 'function')[0];
  const envoyerEtConfirmer = async (/** @type {any} */ arbre) => {
    await act(async () => { parID(arbre, 'fermeture-envoyer').props.onPress(); });
    await attendre();
    await act(async () => { parID(arbre, 'fermeture-confirmer').props.onPress(); });
    await attendre();
  };

  it('13. « Fermer » : le panneau se ferme, puis l onglet Fermetures de l installation', async () => {
    gereLaVille();
    /** @type {any} */ (closeFacility).mockResolvedValue({ data: { documentId: 'f9' } });
    mockRoute.params = { ...mockRoute.params, fermeture: 'fermer' };
    const arbre = await rendre();
    await act(async () => { date('Du').onChange('04/03/2026'); });
    await attendre();
    await envoyerEtConfirmer(arbre);
    expect(closeFacility).toHaveBeenCalled();
    expect(panneau(arbre)).toBeUndefined();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteInstallation', {
      collectiviteId: 'ville-1', facilityId: 'gym-ville', onglet: 'fermetures',
    });
  });

  it('14. « Bloquer » : le panneau se ferme, on reste sur le planning (inchangé)', async () => {
    gereLaVille();
    /** @type {any} */ (closeFacility).mockResolvedValue({ data: { documentId: 'b9' } });
    mockRoute.params = {
      ...mockRoute.params, endTime: '18:30', fermeture: 'bloquer', startTime: '17:00',
    };
    const arbre = await rendre();
    await act(async () => { date('Jour').onChange('04/03/2026'); });
    await attendre();
    // SAIS (08/10, T20 lot 2) : « Pour quoi » est devenu « Nom (facultatif) » (+ pastilles Motif).
    // CRFERM (13/10, planche P4v4) : le nom est replié derrière « Ajouter un nom ou un mot ».
    await act(async () => { parID(arbre, 'fermeture-deplier').props.onPress(); });
    await attendre();
    await act(async () => { champ('Nom (facultatif)').onChangeText('Forum'); });
    await attendre();
    await envoyerEtConfirmer(arbre);
    expect(closeFacility).toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('CollectiviteInstallation', expect.anything());
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
