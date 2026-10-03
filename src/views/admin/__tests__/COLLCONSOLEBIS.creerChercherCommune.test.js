import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import AdminCollectiviteForm from '../AdminCollectiviteForm';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 1 — « CHERCHER LA COMMUNE » dans la console (planche 14,
// `P2-creer-tel` états 1 et 2, `P2-creer-ordi` état 1). ROUGE avant le lot : le champ n'existait
// pas, le nom officiel, l'INSEE et le SIREN se tapaient à la main.
//   - la recherche lit le référentiel de l'État par le serveur (route existante, `communes=1`) ;
//   - un appui REMPLIT le formulaire : « Ville de Valfleuri », INSEE, SIREN ; « Créer » les
//     envoie ;
//   - une commune DÉJÀ sur FoundClub le dit, et ouvre sa fiche au lieu de remplir (le garde-fou
//     anti-doublon du serveur, INSEE ou SIREN obligatoire, reste en place) ;
//   - le champ n'existe que pour le type « Commune ».

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  addListener: () => () => {},
  dispatch: jest.fn(),
  goBack: jest.fn(),
  navigate: (/** @type {any[]} */ ...args) => mockNavigate(...args),
  replace: jest.fn(),
};

jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: (/** @type {any[]} */ ...args) => mockGet(...args),
    post: (/** @type {any[]} */ ...args) => mockPost(...args),
    put: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
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

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
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
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

/**
 * Laisse tourner react-query jusqu a ce que la condition tienne (borne en TEMPS, pas en tours :
 * piege-attente-temoin-comptee-en-tours).
 * @param {() => boolean} condition - Ce qu on attend.
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  const fin = Date.now() + 5000;
  while (!condition() && Date.now() < fin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((suite) => { setTimeout(suite, 10); }); });
  }
};

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}><AdminCollectiviteForm /></QueryClientProvider>,
    );
  });
  return arbre;
};
const champ = (/** @type {any} */ arbre, /** @type {string} */ cle) => arbre.root
  .findAllByType(TextInput)
  .find((/** @type {any} */ n) => n.props.testID === `admin-collectivite-form-${cle}`);
const taper = async (
  /** @type {any} */ arbre,
  /** @type {string} */ cle,
  /** @type {string} */ texte,
) => {
  await act(async () => { champ(arbre, cle).props.onChangeText(texte); });
};
const pressables = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [cible] = pressables(arbre, testID);
  expect(cible).toBeDefined();
  await act(async () => { await cible.props.onPress(); });
};

const VALFLEURI = {
  codeInsee: '13999',
  codesPostaux: ['13990'],
  collectivite: null,
  departement: '13',
  name: 'Valfleuri',
  siren: '213999999',
};
const MONTRIVAGE = {
  codeInsee: '13998',
  codesPostaux: ['13980'],
  collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
  departement: '13',
  name: 'Montrivage',
  siren: '213998888',
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockNavigate.mockReset();
  mockGet.mockResolvedValue({ data: { data: [VALFLEURI, MONTRIVAGE] } });
  mockPost.mockResolvedValue({ data: { data: { documentId: 'ville-valfleuri' } } });
});

describe('COLL-CONSOLE-BIS — planche 14 : « Chercher la commune » dans la console', () => {
  it('le référentiel lu par le serveur ; un appui REMPLIT nom officiel, INSEE, SIREN', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Chercher la commune',
      'Nom officiel, code INSEE et SIREN se remplissent à partir d’elle.',
    ]));
    await taper(arbre, 'commune', 'Valf');
    await attendre(() => pressables(arbre, 'admin-collectivite-form-commune-13999').length > 0);
    expect(mockGet).toHaveBeenCalledWith('/collectivite-manager-requests/collectivites', {
      params: { communes: 1, q: 'Valf' },
    });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Valfleuri',
      '13990 · INSEE 13999 · SIREN 213999999',
    ]));

    await appuyer(arbre, 'admin-collectivite-form-commune-13999');
    expect(champ(arbre, 'name').props.value).toBe('Ville de Valfleuri');
    expect(champ(arbre, 'codeInsee').props.value).toBe('13999');
    expect(champ(arbre, 'siren').props.value).toBe('213999999');
    expect(champ(arbre, 'commune').props.value).toBe('');

    await appuyer(arbre, 'bouton-Créer — elle naîtra inactive');
    await attendre(() => mockPost.mock.calls.length > 0);
    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites', {
      data: {
        codeInsee: '13999', name: 'Ville de Valfleuri', siren: '213999999', type: 'commune',
      },
    });
  });

  it('une commune DÉJÀ sur FoundClub le dit, et ouvre sa fiche au lieu de remplir', async () => {
    const arbre = await monter();
    await taper(arbre, 'commune', 'Montr');
    await attendre(() => pressables(arbre, 'admin-collectivite-form-commune-13998').length > 0);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Montrivage', 'Déjà sur FoundClub']));
    await appuyer(arbre, 'admin-collectivite-form-commune-13998');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminCollectiviteDetail, {
      collectiviteId: 'ville-montrivage',
    });
    expect(champ(arbre, 'codeInsee').props.value).toBe('');
  });

  it('référentiel muet : la saisie à la main reste, et l écran le dit', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    const arbre = await monter();
    await taper(arbre, 'commune', 'Zzzz');
    await attendre(() => textes(arbre).some((texte) => texte.startsWith('Aucune commune')));
    expect(textes(arbre)).toContain(
      'Aucune commune trouvée : saisis son nom officiel et ses codes ci-dessous.',
    );
  });

  it('le champ n existe que pour le type « Commune »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'admin-collectivite-form-type-region');
    expect(champ(arbre, 'commune')).toBeUndefined();
  });
});

// 🧯 FINITIONS12-COLL (03/10) — point 5 : APRÈS UNE CRÉATION, LA RECHERCHE RENDAIT L'ANCIENNE
// RÉPONSE. Tournée T11 (C14) : juste après « Créer » la Ville de Montpellier, retaper « Montpel »
// rendait la réponse en cache (5 min), SANS « Déjà sur FoundClub » ; il fallait changer le texte.
// La création invalide la recherche (même clé de requête). ROUGE avant le lot.
describe('FINITIONS12-COLL point 5 — la recherche se relit après une création', () => {
  it('retaper le même texte juste après « Créer » dit « Déjà sur FoundClub »', async () => {
    let creee = false;
    mockGet.mockImplementation(async () => ({
      data: {
        data: [creee
          ? {
            ...VALFLEURI,
            collectivite: { documentId: 'ville-valfleuri', name: 'Ville de Valfleuri' },
          }
          : VALFLEURI],
      },
    }));
    mockPost.mockImplementation(async () => {
      creee = true;
      return { data: { data: { documentId: 'ville-valfleuri' } } };
    });
    const arbre = await monter();
    await taper(arbre, 'commune', 'Valf');
    await attendre(() => pressables(arbre, 'admin-collectivite-form-commune-13999').length > 0);
    await appuyer(arbre, 'admin-collectivite-form-commune-13999');
    await appuyer(arbre, 'bouton-Créer — elle naîtra inactive');
    await attendre(() => mockPost.mock.calls.length > 0);

    await taper(arbre, 'commune', '');
    await taper(arbre, 'commune', 'Valf');
    await attendre(() => textes(arbre).includes('Déjà sur FoundClub'));
    expect(textes(arbre)).toContain('Déjà sur FoundClub');
  });
});
