import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// ==========================================================================
// COMPOMODIF · M1 — LA CARTE DU TCHAT REND SA PORTE « Modifier » AU COACH.
//
// 🗣️ Adel, 27/08 : « si c'est le coach qui ouvre, il manque un petit bouton
// Modifier, a chaque fois, des qu'il peut voir la compo ».
//
// 🧨 CE QUE LA MESURE A TROUVE : sur les 3 vues d'une compo publiee, cette
// carte est la SEULE qui eteignait la porte. Elle envoyait `canEdit: false`
// EN DUR au plateau — donc meme un coach y arrivait sans son bouton, alors que
// COMPOLECT-2 l'avait bel et bien pose sur cet ecran.
//
// ⛔ ON N'EN FABRIQUE PAS UN DEUXIEME : on rallume celui qui existe.
//
// ⚠️ ET LA CARTE DOIT REMETTRE DE QUOI MODIFIER : sans `teamId` la publication
// est impossible, et sans le pack l'ecran de selection repart de zero — c'est
// le defaut M4, qu'on recreerait ici en ouvrant simplement la porte.
//
// ♻️ Le droit se lit dans l'instantane d'authentification, celui que la carte
// interroge DEJA pour savoir si le lecteur est convoque. `useAuth` tirerait
// tout le client HTTP dans une carte de tchat qui n'appelle rien.
// ==========================================================================

const mockNavigate = jest.fn();
/** @type {any} */
let mockSnapshot;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => mockSnapshot,
}));

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View testID="mini-terrain">{children}</View>,
  };
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
const EQUIPE = 'team-1';
const COACH = 'coach-1';
const SPECTATEUR = 'spectateur-9';

// La charge telle que le serveur la poste vraiment
// (`publishLineupShareToTeamChat`) : elle PORTE `teamId`.
const COMPO = {
  eventAddress: 'Stade Georges Ricard, 13710 Fuveau',
  eventDate: '2026-08-24T18:30:00.000Z',
  eventId: 'evt-1',
  eventName: 'US Fuveau - AS Gardanne',
  manualPlayers: [],
  placements: [],
  publishedVersion: 2,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Leo', lastname: 'Diarra' }],
  schemaVersion: 3,
  snapshotPlayers: [{ documentId: JOUEUR, firstname: 'Karim', lastname: 'Sylla' }],
  sportContext: 'football',
  teamId: EQUIPE,
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
  const appel = [...mockNavigate.mock.calls].pop();
  return appel ? appel[1] : null;
};

/**
 * L'instantane d'authentification d'une personne, avec les equipes qu'elle
 * entraine.
 * @param {string} documentId
 * @param {string[]} [equipesEntrainees]
 * @returns {any}
 */
const identite = (documentId, equipesEntrainees = []) => ({
  auth: {
    user: {
      documentId,
      trainedTeams: equipesEntrainees.map((id) => ({ documentId: id, name: id })),
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot = identite(SPECTATEUR);
});

afterEach(() => {
  if (monte) {
    act(() => {
      monte.unmount();
    });
    monte = null;
  }
});

describe('COMPOMODIF · M1 — la carte du tchat rallume « Modifier » pour le coach', () => {
  test('🥇 le COACH de l equipe arrive sur le plateau avec le droit de modifier', () => {
    mockSnapshot = identite(COACH, [EQUIPE]);

    appuyerSurLaCarte();

    expect(derniereRoute()?.screen).toBe('MatchCompositionBoard');
    expect(derniereRoute()?.params?.canEdit).toBe(true);
  });

  test('🔒 un lecteur qui n entraine PAS cette equipe n a aucun droit', () => {
    mockSnapshot = identite(SPECTATEUR, ['une-autre-equipe']);

    appuyerSurLaCarte();

    expect(derniereRoute()?.params?.canEdit).toBe(false);
  });

  test('🔒 sans `teamId` dans la charge, la carte n ouvre aucun droit', () => {
    mockSnapshot = identite(COACH, [EQUIPE]);

    appuyerSurLaCarte({ ...COMPO, teamId: undefined });

    expect(derniereRoute()?.params?.canEdit).toBe(false);
  });

  // ⚠️ Ouvrir la porte sans donner de quoi modifier recreerait M4 : l'ecran de
  // selection repartirait de zero, et publier serait impossible faute d equipe.
  test('🥇 la carte remet l equipe ET le pack publie', () => {
    mockSnapshot = identite(COACH, [EQUIPE]);

    appuyerSurLaCarte();

    const parametres = derniereRoute()?.params;
    expect(parametres?.teamId).toBe(EQUIPE);
    expect(parametres?.existingComposition?.teams?.[0]?.placements?.[0]?.playerId).toBe(JOUEUR);
    expect(parametres?.existingComposition?.reservePlayerIds).toEqual([REMPLACANT]);
  });

  // 🔒 NON-REGRESSION COMPOLECT-2 : on arrive toujours en CONSULTATION. Le
  // bouton « Modifier » est une porte, pas un mode.
  test('🔒 on arrive toujours en lecture seule', () => {
    mockSnapshot = identite(COACH, [EQUIPE]);

    appuyerSurLaCarte();

    expect(derniereRoute()?.params?.readOnly).toBe(true);
  });

  // 🔒 NON-REGRESSION AC08 : un convoque part toujours sur SON ecran, jamais
  // sur le plateau du coach.
  test('🔒 un convoque part toujours sur son ecran de convocation', () => {
    mockSnapshot = identite(JOUEUR, [EQUIPE]);

    appuyerSurLaCarte();

    expect(derniereRoute()?.screen).toBe('PlayerConvocation');
  });
});
