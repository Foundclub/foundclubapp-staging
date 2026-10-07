import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import OffresFoundclubListe from '../OffresFoundclubListe';

// 🎁 OFFRIR-ABONNEMENT (07/10/2026) — la liste « Abonnements offerts » de la console SuperAdmin
// (panneau « Subscription Ops » de l accueil). ROUGE avant le lot : le composant n existait pas.
//   L1 — une ligne par offre : le club, l offre, depuis, jusqu’au (ou « Sans fin »), le motif ;
//   L2 — « Retirer » demande confirmation, retire CE club, puis la liste se relit ;
//   L3 — le nom du club ouvre sa fiche ; « Offrir à un club » ouvre la recherche des clubs ;
//   L4 — aucune offre : on le dit.
// Le client HTTP est doublé ; le VRAI i18next (fr.js) écrit les phrases.

jest.setTimeout(30000);

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

const LISTE = '/admin-dashboard/subscription-ops/foundclub-offers';

/** @type {any[]} */
let offres;

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const parTestID = (/** @type {any} */ noeud, /** @type {string} */ testID) => noeud.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
)[0];
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.findAll(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
)[0];
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let i = 0; i < 80 && !condition(); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
};

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <OffresFoundclubListe />
      </QueryClientProvider>,
    );
  });
  // eslint-disable-next-line max-len
  await attendre(() => Boolean(arbre.root.findAll((n) => n.props?.testID === 'offres-foundclub-liste')[0]));
  return arbre;
};

beforeEach(() => {
  offres = [
    {
      // eslint-disable-next-line max-len
      clubDocumentId: 'club-A', clubName: 'AS Offerte', planCode: 'fc_foundclub_club', reason: 'Club pilote', since: '2026-10-07T12:00:00.000Z', status: 'active', subscriptionDocumentId: 'sub-A', until: '2027-10-07T12:00:00.000Z',
    },
    {
      // eslint-disable-next-line max-len
      clubDocumentId: 'club-B', clubName: 'US Sans Fin', planCode: 'fc_foundclub_club', reason: null, since: '2026-09-01T12:00:00.000Z', status: 'active', subscriptionDocumentId: 'sub-B', until: null,
    },
  ];
  [mockGet, mockPost, mockNavigate].forEach((doublure) => doublure.mockReset());
  mockGet.mockImplementation(async (route) => {
    if (route === LISTE) return { data: { data: offres } };
    throw new Error(`GET inattendu ${route}`);
  });
  mockPost.mockImplementation(async (route) => {
    const club = /clubs\/([^/]+)\/foundclub-offer\/revoke$/.exec(route)?.[1];
    if (!club) throw new Error(`POST inattendu ${route}`);
    offres = offres.filter((offre) => offre.clubDocumentId !== club);
    return { data: { data: { offer: 'revoked' } } };
  });
});

// eslint-disable-next-line max-len
test('L1 — une ligne par offre : club, offre, depuis, jusqu’au ou « Sans fin », motif', async () => {
  const arbre = await monter();
  expect(textes(arbre.root)).toEqual(expect.arrayContaining([
    'Abonnements offerts',
    // eslint-disable-next-line max-len
    'AS Offerte', 'Club', 'Depuis le 7 octobre 2026', 'Jusqu’au 7 octobre 2027', 'Motif : Club pilote',
    'US Sans Fin', 'Depuis le 1 septembre 2026', 'Sans fin',
  ]));
});

test('L2 — « Retirer » demande confirmation, retire CE club, puis la liste se relit', async () => {
  const arbre = await monter();
  const ligne = arbre.root.findAll((n) => n.props?.testID === 'offres-foundclub-ligne-club-B')[0];
  await act(async () => { bouton(ligne, 'Retirer').props.onPress(); });
  expect(mockPost).not.toHaveBeenCalled();
  const confirmation = arbre.root.findAll(
    (n) => n.props?.testID === 'offre-foundclub-retrait' && n.props?.accessibilityViewIsModal,
  )[0];
  expect(textes(confirmation)).toContain('US Sans Fin');
  await act(async () => { bouton(confirmation, 'Retirer l’offre').props.onPress(); });
  await attendre(() => !textes(arbre.root).includes('US Sans Fin'));
  expect(mockPost).toHaveBeenCalledWith(
    '/admin-dashboard/subscription-ops/clubs/club-B/foundclub-offer/revoke',
    { data: { reason: '' } },
  );
  expect(textes(arbre.root)).toContain('AS Offerte');
});

// eslint-disable-next-line max-len
test('L3 — le nom du club ouvre sa fiche ; « Offrir à un club » ouvre la recherche des clubs', async () => {
  const arbre = await monter();
  await act(async () => { parTestID(arbre.root, 'offres-foundclub-club-club-A').props.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminClubDetail, { clubId: 'club-A' });
  await act(async () => { bouton(arbre.root, 'Offrir à un club').props.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminClubList);
});

test('L4 — aucune offre : on le dit', async () => {
  offres = [];
  const arbre = await monter();
  expect(textes(arbre.root)).toContain('Aucun abonnement offert pour l’instant.');
});
