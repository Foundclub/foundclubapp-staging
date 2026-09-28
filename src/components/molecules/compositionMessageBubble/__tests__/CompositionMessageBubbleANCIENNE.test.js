import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// BULLE (29/09) — la barre Present / Absent tire la couche de services (client
// HTTP). Cette suite ne l affiche jamais (matchs passes, ou lecteur absent de la
// carte) : elle est testee dans `CompositionMessageBubbleBULLE.test.js`.
jest.mock('../CompositionAnswerBar', () => ({ __esModule: true, default: () => null }));

// ==========================================================================
// COMPOMSG (suite, point 3) — LES VIEILLES CARTES « À PLAT » SE REDESSINENT.
//
// 🧪 Mesuré en production (chef d'orchestre, 23/09) : 15 cartes `lineup_share`,
// dont 7 postées du 13/05 au 15/06 SANS `schemaVersion` — la forme d'avant la
// v3 : `placements` à la racine, personnes dans `teamPlayers`.
//
// 🐛 Le défaut, consigné le 16/08 par `portesCompoAncienTerrain.test.js` : le
// drapeau « plusieurs équipes » valait `schemaVersion === 3 || Array.isArray(teams)`
// — et `teams` a `[]` pour valeur par défaut, donc le drapeau était TOUJOURS vrai.
// Les placements à plat n'étaient jamais lus : ni jeton, ni nom, ni compte.
// ==========================================================================

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

// La forme exacte des cartes de mai-juin : pas de `schemaVersion`, pas de `teams`.
const ANCIENNE = {
  eventDate: '2026-06-14T15:00:00.000Z',
  eventId: 'evt-ancien',
  eventName: 'Match amical',
  placements: [
    { playerId: 'j1', positionX: 50, positionY: 50 },
    { playerId: 'j2', positionX: 30, positionY: 80 },
  ],
  sport: 'football',
  teamName: 'Les Bleus',
  teamPlayers: [
    { documentId: 'j1', firstname: 'Ada', lastname: 'Lovelace' },
    { documentId: 'j2', firstname: 'Alan', lastname: 'Turing' },
  ],
  type: 'lineup_share',
};

/** @type {any[]} */
const montes = [];

const rendre = (/** @type {any} */ composition) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={composition} />);
  });
  montes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ noeud) => {
  const { Text } = jest.requireActual('react-native');
  return noeud.findAllByType(Text)
    .map((/** @type {any} */ n) => [n.props.children].flat().map((e) => String(e ?? '')).join(''));
};

beforeEach(() => mockNavigate.mockClear());

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('COMPOMSG · point 3 — une carte de mai-juin se redessine', () => {
  test('🥇 les jetons sont posés sur le terrain', () => {
    const [terrain] = rendre(ANCIENNE).root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'mini-terrain',
    );

    expect(textes(terrain)).toEqual(expect.arrayContaining(['AL', 'AT']));
  });

  test('🥇 les noms sont écrits, et le pied compte les convoqués', () => {
    const tous = textes(rendre(ANCIENNE).root).join(' | ');

    expect(tous).toContain('Ada Lovelace');
    expect(tous).toContain('Alan Turing');
    expect(tous).toContain('2 convoqués');
  });

  test('🥇 la toucher ouvre le MÊME plein écran, qui relit la dernière version', () => {
    const { TouchableOpacity } = jest.requireActual('react-native');
    const carte = rendre(ANCIENNE).root.findAllByType(TouchableOpacity)[0];

    act(() => { carte.props.onPress(); });

    const [, cible] = mockNavigate.mock.calls.pop();
    expect(cible.screen).toBe('MatchCompositionBoard');
    expect(cible.params.readOnly).toBe(true);
    expect(cible.params.refreshFromServer).toBe(true);
    expect(cible.params.startPlacements.map((/** @type {any} */ p) => p.playerId))
      .toEqual(['j1', 'j2']);
  });

  test('🔒 une carte v3 SANS équipe (liste vide) reste lue comme avant', () => {
    const tous = textes(rendre({ ...ANCIENNE, schemaVersion: 3, teams: [] }).root).join(' | ');

    expect(tous).not.toContain('Ada Lovelace');
  });
});
