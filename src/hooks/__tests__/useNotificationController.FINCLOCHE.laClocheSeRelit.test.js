/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getUnreadCount } from '@/services/notification/notificationService';

import { UNREAD_COUNT_QUERY_KEY, useNotificationController } from '../useNotificationController';

// FIN-CLOCHE (02/11/2026) — le démarrage ne réécrit plus le chiffre de la cloche
// (useAuth.FINCLOCHE.demarrageNEcrasePasLaCloche). Ce filet prouve l'autre moitié : la cloche
// continue de se relire ensuite, par sa minuterie et quand on ouvre le panneau.

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
jest.mock('@/services/notification/notificationService', () => ({
  deleteNotification: jest.fn(),
  getNotifications: jest.fn(async () => ({ data: [], meta: {} })),
  getUnreadCount: jest.fn(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
}));

/** @type {(() => void) | null} */
let demonter = null;

/**
 * Monte le contrôleur sur une cloche déjà remplie par le démarrage.
 * @returns {Promise<{ controleur: () => any }>} Le contrôleur.
 */
const monterApresLeDemarrage = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(UNREAD_COUNT_QUERY_KEY, { count: 376 });
  /** @type {any} */
  let dernier = null;
  /**
   * La sonde qui lit le contrôleur.
   * @returns {null} Rien à afficher.
   */
  function Sonde() {
    dernier = useNotificationController({ notificationsEnabled: false, unreadPollMs: 1000 });
    return null;
  }
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<QueryClientProvider client={client}><Sonde /></QueryClientProvider>);
  });
  demonter = () => {
    act(() => { arbre.unmount(); });
    client.clear();
  };
  return { controleur: () => dernier };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(getUnreadCount).mockReset();
  jest.mocked(getUnreadCount).mockResolvedValue({ count: 375 });
});

afterEach(() => {
  demonter?.();
  demonter = null;
  jest.useRealTimers();
});

test('le chiffre du démarrage s affiche, puis la minuterie le remplace par celui du serveur', async () => {
  const { controleur } = await monterApresLeDemarrage();
  expect(controleur().unreadCount).toBe(376);

  await act(async () => {
    jest.advanceTimersByTime(1100);
    await Promise.resolve();
  });

  expect(getUnreadCount).toHaveBeenCalled();
  expect(controleur().unreadCount).toBe(375);
});

test('ouvrir le panneau relit le chiffre tout de suite, même frais', async () => {
  const { controleur } = await monterApresLeDemarrage();

  await act(async () => {
    controleur().refreshUnreadCount();
    await Promise.resolve();
  });

  expect(getUnreadCount).toHaveBeenCalledTimes(1);
  expect(controleur().unreadCount).toBe(375);
});
