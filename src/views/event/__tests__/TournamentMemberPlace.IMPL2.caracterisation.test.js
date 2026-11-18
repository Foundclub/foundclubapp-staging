/* eslint-disable max-len, jsdoc/require-description, jsdoc/require-returns -- les témoins se lisent en entier. */
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { TournamentMemberPlace, TournamentPlacesSummary } from '../TournamentMemberPlace';

// IMPL-2-EQUIPE (18/11/2026) — TÉMOIN CARACTÉRISANT de TournamentMemberPlace (E6 : aucun test ne le
// citait). Posé AVANT les retouches des planches 4 et 10 : il décrit ce que la ligne fait aujourd'hui
// (libellés, boutons et leur effet). Une retouche voulue change l'attendu ici, en le disant.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, {
      accessibilityLabel: props.title, onPress: props.onPress,
    }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrlHere: jest.fn() } }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { copier: jest.fn(async () => true) } }));

/** @type {any} */
const LinksPlatform = jest.requireMock('@/platform/links').default;
/** @type {any} */
const SharePlatform = jest.requireMock('@/platform/share').default;

/** @param {any} element */
const monter = (element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre;
};
/** @param {any} arbre */
const textes = (arbre) => arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.children === 'string')
  .map((/** @type {any} */ n) => n.props.children);
/**
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Le libellé.
 */
const bouton = (arbre, titre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === titre && n.props?.onPress)[0];

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });

describe('TournamentMemberPlace (caractérisant)', () => {
  it('sans place : rien', () => {
    const arbre = monter(<TournamentMemberPlace place={undefined} />);
    expect(arbre.toJSON()).toBeNull();
  });

  it('place payée : « Place payée », aucun bouton', () => {
    const arbre = monter(<TournamentMemberPlace place={{ isSelf: true, status: 'paid' }} />);
    expect(textes(arbre)).toContain('Place payée');
    expect(bouton(arbre, 'Payer ma place')).toBeUndefined();
    expect(bouton(arbre, 'Copier le lien de paiement')).toBeUndefined();
  });

  it('sa propre place due, avec lien : « Payer ma place » ouvre la page dans le même onglet', () => {
    const arbre = monter(<TournamentMemberPlace place={{ isSelf: true, paymentUrl: 'https://x/pay/1', status: 'due' }} />);
    expect(textes(arbre)).toContain('Place à payer');
    act(() => { bouton(arbre, 'Payer ma place').props.onPress(); });
    expect(LinksPlatform.openUrlHere).toHaveBeenCalledWith('https://x/pay/1');
  });

  it('showSelfPay faux : pas de « Payer ma place » sur sa propre ligne', () => {
    const arbre = monter(<TournamentMemberPlace place={{ isSelf: true, paymentUrl: 'https://x/pay/1', status: 'due' }} showSelfPay={false} />);
    expect(bouton(arbre, 'Payer ma place')).toBeUndefined();
  });

  it('la place due d’un autre, vue de qui gère : « Copier le lien de paiement » copie le lien', async () => {
    const arbre = monter(<TournamentMemberPlace place={{ isSelf: false, paymentUrl: 'https://x/pay/2', status: 'due' }} />);
    await act(async () => { await bouton(arbre, 'Copier le lien de paiement').props.onPress(); });
    expect(SharePlatform.copier).toHaveBeenCalledWith('https://x/pay/2');
    expect(Alert.alert).toHaveBeenCalledWith('Lien copié', 'Envoie-le au joueur ou à son parent.');
  });

  it('la place due d’un autre sans lien (simple membre) : ni copie ni paiement', () => {
    const arbre = monter(<TournamentMemberPlace place={{ isSelf: false, paymentUrl: null, status: 'due' }} />);
    expect(textes(arbre)).toContain('Place à payer');
    expect(bouton(arbre, 'Copier le lien de paiement')).toBeUndefined();
  });

  it('taille de maillot : choisie, ou « Taille : au paiement » tant que la place est due ; clé absente = rien', () => {
    expect(textes(monter(<TournamentMemberPlace place={{ jerseySize: 'L', status: 'paid' }} />))).toContain('Taille choisie : L');
    expect(textes(monter(<TournamentMemberPlace place={{ jerseySize: null, status: 'due' }} />))).toContain('Taille : au paiement');
    const sans = textes(monter(<TournamentMemberPlace place={{ status: 'due' }} />));
    expect(sans.some((t) => /Taille/.test(t))).toBe(false);
  });
});

describe('TournamentPlacesSummary (caractérisant)', () => {
  it('le résumé des places', () => {
    const arbre = monter(<TournamentPlacesSummary payment={{ entryFeeCents: 2000, paidCount: 2, paidMembersToValidate: 5 }} />);
    expect(textes(arbre).join(' ')).toMatch(/2\/5/);
  });
  it('sans bloc de paiement : rien', () => {
    expect(monter(<TournamentPlacesSummary payment={undefined} />).toJSON()).toBeNull();
  });
});
