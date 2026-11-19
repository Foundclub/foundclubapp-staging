import { cleDeSport } from '@/domains/activity/cleDeSport';
import {
  ACTIVITES_PAR_FAMILLE, estDeCompetition, familleDuSport,
} from '@/domains/activity/familleDuSport';

// INSCRIPTION-CODE (19/11) — la table des familles votée en V2 (v2_03) : chaque activité dans UN
// seul groupe ; les doublons de la base (« Volley ») suivent leur sport.
describe('familleDuSport', () => {
  it('132 activités de la recette + 6 de culture à venir, chacune dans une seule famille', () => {
    const cles = Object.values(ACTIVITES_PAR_FAMILLE).flat().map(cleDeSport);
    expect(cles).toHaveLength(138);
    expect(new Set(cles).size).toBe(138);
  });

  it.each([
    ['Football', 'equipe'], ['Volley', 'equipe'], ['VOLLEY-BALL', 'equipe'], ['Padel', 'raquette'],
    ['Judo', 'combat'], ['Karaté', 'combat'], ['Natation', 'individuel'],
    ['spéléologie', 'nature'], ['Randonnée', 'nature'], ['Danse', 'culture'], ['Musique', 'culture'],
  ])('%s → %s', (nom, famille) => {
    expect(familleDuSport(nom)).toBe(famille);
  });

  it('un nom inconnu ou vide n\'a pas de famille et garde le parcours de compétition', () => {
    expect(familleDuSport('Quidditch')).toBeNull();
    expect(familleDuSport('')).toBeNull();
    expect(estDeCompetition(undefined)).toBe(true);
    expect(estDeCompetition('Spéléologie')).toBe(false);
    expect(estDeCompetition('Judo')).toBe(true);
  });
});
