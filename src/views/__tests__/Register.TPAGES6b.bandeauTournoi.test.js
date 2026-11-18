/* eslint-disable max-len -- phrases et doublures recopiées telles quelles */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { retenirLInscriptionAuTournoi } from '@/domains/tournoi/inscriptionEnCours';

import Register from '@/views/Register';

/**
 * T-PAGES-6b (18/11/2026, point 6 de T-PAGES-6) — L'ÉCRAN DU NUMÉRO RAPPELLE LE TOURNOI. Le
 * visiteur venu d'un tournoi (fiche ou lien d'équipe) lit en tête « Tournoi FoundClub x AR Soccer ·
 * Sam. 19 déc. » (ou « Tu rejoins <équipe> · <tournoi> »), et le bouton dit « Recevoir mon code ».
 * Sans tournoi retenu, l'écran est celui de tout le monde (« Créer ton compte »).
 * ROUGE avant le lot : ni bandeau ni libellé.
 */

const mockRangement = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ options) => (
      jest.requireActual('i18next').t(cle, options)
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    cancelAddAccount: jest.fn(),
    canShowCodeButton: false,
    confirm: jest.fn(),
    isAddingAccount: false,
    isLoading: false,
    loginMutation: { error: null },
    otpMutation: { error: null, isPending: false, mutate: jest.fn() },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Images: new Proxy({}, { get: () => 1 }),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/organisms/otpForm/OTPForm', () => () => null);
jest.mock(
  '@/components/templates/FormScreenContainer',
  () => (/** @type {any} */ { children }) => children,
);
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => () => null);

/**
 * Les textes visibles de l'écran.
 * @param {import('react-test-renderer').ReactTestRenderer} arbre - L'écran rendu
 * @returns {string[]} Les textes visibles
 */
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string').join(''))
  .filter(Boolean);

/**
 * Le bouton qui porte ce texte.
 * @param {import('react-test-renderer').ReactTestRenderer} arbre - L'écran rendu
 * @param {string} libelle - Le texte du bouton
 * @returns {any} Le bouton qui porte ce texte
 */

const TOURNOI = {
  date: '2026-12-19T18:00:00.000Z', documentId: 'evt-3442', name: 'Tournoi FoundClub x AR Soccer',
};

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<Register navigation={{ navigate: jest.fn() }} />); });
  return arbre;
};

beforeEach(() => mockRangement.clear());

describe('T-PAGES-6b — l écran du numéro rappelle le tournoi', () => {
  it('🔴 venu de la fiche : le tournoi et son jour, et « Recevoir mon code »', () => {
    retenirLInscriptionAuTournoi({ event: TOURNOI });
    const vus = textes(monter());
    expect(vus).toContain('Tournoi FoundClub x AR Soccer · Sam. 19 déc.');
    expect(vus).toContain('Recevoir mon code');
    expect(vus).not.toContain('Créer ton compte');
  });

  it('🔴 venu d un lien d équipe : « Tu rejoins <équipe> · <tournoi> »', () => {
    retenirLInscriptionAuTournoi({ equipe: 'Les Kaïras', event: TOURNOI });
    const vus = textes(monter());
    expect(vus).toContain('Tu rejoins Les Kaïras · Tournoi FoundClub x AR Soccer');
    expect(vus).toContain('Recevoir mon code');
  });

  it('caractérisant : sans tournoi retenu, le tunnel est inchangé', () => {
    const arbre = monter();
    const vus = textes(arbre);
    expect(vus).toContain('Crée ton compte');
    expect(vus).toContain('Créer ton compte');
    expect(vus).not.toContain('Recevoir mon code');
    expect(arbre.root.findAll((n) => n.props.testID === 'bandeau-tournoi-en-cours')).toHaveLength(0);
  });
});
