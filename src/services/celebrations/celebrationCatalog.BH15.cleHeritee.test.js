import { buildCelebrationPayload } from './celebrationCatalog';

// BH15 · P3-20 — une clé héritée d'Object.prototype (« constructor ») ne fait pas planter la fête.
describe('buildCelebrationPayload', () => {
  it.each(['constructor', 'toString', '__proto__'])('rend null pour la clé %s', (cle) => {
    expect(buildCelebrationPayload(cle)).toBeNull();
  });
});
