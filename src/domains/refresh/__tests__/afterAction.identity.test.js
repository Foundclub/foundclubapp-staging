import {
  QueryClient,
  QueryObserver,
} from '@tanstack/react-query';

import { shouldFetchFullUser } from '@/domains/auth/authUseCases';

import {
  AFTER_ACTION_CACHES,
  invalidateAfterAction,
  MEMBERSHIP_NOTIFICATION_TYPES,
  resolveNotificationRefreshAction,
} from '../afterAction';

/**
 * U05 — LES TEMOINS DU BRANCHEMENT, cote identite et cote notification.
 *
 * Ils tournent sur un VRAI `QueryClient` et un VRAI `QueryObserver` : le defaut
 * qu'ils gardent est une regle interne de react-query, pas une intention. Le
 * mocker le rendrait vert des le premier jour, ce qui est exactement ce qui
 * s'est passe pendant des semaines.
 */

/**
 * Monte une query qui a deja ete lue une fois, comme dans l'app.
 * @param {QueryClient} queryClient Le client de test.
 * @param {string[]} queryKey La cle a poser.
 * @param {boolean} enabled L'etat de l'observateur.
 * @returns {{ observer: QueryObserver, compteurDeLectures: () => number, arreter: () => void }}
 *   L'observateur, le compteur d'appels reseau, et son desabonnement.
 */
const monterQueryLue = (queryClient, queryKey, enabled) => {
  let lectures = 0;
  // La donnee est posee AVANT l'abonnement : c'est l'etat de l'app apres un
  // premier `refetch` imperatif, ou apres le `setQueryData` d'un ecran de
  // profil. Poser apres ferait partir une premiere lecture de montage, qui
  // n'existe pas dans l'app et fausserait le compteur.
  queryClient.setQueryData(queryKey, { documentId: 'u-1', lecture: 0 });
  const observer = new QueryObserver(queryClient, {
    enabled,
    queryFn: async () => {
      lectures += 1;
      return { documentId: 'u-1', lecture: lectures };
    },
    queryKey,
    staleTime: 1000 * 60 * 5,
  });
  const desabonner = observer.subscribe(() => {});
  return {
    arreter: desabonner,
    compteurDeLectures: () => lectures,
    observer,
  };
};

describe('U05 — l\'identite lue ne recouvre plus la version fraiche', () => {
  /** @type {QueryClient} */
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('temoin 4 — une identite DESACTIVEE ignore l\'invalidation : c\'est le defaut', async () => {
    const { arreter, compteurDeLectures } = monterQueryLue(queryClient, ['get-me', 'jeton'], false);

    await invalidateAfterAction(queryClient, 'joinTeam');

    // La preuve du defaut, et elle est mecanique : `invalidateQueries` ne
    // re-lit que les queries ACTIVES. Marquee perimee, jamais re-lue.
    expect(compteurDeLectures()).toBe(0);
    arreter();
  });

  it('temoin 4 bis — une identite qui reste ACTIVE obeit a l\'invalidation', async () => {
    const { arreter, compteurDeLectures } = monterQueryLue(queryClient, ['get-me', 'jeton'], true);

    expect(compteurDeLectures()).toBe(0);

    await invalidateAfterAction(queryClient, 'joinTeam');

    expect(compteurDeLectures()).toBe(1);
    arreter();
  });

  it('temoin 4 ter — la regle qui tranche : le profil deja lu reste rafraichissable', () => {
    const conditionsDeDemarrage = {
      hasBootstrapError: false,
      hasBootstrapUser: true,
      isAddingAccount: false,
      isBootstrapDisabled: false,
      isDelayElapsed: true,
      isSignedIn: true,
    };

    // Avant : bootstrap OK et pas encore de profil complet => on ne lit pas.
    expect(shouldFetchFullUser({ ...conditionsDeDemarrage, hasFullUser: false })).toBe(false);
    // Apres : le profil complet EST la source lue => il reste rafraichissable.
    expect(shouldFetchFullUser({ ...conditionsDeDemarrage, hasFullUser: true })).toBe(true);
    // Et rien ne se lit sans jeton, ni pendant l'ajout d'un compte.
    expect(shouldFetchFullUser({
      ...conditionsDeDemarrage, hasFullUser: true, isSignedIn: false,
    })).toBe(false);
    expect(shouldFetchFullUser({
      ...conditionsDeDemarrage, hasFullUser: true, isAddingAccount: true,
    })).toBe(false);
    expect(shouldFetchFullUser({
      ...conditionsDeDemarrage, hasFullUser: true, isDelayElapsed: false,
    })).toBe(false);
  });

  it('temoin 3 — envoyer une demande d\'equipe rend l\'attente lisible tout de suite', async () => {
    // Ce que l'ecran « Mes equipes » lit pour afficher « en attente » : la
    // liste des demandes portee par le profil, et la liste des equipes.
    const { arreter, compteurDeLectures } = monterQueryLue(queryClient, ['get-me', 'jeton'], true);
    queryClient.setQueryData(['teamMembershipRequests', 'team-1'], { valeur: 'lue' });
    queryClient.setQueryData(['teams'], { valeur: 'lue' });

    await invalidateAfterAction(queryClient, 'joinTeam');

    expect(compteurDeLectures()).toBe(1);
    expect(
      queryClient.getQueryCache()
        .find({ exact: true, queryKey: ['teamMembershipRequests', 'team-1'] })
        ?.state?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryCache().find({ exact: true, queryKey: ['teams'] })?.state?.isInvalidated,
    ).toBe(true);
    arreter();
  });
});

describe('U05 — la notification d\'acceptation relit l\'appartenance', () => {
  /** @type {QueryClient} */
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('temoin 2 — les trois types d\'appartenance declenchent le rafraichissement', () => {
    expect(resolveNotificationRefreshAction('teamMembershipRequest')).toBe('membershipChanged');
    expect(resolveNotificationRefreshAction('clubMembershipRequest')).toBe('membershipChanged');
    expect(resolveNotificationRefreshAction('addToTeam')).toBe('membershipChanged');
    expect(MEMBERSHIP_NOTIFICATION_TYPES.length).toBe(3);
  });

  it("temoin 2 bis — elle relit l'appartenance ET l'identite", async () => {
    const { arreter, compteurDeLectures } = monterQueryLue(queryClient, ['get-me', 'jeton'], true);
    queryClient.setQueryData(['teams'], { valeur: 'lue' });
    queryClient.setQueryData(['team', 'team-1'], { valeur: 'lue' });
    queryClient.setQueryData(['home-summary'], { valeur: 'lue' });

    const action = resolveNotificationRefreshAction('teamMembershipRequest');
    await invalidateAfterAction(queryClient, action);

    expect(compteurDeLectures()).toBe(1);
    ['teams', 'team', 'home-summary'].forEach((racine) => {
      const trouvee = queryClient.getQueryCache()
        .findAll({ queryKey: [racine] })
        .every((query) => query.state.isInvalidated);
      expect({ racine, toutesPerimees: trouvee }).toEqual({ racine, toutesPerimees: true });
    });
    arreter();
  });

  it('temoin 6 — une notification ORDINAIRE ne rafraichit RIEN de plus que la cloche', async () => {
    queryClient.setQueryData(['teams'], { valeur: 'lue' });
    queryClient.setQueryData(['planning', 'personal'], { valeur: 'lue' });
    queryClient.setQueryData(['home-summary'], { valeur: 'lue' });

    // Un message de discussion, une convocation, un rappel : la grande majorite
    // du trafic. Les brancher couterait dix requetes par notification recue.
    ['newTeamMessage', 'eventInvitation', 'leagueMatchDisputed', '', undefined].forEach((type) => {
      expect(resolveNotificationRefreshAction(/** @type {any} */ (type))).toBe('');
    });

    [['teams'], ['planning', 'personal'], ['home-summary']].forEach((queryKey) => {
      const query = queryClient.getQueryCache().find({ exact: true, queryKey });
      expect({ perimee: Boolean(query?.state?.isInvalidated), queryKey })
        .toEqual({ perimee: false, queryKey });
    });
  });

  it('temoin 6 bis — l\'action ajoutee ne recharge pas toute l\'app', async () => {
    queryClient.setQueryData(['temoin-etranger'], { valeur: 'lue' });

    await invalidateAfterAction(queryClient, 'membershipChanged');

    expect(
      queryClient.getQueryCache()
        .find({ exact: true, queryKey: ['temoin-etranger'] })?.state?.isInvalidated,
    ).toBe(false);
    expect(AFTER_ACTION_CACHES.membershipChanged.length).toBeGreaterThan(0);
  });
});
