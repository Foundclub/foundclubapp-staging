import { QueryClient, QueryObserver } from '@tanstack/react-query';

import {
  cancelScheduledSubscriptionStateRefresh,
  scheduleSubscriptionStateRefresh,
} from './subscriptionRefresh';

/**
 * Contrôles du calendrier de convergence (L08). Ce qu'ils protègent :
 * - il s'arrête dès que l'état a bougé, au lieu de consommer sa fenêtre —
 *   sinon on rouvre la vanne à rafales de `/app/bootstrap` fermée le 30/07 ;
 * - un second appel pendant qu'un calendrier tourne ne le remplace pas ;
 * - l'annulation arrête bien les relances restantes.
 */

const ABONNEMENT_ACTIF = { activePlanCodes: ['TEAM_2_YEARLY'], hasTeamPlan: true };

let nombreDAppels = 0;
let appelDeBascule = Number.POSITIVE_INFINITY;

const getBootstrap = jest.fn(async () => {
  nombreDAppels += 1;
  return {
    subscriptionSummary: nombreDAppels >= appelDeBascule ? ABONNEMENT_ACTIF : null,
  };
});

/**
 * Monte un observateur actif sur `['app-bootstrap']` : sans lui,
 * `invalidateQueries` marque la query périmée sans jamais la relire.
 * @param {any} queryClient - Le client de test.
 * @returns {Promise<{ desabonner: () => void }>} L'observateur monté.
 */
const monterObservateurBootstrap = async (queryClient) => {
  const observer = new QueryObserver(queryClient, {
    queryFn: getBootstrap,
    queryKey: ['app-bootstrap', 'jeton-de-test'],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 30,
  });
  const desabonner = observer.subscribe(() => {});
  await observer.refetch();
  return { desabonner };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  cancelScheduledSubscriptionStateRefresh();
  nombreDAppels = 0;
  appelDeBascule = Number.POSITIVE_INFINITY;
});

afterEach(() => {
  cancelScheduledSubscriptionStateRefresh();
  jest.useRealTimers();
});

describe('scheduleSubscriptionStateRefresh', () => {
  it('s\'arrête dès que l\'état d\'abonnement a bougé', async () => {
    const queryClient = new QueryClient();
    const { desabonner } = await monterObservateurBootstrap(queryClient);
    // Le serveur ouvre les droits à la 3ᵉ lecture (1 = montage, 2 = 1ʳᵉ relance).
    appelDeBascule = 3;

    const aConverge = await scheduleSubscriptionStateRefresh(queryClient, {
      delaysMs: [0, 0, 0, 0, 0],
    });

    expect(aConverge).toBe(true);
    // 5 relances étaient permises : on s'est arrêté à la 2ᵉ.
    expect(nombreDAppels).toBe(3);
    desabonner();
  });

  it('rend la main sans converger quand le serveur ne bouge pas', async () => {
    const queryClient = new QueryClient();
    const { desabonner } = await monterObservateurBootstrap(queryClient);

    const aConverge = await scheduleSubscriptionStateRefresh(queryClient, {
      delaysMs: [0, 0, 0],
    });

    expect(aConverge).toBe(false);
    expect(nombreDAppels).toBe(4);
    desabonner();
  });

  it('ne remplace pas un calendrier déjà en cours (anti-rafale)', async () => {
    const queryClient = new QueryClient();
    const { desabonner } = await monterObservateurBootstrap(queryClient);

    const premier = scheduleSubscriptionStateRefresh(queryClient, { delaysMs: [0, 1000] });
    await Promise.resolve();
    const second = await scheduleSubscriptionStateRefresh(queryClient, { delaysMs: [0] });

    expect(second).toBe(false);
    const appelsAvantEcheance = nombreDAppels;

    // Le premier calendrier doit avoir survécu : sa relance à 1 s doit partir.
    await jest.advanceTimersByTimeAsync(1000);
    await premier;
    expect(nombreDAppels).toBe(appelsAvantEcheance + 1);
    desabonner();
  });

  it('annule les relances restantes', async () => {
    const queryClient = new QueryClient();
    const { desabonner } = await monterObservateurBootstrap(queryClient);

    const enCours = scheduleSubscriptionStateRefresh(queryClient, { delaysMs: [0, 1000] });
    await Promise.resolve();
    cancelScheduledSubscriptionStateRefresh();
    const appelsAvantAnnulation = nombreDAppels;

    await jest.advanceTimersByTimeAsync(1000);
    expect(await enCours).toBe(false);
    expect(nombreDAppels).toBe(appelsAvantAnnulation);
    desabonner();
  });
});
