import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

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

// 📐 COLL-C2B (02/10/2026), planche 3 du design HY521H1 : « P4v2-creneaux-tel » et
// « P4v2-creneaux-ordi » — L ONGLET « CRENEAUX » D UNE INSTALLATION DE LA VILLE, branche sur
// le contrat C2A (admin docs/CONTRAT_CRENEAUX_SAISON.md). Le vrai fr.js ecrit les phrases ;
// le service HTTP est double, les requetes react-query sont les vraies.
//
// Les temoins attendus par le prompt du lot (ROUGES avant : l ecran n existait pas) :
//   1. l onglet Creneaux liste ce que rend §4.1 (jour par jour, « complet » nomme) ;
//   2. « Attribuer » envoie le bon corps, et affiche la place libre de §4.2 PENDANT la saisie ;
//   3. un 409 de capacite ouvre « Attribuer quand meme » (confirmOverCapacity) ;
//   4. Retirer affiche la phrase D67 ; Retablir rappelle §4.7 (et son 409) ;
//   5. le champ Plateau n existe que si `plateaux` est non vide ;
//   6. un membre non gestionnaire n a AUCUN geste d ecriture ;
//   7. aucun nom de personne dans ce qui est affiche a la mairie (secrets semes).

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

// COLL-R-A7 (COL-005) : le tunnel plein écran rend le vrai gabarit des tunnels ; la marge du dépôt.
jest.setTimeout(30000);
// R17-CONTROLES (20/10) : l onglet « Sécurité et suivi » porte « Noter un contrôle », qui charge le
// selecteur de documents (module natif, absent des temoins) : doublure.
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls' } }),
}));
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
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
// VILLE-T18A : Début et Fin sont des sélecteurs d heure (TimePickerInput) ; même relevé,
// leur `onChange` se lit comme le `onChangeText` d un champ.
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => function TimePickerInputMock(/** @type {any} */ props) {
    mockInputProps.push({ ...props, onChangeText: props.onChange });
    return null;
  },
);
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock(/** @type {any} */ props) {
    mockDateProps.push(props);
    return null;
  },
);
// SAIS (T20 lot 1) : la doublure garde aussi les proprietes des feuilles OUVERTES (leur hauteur).
/** @type {any[]} */
const mockFeuilles = [];
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ props,
) {
  if (props.isVisible) mockFeuilles.push(props);
  return props.isVisible ? props.children : null;
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
  // VILLE-T18A : les puces écrivent leurs espaces en insécables ; on les lit en espaces.
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

test('IPH09 FC-001 : retour unique, header rétabli à la fermeture', async () => {
  const arbre = await rendre();
  await appuyer(parTexte(arbre, 'Attribuer un créneau'));
  expect(mockNavigation.setOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ headerShown: false }),
  );
  // COLL-R-A7 (COL-005) : en plein écran, à l'étape 1, la croix seule (pas de flèche) ferme.
  const gabarit = arbre.root.findByType(WizardStepLayout);
  expect(gabarit.props.onBack).toBeUndefined();
  await appuyer({ props: { onPress: gabarit.props.onClose } });
  expect(mockNavigation.setOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ headerShown: true }),
  );
});

test('CRA7F : Ajouter un club ferme le tunnel puis ouvre le rattachement', async () => {
  mockClubs = { data: [] };
  const arbre = await rendre();
  await appuyer(parTexte(arbre, 'Attribuer un créneau'));
  await appuyer(parTexte(arbre, 'Ajouter un club'));
  expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteInviteClub', {
    collectiviteId: 'ville-montrivage', onglet: 'recherche',
  });
  expect(arbre.root.findAllByType(WizardStepLayout)).toHaveLength(0);
});

test('IPH09 FC-003 : détail compact et actions groupées', async () => {
  const arbre = await rendre();
  await appuyer(parTestID(arbre, 'creneau-mar-u15'));
  expect(mockFeuilles.at(-1).contentBottomPaddingOverride).toBeGreaterThanOrEqual(16);
  expect(mockFeuilles.at(-1).contentBottomPaddingOverride).toBeLessThan(60);
  const fermer = parTexte(arbre, 'Fermer');
  const modifier = parTexte(arbre, 'Modifier le créneau');
  expect(fermer.parent.parent).toBe(modifier.parent.parent);
  const feuille = mockFeuilles.at(-1);
  expect(StyleSheet.flatten(feuille.contentContainerStyle).paddingTop).toBeGreaterThanOrEqual(20);
  expect(textes(arbre)).toContain('17:30 – 19:00');
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
