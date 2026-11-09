import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { indexOfStep, matchSignal } from '@/domains/tour/tourGuideEngine';

// GUIDE-D-CORR-3, M1082 (TestFlight 2.6.97, 09/11) : « ça me dit de revenir quand il y aura plus
// de 2 membres pour créer une conversation. Il faut créer de faux joueurs pour la simulation. »
// Décidé par le chef : les bonus 2 et 3 se jouent en SIMULATION, comme le bonus 1 (cotisation
// d'exemple) et le bonus 4 (annonce d'exemple). Les écrans lisent ces drapeaux.

const profile = PRESIDENT_GUIDE;
const ctx = { created: {}, flags: {} };
const step = (id) => profile.steps[indexOfStep(profile, id)];

describe('B2 et B3 se jouent en simulation', () => {
  it('B2 : l étape du canal demande un canal d exemple s il manque', () => {
    expect(step('b2-canal').simulatesCanal).toBe(true);
  });

  it('B3 : la liste, le nom et la création sont simulés', () => {
    ['b3-sel', 'b3-name', 'b3-create'].forEach((id) => {
      expect(step(id).simulatesGroup).toBe(true);
    });
  });

  it('B3 : la bulle de création ne dit plus que le groupe est réel', () => {
    expect(step('b3-create').text).not.toMatch(/réel/);
    expect(step('b3-create').text).toMatch(/simulation/i);
    const done = matchSignal(profile, indexOfStep(profile, 'b3-create'), {
      key: 'conversation.group.created', kind: 'action',
    }, ctx);
    expect(done.completes).toBe(true);
  });
});

// Tournée émulateur du train 7 (09/11, 18:10) : le groupe simulé du bonus 3 sortait au bilan
// « Groupe créé · RÉEL ». Le bilan ne nomme que ce qui existe pour de vrai.
describe('Bilan : un groupe simulé n est pas un groupe réel', () => {
  const texte = (key, fallback) => fallback;

  it('le groupe simulé ne figure pas au bilan', () => {
    const lignes = profile.closingLines(texte, {
      created: { 'conversation.group.created': { at: null, simulated: true } },
    });
    expect(lignes).not.toContain('Groupe créé');
  });

  it('un vrai groupe y figure toujours', () => {
    const lignes = profile.closingLines(texte, {
      created: { 'conversation.group.created': { at: null } },
    });
    expect(lignes).toContain('Groupe créé');
  });
});
