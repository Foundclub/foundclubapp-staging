/* eslint-disable max-len -- les cas se lisent en entier */
// RETOUCHES-R50 (20/11/2026, tournée de photos de la recette 50, écran 8b, reco « avant » suivie par
// Adel) — L'ONGLET ÉQUIPES DU SITE ÉTAIT VIDE alors que 21 équipes étaient inscrites.
// Cause : le site cachait la liste quand la CAPACITÉ du tournoi est inconnue
// (`isTournamentTeamsCountHidden` rendait vrai), alors que le téléphone ne la cache que si la capacité
// est connue ET le seuil des 30 % pas atteint (EventDetails.js, `listeDesEquipesMasquee`).
// Le joueur connecté ne voyait que sa propre équipe ; Android listait tout.
jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({ useGetTournamentTeam: jest.fn() }));

/* eslint-disable import/first -- le double du service passe avant les imports */
import { isTournamentTeamsCountHidden } from '../components/TournamentFicheWeb';
import { getTournamentTeamsCapacity, isTournamentTeamsCountShown } from '../tournamentTeamsCount';

// La règle du téléphone, mot pour mot (EventDetails.js).
const regleDuTelephone = (event) => Boolean(
  getTournamentTeamsCapacity(event) && !isTournamentTeamsCountShown(event),
);

const tournoi = (summary, tournamentConfig = {}) => ({ tournamentConfig, tournamentTeamsSummary: summary });

describe('RETOUCHES-R50 8b : le site masque la liste des équipes comme le téléphone', () => {
  test('🔴 capacité inconnue, 21 inscrites : la liste n’est PAS masquée (le site la masquait)', () => {
    const event = tournoi({ expectedCount: null, registeredCount: 21 });
    expect(isTournamentTeamsCountHidden(event)).toBe(false);
  });

  test.each([
    ['capacité inconnue, 21 inscrites', { expectedCount: null, registeredCount: 21 }, {}],
    ['24 attendues, 21 inscrites (au-dessus du seuil)', { expectedCount: 24, registeredCount: 21 }, {}],
    ['24 attendues, 3 inscrites (sous le seuil de 8)', { expectedCount: 24, registeredCount: 3 }, {}],
    ['24 attendues, 8 inscrites (pile au seuil)', { expectedCount: 24, registeredCount: 8 }, {}],
    ['capacité par maxTeams seulement, 2 inscrites', { registeredCount: 2 }, { maxTeams: 24 }],
    ['ni capacité ni nombre', {}, {}],
  ])('même réponse que le téléphone : %s', (_nom, summary, config) => {
    const event = tournoi(summary, config);
    expect(isTournamentTeamsCountHidden(event)).toBe(regleDuTelephone(event));
  });

  test('caractérisant : sous le seuil avec une capacité connue, la liste reste masquée', () => {
    expect(isTournamentTeamsCountHidden(tournoi({ expectedCount: 24, registeredCount: 3 }))).toBe(true);
  });
});
