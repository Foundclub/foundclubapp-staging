import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { getMemberClubIds } from '@/domains/auth/authUseCases';

import { invalidateAfterAction } from '../afterAction';

const avant = {
  club: { documentId: 'club-a' },
  clubAffiliations: [{ club: { documentId: 'club-a' } }],
  documentId: 'joueur',
  myTeams: [{ club: { documentId: 'club-a' }, documentId: 'equipe-a' }],
};
const apres = {
  ...avant, club: null, clubAffiliations: [], myTeams: [],
};

describe('IPH09-SORTIE — les caches suivent le depart confirme par le serveur', () => {
  /** @type {QueryClient} */
  let client;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => { client.clear(); });

  it('relit les familles actives de club, equipe, identite, planning et chats', async () => {
    const keys = [
      ['get-me', 'jeton'], ['app-bootstrap', 'jeton'], ['club', 'club-a', 'prive'],
      ['clubs', 'liste'], ['clubMemberRoles', 'club-a'], ['team', 'equipe-a'], ['teams'],
      ['planning', 'fullscreen', 'personal'], ['events'], ['home-summary'],
      ['chats', 'liste'], ['chat', 'chat-a'],
    ];
    const arreter = keys.map((queryKey) => {
      client.setQueryData(queryKey, avant);
      return new QueryObserver(client, {
        queryFn: async () => apres, queryKey, refetchOnMount: false, staleTime: Infinity,
      }).subscribe(() => {});
    });
    try {
      await invalidateAfterAction(client, 'leaveTeam');
      keys.forEach((key) => expect(client.getQueryData(key)).toEqual(apres));
      expect(getMemberClubIds(client.getQueryData(['get-me', 'jeton']))).not.toContain('club-a');
    } finally { arreter.forEach((stop) => stop()); }
  });

  it('marque perimes les clubs non montes pour le retour de navigation', async () => {
    client.setQueryData(['club', 'club-a', 'prive'], avant);
    await invalidateAfterAction(client, 'leaveTeam');
    expect(client.getQueryState(['club', 'club-a', 'prive'])?.isInvalidated).toBe(true);
    const observer = new QueryObserver(client, {
      queryFn: async () => apres, queryKey: ['club', 'club-a', 'prive'], staleTime: Infinity,
    });
    const stop = observer.subscribe(() => {});
    await observer.refetch();
    expect(client.getQueryData(['club', 'club-a', 'prive'])).toEqual(apres);
    stop();
  });

  it('avec l ancien serveur, le profil relu garde le club sans depart fictif', async () => {
    client.setQueryData(['get-me', 'jeton'], avant);
    const observer = new QueryObserver(client, {
      queryFn: async () => ({ ...avant, myTeams: [] }),
      queryKey: ['get-me', 'jeton'],
      refetchOnMount: false,
      staleTime: Infinity,
    });
    const stop = observer.subscribe(() => {});
    await invalidateAfterAction(client, 'leaveTeam');
    expect(getMemberClubIds(client.getQueryData(['get-me', 'jeton']))).toContain('club-a');
    stop();
  });
});
