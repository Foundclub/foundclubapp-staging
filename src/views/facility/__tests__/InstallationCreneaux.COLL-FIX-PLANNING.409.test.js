import { QueryClientProvider } from '@tanstack/react-query';
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

// Le VRAI client react-query de l app, avec son filet global d alertes.
const { createFoundClubQueryClient } = require('@/app/queryClient');

// 🐞 COLL-FIX-PLANNING (02/10/2026), point 5, defaut de la tournee T9 (capture T9_C23_6) : un 409
// de capacite (`SEASON_SLOT_OVER_CAPACITY`) ouvrait PAR-DESSUS la vraie confirmation de l ecran
// (« Attribuer quand même » / « Changer l’heure », qui renvoie avec `confirmOverCapacity`) une
// alerte « Erreur » au texte brut du serveur, sans accents, avec un seul « OK ». La mairie croyait
// ne pas pouvoir confirmer.
//
// LA CAUSE : le filet GLOBAL des erreurs de react-query (`app/queryClient.js`, MutationCache ->
// `displayErrorAlert` de App.js) alerte sur toute mutation qui echoue — alors que les 4 gestes
// sur un creneau (attribuer, modifier, retirer, retablir) disent DEJA leur erreur dans l ecran,
// traduite.
// Le temoin C2B montait l ecran avec un client react-query NU : le filet n y existait pas.
//
// Ce temoin monte l ecran avec le VRAI client de l app et une alerte espionne :
//   - un 409 ne declenche AUCUNE alerte globale ; la confirmation a 2 boutons est la, accentuee,
//     et « quand même » renvoie avec `confirmOverCapacity` ;
//   - pareil pour « Rétablir » ;
//   - un autre refus (retirer un creneau deja retire) se dit DANS l ecran, traduit, sans alerte.
// ROUGE avant : l alerte globale part a chaque refus.

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
  return function SegmentedControlMock(/** @type {any} */ { onChange, options }) {
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
  // VILLE-T18A : les puces écrivent leurs espaces en insécables (Android 16) ; on les lit en espaces.
  return String(enfants).replace(/\u00a0/g, ' ');
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
const champ = (/** @type {string} */ libelle) => mockInputProps
  .filter((props) => props.label === libelle).pop();
const saisir = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  await act(async () => { champ(libelle).onChangeText(valeur); });
  await attendre();
};

const mockAlerte = jest.fn();
/** @type {any[]} */
const montes = [];
const rendre = async () => {
  // Le VRAI client de l app : son filet d alertes est branche sur l espion.
  const client = createFoundClubQueryClient({
    onMutationError: (/** @type {any[]} */ ...args) => mockAlerte(...args),
  });
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

const COMPLET = {
  details: {
    code: 'SEASON_SLOT_OVER_CAPACITY',
    preview: {
      capacity: 2,
      needsConfirmation: true,
      occupants: [
        { club: { name: 'AS Montrivage' }, team: { name: 'U15' } },
        { club: { name: 'Montrivage FC' }, team: { name: 'Senior B' } },
      ],
      overCapacity: true,
      peak: 2,
      teamsAfter: 3,
    },
  },
  message: 'L installation est deja pleine a ce moment : confirmez pour attribuer quand meme.',
  status: 409,
};

describe('COLL-FIX-PLANNING 5 — un 409 : la confirmation de l ecran, sans alerte dessus', () => {
  it('attribuer : aucune alerte, 2 boutons accentues, « quand même » confirme', async () => {
    /** @type {any} */ (attributeSeasonSlot)
      .mockRejectedValueOnce(COMPLET)
      .mockResolvedValueOnce({ data: { documentId: 'neuf' } });
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Attribuer un créneau'));
    await appuyer(parTexte(arbre, 'AS Montrivage'));
    await appuyer(parTexte(arbre, 'U13'));
    await appuyer(parTestID(arbre, 'jour-3'));
    await saisir('Début', '17:30');
    await saisir('Fin', '19:00');
    await appuyer(parTexte(arbre, 'Attribuer le créneau'));

    expect(mockAlerte).not.toHaveBeenCalled();
    expect(textes(arbre))
      .toContain('Attribuer met 3 équipes pour 2 places, chaque mercredi de la saison.');
    expect(textes(arbre).join(' ')).not.toContain('deja pleine');
    expect(parTexte(arbre, 'Attribuer quand même')).toBeDefined();
    expect(parTexte(arbre, 'Changer l’heure')).toBeDefined();

    await appuyer(parTexte(arbre, 'Attribuer quand même'));
    expect(attributeSeasonSlot).toHaveBeenLastCalledWith('gym-tilleuls', {
      club: 'club-as',
      confirmOverCapacity: true,
      endTime: '19:00',
      startTime: '17:30',
      team: 'team-u13',
      weekday: 3,
    });
    expect(mockAlerte).not.toHaveBeenCalled();
  });

  it('retablir : aucune alerte « Erreur », « Rétablir quand même » confirme', async () => {
    /** @type {any} */ (restoreSeasonSlot)
      .mockRejectedValueOnce({
        ...COMPLET,
        details: { ...COMPLET.details, preview: { capacity: 2, teamsAfter: 3 } },
      })
      .mockResolvedValueOnce({ data: { status: 'active' } });
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Rétablir'));
    expect(mockAlerte).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Le rétablir met 3 équipes pour 2 places.');
    await appuyer(parTexte(arbre, 'Rétablir quand même'));
    expect(restoreSeasonSlot).toHaveBeenLastCalledWith('lun-retire', { confirmOverCapacity: true });
    expect(mockAlerte).not.toHaveBeenCalled();
  });

  it('un autre refus (deja retire) se dit dans l ecran, traduit, sans alerte', async () => {
    /** @type {any} */ (withdrawSeasonSlot).mockRejectedValueOnce({
      details: { code: 'SEASON_SLOT_ALREADY_WITHDRAWN' },
      message: 'Season slot already withdrawn',
      status: 409,
    });
    const arbre = await rendre();
    await appuyer(parTestID(arbre, 'creneau-mar-u15'));
    await appuyer(parTexte(arbre, 'Retirer le créneau'));
    await appuyer(parTexte(arbre, 'Retirer le créneau'));
    expect(mockAlerte).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Ce créneau est déjà retiré.');
  });
});
