import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import AdminCollectiviteForm from '../AdminCollectiviteForm';

// 🏛️ D61 (29/09) — ÉCRAN 3 : créer une collectivité depuis la console super-admin.
//
// Ce que ce témoin fige (ROUGE avant l écran 3 : le module n existait pas) :
//   - AIDE (D59) : choisir le type pose son début officiel dans le champ (« Ville de »,
//     « Département de »…) sans écraser un nom déjà tapé, et montre un exemple ;
//   - CONTRÔLE : un nom hors forme officielle, un code INSEE faux, ni INSEE ni SIREN → rien
//     ne part, chaque faute est dite ;
//   - CRÉER : POST /superadmin/collectivites { data } avec les seuls champs remplis, puis
//     le détail de la collectivité créée REMPLACE le formulaire ;
//   - un refus du serveur (409 : code déjà pris) s affiche, on reste sur le formulaire.

const mockPost = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: (...args) => mockPost(...args),
    put: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: mockReplace }),
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
 * Laisse tourner react-query jusqu a ce que la condition tienne (borne).
 * @param {() => boolean} condition - Ce qu on attend.
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  for (let i = 0; i < 80 && !condition(); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
};

const monter = async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}><AdminCollectiviteForm /></QueryClientProvider>,
    );
  });
  return arbre;
};

// eslint-disable-next-line max-len
const champ = (/** @type {any} */ arbre, /** @type {string} */ cle) => arbre.root.findAllByType(TextInput)
  .find((/** @type {any} */ n) => n.props.testID === `admin-collectivite-form-${cle}`);
// eslint-disable-next-line max-len
const taper = async (/** @type {any} */ arbre, /** @type {string} */ cle, /** @type {string} */ texte) => {
  await act(async () => { champ(arbre, cle).props.onChangeText(texte); });
};
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ type) => {
  const puce = arbre.root.find((/** @type {any} */ n) => (
    // eslint-disable-next-line max-len
    n.props?.testID === `admin-collectivite-form-type-${type}` && typeof n.props?.onPress === 'function'));
  await act(async () => { puce.props.onPress(); });
};
const creer = async (/** @type {any} */ arbre) => {
  const bouton = arbre.root.find((/** @type {any} */ n) => (
    n.props?.testID === 'bouton-Créer' && typeof n.props?.onPress === 'function'));
  await act(async () => { bouton.props.onPress(); });
};

beforeEach(() => {
  mockPost.mockReset();
  mockReplace.mockReset();
});

describe('D61 — écran 3 : créer une collectivité', () => {
  // eslint-disable-next-line max-len
  it('AIDE : le début officiel est posé selon le type, avec un exemple ; un nom tapé est gardé', async () => {
    const arbre = await monter();
    expect(champ(arbre, 'name').props.value).toBe('Ville de ');
    expect(textes(arbre)).toContain(
      // eslint-disable-next-line max-len
      'Forme officielle, par exemple « Ville de Montrivage » ou « Ville d’Aix ». C’est ce nom qu’affiche le bandeau « Offert par… » des clubs.',
    );

    await choisir(arbre, 'departement');
    expect(champ(arbre, 'name').props.value).toBe('Département de ');
    expect(textes(arbre)).toContain(
      // eslint-disable-next-line max-len
      'Forme officielle, par exemple « Département du Var ». C’est ce nom qu’affiche le bandeau « Offert par… » des clubs.',
    );

    await choisir(arbre, 'intercommunalite');
    expect(champ(arbre, 'name').props.value).toBe('Communauté de communes ');

    await taper(arbre, 'name', 'Métropole Aix-Marseille-Provence');
    await choisir(arbre, 'region');
    expect(champ(arbre, 'name').props.value).toBe('Métropole Aix-Marseille-Provence');
  });

  // eslint-disable-next-line max-len
  it('CONTRÔLE : nom hors forme officielle, ni INSEE ni SIREN → rien ne part, chaque faute est dite', async () => {
    const arbre = await monter();
    await taper(arbre, 'name', 'Montrivage');
    await creer(arbre);
    expect(mockPost).not.toHaveBeenCalled();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      // eslint-disable-next-line max-len
      'Le nom doit suivre la forme officielle, par exemple « Ville de Montrivage » ou « Ville d’Aix » : c’est lui qu’affiche le bandeau « Offert par… ».',
      'Un code INSEE ou un SIREN est obligatoire.',
    ]));

    await taper(arbre, 'name', 'Ville de Montrivage');
    await taper(arbre, 'codeInsee', '9901');
    await creer(arbre);
    expect(mockPost).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Code INSEE : 5 caractères (2A ou 2B en Corse).');
  });

  // eslint-disable-next-line max-len
  it('CRÉER : POST /superadmin/collectivites { data }, puis le détail remplace le formulaire', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          // eslint-disable-next-line max-len
          codeInsee: '99001', documentId: 'nouvelle-ville', name: 'Ville de Montrivage', type: 'commune',
        },
      },
    });
    const arbre = await monter();
    await taper(arbre, 'name', ' Ville de Montrivage ');
    await taper(arbre, 'codeInsee', '99001');
    await taper(arbre, 'email', 'sports@montrivage.example.invalid');
    await creer(arbre);
    await attendre(() => mockReplace.mock.calls.length > 0);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites', {
      data: {
        codeInsee: '99001',
        email: 'sports@montrivage.example.invalid',
        name: 'Ville de Montrivage',
        type: 'commune',
      },
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.AdminCollectiviteDetail, {
      collectiviteId: 'nouvelle-ville',
    });
  });

  it('un code déjà pris (409) : le refus s affiche, on reste sur le formulaire', async () => {
    mockPost.mockRejectedValue({
      response: {
        data: { error: { details: { code: 'COLLECTIVITE_ALREADY_EXISTS' }, status: 409 } },
        status: 409,
      },
    });
    const arbre = await monter();
    await choisir(arbre, 'region');
    await taper(arbre, 'name', 'Région Sud');
    await taper(arbre, 'siren', '200 053 403');
    await creer(arbre);
    const refus = 'Une collectivité porte déjà ce code INSEE ou ce SIREN.';
    await attendre(() => textes(arbre).includes(refus));

    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites', {
      data: { name: 'Région Sud', siren: '200053403', type: 'region' },
    });
    expect(textes(arbre)).toContain(refus);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
