import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

jest.mock('../CompositionAnswerBar', () => ({ __esModule: true, default: () => null }));

// ==========================================================================
// 📋 CONVLISTE (26/10, planche B4) — UNE CONVOCATION EN LISTE N'A PAS DE TERRAIN.
//
// Le serveur accepte deja une convocation sans placement et range chaque convoque au banc
// (`reservePlayers`). La carte dessinait pourtant TOUJOURS le mini-terrain — vide — et titrait
// « Sur le banc · 2 » : une liste se lisait comme une composition ratee.
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
  return {
    __esModule: true,
    default: ({ children }) => <View testID="mini-terrain">{children}</View>,
  };
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

const HUGO = { documentId: 'hugo', firstname: 'Hugo', lastname: 'Martin' };
const SAMI = { documentId: 'sami', firstname: 'Sami', lastname: 'Diallo' };

const EN_LISTE = {
  eventDate: '2026-11-01T09:00:00.000Z',
  eventDisplayName: 'Match vs AS Bron',
  eventId: 'evt-1',
  placements: [],
  publishedVersion: 1,
  reservePlayers: [HUGO, SAMI],
  schemaVersion: 3,
  snapshotPlayers: [],
  teamId: 'team-1',
  teamName: 'U13 A',
  teams: [{ id: 't1', placements: [] }],
  type: 'lineup_share',
};

const EN_COMPOSITION = {
  ...EN_LISTE,
  reservePlayers: [SAMI],
  snapshotPlayers: [HUGO],
  teams: [{ id: 't1', placements: [{ playerId: 'hugo', positionX: 50, positionY: 80 }] }],
};

/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ composition) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={composition} dansLaBulle />);
  });
  montes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ arbre) => {
  const { Text } = jest.requireActual('react-native');
  return arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => [n.props.children].flat().map((e) => String(e ?? '')).join(''));
};

const aUnTerrain = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props.testID === 'mini-terrain').length > 0;

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('CONVLISTE · la carte d une convocation en liste', () => {
  test('🥇 pas de mini-terrain ; « Convocation » ; « Convoqués · 2 » et les deux noms', () => {
    const arbre = monter(EN_LISTE);
    const vus = textes(arbre);

    expect(aUnTerrain(arbre)).toBe(false);
    expect(vus).toContain('Convocation');
    expect(vus).not.toContain('Composition publiée');
    expect(vus).toContain('Convoqués · 2');
    expect(vus).toContain('Hugo Martin · Sami Diallo');
    expect(vus).not.toContain('Sur le banc · 2');
    expect(vus).toContain('2 convoqués');
  });

  test('🔒 une composition garde son terrain, « Sur le terrain » et « Sur le banc »', () => {
    const arbre = monter(EN_COMPOSITION);
    const vus = textes(arbre);

    expect(aUnTerrain(arbre)).toBe(true);
    expect(vus).toContain('Composition publiée');
    expect(vus).toContain('Sur le terrain · 1');
    expect(vus).toContain('Sur le banc · 1');
  });
});
