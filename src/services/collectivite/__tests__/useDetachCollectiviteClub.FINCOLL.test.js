import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import {
  collectiviteClubQueryKey,
  collectiviteClubsQueryKey,
  useDetachCollectiviteClub,
} from '../collectiviteQueries';

// FIN-COLLECTIVITES 4 (02/11, contre-recette 07:07) — après « Oui, détacher », la console montrait
// 2 × 404 : la fiche du club, encore à l'écran, était relue alors qu'il n'est plus à la Ville. La
// liste et les autres lectures de la Ville se relisent ; la fiche, à sa prochaine ouverture.

const mockLireLaFiche = jest.fn(async () => ({ data: { documentId: 'club-1' } }));
const mockLireLaListe = jest.fn(async () => ({ data: [] }));

jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));

jest.mock('../collectiviteService', () => ({
  detachCollectiviteClub: jest.fn(async () => ({})),
}));

const VILLE = 'ville-1';
const CLUB = 'club-1';

const preparer = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fiche = new QueryObserver(client, {
    queryFn: mockLireLaFiche, queryKey: collectiviteClubQueryKey(VILLE, CLUB),
  });
  const liste = new QueryObserver(client, {
    queryFn: mockLireLaListe, queryKey: collectiviteClubsQueryKey(VILLE),
  });
  const arrets = [fiche.subscribe(() => {}), liste.subscribe(() => {})];
  await act(async () => { await client.refetchQueries(); });
  /** @type {any} */
  let geste;
  /**
   * La sonde garde le geste.
   * @returns {null} Rien à l'écran.
   */
  function Sonde() {
    geste = useDetachCollectiviteClub();
    return null;
  }
  await act(async () => {
    renderer.create(createElement(QueryClientProvider, { client }, createElement(Sonde)));
  });
  mockLireLaFiche.mockClear();
  mockLireLaListe.mockClear();
  return {
    arrets,
    client,
    detacher: () => geste.mutateAsync({ clubId: CLUB, collectiviteId: VILLE }),
  };
};

describe('FIN-COLLECTIVITES 4 — détacher un club ne relit pas sa fiche', () => {
  it('la fiche à l’écran n’est pas relue, la liste l’est une fois', async () => {
    const { arrets, detacher } = await preparer();

    await act(async () => { await detacher(); });

    expect(mockLireLaFiche).not.toHaveBeenCalled();
    expect(mockLireLaListe).toHaveBeenCalledTimes(1);
    arrets.forEach((arret) => arret());
  });

  it('la fiche reste périmée : sa prochaine ouverture la relit', async () => {
    const { arrets, client, detacher } = await preparer();

    await act(async () => { await detacher(); });

    expect(client.getQueryState(collectiviteClubQueryKey(VILLE, CLUB))?.isInvalidated).toBe(true);
    arrets.forEach((arret) => arret());
  });
});
