import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// ==========================================================================
// COMPOMSG (suite, 23/09) — LA CARTE TITRE LE MATCH, ET RANGE LE RDV À PART.
//
// 🧪 Mesuré en production (chef d'orchestre, lecture seule) : le match d'Adel a
// un `name` VIDE et sa `description` vaut « RDV 19h30 au stade de Pelisanne ».
// La charge du fil n'avait que `eventName` = `name || description` : la carte
// titrait donc le RDV, là où « Tu es convoqué » écrivait « Match vs US Pelican ».
//
// ✅ Le serveur envoie désormais deux champs séparés (`eventDisplayName`,
// `eventNote`). Les cartes DÉJÀ postées ne les ont pas : elles gardent leur
// titre d'hier (`eventName`), sans rien perdre.
// ==========================================================================

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/store/authRuntime', () => ({ getAuthRuntimeSnapshot: () => ({ auth: undefined }) }));
jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <View>{children}</View> };
});
jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
    }),
  };
});

const RDV = 'RDV 19h30 au stade de Pelisanne';

const CARTE = {
  eventAddress: 'Pélissanne (13330)',
  eventDate: '2026-09-28T16:00:00.000Z',
  eventDisplayName: 'Match vs US Pelican',
  eventId: 'evt-1',
  eventName: RDV,
  eventNote: RDV,
  publishedVersion: 1,
  reservePlayers: [],
  schemaVersion: 3,
  snapshotPlayers: [{ documentId: 'j1', firstname: 'Adel', lastname: 'Ferchichi' }],
  teamName: 'Aix-Perd en Buvette',
  teams: [{ id: 't1', placements: [{ playerId: 'j1', positionX: 50, positionY: 20 }] }],
  type: 'lineup_share',
};

/** @type {any[]} */
const montes = [];

const textes = (/** @type {any} */ composition) => {
  const { Text } = jest.requireActual('react-native');
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={composition} />);
  });
  montes.push(arbre);
  return arbre.root.findAllByType(Text).map((/** @type {any} */ n) => ({
    lignes: n.props.numberOfLines,
    texte: [n.props.children].flat().map((e) => String(e ?? '')).join(''),
  }));
};

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('COMPOMSG · la carte titre le MATCH et range le RDV à part', () => {
  test('🥇 le titre est « Match vs US Pelican », sur deux lignes au plus', () => {
    const titre = textes(CARTE).find((t) => t.texte === 'Match vs US Pelican');

    expect(titre).toBeDefined();
    expect(titre?.lignes).toBe(2);
  });

  test('🥇 le RDV de l’entraîneur est écrit UNE fois, sous « Infos »', () => {
    const tous = textes(CARTE).map((t) => t.texte);

    expect(tous.filter((t) => t.includes(RDV))).toHaveLength(1);
    expect(tous).toContain('Infos');
  });

  test('🔒 une carte DÉJÀ postée (sans les deux champs) garde son titre d’hier', () => {
    const { eventDisplayName, eventNote, ...ancienne } = CARTE;
    const tous = textes(ancienne).map((t) => t.texte);

    expect(tous).toContain(RDV);
    expect(tous).not.toContain('Infos');
    expect(tous).not.toContain('Match vs US Pelican');
  });

  test('🔒 un texte libre identique au titre n’est pas répété', () => {
    const tous = textes({ ...CARTE, eventDisplayName: RDV }).map((t) => t.texte);

    expect(tous.filter((t) => t.includes(RDV))).toHaveLength(1);
    expect(tous).not.toContain('Infos');
  });
});
