/**
 * C09 — banc de rendu de `SquadDetailsScreen` (aucun avant la phase 2 BUGHUNT).
 *
 * L'écran est rendu en vrai ; la liste et le formulaire de créneaux sont
 * doublés pour que le témoin agisse comme le capitaine : toucher un créneau,
 * fermer la fenêtre, toucher « Ajouter un créneau », enregistrer.
 */
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.setTimeout(30000);

const mockRefetch = jest.fn(async () => ({}));
const mockCreateTeamSlot = jest.fn();
const mockUpdateTeamSlot = jest.fn();
const mockTeam = { current: null };
const mockSlotList = { last: null };
const mockSlotForm = { last: null };
const mockSlotModal = { last: null };

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
  };
});
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isFetching: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(async () => {}) }),
}));
jest.mock('react-i18next', () => ({
  // eslint-disable-next-line global-require
  useTranslation: () => ({ t: (...args) => require('i18next').t(...args) }),
}));
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
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/domains/auth/useAuth', () => () => ({ userData: { documentId: 'user-1', id: 1 } }));
jest.mock('@/domains/club/useClub', () => () => ({
  getClubInitials: (name) => String(name || '').substring(0, 2).toUpperCase(),
}));
jest.mock('@/hooks/useLeagueLegalAcceptance', () => () => ({
  leagueLegalAcceptanceModal: null,
  requestLeagueLegalAcceptance: jest.fn(),
}));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({
  floatingActionBottomOffset: 0,
  sceneBottomInset: 0,
}));
jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
}));
jest.mock('@/navigation/pendingSquadInviteLink', () => ({
  clearPendingSquadInviteLink: jest.fn(),
  savePendingSquadInviteLink: jest.fn(),
}));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));
jest.mock('@/views/league/match/utils/leagueNavigation', () => ({
  navigateToLeagueStackScreen: jest.fn(),
}));
jest.mock('@/services/league/leagueActionQueries', () => ({
  getPendingLeagueActionQueryKey: (teamId) => ['pending', teamId],
}));
jest.mock('@/services/league/MatchmakingService', () => ({ __esModule: true, default: {} }));
jest.mock('@/services/leagueTeam/leagueTeamQueries', () => ({
  useGetLeagueTeam: () => ({
    data: mockTeam.current, error: null, isLoading: false, refetch: mockRefetch,
  }),
}));
jest.mock('@/services/leagueTeam/leagueTeamService', () => ({
  assignSquadCaptain: jest.fn(),
  cancelJoinRequest: jest.fn(),
  deleteLeagueTeam: jest.fn(),
  getRanking: jest.fn(async () => []),
  joinSquadViaInviteLink: jest.fn(),
  leaveSquad: jest.fn(),
  removeSquadMember: jest.fn(),
  requestToJoinSquad: jest.fn(),
  respondToSquadInvite: jest.fn(),
  resyncLeagueSourceTeam: jest.fn(),
  updateLeagueTeam: jest.fn(),
}));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetLeagueTeamPerformanceStats: () => ({ data: null, isFetching: false, refetch: jest.fn() }),
}));
jest.mock('@/services/teamSlot/teamSlotService', () => ({
  createTeamSlot: (...args) => mockCreateTeamSlot(...args),
  deleteTeamSlot: jest.fn(),
  updateTeamSlot: (...args) => mockUpdateTeamSlot(...args),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/atoms/league/DivisionBadge', () => () => null);
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => () => null);
jest.mock('@/components/atoms/teamShield/TeamShield', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock(
  '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay',
  () => () => null,
);
jest.mock('@/components/templates/ScreenContainer', () => ({ children }) => children || null);
jest.mock('@/views/league/components/LeagueStateView', () => () => null);
jest.mock('@/components/molecules/teamSlotList/TeamSlotList', () => (props) => {
  mockSlotList.last = props;
  return null;
});
jest.mock('@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm', () => (props) => {
  mockSlotForm.last = props;
  return null;
});
// La fenêtre des créneaux est la seule qui porte le formulaire : on la retient, ouverte ou fermée.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (props) => {
  if (props.children?.props?.onAdd) mockSlotModal.last = props;
  return props.isVisible ? props.children : null;
});

// eslint-disable-next-line import/first
import SquadDetailsScreen from '../SquadDetailsScreen';

const slotMonday = {
  documentId: 'slot-monday',
  end_hour: '21:00:00.000',
  location_mode: 'both',
  recurrence_day: 'monday',
  start_hour: '20:00:00.000',
};
const teamOf = () => ({
  captain: { documentId: 'user-1' },
  documentId: 'squad-1',
  name: 'Alpha',
  roster: [{ documentId: 'user-1' }],
  slots: [slotMonday],
  sport: 'football5',
});
const mountedTrees = [];

const flush = async () => {
  for (let index = 0; index < 8; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};
const run = async (callback) => {
  await act(async () => { await callback(); });
  await flush();
};
const isSlotFormOpen = () => Boolean(mockSlotModal.last?.isVisible) && mockSlotForm.last !== null;

/**
 * Rend la fiche de l'équipe du capitaine.
 * @returns {Promise<any>} l'arbre rendu
 */
const renderScreen = async () => {
  mockTeam.current = teamOf();
  const navigation = {
    addListener: () => () => {},
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
  };
  let tree;
  await act(async () => {
    const route = { params: { teamId: 'squad-1' } };
    tree = renderer.create(<SquadDetailsScreen navigation={navigation} route={route} />);
  });
  mountedTrees.push(tree);
  await flush();
  return tree;
};

/**
 * Ouvre un créneau existant puis ferme la fenêtre, comme le capitaine.
 * @param {'close' | 'cancel'} how - la croix de la fenêtre ou le bouton « Annuler » du formulaire
 * @returns {Promise<void>} rien
 */
const openThenDismissSlot = async (how) => {
  await run(() => mockSlotList.last.onSlotPress(slotMonday));
  expect(mockSlotForm.last.initialValues?.day).toBe('monday');
  await run(() => (how === 'close' ? mockSlotModal.last.close() : mockSlotForm.last.onCancel()));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSlotForm.last = null;
  mockSlotModal.last = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockCreateTeamSlot.mockResolvedValue({ documentId: 'slot-new' });
  mockUpdateTeamSlot.mockResolvedValue({});
});

afterEach(() => {
  mountedTrees.splice(0).forEach((tree) => act(() => { tree.unmount(); }));
  jest.restoreAllMocks();
});

describe('SquadDetailsScreen — banc de rendu', () => {
  it('rend la fiche du capitaine avec ses créneaux', async () => {
    await renderScreen();
    expect(mockSlotList.last.isCaptain).toBe(true);
    expect(mockSlotList.last.slots).toEqual([slotMonday]);
  });
});

describe('SquadDetailsScreen — « Ajouter un créneau » après un créneau ouvert', () => {
  it.each(['close', 'cancel'])('P10-03 : fermé par %s, l’ajout crée un créneau', async (how) => {
    await renderScreen();
    await openThenDismissSlot(how);

    await run(() => mockSlotList.last.onAddSlot());
    expect(isSlotFormOpen()).toBe(true);
    expect(mockSlotForm.last.initialValues).toBeNull();

    const friday = { day: 'friday', endTime: '19:00', startTime: '18:00' };
    await run(() => mockSlotForm.last.onAdd(friday));

    expect(mockUpdateTeamSlot).not.toHaveBeenCalled();
    expect(mockCreateTeamSlot).toHaveBeenCalledTimes(1);
    expect(mockCreateTeamSlot.mock.calls[0][0]).toMatchObject({ recurrence_day: 'friday' });
  });
});

describe('SquadDetailsScreen — créneaux ajoutés en lot', () => {
  it('P10-26 : échec partiel = fiche rafraîchie, seul le raté est nommé', async () => {
    await renderScreen();
    await run(() => mockSlotList.last.onAddSlot());
    const refetchesBefore = mockRefetch.mock.calls.length;
    mockCreateTeamSlot
      .mockResolvedValueOnce({ documentId: 'slot-new' })
      .mockRejectedValueOnce(new Error('refusé'));

    await run(() => mockSlotForm.last.onAdd([
      { day: 'monday', endTime: '21:00', startTime: '20:00' },
      { day: 'tuesday', endTime: '22:00', startTime: '21:00' },
    ]));

    expect(mockCreateTeamSlot).toHaveBeenCalledTimes(2);
    expect(mockRefetch.mock.calls.length).toBeGreaterThan(refetchesBefore);
    const [title, message] = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1];
    expect(title).toBe('Erreur');
    expect(message).toContain('Mardi 21:00');
    expect(message).not.toContain('Lundi');
    // La fenêtre se ferme : renvoyer les deux brouillons recréerait le créneau réussi.
    expect(mockSlotModal.last.isVisible).toBe(false);
  });
});
