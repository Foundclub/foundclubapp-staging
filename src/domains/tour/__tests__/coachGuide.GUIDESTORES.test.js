import { COACH_GUIDE } from '@/domains/tour/coachGuide';

// GUIDE-STORES (recette RECETTE-GUIDE-AZ, 04/11) : des bulles parlaient de boutons que l'écran n'a
// pas, ou gardaient leur phrase utile pour la fin, coupée par la place de la bulle.

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const bubble = (id, index) => step(id).bubbles[index]();

describe('les bulles disent ce que l écran montre', () => {
  it('m3-place : rien n est promis si le club n a pas d installation ni de bouton d ajout', () => {
    expect(bubble('m3-place', 1)).toMatch(/\?/);
    expect(bubble('m3-place', 2)).not.toMatch(/Ajoute-le ici/);
    expect(bubble('m3-place', 2)).toMatch(/Extérieur/);
  });

  it('m3-when nomme les vrais boutons', () => {
    expect(step('m3-when').text).not.toMatch(/Ouvre « Répéter »/);
    expect(step('m3-when').text).toMatch(/Chaque semaine/);
    expect(step('m3-when').text).toMatch(/Plus d’options/);
    expect(step('m3-when').text.length).toBeLessThanOrEqual(110);
  });

  it('m4-am4 ne suppose pas un terrain proposé', () => {
    expect(step('m4-am4').text).toMatch(/^Tape ta ville/);
  });

  it('rv-m1 et rv-m2 nomment ce qui est à l écran', () => {
    expect(step('rv-m1').text).not.toMatch(/Nouvelle équipe/);
    expect(step('rv-m2').text).toMatch(/⋮/);
    expect(step('rv-m2').text).toMatch(/Partager un lien d’invitation/);
  });

  it('m3-access dit d abord l essentiel, dans la place de la bulle', () => {
    expect(step('m3-access').text).toMatch(/^Pour un entraînement, garde Privé/);
    expect(step('m3-access').text.length).toBeLessThanOrEqual(70);
  });
});

describe('les gestes demandés restent possibles', () => {
  it('m3-team : toutes les équipes sont à portée, pas seulement la première', () => {
    expect(step('m3-team').targets).toContain('teamWizard.field');
    expect(step('m3-team').targets).not.toContain('eventWizard.team.0');
  });

  it('b1-vide : la liste montrée par « ici » n est pas sous le voile', () => {
    expect(step('b1-vide').veil).toBe(false);
  });
});
