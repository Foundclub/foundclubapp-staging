/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 📐 VILLE-T18A (07/10/2026) — LA FICHE D UNE INSTALLATION DE LA VILLE, défauts de la tournée T18
// (captures D:/App/fc/.recette/tournee18/captures). Harnais repris de
// InstallationCreneaux.COLL-C2B.test.js (le vrai fr.js, le service HTTP doublé, les vraies
// requêtes react-query).
//
// POINT 1 — T18 G32/G33x : « un créneau dont on a raccourci la période (“18:00 – 19:30 · du
// 1 sept. au 15 juin”) ne s ouvre plus depuis l onglet Créneaux ». ⚠️ TÉMOIN DE NON-REPRODUCTION :
// il était VERT avant le lot. Le chemin JavaScript (la carte → « gérer » → la fiche du créneau)
// ouvre bien un créneau à période raccourcie, avec les données EXACTES rendues par la recette
// (PUT 200 de 12:58:52, relay_corps.log de la T18). La cause est donc hors de ce chemin (couche
// native : toucher ou feuille du bas), et reste à établir sur l émulateur — voir le compte rendu.
// Ce témoin garde le chemin JS ouvert.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  getSeasonSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
  restoreSeasonSlot,
  withdrawSeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import InstallationCreneaux from '../InstallationCreneaux';

// Un écran entier, monté sous la charge des portes : le délai par défaut (5 s) ne suffit pas.
jest.setTimeout(30000);

// Les phrases passent par le vrai i18next (interpolation comprise).
const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockDateProps = [];
/** @type {any[]} */
const mockOnglets = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls' } }),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 44,
  }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));

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
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
// COLL-C4B (02/10) : l ecran a gagne l onglet « Fermetures » ; son service est double ici aussi
// (sans doublure, le client HTTP charge sans .env fait echouer la suite dans une copie de travail).
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  listFacilityClosures: jest.fn(() => Promise.resolve({ data: [], meta: {} })),
}));

/** @type {any} */
let mockClubs;
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: (/** @type {any} */ id) => (id ? mockClubs : { data: undefined }),
  useCollectiviteInstallations: () => ({
    data: [{
      closingTime: '22:00:00.000',
      documentId: 'gym-tilleuls',
      maxSlots: 2,
      name: 'Gymnase des Tilleuls',
      openingTime: '08:00:00.000',
      type: 'Gymnase',
    }],
  }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/emptyState/EmptyState', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN,
  } = jest.requireActual('react-native');
  return function EmptyStateMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      null,
      reactActuel.createElement(TexteRN, null, props.title),
      reactActuel.createElement(TexteRN, null, props.description),
      props.actionLabel ? reactActuel.createElement(
        PressableRN,
        { onPress: props.onAction },
        reactActuel.createElement(TexteRN, null, props.actionLabel),
      ) : null,
    );
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock(/** @type {any} */ props) {
    mockDateProps.push(props);
    return null;
  },
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN,
  } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ props) {
    const { onChange, options } = props;
    mockOnglets.push(props);
    return reactActuel.createElement(VueRN, null, (options || []).map(
      (/** @type {any} */ option) => reactActuel.createElement(
        PressableRN,
        { key: option.value, onPress: () => onChange(option.value) },
        reactActuel.createElement(TexteRN, null, option.label),
      ),
    ));
  };
});

// Des secrets SEMES la ou le serveur ne doit rien mettre : s ils s affichent, la mairie lirait
// une personne. Le contrat dit que `attributedBy` ne sort par aucune route ; l ecran ne doit
// de toute facon jamais afficher un champ de personne.
const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr', '0611223344'];
const PERSONNE = {
  email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1], phone: SECRETS[3],
};
const creneau = (/** @type {any} */ champs) => ({
  attributedAt: '2026-09-01T08:00:00.000Z',
  attributedBy: PERSONNE,
  club: { documentId: 'club-as', name: 'AS Montrivage', president: PERSONNE },
  facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
  plateau: null,
  previous: null,
  source: 'attribution',
  status: 'active',
  team: { documentId: 'team-u15', name: 'U15', trainers: [PERSONNE] },
  validFrom: '2026-09-01',
  validUntil: '2027-06-30',
  withdrawnAt: null,
  withdrawnFrom: null,
  ...champs,
});
const CRENEAUX = [
  creneau({
    documentId: 'mar-u15', endTime: '19:00', startTime: '17:30', weekday: 2,
  }),
  creneau({
    documentId: 'jeu-u15', endTime: '19:30', startTime: '18:00', weekday: 4,
  }),
  creneau({
    club: { documentId: 'club-fc', name: 'Montrivage FC' },
    documentId: 'jeu-sb',
    endTime: '19:30',
    startTime: '18:00',
    team: { documentId: 'team-sb', name: 'Senior B' },
    weekday: 4,
  }),
];
const META = (/** @type {any} */ champs = {}) => ({
  canManage: true,
  facility: {
    documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', plateaux: [],
  },
  season: { validFrom: '2026-09-01', validUntil: '2027-06-30' },
  ...champs,
});
const RETIRE = creneau({
  documentId: 'lun-retire',
  endTime: '19:30',
  startTime: '18:00',
  status: 'withdrawn',
  team: { documentId: 'team-u17', name: 'U17' },
  weekday: 1,
  withdrawnFrom: '2026-10-05',
});

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
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAllByType(TouchableOpacity).find((/** @type {any} */ noeud) => noeud.props.testID === id);
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
};
const appuyer = async (/** @type {any} */ noeud) => {
  if (!noeud) throw new Error('rien a toucher');
  await act(async () => { noeud.props.onPress(); });
  await attendre();
};

/** @type {any[]} */
const montes = [];
const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <InstallationCreneaux />
      </QueryClientProvider>,
    );
  });
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInputProps.length = 0;
  mockDateProps.length = 0;
  mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() };
  mockClubs = {
    data: [
      { documentId: 'club-as', email: 'contact@as.fr', name: 'AS Montrivage' },
      { documentId: 'club-fc', name: 'Montrivage FC' },
    ],
  };
  /** @type {any} */ (listFacilitySeasonSlots).mockImplementation(
    (/** @type {string} */ _id, /** @type {any} */ { status }) => Promise.resolve(
      status === 'withdrawn'
        ? { data: [RETIRE], meta: META() }
        : { data: CRENEAUX, meta: META() },
    ),
  );
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([
    { documentId: 'team-u13', name: 'U13' }, { documentId: 'team-u15', name: 'U15' },
  ]);
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
    data: {
      capacity: 2,
      needsConfirmation: false,
      next: {
        club: { name: 'Montrivage FC', secretary: PERSONNE },
        startTime: '19:00',
        team: { name: 'Senior B' },
      },
      occupants: [],
      overCapacity: false,
      peak: 0,
      plateau: null,
      remaining: 2,
      teamsAfter: 1,
    },
  });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (getSeasonSlot).mockResolvedValue({
    data: { ...CRENEAUX[0], sessionsCount: 7 }, meta: { canManage: true },
  });
  /** @type {any} */ (withdrawSeasonSlot).mockResolvedValue({ data: { status: 'withdrawn' } });
  /** @type {any} */ (restoreSeasonSlot).mockResolvedValue({ data: { status: 'active' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: {}, meta: { split: false } });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

// Les DONNÉES EXACTES de la recette (relay_corps.log de la T18, PUT 200 de 12:58:52) : le créneau
// « Montrivage FC » (sans équipe) raccourci au 15 juin, et « AS Montrivage · U15 » saison entière.
const SALLE_T18 = { documentId: 'kmywd584kbdcnvgq1mk0jtlg', name: 'T18 Salle essai' };
const RECETTE = (/** @type {string} */ fin) => [
  {
    attributedAt: '2026-10-07T12:52:09.017Z',
    club: { documentId: 'tkfun3xnrphzyp9sqmjsadks', name: 'AS Montrivage' },
    documentId: 'upk2yd7zege7fy5dogjb502b',
    effectiveUntil: '2027-06-30',
    endTime: '19:30',
    facility: { documentId: SALLE_T18.documentId, name: SALLE_T18.name },
    plateau: null,
    previous: null,
    source: 'attribution',
    startTime: '18:00',
    status: 'active',
    team: { documentId: 'xpzuyxb64l0mujluirrmq69l', name: 'U15' },
    validFrom: '2026-09-01',
    validUntil: '2027-06-30',
    weekday: 2,
    withdrawnAt: null,
    withdrawnFrom: null,
  },
  {
    attributedAt: '2026-10-07T12:53:37.571Z',
    club: { documentId: 'uwesxe5dbze6jfp6487jio22', name: 'Montrivage FC' },
    documentId: 'pt2i2ifk8p06rp4vowcg86g3',
    effectiveUntil: fin,
    endTime: '19:30',
    facility: { documentId: SALLE_T18.documentId, name: SALLE_T18.name },
    plateau: null,
    previous: null,
    source: 'attribution',
    startTime: '18:00',
    status: 'active',
    team: null,
    validFrom: '2026-09-01',
    validUntil: fin,
    weekday: 2,
    withdrawnAt: null,
    withdrawnFrom: null,
  },
];

describe('VILLE-T18A point 1 — un créneau à période raccourcie s ouvre depuis l onglet Créneaux', () => {
  it('« Montrivage FC · 18:00 – 19:30 · du 1 sept. au 15 juin » : la carte ouvre sa fiche, ses gestes', async () => {
    /** @type {any} */ (listFacilitySeasonSlots).mockImplementation(
      (/** @type {string} */ _id, /** @type {any} */ { status }) => Promise.resolve(
        status === 'withdrawn' ? { data: [], meta: META() } : { data: RECETTE('2027-06-15'), meta: META() },
      ),
    );
    /** @type {any} */ (getSeasonSlot).mockResolvedValue({
      data: { ...RECETTE('2027-06-15')[1], sessionsCount: 0 }, meta: { canManage: true },
    });
    const arbre = await rendre();
    expect(textes(arbre)).toContain('18:00 – 19:30 · du 1 sept. au 15 juin');

    await appuyer(parTestID(arbre, 'creneau-pt2i2ifk8p06rp4vowcg86g3'));
    expect(getSeasonSlot).toHaveBeenCalledWith('pt2i2ifk8p06rp4vowcg86g3');
    const lus = textes(arbre);
    expect(lus).toContain('Chaque mardi, 18:00 – 19:30 · Gymnase des Tilleuls');
    expect(lus).toContain('1 sept. 2026 – 15 juin 2027');
    expect(parTexte(arbre, 'Modifier le créneau')).toBeDefined();
    expect(parTexte(arbre, 'Retirer le créneau')).toBeDefined();
  });
});

// POINT 4 — T18 G28a : la fiche a 4 onglets (Créneaux · Planning · Fermetures · Infos, comme
// P4v3-fermer-ordi) ; sur téléphone ils défilaient et « Infos » était coupé au bord droit
// (22 px visibles). Ils se partagent maintenant la largeur, le texte rétrécit pour tenir.
describe('VILLE-T18A point 4 — la fiche : les 4 onglets tiennent dans la largeur', () => {
  it('Créneaux · Planning · Fermetures · Infos, à largeur égale, libellés rétrécis (jamais coupés)', async () => {
    await rendre();
    const onglets = mockOnglets.at(-1);
    // R17-SIGNALER-1 (19/10, planche P10-securite-tel écran 1, validée par Adel « ok go ») : la Ville
    // a un 5ᵉ onglet, « Sécurité et suivi ». Cinq ne tiennent pas sur 412 px : au téléphone, la
    // rangée DÉFILE et chaque nom reste entier. Sans la Ville (canManage faux), 4 onglets à largeur
    // égale, comme avant.
    expect(onglets.options.map((/** @type {any} */ option) => option.label))
      .toEqual(['Créneaux', 'Planning', 'Fermetures', 'Infos', 'Sécurité et suivi']);
    expect(onglets.centerContent).toBe(false);
    expect(onglets.fitLabels).toBe(false);
    expect(onglets.fullLabels).toBe(true);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
