/* eslint-disable max-len -- les phrases de l’écran sont citées en entier */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminCollectiviteInvitations from '../AdminCollectiviteInvitations';

// 🏛️ VILLE-INVITER-CLUB, VOIE 3 (07/10/2026) — « collectivité A » d'Adel : « Prévenir ma mairie »
// laisse une PISTE pour l'équipe FoundClub et ses agents commerciaux. La console la lit dans un
// 4e onglet « Pistes » de « Rattachements et invitations ».
//
// Ce que ce témoin fige (ROUGE avant : l'onglet n'existait pas) :
//   P1 — « Pistes (n) » : le club, la mairie à contacter (commune et code), la date, le contact
//        GÉNÉRAL du club ; un club rattaché depuis le dit ;
//   P2 — sans piste : on le dit.
// Le client HTTP est doublé ; le VRAI i18next (fr.js) écrit les phrases.

const mockGet = jest.fn();
jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: (...args) => mockGet(...args),
    post: jest.fn(),
    put: jest.fn(),
  },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), setParams: jest.fn() }),
  useRoute: () => ({ params: { onglet: 'pistes' } }),
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
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN, View: Vue } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options }) {
    return reactActuel.createElement(Vue, null, options.map((option) => reactActuel.createElement(
      PressableRN,
      { key: option.value, onPress: () => onChange(option.value), testID: `onglet-${option.value}` },
      reactActuel.createElement(TexteRN, null, option.label),
    )));
  };
});

/** @type {any[]} */
let mockPistes;

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let i = 0; i < 80 && !condition(); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
};
const parTestID = (/** @type {any} */ noeud, /** @type {string} */ testID) => noeud.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}><AdminCollectiviteInvitations /></QueryClientProvider>,
    );
  });
  await attendre(() => textes(arbre.root).some((texte) => texte.startsWith('Pistes (')));
  return arbre;
};

beforeEach(() => {
  mockPistes = [{
    attached: false,
    club: {
      cityName: 'Montrivage', documentId: 'judo-e', email: 'contact@judo.example.invalid', name: 'Judo Club E', phoneNumber: '04 00 00 00 00', websiteUrl: null,
    },
    communeCode: '13055',
    communeName: 'Montrivage',
    createdAt: '2026-10-07T12:00:00.000Z',
    documentId: 'piste-1',
  }, {
    attached: true,
    club: {
      cityName: 'Portvieux', documentId: 'hand-h', email: null, name: 'Hand H', phoneNumber: null, websiteUrl: null,
    },
    communeCode: null,
    communeName: 'Portvieux',
    createdAt: '2026-10-05T12:00:00.000Z',
    documentId: 'piste-2',
  }];
  mockGet.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ route) => {
    if (route === '/superadmin/collectivite-invitations') return { data: { data: [] } };
    if (route === '/superadmin/collectivite-leads') return { data: { data: mockPistes } };
    throw new Error(`GET inattendu ${route}`);
  });
});

describe('VINV voie 3 · la console lit les pistes « Prévenir ma mairie »', () => {
  it('P1 « Pistes (2) » : le club, la mairie à contacter, la date, son contact général ; un club rattaché depuis le dit', async () => {
    const arbre = await monter();
    await attendre(() => Boolean(parTestID(arbre.root, 'piste-piste-1')));
    expect(textes(arbre.root)).toContain('Pistes (2)');
    expect(textes(parTestID(arbre.root, 'piste-piste-1'))).toEqual(expect.arrayContaining([
      'Judo Club E',
      'Mairie à contacter : Montrivage (13055)',
      'Signalée par un dirigeant le mer. 7 oct.',
      'contact@judo.example.invalid',
      '04 00 00 00 00',
    ]));
    expect(textes(parTestID(arbre.root, 'piste-piste-2'))).toEqual(expect.arrayContaining([
      'Hand H', 'Mairie à contacter : Portvieux', 'Rattaché depuis à une collectivité : rien à faire.',
    ]));
  });

  it('P2 aucune piste : on le dit', async () => {
    mockPistes = [];
    const arbre = await monter();
    await attendre(() => textes(arbre.root).includes('Pistes (0)'));
    expect(textes(arbre.root)).toContain('Aucune piste « Prévenir ma mairie » pour l’instant.');
  });
});
