import { formatTournamentRoundLabel } from '../tournamentUtils';

// REPRISE-TEXTES, point 24 (contre-recette du parent, 01/11) — « Poule A - Journee 1 » sur le match
// et l'onglet Matchs du tournoi : le serveur écrivait « Journee » dans `roundLabel`. Le serveur est
// corrigé ; les matchs déjà créés gardent ce texte en base, l'affichage le répare.
test('🔴 « Journee » s’affiche « Journée »', () => {
  expect(formatTournamentRoundLabel('Poule A - Journee 1')).toBe('Poule A - Journée 1');
  expect(formatTournamentRoundLabel('Journee 12')).toBe('Journée 12');
});

test('un libellé déjà juste, vide ou absent ne change pas', () => {
  expect(formatTournamentRoundLabel('Poule B - Journée 2')).toBe('Poule B - Journée 2');
  expect(formatTournamentRoundLabel('Quart de finale')).toBe('Quart de finale');
  expect(formatTournamentRoundLabel('')).toBe('');
  expect(formatTournamentRoundLabel(undefined)).toBe('');
});
