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

// ---------------------------------------------------------------------------
// ABOFIX / A3 — LA FENETRE DE RELECTURE FACE AU VRAI CACHE DU SERVEUR
//
// Le faux serveur ci-dessous ne « fige pas 30 secondes » : il reproduit
// `admin/src/utils/runtime-cache.js` a la lettre, parce que c est LUI qui decide
// quand l app peut voir un achat. Une entree posee a l instant T est
//   - FRAICHE  de T a T+36 s (30 s de TTL + jusqu a 20 % de gigue) : lecture en
//     memoire, aucune requete en base ;
//   - PERIMEE-MAIS-SERVIE ensuite pendant 4 minutes : le serveur rend ENCORE la
//     vieille valeur et ne rafraichit qu en arriere-plan.
//
// Consequence chiffree, et c est tout le sujet du lot : sans la purge serveur
// (A1), un abonnement paye peut rester invisible plus de QUATRE MINUTES. Aucune
// fenetre de relecture cote app ne rattrape ca — c est pour cela que A3 seul ne
// suffit pas, et le second temoin ci-dessous l exige noir sur blanc.
// ---------------------------------------------------------------------------
const TTL_FRAIS_MS = 36 * 1000;
const TTL_PERIME_MS = 4 * 60 * 1000;

describe('scheduleSubscriptionStateRefresh face au cache serveur reel', () => {
  /** Ce que la base contient vraiment, a l instant present. */
  let veriteEnBase = null;
  /** L entree de cache du serveur : `{ poseeA, valeur }`, ou null si purgee. */
  let entreeDeCache = null;

  /** Ce que fait A1 cote serveur quand un achat est traite. */
  const purgerCacheServeur = () => {
    entreeDeCache = null;
  };

  const lireBootstrapViaCacheServeur = jest.fn(async () => {
    const maintenant = Date.now();
    if (entreeDeCache) {
      const age = maintenant - entreeDeCache.poseeA;
      if (age < TTL_FRAIS_MS) {
        return { subscriptionSummary: entreeDeCache.valeur };
      }
      if (age < TTL_FRAIS_MS + TTL_PERIME_MS) {
        // Perime : on ressert l ancienne valeur ET on rafraichit en arriere-plan.
        const valeurServie = entreeDeCache.valeur;
        entreeDeCache = { poseeA: maintenant, valeur: veriteEnBase };
        return { subscriptionSummary: valeurServie };
      }
    }
    entreeDeCache = { poseeA: maintenant, valeur: veriteEnBase };
    return { subscriptionSummary: entreeDeCache.valeur };
  });

  /**
   * Monte un observateur actif sur la query bootstrap.
   * @param {any} queryClient - Le client de test.
   * @returns {Promise<{ desabonner: () => void }>} L observateur monte.
   */
  const monterObservateur = async (queryClient) => {
    const observer = new QueryObserver(queryClient, {
      queryFn: lireBootstrapViaCacheServeur,
      queryKey: ['app-bootstrap', 'jeton-abofix'],
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    });
    const desabonner = observer.subscribe(() => {});
    await observer.refetch();
    return { desabonner };
  };

  beforeEach(() => {
    veriteEnBase = null;
    entreeDeCache = null;
    lireBootstrapViaCacheServeur.mockClear();
  });

  it('webhook a 40 s : la fenetre doit encore le voir', async () => {
    const queryClient = new QueryClient();
    const { desabonner } = await monterObservateur(queryClient);

    // Le store a encaisse, mais le webhook met 40 s a arriver. A1 purge le cache
    // au moment ou le serveur traite l achat : c est la purge qui rend la
    // relecture suivante utile.
    setTimeout(() => {
      veriteEnBase = { activePlanCodes: ['TEAM_1_MONTHLY'], hasTeamPlan: true };
      purgerCacheServeur();
    }, 40000);

    const enCours = scheduleSubscriptionStateRefresh(queryClient);
    await jest.advanceTimersByTimeAsync(120000);

    expect(await enCours).toBe(true);
    desabonner();
  });

  it('sans la purge serveur (A1), meme une fenetre plus longue ne voit rien', async () => {
    const queryClient = new QueryClient();
    const { desabonner } = await monterObservateur(queryClient);

    // Meme scenario, mais le serveur ne purge pas : il vient de reposer une
    // entree fraiche a 37 s avec l ANCIEN etat, valable 36 s de plus.
    setTimeout(() => {
      veriteEnBase = { activePlanCodes: ['TEAM_1_MONTHLY'], hasTeamPlan: true };
    }, 40000);

    const enCours = scheduleSubscriptionStateRefresh(queryClient);
    await jest.advanceTimersByTimeAsync(120000);

    expect(await enCours).toBe(false);
    desabonner();
  });
});
