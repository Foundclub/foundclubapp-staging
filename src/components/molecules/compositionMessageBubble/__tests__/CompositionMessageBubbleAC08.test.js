import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// ==========================================================================
// AC08 — TEMOIN 7 : la bulle de compo du tchat mene au BON ecran.
//
// 🗣️ Adel (D-23) : « quand on clique pour ouvrir la compo, c'est nul. Ce que je
// veux voir, c'est le terrain avec les joueurs places et le banc, et si jamais
// c'est demande, repondre present / absent. »
//
// 🧨 Mesure : la carte envoyait TOUT LE MONDE — convoques compris — sur
// `TacticalBoardV2` en lecture seule, c'est-a-dire le tableau du coach
// desactive, sans aucun bouton pour repondre.
//
// ♻️ L'identite se lit dans l'instantane d'authentification, le MEME que
// `client.native.js` interroge avant chaque requete : `useAuth` tirerait tout le
// client HTTP dans une carte de tchat qui n'appelle rien.
// ==========================================================================

const mockNavigate = jest.fn();
/** @type {any} */
let mockSnapshot;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => mockSnapshot,
}));

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => <View>{children}</View> };
});

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
      Spaces,
    }),
  };
});

const JOUEUR = 'joueur-1';
const REMPLACANT = 'joueur-2';

const COMPO = {
  eventAddress: 'Stade Georges Ricard, 13710 Fuveau',
  eventDate: '2026-08-24T18:30:00.000Z',
  eventId: 'evt-1',
  eventName: 'US Fuveau - AS Gardanne',
  placements: [],
  publishedVersion: 2,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Leo', lastname: 'Diarra' }],
  schemaVersion: 3,
  snapshotPlayers: [{ documentId: JOUEUR, firstname: 'Karim', lastname: 'Sylla' }],
  teamName: 'U15 A',
  teams: [{
    id: 't1',
    name: 'U15 A',
    placements: [{ playerId: JOUEUR, positionX: 50, positionY: 90 }],
  }],
  type: 'lineup_share',
};

/** @type {any} */
let monte = null;

const appuyerSurLaCarte = (/** @type {any} */ compo = COMPO) => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  act(() => {
    monte = renderer.create(<CompositionMessageBubble composition={compo} />);
  });
  const carte = monte.root.findAllByType(TouchableOpacity)[0];
  act(() => {
    carte.props.onPress();
  });
};

const derniereRoute = () => {
  const call = [...mockNavigate.mock.calls].pop();
  return call ? call[1] : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot = { auth: { user: { documentId: JOUEUR } } };
});

afterEach(() => {
  if (monte) {
    act(() => {
      monte.unmount();
    });
    monte = null;
  }
});

describe('AC08 · TEMOIN 7 — la bulle du tchat mene au bon ecran', () => {
  test('🥇 un joueur PLACE part sur son ecran de convocation', () => {
    appuyerSurLaCarte();

    expect(derniereRoute()).toEqual({
      params: { eventId: 'evt-1' },
      screen: 'PlayerConvocation',
    });
  });

  test('un REMPLACANT y part aussi', () => {
    mockSnapshot = { auth: { user: { documentId: REMPLACANT } } };

    appuyerSurLaCarte();

    expect(derniereRoute()?.screen).toBe('PlayerConvocation');
  });

  test('🔒 un non-convoque garde la vue d ensemble en lecture seule', () => {
    mockSnapshot = { auth: { user: { documentId: 'spectateur-9' } } };

    appuyerSurLaCarte();

    expect(derniereRoute()?.screen).toBe('TacticalBoardV2');
    expect(derniereRoute()?.params?.readOnly).toBe(true);
  });

  test('🔒 sans personne connectee, rien ne change non plus', () => {
    mockSnapshot = { auth: undefined };

    appuyerSurLaCarte();

    expect(derniereRoute()?.screen).toBe('TacticalBoardV2');
  });

  test('⛔ une carte SANS evenement rattache ne peut mener a aucune convocation', () => {
    appuyerSurLaCarte({ ...COMPO, eventId: undefined });

    expect(derniereRoute()?.screen).toBe('TacticalBoardV2');
  });
});
