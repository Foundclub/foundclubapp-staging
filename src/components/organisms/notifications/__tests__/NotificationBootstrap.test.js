// NOTIF-PREDEMANDE (E6) — NotificationBootstrap n'avait AUCUN test. Ce temoin fige ce
// qui doit SURVIVRE au lot : la fenetre « Match confirmé » (ajout au calendrier).
import renderer, { act } from 'react-test-renderer';

import NotificationBootstrap from '../NotificationBootstrap';

const mockCalendarAccept = jest.fn();
const mockActiver = jest.fn();

jest.mock('@/constants/runtimeFlags', () => ({
  ...jest.requireActual('@/constants/runtimeFlags'),
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_SMART_NOTIFICATIONS: false,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_cle, repli) => repli }),
}));

jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn() }));
jest.mock('@/services/notifications/notificationRuntimeSnapshot', () => ({
  getNotificationRuntimeSnapshot: () => ({}),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: () => true,
}));
jest.mock('@/context/SmartNotificationContext', () => ({
  useSmartNotifications: () => ({ consumeNotification: jest.fn() }),
}));
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => function GlobalPromptModal() {
  return null;
});
jest.mock('../PreDemandeNotifications', () => function PreDemandeNotifications() {
  return null;
});

jest.mock('@/hooks/useNotifications', () => ({
  __esModule: true,
  default: () => ({
    activerNotifications: mockActiver,
    calendarPrompt: {
      body: 'Ajoute le match',
      canShow: true,
      descriptor: { id: 'notification-calendar-alert', priority: 50 },
      onAccept: mockCalendarAccept,
      onDismiss: jest.fn(),
      onVisible: jest.fn(),
      title: 'Match confirmé',
    },
    pushPermissionPrompt: {
      body: '',
      canShow: false,
      descriptor: { id: 'push-permission-preprompt', priority: 90 },
      onAccept: jest.fn(),
      onDismiss: jest.fn(),
      onVisible: jest.fn(),
      title: '',
    },
  }),
}));

test('la fenetre « Match confirmé » reste montee, visible, et branchee sur son geste', () => {
  let arbre;
  act(() => { arbre = renderer.create(<NotificationBootstrap />); });
  const calendrier = arbre.root.findAll((n) => n.props?.title === 'Match confirmé' && n.props?.visible !== undefined);
  expect(calendrier).toHaveLength(1);
  expect(calendrier[0].props.visible).toBe(true);
  expect(calendrier[0].props.primaryAction.label).toBe('Ajouter au calendrier');
  expect(calendrier[0].props.primaryAction.onPress).toBe(mockCalendarAccept);
});

test('NOTIF-PREDEMANDE — notre ecran remplace l ancienne fenetre maison, branche sur « Activer »', () => {
  let arbre;
  act(() => { arbre = renderer.create(<NotificationBootstrap />); });
  const ecran = arbre.root.findAll((n) => n.props?.activerNotifications !== undefined && typeof n.type === 'function');
  expect(ecran.length).toBeGreaterThan(0);
  expect(ecran[0].props.activerNotifications).toBe(mockActiver);
  // Plus de fenetre maison « Active les notifications FoundClub » : seule reste celle du calendrier.
  const fenetres = arbre.root.findAll((n) => n.props?.primaryAction !== undefined && typeof n.type === 'function');
  expect(fenetres.map((n) => n.props.primaryAction.label)).toEqual(['Ajouter au calendrier']);
});
