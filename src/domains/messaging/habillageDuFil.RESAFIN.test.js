import { nomDansLeCanal, pageDuCanal } from './habillageDuFil';

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

// RESA-FIN-APP (22/10) — le fil du canal porte `complexe: { documentId, name, slug }` (RESA-FIN-SERVEUR) : son
// en-tête ouvre la page du complexe (E-P12 ⇒ E-P02). Lecture tolérante : rien si le fil ne le porte pas.
describe('RESA-FIN-APP — l’en-tête du canal mène à la page du complexe', () => {
  it('canal avec son complexe : le slug', () => {
    expect(pageDuCanal({
      complexe: { documentId: 'cx-five', name: 'Le Five', slug: 'le-five' }, participantsCount: 3, type: 'group',
    })).toBe('le-five');
  });

  it('champ absent, ou autre fil : rien', () => {
    expect(pageDuCanal({ participantsCount: 3, type: 'group' })).toBe('');
    expect(pageDuCanal({ complexe: { slug: 'le-five' }, type: 'group' })).toBe('');
  });
});
