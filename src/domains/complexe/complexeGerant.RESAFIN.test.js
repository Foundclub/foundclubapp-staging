import { CASES_GERER } from './complexeGerant';

// RESA-FIN-APP (20/10/2026) — l'icône de la case « Affiches » s'affichait en CARRÉ PLEIN (relevé pour le site,
// RESA-FIN-SITE) : `share2.png` est une tuile opaque (fond cyan), qu'une teinte remplit en entier. Chaque case
// de l'accueil prend un pictogramme transparent, teinté comme les autres.
describe('RESA-FIN-APP (4) — la case « Affiches » a un pictogramme, pas une tuile pleine', () => {
  it('« Affiches » : `share`', () => {
    expect(CASES_GERER.find((cas) => cas.cle === 'affiches')?.icone).toBe('share');
  });

  it('aucune case n’emploie une tuile pleine (`share2`)', () => {
    expect(CASES_GERER.map((cas) => cas.icone)).not.toContain('share2');
  });
});
