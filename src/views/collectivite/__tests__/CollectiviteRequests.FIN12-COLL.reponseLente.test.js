import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteRequests from '../CollectiviteRequests';

// 🧯 FINITIONS12-COLL (03/10) — point 1, côté app : UNE RÉPONSE LENTE N'EST PAS UNE ERREUR.
//
// Tournée T11 : la Ville accepte 37 dates d'une série ; le serveur répond 200 en 23,5 s ; le
// client abandonne à 15 s ; la fenêtre affiche « Erreur » et reste ouverte, alors que tout est
// écrit. Ce que ce témoin exige (ROUGE avant le lot) :
//   - délai dépassé, mais la demande n'est plus dans la file relue : la décision est passée ⇒
//     la fenêtre se ferme, aucune erreur, et « Traitées » relit la liste (la décision y est) ;
//   - « plus en attente » (un appui précédent l'a déjà tranchée) : même chose ;
//   - délai dépassé et la demande est TOUJOURS dans la file : rien n'est écrit ⇒ l'erreur reste,
//     la fenêtre aussi (on ne ment pas dans l'autre sens).
// De bout en bout côté app : les VRAIES lectures et mutations ; seul le client HTTP est doublé.

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: jest.fn(),
  },
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 812, scale: 2, width: 375,
  }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: null, clubs: [], documentId: 'u-mairie' } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { collectiviteId: 'ville-de-recette' } }),
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
        const valeurs = typeof repli === 'object' && repli ? repli : options;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
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
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return function SkeletonLoaderMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, null, props.children);
  };
});
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
    Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN,
  } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, null, props.options.map((/** @type {any} */ option) => (
      reactActuel.createElement(
        PressableRN,
        {
          key: option.value,
          onPress: () => props.onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        reactActuel.createElement(TexteRN, null, option.label),
      )
    )));
  };
});

const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Recette', type: 'commune' };
const EN_ATTENTE = {
  club: { documentId: 'club-b', name: 'Montrivage FC' },
  conflict: { maxSlots: 2, occupants: [], remaining: 2 },
  documentId: 'rq-1',
  event: {
    documentId: 'ev-1', isRecurring: false, name: null, type: { name: 'Entraînement' },
  },
  facility: { documentId: 'gymnase', name: 'Gymnase des Tilleuls' },
  reason: null,
  requestedBy: { documentId: 'u-adel', firstname: 'Test', lastname: 'Adel' },
  requestedEnd: '2030-10-08T17:30:00.000Z',
  requestedStart: '2030-10-08T16:00:00.000Z',
  requesterFunction: 'trainer',
  series: null,
  seriesCount: 1,
  status: 'pending',
  team: { documentId: 'team-l', name: 'Loisir mixtes' },
};
const TRAITEE = {
  ...EN_ATTENTE, conflict: undefined, status: 'approved', updatedAt: '2030-10-01T09:00:00.000Z',
};
// Ce que l'intercepteur du client rejette sur un abandon à 15 s (client.native.js, PERF3).
const DELAI_DEPASSE = {
  code: 'REQUEST_TIMEOUT_ABANDONED',
  message: 'Request timeout - please retry.',
  name: 'RequestTimeoutAbandonError',
  status: 0,
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID, index = 0) => {
  const pressables = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
  await act(async () => { await pressables[index].props.onPress(); });
};
const attendre = async (/** @type {() => boolean} */ condition, delaiMs = 9000) => {
  const fin = Date.now() + delaiMs;
  while (!condition() && Date.now() < fin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 25); }); });
  }
};
jest.setTimeout(30000);

/** @type {any[]} */
let mockFile = [];
/** @type {any[]} */
let mockTraitees = [];
const lecturesDe = (/** @type {string} */ statut) => mockGet.mock.calls
  .filter(([url, config]) => url === '/collectivites/ville-de-recette/requests'
    && config?.params?.status === statut)
  .length;

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <CollectiviteRequests />
      </QueryClientProvider>,
    );
  });
  await attendre(() => textes(arbre).includes('Accepter'));
  return arbre;
};

beforeEach(() => {
  mockFile = [EN_ATTENTE];
  mockTraitees = [];
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ config) => {
    if (url === '/collectivites/mine') return { data: { data: [VILLE] } };
    if (url === '/collectivites/ville-de-recette/requests') {
      return { data: { data: config?.params?.status === 'decided' ? mockTraitees : mockFile } };
    }
    throw new Error(`GET inattendu ${url}`);
  });
});

const fenetreOuverte = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === 'fenetre-rappel').length > 0;

describe('FINITIONS12-COLL point 1 — une réponse lente ou perdue n’est pas une erreur', () => {
  // eslint-disable-next-line max-len
  it('délai dépassé, décision écrite : la fenêtre se ferme, aucune erreur, « Traitées » la montre', async () => {
    // Le serveur ÉCRIT la décision, mais le client abandonne avant sa réponse.
    mockPost.mockImplementation(async () => {
      mockFile = [];
      mockTraitees = [TRAITEE];
      return Promise.reject(DELAI_DEPASSE);
    });
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    expect(fenetreOuverte(arbre)).toBe(true);
    await appuyer(arbre, 'bouton-Accepter', 1);
    await attendre(() => !fenetreOuverte(arbre));

    expect(fenetreOuverte(arbre)).toBe(false);
    expect(textes(arbre).join(' | ')).not.toMatch(/timeout|Erreur|n’a pas pu/i);
    expect(textes(arbre)).toContain('En attente (0)');
    await appuyer(arbre, 'onglet-decided');
    await attendre(() => textes(arbre).includes('Acceptée'));
    expect(textes(arbre)).toContain('Acceptée');
    expect(lecturesDe('decided')).toBeGreaterThan(0);
  });

  // eslint-disable-next-line max-len
  it('« plus en attente » (déjà tranchée par un appui précédent) : la fenêtre se ferme', async () => {
    mockFile = [EN_ATTENTE];
    mockPost.mockImplementation(async () => {
      mockFile = [];
      // eslint-disable-next-line prefer-promise-reject-errors -- la forme que rejette le client
      return Promise.reject({
        details: {},
        message: 'This facility override request is no longer pending',
        name: 'BadRequestError',
        status: 400,
      });
    });
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    await appuyer(arbre, 'bouton-Accepter', 1);
    await attendre(() => !fenetreOuverte(arbre));
    expect(fenetreOuverte(arbre)).toBe(false);
    expect(textes(arbre).join(' | ')).not.toMatch(/no longer pending/i);
  });

  // eslint-disable-next-line max-len
  it('délai dépassé et la demande est toujours en attente : l’erreur reste, la fenêtre aussi', async () => {
    mockPost.mockRejectedValue(DELAI_DEPASSE);
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    await appuyer(arbre, 'bouton-Accepter', 1);
    // La file est relue (au moins une fois de plus qu'au montage) avant de conclure ; on laisse
    // passer toutes les relectures (la dernière vient 4 s après l'abandon).
    await attendre(() => lecturesDe('pending') >= 4, 9000);
    await attendre(() => false, 300);
    expect(lecturesDe('pending')).toBeGreaterThanOrEqual(2);
    expect(fenetreOuverte(arbre)).toBe(true);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
