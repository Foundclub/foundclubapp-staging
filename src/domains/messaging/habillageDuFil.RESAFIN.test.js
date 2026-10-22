import { nomDansLeCanal } from './habillageDuFil';

// RESA-FIN-APP (20/10/2026) — tournée 2 (E-G12 / E-P12) : le message du gérant aux membres du canal était signé de
// son nom personnel (« Mathis Renaud »). Tranché : un message du canal se lit « signé » par le COMPLEXE (son nom,
// le nom du fil). Hors canal d'un complexe : rien ne change (le nom de l'expéditeur).
describe('RESA-FIN-APP (3) — le canal d’un complexe parle au nom du complexe', () => {
  it('canal d’un complexe : le nom du complexe', () => {
    expect(nomDansLeCanal({ groupName: 'Le Five de Montrivage', participantsCount: 214, type: 'group' }))
      .toBe('Le Five de Montrivage');
  });

  it('un autre fil : rien (le nom de l’expéditeur reste)', () => {
    expect(nomDansLeCanal({ groupName: 'U15 Valbrune', type: 'group' })).toBe('');
    expect(nomDansLeCanal({ type: 'private' })).toBe('');
    expect(nomDansLeCanal(null)).toBe('');
  });
});
