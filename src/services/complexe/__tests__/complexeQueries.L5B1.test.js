import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import * as requetes from '../complexeQueries';

// RESA-L5B-1 (20/10/2026) — les gestes du gérant passent tous par `useGeste` : l'écran dit le refus
// lui-même (`meta.preventToastError`) et tout le préfixe `['complexe']` est relu ensuite (la liste,
// la fiche, l'accueil suivent ensemble). Le fichier n'avait aucun témoin direct (E6) : le premier
// bloc décrit ce comportement sur un geste EXISTANT (`useAnnulerReservation`, RESA-L5A2) ; le
// second, les gestes neufs de RESA-L2B (« non honorée »), qui doivent suivre le même chemin.

const mockService = {
  annulerNonHonoree: jest.fn(async () => ({ data: { documentId: 'r-1' } })),
  annulerReservationGeree: jest.fn(async () => ({ data: { documentId: 'r-1' } })),
  apercuReglages: jest.fn(async () => ({ data: { dryRun: true, reservationsPlusJeunes: 2 } })),
  bannir: jest.fn(async () => ({ data: { documentId: 'u-julien' } })),
  debannir: jest.fn(async () => ({ data: { documentId: 'u-julien' } })),
  lireClient: jest.fn(async () => ({ data: { documentId: 'u-julien', noShows: 1 } })),
  marquerNonHonoree: jest.fn(async () => ({ data: { documentId: 'r-1' } })),
};
jest.mock('../complexeService', () => ({
  annulerNonHonoree: (/** @type {any[]} */ ...args) => mockService.annulerNonHonoree(...args),
  annulerReservationGeree: (/** @type {any[]} */ ...args) => (
    mockService.annulerReservationGeree(...args)
  ),
  apercuReglages: (/** @type {any[]} */ ...args) => mockService.apercuReglages(...args),
  bannir: (/** @type {any[]} */ ...args) => mockService.bannir(...args),
  debannir: (/** @type {any[]} */ ...args) => mockService.debannir(...args),
  lireClient: (/** @type {any[]} */ ...args) => mockService.lireClient(...args),
  marquerNonHonoree: (/** @type {any[]} */ ...args) => mockService.marquerNonHonoree(...args),
}));

/**
 * Monte un crochet dans un vrai client react-query et rend sa valeur.
 * @param {() => any} crochet - Le crochet.
 * @returns {Promise<{ client: QueryClient, valeur: () => any }>} Le client et la valeur courante.
 */
const monter = async (crochet) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  /** @type {any} */
  let valeur;
  /**
   * La sonde : elle lit le crochet à chaque rendu.
   * @returns {null} Rien à dessiner.
   */
  function Sonde() {
    valeur = crochet();
    return null;
  }
  await act(async () => {
    renderer.create(
      createElement(QueryClientProvider, { client: queryClient }, createElement(Sonde)),
    );
  });
  return { client: queryClient, valeur: () => valeur };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('E6 — useGeste aujourd’hui (geste existant « Annuler la réservation »)', () => {
  it('appelle le service, puis relit tout le préfixe « complexe »', async () => {
    const { client, valeur } = await monter(() => requetes.useAnnulerReservation());
    const relire = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await valeur().mutateAsync({ complexeId: 'cx-five', motif: 'Pluie', reservationId: 'r-1' });
    });
    expect(mockService.annulerReservationGeree).toHaveBeenCalledWith('cx-five', 'r-1', 'Pluie');
    expect(relire).toHaveBeenCalledWith({ queryKey: ['complexe'] });
  });
});

describe('RESA-L5B-1 — les gestes « non honorée » suivent le même chemin', () => {
  it('marquer, puis relire', async () => {
    const crochet = /** @type {any} */ (requetes).useMarquerNonHonoree;
    expect(typeof crochet).toBe('function');
    const { client, valeur } = await monter(() => crochet());
    const relire = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await valeur().mutateAsync({ complexeId: 'cx-five', reservationId: 'r-1' });
    });
    expect(mockService.marquerNonHonoree).toHaveBeenCalledWith('cx-five', 'r-1');
    expect(relire).toHaveBeenCalledWith({ queryKey: ['complexe'] });
  });

  it('bannir et débannir, puis relire', async () => {
    const { useBannir, useDebannir } = /** @type {any} */ (requetes);
    expect([typeof useBannir, typeof useDebannir]).toEqual(['function', 'function']);
    const ban = await monter(() => useBannir());
    const relireBan = jest.spyOn(ban.client, 'invalidateQueries');
    await act(async () => {
      await ban.valeur()
        .mutateAsync({ ban: { joueur: 'u-julien', reason: 'X' }, complexeId: 'cx-five' });
    });
    expect(mockService.bannir).toHaveBeenCalledWith('cx-five', { joueur: 'u-julien', reason: 'X' });
    expect(relireBan).toHaveBeenCalledWith({ queryKey: ['complexe'] });
    const leve = await monter(() => useDebannir());
    await act(async () => {
      await leve.valeur().mutateAsync({ complexeId: 'cx-five', joueurId: 'u-julien' });
    });
    expect(mockService.debannir).toHaveBeenCalledWith('cx-five', 'u-julien');
  });

  it('la fiche d’un client : lue quand le complexe et le joueur sont connus', async () => {
    const { useClientDuComplexe } = /** @type {any} */ (requetes);
    expect(typeof useClientDuComplexe).toBe('function');
    await monter(() => useClientDuComplexe('cx-five', null));
    expect(mockService.lireClient).not.toHaveBeenCalled();
    const { valeur } = await monter(() => useClientDuComplexe('cx-five', 'u-julien'));
    await act(async () => {
      await new Promise((fin) => { setTimeout(fin, 0); });
    });
    expect(mockService.lireClient).toHaveBeenCalledWith('cx-five', 'u-julien');
    expect(valeur().data).toEqual({ documentId: 'u-julien', noShows: 1 });
  });

  it('B4 — l’aperçu de l’âge : lu seulement quand l’écran le demande', async () => {
    const { useApercuAgeMinimum } = /** @type {any} */ (requetes);
    expect(typeof useApercuAgeMinimum).toBe('function');
    await monter(() => useApercuAgeMinimum('cx-five', 18, { enabled: false }));
    expect(mockService.apercuReglages).not.toHaveBeenCalled();
    const { valeur } = await monter(() => useApercuAgeMinimum('cx-five', 18, { enabled: true }));
    await act(async () => {
      await new Promise((fin) => { setTimeout(fin, 0); });
    });
    expect(mockService.apercuReglages).toHaveBeenCalledWith('cx-five', { minAge: 18 });
    expect(valeur().data).toEqual({ dryRun: true, reservationsPlusJeunes: 2 });
  });

  it('annuler le marquage, puis relire', async () => {
    const crochet = /** @type {any} */ (requetes).useAnnulerNonHonoree;
    expect(typeof crochet).toBe('function');
    const { client, valeur } = await monter(() => crochet());
    const relire = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await valeur().mutateAsync({ complexeId: 'cx-five', reservationId: 'r-1' });
    });
    expect(mockService.annulerNonHonoree).toHaveBeenCalledWith('cx-five', 'r-1');
    expect(relire).toHaveBeenCalledWith({ queryKey: ['complexe'] });
  });
});
