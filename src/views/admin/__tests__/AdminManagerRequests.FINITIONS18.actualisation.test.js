/* eslint-disable no-unused-vars, max-len -- harnais recopie de AdminManagerRequests.test.js */
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminManagerRequests from '../AdminManagerRequests';
import ManagerRequestsLink from '../components/ManagerRequestsLink';

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 6 : la file « Demandes de gestionnaire » de la console
// (décision d'Adel « console oui » ; `P2-gestion-tel` / `-ordi`). ROUGE avant le lot : l'écran
// n'existait pas. Ce que le témoin fige :
//   - la file en attente : la personne, sa fonction, son e-mail pro, la Ville et « Existe » /
//     « Pas encore sur FoundClub » ;
//   - une demande ouverte : la personne, la Ville et ce qu'elle a déjà, le conseil de
//     vérification, « Valider » et « Refuser » ;
//   - valider (Ville existante) ; valider en CRÉANT la Ville : nom officiel et code exigés ;
//   - refuser : le motif est OBLIGATOIRE, trois motifs en un appui ;
//   - « Traitées » : l'issue, la date, qui a tranché, le motif d'un refus ; la file vide ;
//   - « Ouvrir dans la file » depuis la fiche d'une collectivité.

/** @type {any} */
let mockEnAttente;
/** @type {any} */
let mockTraitees;
/** @type {any} */
let mockParams;
const mockTrancher = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

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

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useAdminManagerRequests: (/** @type {string} */ statut) => (
    statut === 'decided' ? mockTraitees : mockEnAttente
  ),
  useDecideManagerRequest: () => ({ isPending: false, mutateAsync: mockTrancher }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);
jest.mock(
  '@/components/atoms/loader/Loader',
  () => function LoaderMock() {
    return null;
  },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN,
    TouchableOpacity: PressableRN,
    View: Vue,
  } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options }) {
    return reactActuel.createElement(
      Vue,
      null,
      options.map((option) => reactActuel.createElement(
        PressableRN,
        {
          key: option.value,
          onPress: () => onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        reactActuel.createElement(TexteRN, null, option.label),
      )),
    );
  };
});

const lu = (/** @type {any[]} */ data) => ({
  data,
  error: null,
  isLoading: false,
  refetch: jest.fn(),
});

const MONTRIVAGE = {
  collectivite: {
    clubsCount: 3,
    codeInsee: '13998',
    documentId: 'ville-montrivage',
    exists: true,
    gestionnaires: ['Karim Benali'],
    isActive: true,
    name: 'Ville de Montrivage',
    type: 'commune',
  },
  createdAt: '2026-10-01T09:00:00.000Z',
  decidedAt: null,
  decidedBy: null,
  documentId: 'dm-1',
  jobTitle: 'Service des sports',
  professionalEmail: 'sports@montrivage.fr',
  refusalReason: null,
  requester: {
    documentId: 'agent',
    firstname: 'Agnès',
    lastname: 'Mairie',
    phone: '+33600000010',
  },
  status: 'pending',
};
const VALFLEURI = {
  ...MONTRIVAGE,
  collectivite: {
    clubsCount: 0,
    codeInsee: null,
    documentId: null,
    exists: false,
    gestionnaires: [],
    isActive: false,
    name: 'Valfleuri',
    type: 'commune',
  },
  documentId: 'dm-2',
  requester: {
    documentId: 'paul',
    firstname: 'Paul',
    lastname: 'Valfleuri',
    phone: null,
  },
};

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [cible] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  );
  expect(cible).toBeDefined();
  await act(async () => {
    await cible.props.onPress();
  });
};
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ testID,
  /** @type {string} */ valeur,
) => {
  const [champ] = arbre.root.findAll(
    (/** @type {any} */ n) => n.type === TextInput && n.props.testID === testID,
  );
  await act(async () => {
    champ.props.onChangeText(valeur);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockEnAttente = lu([MONTRIVAGE, VALFLEURI]);
  mockTraitees = lu([]);
  mockTrancher.mockResolvedValue({ data: {} });
});

// FINITIONS18 · POINT 7 (T15, T16 ; REPRODUIT sur l'emulateur le 06/10) — au telephone, l'onglet
// « Traitees » ne reagissait pas : une zone MORTE de ~100 × 70 px au centre du bouton, a l'abscisse
// exacte du rond natif de « tirer pour actualiser » (CircleImageView, x 425-529 dans son parent).
// `refreshing` suivait CHAQUE relecture de fond (au montage) : le rond descendait, puis restait,
// invisible, a prendre les appuis (« En attente » et les bords de « Traitees » repondaient,
// verifie par sondage). Le rond ne suit plus que le geste de l'utilisateur. ROUGE avant.
describe('FINITIONS18 7 — le rond d actualisation ne suit que le geste', () => {
  // Le rond tel que l ecran le DONNE a sa liste (prop refreshControl de la ScrollView).
  const rond = (/** @type {any} */ arbre) => arbre.root
    .findAll((/** @type {any} */ n) => n.props?.refreshControl)[0].props.refreshControl;

  it('🔴 une relecture de FOND (au montage) ne descend pas le rond', async () => {
    mockEnAttente = { ...mockEnAttente, isRefetching: true };
    mockTraitees = { ...mockTraitees, isRefetching: true };
    const arbre = await monter(<AdminManagerRequests />);
    expect(rond(arbre).props.refreshing).toBe(false);
  });

  it('🔒 tirer pour actualiser : le rond descend, les deux listes se relisent, puis il remonte', async () => {
    let finir = () => {};
    mockEnAttente = { ...mockEnAttente, refetch: jest.fn(() => new Promise((resolve) => { finir = resolve; })) };
    mockTraitees = { ...mockTraitees, refetch: jest.fn(async () => ({})) };
    const arbre = await monter(<AdminManagerRequests />);
    await act(async () => { rond(arbre).props.onRefresh(); });
    expect(rond(arbre).props.refreshing).toBe(true);
    expect(mockEnAttente.refetch).toHaveBeenCalledTimes(1);
    expect(mockTraitees.refetch).toHaveBeenCalledTimes(1);
    await act(async () => { finir({}); await Promise.resolve(); });
    expect(rond(arbre).props.refreshing).toBe(false);
  });
});
