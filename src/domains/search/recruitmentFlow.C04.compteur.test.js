import { getProfileFilterCount } from './recruitmentFlow';

// C04 Q3-15 (BUGHUNT phase 2, 25/10) — recrutement, liste des profils : le compteur de filtres
// disait 1 sans rien choisir et 4 pour un seul sport. Le filtre est écrit tel que la feuille
// ProfileFiltersSheet l'envoie (`appliquer`).
const appliquer = ({
  activity = [], category = [], geohash = undefined, names = [], position = [],
} = {}) => ({
  activity,
  activityIds: activity,
  activityNames: names,
  category,
  city: { label: '', value: '' },
  geohash,
  position,
  positions: position,
  radius: 30,
  sectionIds: category,
});

test.each([
  ['rien choisi', appliquer(), 0],
  ['un sport', appliquer({ activity: ['s1'], names: ['Football'] }), 1],
  ['sport, catégorie et poste', appliquer({
    activity: ['s1'], category: ['c1'], names: ['Football'], position: ['Gardien'],
  }), 3],
  ['une ville', appliquer({ geohash: 'u09' }), 1],
  ['aucun filtre enregistré', undefined, 0],
])('🔴 C04 Q3-15 — %s', (_cas, filtres, attendu) => {
  expect(getProfileFilterCount(filtres)).toBe(attendu);
});
