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

  // 🔄 COMPOLECT-2 — CES DEUX TEMOINS CHANGENT DE DESTINATION, PAS D'INTENTION.
  // Ce qu'ils gardaient : « un non-convoque ne repond pas, il LIT ». Ce qui est
  // corrige : ce qu'il lisait etait `TacticalBoardV2`, un AUTRE plateau que celui
  // de la creation. Adel (27/08) veut le MEME ecran partout. La 2e assertion —
  // `readOnly: true` — est intacte : c'est elle qui porte la promesse.
  test('🥇 COMPOLECT-2 — un non-convoque (le COACH) part sur LE terrain de creation', () => {
    mockSnapshot = { auth: { user: { documentId: 'spectateur-9' } } };

    appuyerSurLaCarte();

    expect(derniereRoute()?.screen).toBe('MatchCompositionBoard');
    expect(derniereRoute()?.params?.readOnly).toBe(true);
  });

  test('🔒 sans personne connectee, meme terrain, toujours en lecture seule', () => {
    mockSnapshot = { auth: undefined };

    appuyerSurLaCarte();

    expect(derniereRoute()?.screen).toBe('MatchCompositionBoard');
    expect(derniereRoute()?.params?.readOnly).toBe(true);
  });

  test('⛔ une carte SANS evenement rattache ne peut mener a aucune convocation', () => {
    appuyerSurLaCarte({ ...COMPO, eventId: undefined });

    expect(derniereRoute()?.screen).toBe('TacticalBoardV2');
  });
});

// ==========================================================================
// COMPOLECT-2 — LA CARTE DU TCHAT PORTE LE MEME TERRAIN QUE LA CREATION.
//
// 🗣️ Adel, 27/08 : « quand je clique sur "ouvrir la compo", je vois le terrain
// avec le banc en plein ecran, COMME QUAND JE CREE LA COMPO. »
//
// 🧨 CE QUE LA MESURE A TROUVE : COMPOLECT-1 a rebranche l'onglet
// « Convocation » de l'evenement, mais PAS cette carte. Or un coach n'est
// jamais convoque sur sa propre compo — il prenait donc TOUJOURS la branche du
// non-convoque, celle qui menait a l'ANCIEN plateau.
//
// ⛔ ET LES DEUX GARDE-FOUS DE D6 SONT REPRIS TELS QUELS : sans titulaire
// dessinable, et avec plusieurs equipes, l'ancien plateau garde la main.
// ==========================================================================
describe('COMPOLECT-2 · la carte du tchat mene au plateau de creation', () => {
  test('le terrain recoit les titulaires ET le banc, avec leurs placements', () => {
    mockSnapshot = { auth: { user: { documentId: 'spectateur-9' } } };

    appuyerSurLaCarte();
    const params = derniereRoute()?.params;

    expect(params?.startPlacements).toEqual([
      { playerId: JOUEUR, positionX: 50, positionY: 90 },
    ]);
    expect(params?.selectedPlayers.map((/** @type {any} */ p) => p.documentId))
      .toEqual([JOUEUR, REMPLACANT]);
    expect(params?.canEdit).toBe(false);
    expect(params?.teamName).toBe('U15 A');
  });

  test('⛔ D6 — SANS titulaire dessinable, l ancien plateau garde la main', () => {
    mockSnapshot = { auth: { user: { documentId: 'spectateur-9' } } };

    appuyerSurLaCarte({ ...COMPO, teams: [{ id: 't1', name: 'U15 A', placements: [] }] });

    expect(derniereRoute()?.screen).toBe('TacticalBoardV2');
  });

  test('⛔ D6 — avec PLUSIEURS equipes publiees, l ancien plateau garde la main', () => {
    mockSnapshot = { auth: { user: { documentId: 'spectateur-9' } } };

    appuyerSurLaCarte({
      ...COMPO,
      teams: [
        COMPO.teams[0],
        {
          id: 't2',
          name: 'U15 B',
          placements: [{ playerId: REMPLACANT, positionX: 20, positionY: 40 }],
        },
      ],
    });

    expect(derniereRoute()?.screen).toBe('TacticalBoardV2');
  });
});
