import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminManagerRequests from '../AdminManagerRequests';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 6 — « TRAITÉES » EN GRILLE sur le site (planche 17,
// `P2-gestion-ordi`, état D) : Personne | Collectivité | Issue | Le, et le motif d'un refus.
// ROUGE avant le lot : sur le site, les demandes traitées restaient des cartes dans la colonne de
// 400 points. Le téléphone garde ses cartes (témoin AdminManagerRequests).
// L'e-mail est tranché (`mail A`, 02/10) : la personne est prévenue dans l'app seulement, en
// v1 — l'écran n'en promet aucun.

let mockLargeur = 1280;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));
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

const grilles = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === 'gestionnaire-traitees-grille');
const ligneTraitee = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === `gestionnaire-traitee-${id}`)[0];
const textesSous = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const TRAITEES = () => lu([
  {
    ...MONTRIVAGE,
    decidedAt: '2026-10-02T09:00:00.000Z',
    decidedBy: 'Adel F',
    status: 'accepted',
  },
  {
    ...VALFLEURI,
    decidedAt: '2026-10-02T09:00:00.000Z',
    refusalReason: 'Lien non vérifié.',
    status: 'refused',
  },
]);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockEnAttente = lu([]);
  mockTraitees = TRAITEES();
});

describe('COLL-CONSOLE-BIS — planche 17 : « Traitées » en grille sur le site', () => {
  it('sur le site : Personne | Collectivité | Issue | Le, une ligne par demande', async () => {
    mockLargeur = 1280;
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'onglet-decided');
    expect(grilles(arbre)).not.toHaveLength(0);
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Personne', 'Collectivité', 'Issue', 'Le']));
    const montrivage = textesSous(ligneTraitee(arbre, 'dm-1'));
    expect(montrivage.slice(0, 3)).toEqual(['Agnès Mairie', 'Ville de Montrivage', 'Validée']);
    expect(montrivage[3]).toMatch(/02\/10\/2026 · Adel F$/);
    const valfleuri = textesSous(ligneTraitee(arbre, 'dm-2'));
    expect(valfleuri.slice(0, 3)).toEqual(['Paul Valfleuri', 'Valfleuri', 'Refusée']);
    expect(valfleuri).toContain('« Lien non vérifié. »');
  });

  it('sur le téléphone : les cartes restent', async () => {
    mockLargeur = 390;
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'onglet-decided');
    expect(grilles(arbre)).toHaveLength(0);
    expect(textes(arbre)).not.toContain('Personne');
  });
});
