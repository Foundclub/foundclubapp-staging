import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

/**
 * LOT ESSAI (28/08) — E6 : « juste à la fin de l'abonnement, une notification
 * avec l'écran des offres à souscrire ».
 *
 * 🪤 LE PIÈGE QUE CES TÉMOINS TIENNENT — mesuré par le lot INSTANT le 27/08 :
 * une étiquette de notification absente des listes de l'app fait sonner la
 * cloche et **n'ouvre rien**. `resolveNotificationDestination` retombe sur
 * `default: return null`, sans la moindre erreur.
 *
 * Mesuré ici AVANT correction : le serveur envoie `subscriptionEnded`
 * (`admin/src/api/user-fcm-token/types/index.ts:99`, posé par
 * `subscription-billing.notifyPayerSubscriptionState`), et cette chaîne
 * n'existait NULLE PART côté app — ni dans `NOTIFICATION_TYPES`, ni dans le
 * routeur. La notification de fin de cadeau serait donc arrivée muette.
 */
describe('ESSAI/E6 — la notification de fin d\'abonnement ouvre l\'écran des offres', () => {
  test('l\'étiquette du serveur est connue de l\'app, au caractère près', () => {
    // ⛔ Ne PAS remplacer par NOTIFICATION_TYPES.SUBSCRIPTION_ENDED des deux
    // côtés : c'est la chaîne littérale du serveur qu'on vérifie ici. Une faute
    // de frappe symétrique se compenserait et le témoin resterait vert sur du
    // code cassé.
    expect(NOTIFICATION_TYPES.SUBSCRIPTION_ENDED).toBe('subscriptionEnded');
    expect(NOTIFICATION_TYPES.SUBSCRIPTION_PAYMENT_FAILED).toBe('subscriptionPaymentFailed');
  });

  test('la fin du cadeau ouvre les offres, sur la carte CLUB', () => {
    // La charge utile est celle que le serveur envoie vraiment
    // (`notifyPayerSubscriptionState` : planCode + subscriptionDocumentId).
    const destination = resolveNotificationDestination({
      planCode: 'fc_trial_club',
      subscriptionDocumentId: 'sub-cadeau-1',
      type: 'subscriptionEnded',
    });

    expect(destination).toEqual({
      params: { focusScope: 'CLUB' },
      route: RouteNames.SubscriptionOffers,
    });
  });

  test('la fin d\'une offre Équipe ouvre les offres sur la carte ÉQUIPE', () => {
    // Un ancien abonné Équipe reposé sur la carte Club verrait la mauvaise
    // offre : `focusScope` se lit sur le plan, il ne se devine pas.
    const destination = resolveNotificationDestination({
      planCode: 'fc_team_2_yearly',
      subscriptionDocumentId: 'sub-2',
      type: 'subscriptionEnded',
    });

    expect(destination?.params?.focusScope).toBe('TEAM');
  });

  test('elle ouvre les offres même sans identifiant ni plan', () => {
    // Le gabarit serveur exige `subscriptionDocumentId`, mais une notification
    // rejouée ou tronquée ne doit pas retomber sur un écran vide.
    const destination = resolveNotificationDestination({ type: 'subscriptionEnded' });

    expect(destination?.route).toBe(RouteNames.SubscriptionOffers);
  });

  test('l\'échec de paiement mène AUSSI aux offres, pas au néant', () => {
    // Même famille, même chemin : ce message-là dit « mets ton moyen de paiement
    // à jour », et l'écran des offres est le seul endroit où le faire.
    const destination = resolveNotificationDestination({
      planCode: 'fc_club_tier_1_yearly',
      subscriptionDocumentId: 'sub-1',
      type: 'subscriptionPaymentFailed',
    });

    expect(destination?.route).toBe(RouteNames.SubscriptionOffers);
  });
});
