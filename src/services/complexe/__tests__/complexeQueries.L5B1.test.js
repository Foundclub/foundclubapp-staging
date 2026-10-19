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
  marquerNonHonoree: jest.fn(async () => ({ data: { documentId: 'r-1' } })),
};
jest.mock('../complexeService', () => ({
  annulerNonHonoree: (/** @type {any[]} */ ...args) => mockService.annulerNonHonoree(...args),
  annulerReservationGeree: (/** @type {any[]} */ ...args) => (
    mockService.annulerReservationGeree(...args)
  ),
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
