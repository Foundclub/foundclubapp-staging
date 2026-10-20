import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

// R17-CONTROLES (20/10, REC17-011 lot 2, decision d Adel Q6 B ; planche P11-q6-exemple-tel,
// image 3) — LE RAPPEL 30 JOURS AVANT : la notification que le serveur envoie (admin
// src/api/facility-check/services/facility-check.ts, runDueReminders) ouvre la fiche de
// l installation de la Ville SUR son onglet « Sécurité et suivi », ou vit le carnet. Le serveur
// nomme la route ; ce temoin prouve que l app la connait et lui passe l onglet, tels quels.
const PARAMS = {
  collectiviteId: 'ville-montrivage',
  facilityId: 'gym-tilleuls',
  onglet: 'securite',
};

describe('R17CTRL — l appui sur le rappel d un controle', () => {
  it('ouvre CollectiviteInstallation sur l onglet securite (Ville, installation)', () => {
    const destination = resolveNotificationDestination({
      audience: 'collectivite',
      checkId: 'c-ext',
      ctaParams: PARAMS,
      ctaRoute: 'CollectiviteInstallation',
      type: 'facilityCheckDue',
    });

    expect(RouteNames.CollectiviteInstallation).toBe('CollectiviteInstallation');
    expect(destination).toEqual({ params: PARAMS, route: RouteNames.CollectiviteInstallation });
  });
});
