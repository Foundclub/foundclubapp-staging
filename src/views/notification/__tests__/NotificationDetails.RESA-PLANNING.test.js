import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { buildWebPath } from '@/navigation/webRoutes';

import NotificationDetails from '../NotificationDetails';

// T3-RESA-PLANNING (03/11, Adel « 9- A ») — « Voir mon planning » menait au planning du jour :
// la réservation du 05/11 n'y était pas à l'écran. Le bouton ouvre maintenant son jour, sans casser
// la correction de la récolte (`HomeTab` + `{ pop: true }`, témoin DCOACH1).

const mockRoute = { params: {} };
const mockNavigate = jest.fn();
const mockUseMaReservation = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => mockRoute,
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useMaReservation: (/** @type {any} */ id) => mockUseMaReservation(id),
}));
jest.mock('@/services/notification/notificationService', () => ({
  getNotificationById: jest.fn(),
  markAsRead: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/theme/themeContext', () => {
  const ramp = () => new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({
      Alignments: ramp(), Colors: ramp(), Fonts: ramp(), Spaces: ramp(),
    }),
  };
});
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (cle, repli) => (typeof repli === 'string' ? repli : cle) }),
}));
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function CadreDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.Text, { onPress: props.onPress }, props.title);
  };
});

const NOTIFICATION = {
  createdAt: '2026-11-02T20:00:00.000Z',
  data: {
    complexeName: 'Complexe Test',
    reservationId: 'resa-1',
    terrainName: 'Terrain 1',
    whenLabel: 'jeudi 05/11, 19 h',
  },
  documentId: 'n-1',
  read: true,
  title: 'Réservation confirmée',
  type: 'complexeReservationJoueur',
};

/**
 * Ouvre la fiche et touche « Voir mon planning ».
 * @returns {void}
 */
const toucherLeBouton = () => {
  mockRoute.params = { notification: NOTIFICATION };
  let fiche;
  act(() => { fiche = renderer.create(<NotificationDetails />); });
  const bouton = fiche.root.findAllByType(Text)
    .find((/** @type {any} */ noeud) => noeud.props.children === 'Voir mon planning');
  act(() => { bouton.props.onPress(); });
};

describe('T3-RESA-PLANNING — « Voir mon planning » montre la réservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ROUGE-AVANT — le bouton ouvre le jour de la réservation', () => {
    mockUseMaReservation.mockReturnValue({ data: { date: '2026-11-05' } });
    toucherLeBouton();

    expect(mockUseMaReservation).toHaveBeenCalledWith('resa-1');
    expect(mockNavigate).toHaveBeenCalledWith(
      'HomeTab',
      { params: { date: '2026-11-05' }, screen: 'MyEventList' },
      { pop: true },
    );
    expect(buildWebPath('HomeTab', { params: { date: '2026-11-05' }, screen: 'MyEventList' }))
      .toBe('/events/mine?date=2026-11-05');
  });

  test('date pas lue : le planning s\'ouvre quand même, comme la récolte l\'a corrigé', () => {
    mockUseMaReservation.mockReturnValue({ data: undefined });
    toucherLeBouton();

    expect(mockNavigate).toHaveBeenCalledWith('HomeTab', { screen: 'MyEventList' }, { pop: true });
  });
});
