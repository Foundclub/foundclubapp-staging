import { QueryClient, QueryObserver } from '@tanstack/react-query';

import {
  invalidateAfterAction,
  resolveNotificationRefreshAction,
} from '@/domains/refresh/afterAction';

import { getReturnRefreshQueryKeys } from '@/app/queryRefreshOnReturn';

describe('PAR-006 — adhesion de l enfant et cache du parent', () => {
  let client;
  let stopObserving;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
    stopObserving = () => {};
  });

  afterEach(() => {
    stopObserving();
    client.clear();
  });

  it('la notification relit une fiche deja ouverte et affiche l equipe accordee', async () => {
    const key = ['declaredChildren', 'mine'];
    client.setQueryData(key, [{ documentId: 'child-1', team: null }]);
    const fetchChildren = jest.fn(async () => [
      { documentId: 'child-1', team: { documentId: 'team-1' } },
    ]);
    const observer = new QueryObserver(client, {
      queryFn: fetchChildren,
      queryKey: key,
      staleTime: 60_000,
    });
    stopObserving = observer.subscribe(() => {});

    await invalidateAfterAction(client, resolveNotificationRefreshAction('clubInterestResponse'));

    expect(fetchChildren).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().data[0].team).toEqual({ documentId: 'team-1' });
  });

  it('une fiche fermee devient perimee sans relire l identite ou les chats du parent', async () => {
    const keys = [['declaredChildren', 'mine'], ['clubInterestRequests', 'mine'],
      ['get-me'], ['app-bootstrap'], ['chats']];
    keys.forEach((queryKey) => client.setQueryData(queryKey, { value: 'cached' }));

    await invalidateAfterAction(client, resolveNotificationRefreshAction('clubInterestResponse'));

    expect(keys.map((queryKey) => client.getQueryState(queryKey).isInvalidated))
      .toEqual([true, true, false, false, false]);
  });

  it('une acceptation relit egalement la famille enfants', async () => {
    client.setQueryData(['declaredChildren', 'mine'], []);
    await invalidateAfterAction(client, 'acceptRequest');
    expect(client.getQueryState(['declaredChildren', 'mine']).isInvalidated).toBe(true);
  });

  it('le retour au premier plan couvre l enfant meme si la notification a ete manquee', () => {
    expect(getReturnRefreshQueryKeys()).toContainEqual(['declaredChildren']);
  });

  it('un message de chat ne declenche pas la relecture des enfants', () => {
    expect(resolveNotificationRefreshAction('newTeamMessage')).toBe('');
  });
});
