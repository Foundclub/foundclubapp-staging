import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// LOT ROLES2 (recette émulateur du 2026-09-28) — après « Je joue en », le bandeau
// « Voir l'app en joueur » n'apparaissait qu'au redémarrage de l'app.
//
// Côté serveur, la purge du profil est corrigée (admin, ROLES2). Côté app, la
// relecture IMMÉDIATE existait déjà (`membershipChanged` relit `app-bootstrap` et
// `get-me` — la recette la voit partir 23 à 81 ms après le POST). Mais elle peut
// encore tomber sur une copie périmée : chaque réplica du serveur garde 5 s en
// mémoire le numéro de version du profil (`VERSION_CACHE_TTL_MS`,
// admin/src/utils/runtime-cache-version-store.js). Une relecture qui atterrit sur
// un autre réplica dans cette fenêtre rend l'ancien profil — et rien ne relisait
// ensuite. D'où une SECONDE relecture du profil, au-delà de la fenêtre, et
// seulement quand le changement concerne le lecteur lui-même. Écrit ROUGE.

jest.mock('@/services/club/clubMemberRolesService', () => ({
  getClubMemberRoles: jest.fn(),
  updateClubMemberRole: jest.fn(),
}));

const { useUpdateClubMemberRole } = require('@/services/club/clubMemberRolesQueries');
const service = require('@/services/club/clubMemberRolesService');

const PROFILE_KEYS = [['app-bootstrap'], ['get-me']];

/**
 * Monte le hook et rend la mutation et le client.
 * @returns {{ mutation: any, queryClient: QueryClient, unmount: () => void }} La sonde.
 */
const monter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  const sonde = {};
  /**
   * La sonde : elle ne rend rien, elle capture la mutation.
   * @returns {null} Rien.
   */
  function Sonde() {
    sonde.mutation = useUpdateClubMemberRole('club-1');
    return null;
  }
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Sonde)),
    );
  });
  return {
    mutation: sonde.mutation,
    queryClient,
    unmount: () => act(() => arbre.unmount()),
  };
};

const clesInvalidees = (/** @type {jest.SpyInstance} */ espion) => espion.mock.calls
  .map((appel) => JSON.stringify(appel[0]?.queryKey));

const CHANGE = {
  action: 'add', role: 'player', teamDocumentId: 'team-u15', userDocumentId: 'me',
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ROLES2 — le profil du lecteur est relu après SON changement de rôle', () => {
  it('relit tout de suite, PUIS une 2e fois après la fenêtre de 5 s du serveur', async () => {
    service.updateClubMemberRole.mockResolvedValue({
      changed: true,
      member: { documentId: 'me', isSelf: true, playerTeamIds: ['team-u15'] },
    });
    const { mutation, queryClient, unmount } = monter();
    const espion = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await mutation.mutateAsync(CHANGE);
    });
    // Tout de suite : la relecture habituelle (inchangée).
    PROFILE_KEYS.forEach((cle) => expect(clesInvalidees(espion)).toContain(JSON.stringify(cle)));

    espion.mockClear();
    act(() => {
      jest.advanceTimersByTime(4900);
    });
    expect(espion).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1200);
    });
    // Puis la seconde : le PROFIL seulement, pas les dix racines de `membershipChanged`.
    const attendues = PROFILE_KEYS.map((cle) => JSON.stringify(cle)).sort();
    expect(clesInvalidees(espion).sort()).toEqual(attendues);
    unmount();
  });

  it('le rôle d un AUTRE membre : une seule relecture, pas de seconde passe', async () => {
    service.updateClubMemberRole.mockResolvedValue({
      changed: true,
      member: { documentId: 'p2', isSelf: false },
    });
    const { mutation, queryClient, unmount } = monter();
    const espion = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await mutation.mutateAsync({ ...CHANGE, userDocumentId: 'p2' });
    });
    espion.mockClear();
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(espion).not.toHaveBeenCalled();
    unmount();
  });

  it('rien n a changé côté serveur : rien n est relu', async () => {
    service.updateClubMemberRole.mockResolvedValue({
      changed: false,
      member: { documentId: 'me', isSelf: true },
    });
    const { mutation, queryClient, unmount } = monter();
    const espion = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await mutation.mutateAsync(CHANGE);
    });
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(espion).not.toHaveBeenCalled();
    unmount();
  });
});
