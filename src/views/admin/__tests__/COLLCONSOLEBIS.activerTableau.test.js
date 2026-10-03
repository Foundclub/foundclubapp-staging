import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteActivation from '../components/CollectiviteActivation';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 5 — « ACTIVER » SUR LE SITE (planche 16,
// `P2-fenetres-ordi`, état A) : la fenêtre centrée présente les clubs en TABLEAU À DEUX COLONNES,
// « Club rattaché » et « Ce qui change », sous la phrase « Chaque club rattaché, et ce qui change
// pour lui. ». ROUGE avant le lot : une liste groupée, comme sur le téléphone.
// Sur le téléphone, la liste groupée reste (témoin CollectiviteActivation.apercu).

const mockPut = jest.fn();
let mockLargeur = 1280;

jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(async () => ({ data: { data: [] } })),
    post: jest.fn(async () => ({ data: { data: [] } })),
    put: (/** @type {any[]} */ ...args) => mockPut(...args),
  },
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
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

const VERDICTS_ACTIVER = [
  { clubDocumentId: 'as-montrivage', name: 'AS Montrivage', offer: 'granted' },
  { clubDocumentId: 'basket', name: 'Montrivage Basket', offer: 'granted' },
  { clubDocumentId: 'montrivage-fc', name: 'Montrivage FC', offer: 'already-paid' },
];
const MONTRIVAGE = {
  activatedAt: null,
  clubs: [],
  clubsCount: 3,
  documentId: 'ville-montrivage',
  isActive: false,
  name: 'Ville de Montrivage',
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
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const attendre = async (/** @type {() => boolean} */ condition) => {
  const fin = Date.now() + 5000;
  while (!condition() && Date.now() < fin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((suite) => { setTimeout(suite, 10); }); });
  }
};
const fenetre = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => (
  n.props?.testID === 'collectivite-fenetre-etat' && n.props?.accessibilityViewIsModal))[0];
const ligne = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === `collectivite-fenetre-ligne-${id}`)[0];

const ouvrirActiver = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <CollectiviteActivation collectivite={MONTRIVAGE} />
      </QueryClientProvider>,
    );
  });
  const activer = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'bouton-Activer'
    && typeof n.props?.onPress === 'function')[0];
  await act(async () => { activer.props.onPress(); });
  await attendre(() => Boolean(fenetre(arbre)));
  return arbre;
};

beforeEach(() => {
  mockPut.mockReset();
  mockPut.mockResolvedValue({
    data: { data: { clubs: VERDICTS_ACTIVER, isActive: true, preview: true } },
  });
});

describe('COLL-CONSOLE-BIS — planche 16 : « Activer » en tableau sur le site', () => {
  it('sur le site : la phrase, « Club rattaché | Ce qui change », un club par ligne', async () => {
    mockLargeur = 1280;
    const arbre = await ouvrirActiver();
    const lus = textes(fenetre(arbre));
    expect(lus).toEqual(expect.arrayContaining([
      'Chaque club rattaché, et ce qui change pour lui.',
      'Club rattaché',
      'Ce qui change',
      'Offrir l’offre Club à 2 clubs',
    ]));
    expect(textes(ligne(arbre, 'as-montrivage')))
      .toEqual(['AS Montrivage', 'Reçoit l’offre Club offerte']);
    expect(textes(ligne(arbre, 'montrivage-fc')))
      .toEqual(['Montrivage FC', 'Paie déjà : rien ne change']);
    // Le tableau remplace la liste groupée.
    expect(lus).not.toContain('2 clubs recevront l’offre Club offerte :');
  });

  it('sur le téléphone : la liste groupée reste', async () => {
    mockLargeur = 390;
    const arbre = await ouvrirActiver();
    const lus = textes(fenetre(arbre));
    expect(lus).toContain('2 clubs recevront l’offre Club offerte :');
    expect(lus).not.toContain('Ce qui change');
  });
});
