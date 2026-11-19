/* eslint-disable max-len -- titres de témoins en phrases */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentTeamsPublic from '../TournamentTeamsPublic';

// IMPL-1-FICHE (18/11/2026, pack T-DESIGN-TOURNOI, page 8 et écran 8e, remarque 2 d'Adel) —
// l'onglet Équipes vu par qui n'organise pas le tournoi.

const mockAuth = { accountRoleKey: 'player', userData: /** @type {any} */ ({ birthdate: '1995-01-01', documentId: 'joueur-1' }) };
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({ requestJoinTournamentTeam: jest.fn() }));
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => (/** @type {any} */ props) => (
  props.isVisible ? jest.requireActual('react').createElement(jest.requireActual('react-native').Text, { testID: 'declaration' }, props.contextNote) : null
));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (/** @type {any} */ props) => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return react.createElement(rn.View, { testID: 'feuille' }, props.headerComponent, props.children, props.footerComponent);
});
jest.mock('@/components/atoms/button/Button', () => (/** @type {any} */ props) => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return react.createElement(rn.TouchableOpacity, { onPress: props.onPress, testID: `bouton-${props.title}` }, react.createElement(rn.Text, null, props.title));
});
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
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

const RAUZE = {
  captainUser: null,
  documentId: 'rauze',
  isOpenToJoinRequests: true,
  membersSummary: {
    count: 3,
    list: [{ firstName: 'Yanis', lastInitial: 'R', paid: true }, { firstName: 'Inès', lastInitial: 'M', paid: false }, {
      firstName: 'Léo', isMinor: true, lastInitial: 'D', paid: true,
    }],
    paidCount: 3,
  },
  name: 'FC Rauze',
  sourceType: 'custom_team',
  status: 'pending',
};
const PANTHERES = {
  captainUser: { firstname: 'Karim', lastname: 'Benali' }, documentId: 'pantheres', isOpenToJoinRequests: false, membersSummary: { count: 7, list: [], paidCount: 7 }, name: 'Les Panthères', sourceType: 'custom_team', status: 'accepted',
};
const TOURNOI = {
  date: '2099-12-19T18:00:00.000Z', documentId: 'evt', name: 'FoundClub x AR Soccer', tournamentConfig: { paidMembersToValidate: 5 }, tournamentTeams: [RAUZE, PANTHERES], type: { name: 'Tournoi' },
};

/** @type {any} */
let arbre;
const monter = (/** @type {any} */ props = {}) => {
  act(() => {
    arbre = renderer.create(
      <TournamentTeamsPublic
        belowThreshold={props.belowThreshold ?? false}
        event={props.event ?? TOURNOI}
        onCreate={props.onCreate ?? null}
        onOpenTeamPage={props.onOpenTeamPage ?? jest.fn()}
        teams={props.teams ?? [RAUZE, PANTHERES]}
        threshold={props.threshold === undefined ? 8 : props.threshold}
        viewerRequested={props.viewerRequested ?? false}
        viewerTeam={props.viewerTeam ?? null}
      />,
    );
  });
  return arbre.root;
};
afterEach(() => { act(() => arbre?.unmount()); });
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const parId = (/** @type {any} */ root, /** @type {string} */ id) => root.findAll((/** @type {any} */ n) => n.props?.testID === id, { deep: false });

describe('IMPL-1 · 8a — sous le seuil', () => {
  test('🔴 la phrase « dès 8 inscrites », « Créer mon équipe » et « Rejoindre une équipe » ; les autres équipes après « Rejoindre »', () => {
    const creer = jest.fn();
    const root = monter({ belowThreshold: true, onCreate: creer });
    const [carte] = parId(root, 'tournament-teams-threshold');
    expect(textes(carte)).toEqual(['Les équipes s’affichent dès 8 inscrites', 'Sois parmi les premiers : crée ton équipe, ou rejoins-en une qui cherche du monde.', 'Créer mon équipe', 'Rejoindre une équipe']);
    expect(parId(root, 'tournament-public-team-rauze')).toHaveLength(0);
    act(() => { parId(root, 'bouton-Rejoindre une équipe')[0].props.onPress(); });
    expect(parId(root, 'tournament-public-team-rauze')).toHaveLength(1);
    act(() => { parId(root, 'bouton-Créer mon équipe')[0].props.onPress(); });
    expect(creer).toHaveBeenCalled();
  });
});

describe('IMPL-1 · 8b — la carte d une équipe', () => {
  test('🔴 « Équipe du tournoi », « Cherche 2 joueurs », « 3 joueurs », « Voir l’équipe » et « Demander à rejoindre » sur une équipe ouverte', () => {
    const [carte] = parId(monter(), 'tournament-public-team-rauze');
    expect(textes(carte)).toEqual(['FC Rauze', 'Équipe du tournoi', 'Cherche 2 joueurs', '3 joueurs', 'Voir l’équipe', 'Demander à rejoindre']);
  });

  test('🔴 équipe fermée : ni « Cherche » ni « Demander » ; validée : la pastille ; capitaine en « Karim B. »', () => {
    const [carte] = parId(monter(), 'tournament-public-team-pantheres');
    expect(textes(carte)).toEqual(['Les Panthères', 'Équipe du tournoi · capitaine Karim B.', 'Validée', '7 joueurs', 'Voir l’équipe']);
  });

  test('🔴 jamais « Équipe éphémère » ni le paiement d un joueur sur les cartes', () => {
    const tout = textes(monter()).join(' | ');
    expect(tout).not.toMatch(/éphémère|en attente|payé ·|Yanis/);
  });
});

describe('IMPL-1 · 8c — après la demande', () => {
  test('🔴 la carte dit « Demande envoyée » à la place du bouton', () => {
    const [carte] = parId(monter({ viewerRequested: true, viewerTeam: RAUZE }), 'tournament-public-team-rauze');
    expect(textes(carte)).toContain('Demande envoyée');
    expect(textes(carte)).not.toContain('Demander à rejoindre');
  });
});

describe('IMPL-1 · 8e — l aperçu d une équipe', () => {
  test('🔴 toucher la carte ouvre l aperçu : places payées sans dire qui, mineur sans prénom, « Demander à rejoindre » en bas', () => {
    const root = monter();
    act(() => { parId(root, 'tournament-public-team-rauze')[0].props.onPress(); });
    const [apercu] = parId(root, 'feuille');
    const lu = textes(apercu);
    expect(lu).toEqual(expect.arrayContaining(['FC Rauze', 'Équipe du tournoi · FoundClub x AR Soccer', '2 places à payer', 'Cherche 2 joueurs', 'Ouverte aux demandes', '3 places payées sur 5', 'Yanis R.', 'Inès M.', 'Joueur', 'moins de 18 ans : prénom masqué', 'Les paiements de chaque joueur ne sont visibles que dans l’équipe.', 'Demander à rejoindre']));
    expect(lu.join(' | ')).not.toContain('Léo');
  });

  test('🔴 « Demander à rejoindre » de l aperçu ouvre la déclaration pour cette équipe', () => {
    const root = monter();
    act(() => { parId(root, 'tournament-public-team-rauze')[0].props.onPress(); });
    const boutons = parId(root, 'bouton-Demander à rejoindre');
    act(() => { boutons[boutons.length - 1].props.onPress(); });
    expect(textes(parId(root, 'declaration')[0])).toEqual(['Équipe choisie : FC Rauze.']);
  });

  test('🔴 tournoi anonymisé : le joueur aux champs vides est « Joueur », sans la note des mineurs', () => {
    const masquee = { ...RAUZE, membersSummary: { ...RAUZE.membersSummary, list: [{ firstName: 'Yanis', lastInitial: 'R' }, { firstName: '', lastInitial: '' }], paidHidden: true } };
    const root = monter({ event: { ...TOURNOI, participantIdentityVisibility: 'ANONYMIZED' }, teams: [masquee] });
    act(() => { parId(root, 'tournament-public-team-rauze')[0].props.onPress(); });
    const lu = textes(parId(root, 'feuille')[0]);
    expect(lu).toEqual(expect.arrayContaining(['Yanis R.', 'Joueur']));
    expect(lu.join(' | ')).not.toContain('moins de 18 ans');
  });

  test('🔴 sa propre équipe s ouvre sur sa page, pas sur l aperçu', () => {
    const ouvrirPage = jest.fn();
    const root = monter({ onOpenTeamPage: ouvrirPage, viewerTeam: PANTHERES });
    act(() => { parId(root, 'tournament-public-team-pantheres')[0].props.onPress(); });
    expect(ouvrirPage).toHaveBeenCalledWith('pantheres');
    expect(parId(root, 'feuille')).toHaveLength(0);
  });
});

// IMPL-1C (19/11/2026, recette 48, point A) — tournoi 3444 : « dès 0 inscrites » avec 21 équipes
// inscrites, et « Sois parmi les premiers » alors que les inscriptions sont fermées.
describe('IMPL-1C · point A — le seuil et les inscriptions fermées', () => {
  test('🔴 seuil inconnu (capacité absente) : pas de « dès 0 inscrites », les équipes s affichent', () => {
    const root = monter({ belowThreshold: true, onCreate: jest.fn(), threshold: null });
    expect(parId(root, 'tournament-teams-threshold')).toHaveLength(0);
    expect(textes(root).join(' | ')).not.toContain('dès 0');
    expect(parId(root, 'tournament-public-team-rauze')).toHaveLength(1);
  });

  test('🔴 inscriptions fermées : « Inscriptions fermées », ni « Créer mon équipe » ni « Sois parmi les premiers »', () => {
    const root = monter({
      belowThreshold: true,
      event: { ...TOURNOI, tournamentConfig: { ...TOURNOI.tournamentConfig, registrationsClosed: true } },
      onCreate: jest.fn(),
    });
    const tout = textes(root).join(' | ');
    expect(parId(root, 'tournament-teams-closed')).toHaveLength(1);
    expect(tout).toContain('Inscriptions fermées');
    expect(tout).not.toMatch(/Créer mon équipe|Sois parmi les premiers|dès 8/);
    expect(parId(root, 'tournament-public-team-rauze')).toHaveLength(1);
  });
});
