import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { useNotificationController } from '../useNotificationController';

// RECETTE-WEB-DIRIGEANT n° 2 (30/10) — SUR LE SITE, OUVRIR UNE INVITATION D'ÉQUIPE DEPUIS LA
// CLOCHE RELIT LE COMPTE, COMME L'ARRIVÉE DU PUSH AU TÉLÉPHONE.
//
// Constaté sur la recette : Dina invite Guide (déjà connecté au site) par son numéro. Guide reçoit
// « Invitation d'équipe », la touche, arrive sur la fiche de l'équipe… sans « Accepter / Refuser ».
// La bannière lit `currentUser.teamMembershipRequests` (get-me) ; au téléphone, c'est le PUSH qui la
// fait relire (useNotifications, `resolveNotificationRefreshAction`). Le site n'a pas de push : il
// fallait se déconnecter puis se reconnecter. Ici : le contrôleur sait relire ce qu'une notification
// ouverte rend faux, avec la même table que le push.

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
jest.mock('@/services/notification/notificationService', () => ({
  deleteNotification: jest.fn(),
  getNotifications: jest.fn(async () => ({ data: [], meta: {} })),
  getUnreadCount: jest.fn(async () => ({ count: 0 })),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
}));

const monter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidees = jest.spyOn(queryClient, 'invalidateQueries');
  /** @type {any} */
  let controleur = null;
  const Sonde = () => {
    controleur = useNotificationController({ notificationsEnabled: false, unreadCountEnabled: false });
    return null;
  };
  act(() => {
    renderer.create(<QueryClientProvider client={queryClient}><Sonde /></QueryClientProvider>);
  });
  const cles = () => invalidees.mock.calls.map(([filtre]) => JSON.stringify(/** @type {any} */ (filtre)?.queryKey));
  return { cles, controleur: () => controleur };
};

test('🔴 ouvrir une invitation d équipe relit le compte (get-me) et le démarrage (app-bootstrap)', async () => {
  const { cles, controleur } = monter();
  await act(async () => {
    await controleur().refreshAfterOpening('teamMembershipInvitation');
  });
  expect(cles()).toEqual(expect.arrayContaining(['["get-me"]', '["app-bootstrap"]']));
});

test('protégé — un message ordinaire ne relit pas le compte (pas de requêtes en trop)', async () => {
  const { cles, controleur } = monter();
  await act(async () => {
    await controleur().refreshAfterOpening('chatMessage');
  });
  expect(cles()).not.toContain('["get-me"]');
});
