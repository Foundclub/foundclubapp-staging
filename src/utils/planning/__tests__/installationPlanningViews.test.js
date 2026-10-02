import {
  pageDAujourdhui,
  pageSuivante,
  plageDeLaVue,
  VUES,
} from '../installationPlanningViews';

// COLL-C2B (02/10) — les 5 vues du planning d une installation : ce que chacune lit, et ou
// menent les fleches. (Les vues proposees et la vue par defaut : temoin COLL-C2B.planningVues.)

const MERCREDI = new Date(2026, 2, 4, 12, 0, 0);

describe('installationPlanningViews — la periode lue par chaque vue', () => {
  it('Jour, Semaine, Liste : la semaine ; 3 jours : veille et lendemain ; Mois : le mois', () => {
    const semaine = { from: '2026-03-02', to: '2026-03-08' };
    expect(plageDeLaVue(VUES.jour, MERCREDI)).toEqual(semaine);
    expect(plageDeLaVue(VUES.semaine, MERCREDI)).toEqual(semaine);
    expect(plageDeLaVue(VUES.liste, MERCREDI)).toEqual(semaine);
    expect(plageDeLaVue(VUES.troisJours, MERCREDI))
      .toEqual({ from: '2026-03-03', to: '2026-03-05' });
    expect(plageDeLaVue(VUES.mois, MERCREDI)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });
});

describe('installationPlanningViews — les fleches et « Aujourd hui »', () => {
  it('un jour, trois jours, une semaine, un mois', () => {
    expect(pageSuivante(VUES.jour, MERCREDI, 1).getDate()).toBe(5);
    expect(pageSuivante(VUES.troisJours, MERCREDI, -1).getDate()).toBe(1);
    expect(pageSuivante(VUES.semaine, MERCREDI, 1).getDate()).toBe(11);
    expect(pageSuivante(VUES.liste, MERCREDI, -1).getDate()).toBe(25);
    expect(pageSuivante(VUES.mois, MERCREDI, 1).getMonth()).toBe(3);
  });

  it('« Aujourd hui » ne sert que si la page ne le contient pas', () => {
    const jeudi = new Date(2026, 2, 5, 9, 0, 0);
    expect(pageDAujourdhui(VUES.jour, MERCREDI, jeudi)).toBe(false);
    expect(pageDAujourdhui(VUES.troisJours, MERCREDI, jeudi)).toBe(true);
    expect(pageDAujourdhui(VUES.semaine, MERCREDI, jeudi)).toBe(true);
    expect(pageDAujourdhui(VUES.mois, MERCREDI, new Date(2026, 3, 1))).toBe(false);
  });
});
