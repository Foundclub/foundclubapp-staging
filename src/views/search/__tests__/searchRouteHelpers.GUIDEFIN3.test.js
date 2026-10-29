import { consumeSearchHubGuidanceSignal } from '../searchRouteHelpers';

// GUIDE-FINITIONS-3, n° 23 du rejeu : le signal d'onglet ne partait qu'à la
// 1ʳᵉ exposition par écran. Un coach qui avait déjà ouvert « Événement » avant
// la bulle m4-tab-ev touchait l'onglet sans que le guide avance (M4 figée).
describe('n° 23 — signal d’onglet de Rechercher', () => {
  it('revenir sur un onglet déjà vu le signale de nouveau', () => {
    const exposed = new Set();
    expect(consumeSearchHubGuidanceSignal('events', exposed)).toBe('search.tab.events');
    expect(consumeSearchHubGuidanceSignal('clubs', exposed)).toBe('search.tab.clubs');
    expect(consumeSearchHubGuidanceSignal('events', exposed)).toBe('search.tab.events');
  });

  it('le même onglet rendu deux fois de suite ne double pas le signal (témoin)', () => {
    const exposed = new Set();
    expect(consumeSearchHubGuidanceSignal('clubs', exposed)).toBe('search.tab.clubs');
    expect(consumeSearchHubGuidanceSignal('clubs', exposed)).toBeNull();
  });
});
