/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentJoinTeamPanel from '../TournamentJoinTeamPanel';

// ==========================================================================
// T-REJOINDRE (17/11/2026, Clément D50 « 2- A », registre D210) — « REJOINDRE UNE ÉQUIPE » SUR LA
// FICHE DU TOURNOI, le même panneau pour le site et le téléphone.
//   · le bouton, le petit texte de la maquette validée, la liste des équipes ouvertes ET pas
//     complètes (« 3 joueurs sur 5 »), « Demander à rejoindre » ;
//   · la demande passe par la route existante (`requestJoinTournamentTeam`), après la déclaration ;
//   · aucune équipe ouverte : un message clair, pas une liste vide ;
//   · ni le visiteur, ni le joueur plus jeune que l'âge minimum ne voient le bouton.
// ==========================================================================

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Spaces,
    }),
  };
});

/** @type {any} */
let mockAuth = {};
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));

const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

const mockRequestJoin = jest.fn();
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  requestJoinTournamentTeam: (/** @type {any[]} */ ...args) => mockRequestJoin(...args),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { disabled: props.disabled, onPress: props.onPress, testID: props.testID },
      react.createElement(rn.Text, null, props.title),
    );
  };
});

jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function JoinEventModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return react.createElement(
      rn.View,
      { testID: 'doublure-declaration', ...props },
      react.createElement(rn.Text, null, props.contextNote),
      props.errorMessage ? react.createElement(rn.Text, null, props.errorMessage) : null,
    );
  };
});

const membres = (/** @type {number} */ n) => Array.from({ length: n }, (_v, index) => ({
  documentId: `m-${index}`, responseStatus: 'pending', user: { documentId: `u-${index}` },
}));
const equipe = (/** @type {any} */ extra = {}) => ({
  captainUser: { documentId: 'u-cap' },
  documentId: 'eq-seuls',
  isOpenToJoinRequests: true,
  members: membres(3),
  name: 'Les Seuls',
  sourceType: 'custom_team',
  status: 'pending',
  ...extra,
});
const TOURNOI = {
  club: { name: 'AR Soccer' },
  date: '2026-12-19T17:15:00.000Z',
  documentId: 'tournoi-1912',
  tournamentConfig: {
    entryFeeCents: 2000, maxRosterSize: 5, maxTeams: 24, minAge: 16,
  },
  type: { name: 'Tournoi' },
};
const JOUEUR = { accountRoleKey: 'player', userData: { birthdate: '2000-01-01', documentId: 'u-seul' } };

/**
 * Monte le panneau.
 * @param {any} [props] - Les propriétés à changer.
 * @returns {Promise<any>} L'arbre monté.
 */
const monter = async (props = {}) => {
  const { event, onRequested, teams } = {
    event: TOURNOI,
    onRequested: jest.fn(),
    teams: [equipe(), equipe({ documentId: 'eq-pleine', members: membres(5), name: 'Les Complets' })],
    ...props,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <TournamentJoinTeamPanel event={event} onRequested={onRequested} teams={teams} />,
    );
  });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  await act(async () => {
    // L'identifiant est sur l'enveloppe du bouton : on appuie sur le bouton qu'elle contient.
    await arbre.root.findAll((/** @type {any} */ noeud) => noeud.props?.testID === testID)[0]
      .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')[0]
      .props.onPress();
  });
};

// Le premier montage charge le thème et le dictionnaire : large sur un PC partagé entre sessions.
jest.setTimeout(30000);

beforeEach(() => {
  mockAuth = JOUEUR;
  mockInvalidate.mockReset();
  mockRequestJoin.mockReset();
});

describe('T-REJOINDRE — le panneau « Rejoindre une équipe »', () => {
  it('montre le bouton et le petit texte de la maquette ; la liste ne s’ouvre qu’à l’appui', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toContain('Rejoindre une équipe');
    expect(textes(arbre)).toContain('Quand le capitaine accepte, tu paies ta place.');
    expect(textes(arbre)).not.toContain('Les Seuls');

    await appuyer(arbre, 'tournament-join-team-button');
    expect(textes(arbre)).toContain('Les Seuls');
    expect(textes(arbre)).toContain('3 joueurs sur 5');
    expect(textes(arbre)).toContain('Demander à rejoindre');
    // L'équipe complète n'est pas proposée.
    expect(textes(arbre)).not.toContain('Les Complets');
  });

  it('tournoi gratuit : le petit texte ne parle pas de payer', async () => {
    const arbre = await monter({ event: { ...TOURNOI, tournamentConfig: { maxRosterSize: 5 } } });
    expect(textes(arbre)).toContain('tu es dans l’équipe');
    expect(textes(arbre)).not.toContain('tu paies ta place');
  });

  it('aucune équipe ouverte : un message clair, pas une liste vide', async () => {
    const arbre = await monter({ teams: [equipe({ isOpenToJoinRequests: false })] });
    await appuyer(arbre, 'tournament-join-team-button');
    expect(textes(arbre)).toContain(
      'Aucune équipe ne cherche de joueur pour l’instant : crée la tienne ou reviens plus tard.',
    );
    expect(arbre.root.findAll((/** @type {any} */ noeud) => (
      String(noeud.props?.testID || '').startsWith('tournament-join-team-ask-')
    ))).toHaveLength(0);
  });

  it('« Demander à rejoindre » ouvre la déclaration, puis envoie la demande par la route existante', async () => {
    const onRequested = jest.fn();
    mockRequestJoin.mockResolvedValue({ documentId: 'eq-seuls' });
    const arbre = await monter({ onRequested });
    await appuyer(arbre, 'tournament-join-team-button');
    await appuyer(arbre, 'tournament-join-team-ask-eq-seuls');

    const declaration = arbre.root.findByProps({ testID: 'doublure-declaration' });
    expect(declaration.props.contextNote).toBe('Équipe choisie : Les Seuls.');
    expect(mockRequestJoin).not.toHaveBeenCalled();

    await act(async () => {
      await declaration.props.onConfirm({ acceptRiskDeclaration: true });
    });
    expect(mockRequestJoin).toHaveBeenCalledWith('eq-seuls', { acceptRiskDeclaration: true });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['event', 'tournoi-1912'] });
    expect(onRequested).toHaveBeenCalledWith({ documentId: 'eq-seuls' });
    expect(arbre.root.findAllByProps({ testID: 'doublure-declaration' })).toHaveLength(0);
  });

  it('refus du serveur (âge, autre équipe) : son message est montré dans la déclaration, rien d’autre ne bouge', async () => {
    const onRequested = jest.fn();
    mockRequestJoin.mockRejectedValue(new Error('Tu participes déjà à une autre équipe de ce tournoi.'));
    const arbre = await monter({ onRequested });
    await appuyer(arbre, 'tournament-join-team-button');
    await appuyer(arbre, 'tournament-join-team-ask-eq-seuls');
    await act(async () => {
      await arbre.root.findByProps({ testID: 'doublure-declaration' }).props.onConfirm({});
    });
    expect(textes(arbre)).toContain('Tu participes déjà à une autre équipe de ce tournoi.');
    expect(onRequested).not.toHaveBeenCalled();
  });

  it('erreur SANS message (réseau coupé : le client rejette une simple chaîne) : le joueur lit quoi faire', async () => {
    mockRequestJoin.mockRejectedValue('Network Error');
    const arbre = await monter();
    await appuyer(arbre, 'tournament-join-team-button');
    await appuyer(arbre, 'tournament-join-team-ask-eq-seuls');
    await act(async () => {
      await arbre.root.findByProps({ testID: 'doublure-declaration' }).props.onConfirm({});
    });
    expect(textes(arbre)).toContain('La demande n’est pas partie. Vérifie ta connexion, puis réessaie.');
  });

  it('ni le visiteur sans compte, ni le joueur de 15 ans, ni le Parent ne voient le bouton', async () => {
    mockAuth = { accountRoleKey: undefined, userData: null };
    expect((await monter()).toJSON()).toBeNull();
    mockAuth = { accountRoleKey: 'player', userData: { birthdate: '2011-06-01', documentId: 'u-15' } };
    expect((await monter()).toJSON()).toBeNull();
    mockAuth = { ...JOUEUR, accountRoleKey: 'parent' };
    expect((await monter()).toJSON()).toBeNull();
  });
});
