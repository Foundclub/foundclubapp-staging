/**
 * C09 — banc de rendu de `MatchCenterScreen` (aucun avant la phase 2 BUGHUNT).
 *
 * L'écran est rendu en vrai ; seuls les services, la navigation et les
 * composants enfants lourds sont doublés. Les doublures de `Button` et de
 * `TeamShield` dessinent leur texte : on lit l'écran comme un joueur le lit.
 */
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.setTimeout(30000);

const mockGetActiveRequest = jest.fn();
const mockCancelRequest = jest.fn();
const mockGetAvailableSlots = jest.fn();
const mockCreateTeamSlot = jest.fn();
const mockLoadContext = jest.fn();
const mockStateMachine = { last: null };
const mockSlotForm = { last: null };
const mockNavigation = {
  getParent: () => null,
  getState: () => ({ routeNames: [] }),
  navigate: jest.fn(),
  setParams: jest.fn(),
};

jest.mock('@react-navigation/native', () => {
  // eslint-disable-next-line global-require
  const React = require('react');
  return {
    useFocusEffect: (callback) => {
      const ranRef = React.useRef(false);
      React.useEffect(() => {
        if (ranRef.current) return;
        ranRef.current = true;
        callback();
      });
    },
    useIsFocused: () => true,
    useNavigation: () => mockNavigation,
    useRoute: () => ({ params: {} }),
  };
});
jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
    Colors: colors,
    Fonts: jest.requireActual('@/theme/fonts').default(colors),
    Images: jest.requireActual('@/theme/images').default('dark'),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('react-i18next', () => ({
  // eslint-disable-next-line global-require
  useTranslation: () => ({ t: (...args) => require('i18next').t(...args) }),
}));
jest.mock('@react-native-community/slider', () => () => null);
jest.mock('@/domains/club/useClub', () => () => ({
  getClubInitials: (name) => String(name || '').substring(0, 2).toUpperCase(),
}));
jest.mock('../../../../domains/auth/useAuth', () => () => ({
  userData: { documentId: 'user-1', id: 1 },
}));
jest.mock('@/hooks/useLeagueLegalAcceptance', () => () => ({
  leagueLegalAcceptanceModal: null,
  requestLeagueLegalAcceptance: jest.fn(),
}));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ sceneBottomInset: 0 }));
jest.mock('@/services/league/leaguePlatformQueries', () => ({
  useLeaguePlatformRuntime: () => ({ data: null }),
}));
jest.mock('@/services/league/leaguePlatformService', () => ({
  getLeagueClosedMessage: () => '',
  getLeaguePlatformRestrictionCode: () => null,
  getLeagueRestrictionScope: () => 'matchmaking',
  getLeagueRuntimeFromError: () => null,
  isLeaguePlatformRestrictedError: () => false,
}));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: jest.fn(),
  getMatchHistory: jest.fn(async () => []),
}));
jest.mock('@/services/teamSlot/teamSlotService', () => ({
  createTeamSlot: (...args) => mockCreateTeamSlot(...args),
  getAvailableSlots: (...args) => mockGetAvailableSlots(...args),
}));
jest.mock('../../../../services/league/MatchmakingService', () => ({
  __esModule: true,
  default: {
    cancelRequest: (...args) => mockCancelRequest(...args),
    getActiveRequest: (...args) => mockGetActiveRequest(...args),
    respondSuggestion: jest.fn(),
    triggerSearch: jest.fn(),
  },
}));
jest.mock('../../../../services/leagueTeam/leagueTeamQueries', () => ({
  loadLeagueTeamContextWithCache: (...args) => mockLoadContext(...args),
}));
jest.mock('@/views/league/match/hooks/useMatchmakingStateMachine', () => ({
  useMatchmakingStateMachine: (args) => {
    mockStateMachine.last = args;
    return { searchStatus: '', serverNow: null };
  },
}));

// Doublures appelées au rendu seulement : elles lisent les `mock*` une fois le module chargé.
const mockPassThrough = ({ children }) => children || null;
const mockLabel = (value) => {
  // eslint-disable-next-line global-require
  const { Text: RNText } = require('react-native');
  return <RNText>{value}</RNText>;
};
const mockButton = ({ onPress, title }) => {
  // eslint-disable-next-line global-require
  const { TouchableOpacity: Touch } = require('react-native');
  return <Touch accessibilityLabel={title} onPress={onPress}>{mockLabel(title)}</Touch>;
};

jest.mock('@/components/atoms/teamShield/TeamShield', () => ({ initials }) => (
  mockLabel(`BLASON:${initials || ''}`)
));
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => ({ children, text }) => (
  mockLabel(text || children || '')
));
jest.mock('@/components/atoms/league/DivisionBadge', () => () => null);
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({ children, isVisible }) => (
  isVisible ? children : null
));
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => () => null);
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
jest.mock('@/components/organisms/league/SearchCountdown', () => () => null);
jest.mock('@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm', () => (props) => {
  mockSlotForm.last = props;
  return null;
});
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => (props) => mockPassThrough(props));
jest.mock('@/views/league/components/LeagueStateView', () => () => null);
jest.mock('../components/NextMatchCard', () => () => null);
jest.mock('../../../../components/atoms/league/LeagueCard', () => (p) => mockPassThrough(p));
jest.mock('../../../../components/atoms/SectionHeader/SectionHeader', () => () => null);
jest.mock(
  '../../../../components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('../../../../components/atoms/button/Button', () => (props) => mockButton(props));

// eslint-disable-next-line import/first
import MatchCenterScreen from '../MatchCenterScreen';

const squadA = {
  captain: { documentId: 'user-1' },
  documentId: 'squad-a',
  members: [{ documentId: 'user-1' }],
  name: 'Alpha',
  sport: 'football_5',
};
const squadB = {
  captain: { documentId: 'user-1' },
  documentId: 'squad-b',
  members: [{ documentId: 'user-1' }],
  name: 'Bravo',
  sport: 'football11',
};
const idle = { state: 'idle' };
const mountedTrees = [];

const flush = async () => {
  for (let index = 0; index < 12; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};
const textOf = (tree) => tree.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).join(''))
  .join(' | ');

/**
 * Rend l'écran avec les équipes données.
 * @param {Array<Record<string, any>>} squads - équipes de l'utilisateur
 * @returns {Promise<any>} l'arbre rendu
 */
const renderScreen = async (squads = [squadA, squadB]) => {
  mockLoadContext.mockResolvedValue({ defaultSquadId: squads[0].documentId, squads });
  let tree;
  await act(async () => { tree = renderer.create(<MatchCenterScreen />); });
  mountedTrees.push(tree);
  await flush();
  return tree;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGetAvailableSlots.mockResolvedValue([]);
  mockGetActiveRequest.mockResolvedValue(idle);
});

afterEach(() => {
  mountedTrees.splice(0).forEach((tree) => act(() => { tree.unmount(); }));
  jest.restoreAllMocks();
});

describe('MatchCenterScreen — banc de rendu', () => {
  it("rend le vestiaire d'une équipe sans recherche", async () => {
    const tree = await renderScreen();
    expect(mockGetActiveRequest).toHaveBeenCalledWith('squad-a');
    expect(mockStateMachine.last.viewState).toBe('locker_room');
    expect(textOf(tree)).toContain('Alpha');
  });
});

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const hasText = (node, value) => node.findAll((child) => child.type === Text
  && [].concat(child.props.children).join('') === value).length > 0;
const press = async (target) => {
  // Pas d attente du gestionnaire : une réponse lente doit pouvoir rester en vol.
  await act(async () => { target.props.onPress(); });
  await flush();
};
const pressLabel = async (tree, label) => {
  const target = tree.root.findAll((node) => node.type === TouchableOpacity
    && node.props.accessibilityLabel === label)[0];
  if (!target) throw new Error(`Bouton introuvable : ${label}`);
  await press(target);
};
const pressText = async (tree, value) => {
  const targets = tree.root.findAll((node) => node.type === TouchableOpacity
    && hasText(node, value));
  if (targets.length === 0) throw new Error(`Bouton introuvable : ${value}`);
  await press(targets[targets.length - 1]);
};

/**
 * Change d'équipe par le sélecteur, comme un capitaine.
 * @param {any} tree - arbre rendu
 * @param {Record<string, any>} squad - équipe visée
 * @returns {Promise<void>} rien
 */
const switchTo = async (tree, squad) => {
  await pressLabel(tree, 'Squad');
  const rows = tree.root.findAll((node) => node.type === TouchableOpacity
    && node.props.accessibilityLabel !== 'Squad'
    && hasText(node, squad.name));
  if (rows.length === 0) throw new Error(`Équipe absente du sélecteur : ${squad.name}`);
  await press(rows[rows.length - 1]);
};
const cancelAlerts = () => Alert.alert.mock.calls.filter(([title]) => title === 'Match annulé');
const matchOf = (overrides = {}) => ({
  documentId: 'match-1',
  status: 'negotiating',
  team_a: { ...squadB, documentId: 'squad-a', name: 'Alpha' },
  team_b: { documentId: 'xenon', name: 'Xenon', sport: 'football11' },
  ...overrides,
});
const searchingA = {
  request: { createdAt: '2026-10-25T10:00:00Z', documentId: 'req-a' },
  state: 'searching',
};

describe('MatchCenterScreen — changement d’équipe', () => {
  it('P10-06 : la recherche de l’équipe A ne suit pas sur l’équipe B', async () => {
    mockGetActiveRequest.mockImplementation(async (squadId) => (
      squadId === 'squad-a' ? searchingA : idle
    ));
    const tree = await renderScreen();
    expect(mockStateMachine.last.matchRequest?.documentId).toBe('req-a');

    await switchTo(tree, squadB);

    expect(mockStateMachine.last.mySquad.documentId).toBe('squad-b');
    expect(mockStateMachine.last.viewState).toBe('locker_room');
    expect(mockStateMachine.last.matchRequest).toBeNull();
  });

  it('P10-07 : changer d’équipe n’annonce pas « Match annulé »', async () => {
    mockGetActiveRequest.mockImplementation(async (squadId) => (squadId === 'squad-a'
      ? { match: matchOf(), state: 'matched' }
      : idle));
    const tree = await renderScreen();
    expect(mockStateMachine.last.viewState).toBe('match_found');

    await switchTo(tree, squadB);

    expect(cancelAlerts()).toHaveLength(0);
    expect(textOf(tree)).not.toContain('Xenon');
  });

  it('P10-21 : la réponse lente de l’équipe quittée n’écrase pas l’équipe affichée', async () => {
    const slowB = deferred();
    let stateOfA = idle;
    mockGetActiveRequest.mockImplementation((squadId) => (squadId === 'squad-b'
      ? slowB.promise
      : Promise.resolve(stateOfA)));
    const tree = await renderScreen();

    await switchTo(tree, squadB);
    stateOfA = { match: matchOf(), state: 'matched' };
    await switchTo(tree, squadA);
    expect(mockStateMachine.last.viewState).toBe('match_found');

    await act(async () => { slowB.resolve(idle); });
    await flush();

    expect(mockStateMachine.last.mySquad.documentId).toBe('squad-a');
    expect(mockStateMachine.last.viewState).toBe('match_found');
  });
});

describe('MatchCenterScreen — alertes et vues', () => {
  it('P10-20 : un match trouvé en direct puis annulé est annoncé', async () => {
    const tree = await renderScreen();
    await act(async () => {
      mockStateMachine.last.onMatched({ match: matchOf(), state: 'matched' }, { silent: false });
    });
    await flush();
    expect(mockStateMachine.last.viewState).toBe('match_found');

    mockGetActiveRequest.mockResolvedValue(idle);
    const scroll = tree.root.findAll((node) => node.props.refreshControl)[0];
    await act(async () => { await scroll.props.refreshControl.props.onRefresh(); });
    await flush();

    expect(cancelAlerts()).toHaveLength(1);
  });

  it('P10-10 : annuler la recherche laisse le rechargement choisir la vue', async () => {
    mockGetActiveRequest.mockResolvedValue(searchingA);
    mockCancelRequest.mockResolvedValue({});
    const tree = await renderScreen();
    expect(mockStateMachine.last.viewState).toBe('radar');

    // Pendant l'annulation, le serveur a déjà apparié l'équipe.
    mockGetActiveRequest.mockResolvedValue({ match: matchOf(), state: 'matched' });
    await pressLabel(tree, 'ANNULER');

    expect(mockCancelRequest).toHaveBeenCalledWith('req-a');
    expect(mockStateMachine.last.viewState).toBe('match_found');
  });

  it('P10-11 : « REESSAYER » recharge et n’invente pas de recherche', async () => {
    mockGetActiveRequest.mockRejectedValueOnce(new Error('réseau'));
    const tree = await renderScreen();
    expect(mockStateMachine.last.viewState).toBe('connection_error');
    const callsBefore = mockGetActiveRequest.mock.calls.length;

    await pressLabel(tree, 'REESSAYER');

    expect(mockGetActiveRequest.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(mockStateMachine.last.viewState).toBe('locker_room');
  });

  it('P10-11 : le retour au premier plan recharge au lieu d’afficher le radar', async () => {
    mockGetActiveRequest.mockRejectedValueOnce(new Error('réseau'));
    await renderScreen();
    expect(mockStateMachine.last.viewState).toBe('connection_error');

    await act(async () => { mockStateMachine.last.onRecoverFromBackground(); });
    await flush();

    expect(mockStateMachine.last.viewState).toBe('locker_room');
  });
});

describe('MatchCenterScreen — affichage', () => {
  const missingCount = (tree) => {
    const sentence = tree.root.findAll((node) => node.type === Text
      && [].concat(node.props.children).includes('Il manque'))[0];
    return sentence.findAllByType(Text)[1].props.children;
  };

  it.each([
    [3, 8],
    [7, 4],
  ])('P10-08 : foot à 11 avec %i réponses, il manque %i joueurs', async (rsvp, missing) => {
    mockGetAvailableSlots.mockResolvedValue([{
      documentId: 'slot-1',
      end_hour: '21:00:00',
      recurrence_day: 'monday',
      rsvp_count: rsvp,
      start_hour: '20:00:00',
    }]);
    const tree = await renderScreen([squadB, squadA]);
    expect(missingCount(tree)).toBe(missing);
  });

  it('P10-09 : en équipe B, l’adversaire affiché est l’équipe A', async () => {
    const match = matchOf({
      team_a: { documentId: 'xenon', name: 'Xenon', sport: 'football11' },
      team_b: { ...squadB },
    });
    mockGetActiveRequest.mockResolvedValue({ match, state: 'matched' });
    const tree = await renderScreen([squadB, squadA]);
    expect(mockStateMachine.last.viewState).toBe('match_found');

    const shown = textOf(tree);
    expect(shown).toContain('BLASON:XE');
    // Mon blason reste une fois, dans l en-tete de ma squad ; jamais à la place de l adversaire.
    expect(shown.split('BLASON:BR').length - 1).toBe(1);
    expect(shown).toContain('Duel confirmé | Xenon');
  });
});

describe('MatchCenterScreen — créneaux ajoutés en lot', () => {
  it('P10-27 : échec partiel = liste rafraîchie, seul le créneau raté est nommé', async () => {
    const tree = await renderScreen();
    await pressLabel(tree, 'RECHERCHER UN MATCH');
    await pressText(tree, '+ Ajouter');
    expect(mockSlotForm.last).not.toBeNull();
    const refreshesBefore = mockGetAvailableSlots.mock.calls.length;
    mockCreateTeamSlot
      .mockResolvedValueOnce({ documentId: 'new-1' })
      .mockRejectedValueOnce(new Error('refusé'));

    await act(async () => {
      await mockSlotForm.last.onAdd([
        { day: 'monday', endTime: '21:00', startTime: '20:00' },
        { day: 'tuesday', endTime: '22:00', startTime: '21:00' },
      ]);
    });
    await flush();

    expect(mockCreateTeamSlot).toHaveBeenCalledTimes(2);
    expect(mockGetAvailableSlots.mock.calls.length).toBeGreaterThan(refreshesBefore);
    const [title, message] = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1];
    expect(title).toBe('Erreur');
    expect(message).toContain('Mardi 21:00');
    expect(message).not.toContain('Lundi');
    // Le formulaire se ferme : renvoyer les deux brouillons recréerait le créneau réussi.
    expect(textOf(tree)).toContain('+ Ajouter');
  });
});
