import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminCollectiviteDetail from '../AdminCollectiviteDetail';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 4 — LA FICHE D'UNE COLLECTIVITÉ (planche 15,
// `P2-fiche-tel` / `-ordi`). ROUGE avant le lot ; la tournée T10 l'avait vue sans ces éléments :
//   - la recherche de clubs à rattacher dit la VILLE et le SPORT de chaque club, et range d'abord
//     les clubs de la commune, puis ceux du département (la proximité) ;
//   - chaque club rattaché dit sa ville ;
//   - chaque installation a sa PASTILLE DE COULEUR (celle du planning) devant son nom ;
//   - chaque gestionnaire a un ROND à ses initiales (plus un écusson de club) et son e-mail ; un
//     e-mail de remplissage (`…@example.com`, posé à la création d'un compte par téléphone, il
//     porte le numéro) ne s'affiche pas. Vu du SuperAdmin seul (route gardée par
//     global::is-superadmin, témoin admin COLL-CONSOLE-BIS-4).

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: (/** @type {any[]} */ ...args) => mockGet(...args),
    post: (/** @type {any[]} */ ...args) => mockPost(...args),
    put: (/** @type {any[]} */ ...args) => mockPut(...args),
  },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { collectiviteId: 'ville-montrivage' } }),
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
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
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

const EXPLORATEUR = '/superadmin/content/api%3A%3Acollectivite.collectivite/list';
const RECHERCHE_CLUB = '/superadmin/relations/api%3A%3Aclub.club/search';
const COULEUR_DOJO = '#4D79FF';

const ligneServeur = () => ({
  activatedAt: null,
  clubs: [{
    addressDetails: null,
    cityName: 'Montrivage',
    documentId: 'as-montrivage',
    logo: null,
    name: 'AS Montrivage',
  }],
  codeInsee: '13998',
  documentId: 'ville-montrivage',
  gestionnaires: [
    {
      documentId: 'karim',
      email: 'karim@montrivage.fr',
      firstname: 'Karim',
      lastname: 'Benali',
      phoneNumber: '+33600000012',
    },
    {
      documentId: 'paul',
      email: '33600000011@example.com',
      firstname: 'Paul',
      lastname: 'Agent',
      phoneNumber: '+33600000011',
    },
  ],
  installations: [{
    documentId: 'dojo',
    maxSlots: 1,
    name: 'Dojo municipal',
    planningColor: COULEUR_DOJO,
    type: 'Dojo',
  }],
  isActive: true,
  name: 'Ville de Montrivage',
  siren: null,
  type: 'commune',
});

// Trois clubs trouvés, dans l'ordre alphabétique du serveur : loin, département, commune.
const CLUBS_TROUVES = [
  {
    documentId: 'club-loin',
    label: 'Montrivage Athlé (Lyon)',
    raw: { activites: [{ name: 'Athlétisme' }], cityName: 'Lyon', inseeCom: '69123' },
  },
  {
    documentId: 'club-dep',
    label: 'Montrivage Judo',
    raw: { activites: [{ name: 'Judo' }], cityName: 'Aubagne', inseeCom: '13005' },
  },
  {
    documentId: 'club-commune',
    label: 'Montrivage Basket',
    raw: { activites: [{ name: 'Basket' }], cityName: 'Montrivage', inseeCom: '13998' },
  },
];

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
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const attendre = async (/** @type {() => boolean} */ condition) => {
  const fin = Date.now() + 5000;
  while (!condition() && Date.now() < fin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((suite) => { setTimeout(suite, 10); }); });
  }
};
const parTestID = (/** @type {any} */ noeud, /** @type {string} */ testID) => noeud
  .findAll((/** @type {any} */ n) => n.props?.testID === testID)[0];

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}><AdminCollectiviteDetail /></QueryClientProvider>,
    );
  });
  await attendre(() => textes(arbre.root).includes('Ville de Montrivage'));
  return arbre;
};

beforeEach(() => {
  [mockGet, mockPost, mockPut].forEach((doublure) => doublure.mockReset());
  mockGet.mockResolvedValue({ data: { data: [] } });
  mockPut.mockResolvedValue({ data: { data: { clubs: [], preview: true } } });
  mockPost.mockImplementation(async (/** @type {string} */ route) => {
    if (route === EXPLORATEUR) return { data: { data: [ligneServeur()], meta: {} } };
    if (route === RECHERCHE_CLUB) return { data: { data: CLUBS_TROUVES } };
    return { data: { data: [] } };
  });
});

describe('COLL-CONSOLE-BIS — planche 15 : la fiche d une collectivité', () => {
  it('chaque club rattaché dit sa ville', async () => {
    const arbre = await monter();
    expect(textes(parTestID(arbre.root, 'admin-collectivite-club-as-montrivage')))
      .toEqual(expect.arrayContaining(['AS Montrivage', 'Montrivage']));
  });

  it('chaque installation a sa pastille de couleur, celle du planning', async () => {
    const arbre = await monter();
    const pastille = parTestID(arbre.root, 'admin-collectivite-installation-dojo-couleur');
    expect(pastille).toBeDefined();
    const style = [pastille.props.style].flat(Infinity)
      .reduce((tout, s) => ({ ...tout, ...s }), {});
    expect(style.backgroundColor).toBe(COULEUR_DOJO);
  });

  it('un gestionnaire : un rond à ses initiales, son e-mail ; jamais un remplissage', async () => {
    const arbre = await monter();
    const karim = parTestID(arbre.root, 'admin-collectivite-gestionnaire-karim');
    expect(textes(karim))
      .toEqual(expect.arrayContaining(['KB', 'Karim Benali', 'karim@montrivage.fr']));
    const paul = parTestID(arbre.root, 'admin-collectivite-gestionnaire-paul');
    expect(textes(paul)).toEqual(expect.arrayContaining(['PA', 'Paul Agent']));
    expect(textes(paul).some((texte) => texte.includes('33600000011'))).toBe(false);
  });

  it('la recherche de clubs : ville et sport ; la commune, puis le département', async () => {
    const arbre = await monter();
    const champ = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
      && n.props.testID === 'admin-collectivite-recherche-club')[0];
    await act(async () => { champ.props.onChangeText('Montriv'); });
    const premier = 'admin-collectivite-recherche-club-resultat-club-loin';
    await attendre(() => Boolean(parTestID(arbre.root, premier)));

    const appel = mockPost.mock.calls.find(([route]) => route === RECHERCHE_CLUB);
    expect(appel[1].fields).toEqual(expect.arrayContaining(['cityName', 'inseeCom']));
    expect(appel[1].populate).toEqual({ activites: { fields: ['name'] } });

    const prefixe = 'admin-collectivite-recherche-club-resultat-';
    const ordre = arbre.root
      .findAll((/** @type {any} */ n) => String(n.props?.testID || '').startsWith(prefixe))
      .map((/** @type {any} */ n) => n.props.testID.replace(prefixe, ''))
      .filter((id, index, tous) => tous.indexOf(id) === index);
    expect(ordre).toEqual(['club-commune', 'club-dep', 'club-loin']);
    expect(textes(parTestID(arbre.root, 'admin-collectivite-recherche-club-resultat-club-commune')))
      .toContain('Montrivage · Basket');
  });
});
