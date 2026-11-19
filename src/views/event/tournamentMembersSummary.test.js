/**
 * T-JOUEURS (17/11/2026, Adel « joueurs- B ») — LA CARTE D'UNE ÉQUIPE DE TOURNOI DIT LE VRAI
 * NOMBRE.
 *
 * Avant : « 0 joueur, 0 présent, 0 en attente » sur chaque carte (recette 41, tournoi TEST 3442,
 * équipe « Recette Site 333 » : 3 au roster, 1/5 payée). Le serveur ne rend pas `members` à qui
 * n'est pas de l'équipe ; il rend maintenant `membersSummary` (admin tournament-payment.js
 * `membersSummaries`). Sans `membersSummary` (serveur plus ancien), l'affichage d'avant reste.
 */
import fs from 'fs';
import path from 'path';

import {
  formatTournamentPlayerShortLine,
  formatTournamentPlayersShortList,
  getTournamentMembersSummaryLine,
  getTournamentRosterSummary,
} from './tournamentUtils';

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// L'équipe telle que la fiche du tournoi la reçoit d'un compte sans lien : `members` retiré.
const recetteSite333 = {
  documentId: 'equipe-333',
  membersSummary: {
    count: 3,
    list: [
      { firstName: 'Samir', lastInitial: 'B', paid: true },
      { firstName: 'Lina', lastInitial: 'D', paid: false },
      { firstName: '', lastInitial: '', paid: false },
    ],
    paidCount: 1,
    pendingCount: 2,
  },
  name: 'Recette Site 333',
  status: 'pending',
};
const payant = { entryFeeCents: 2000, maxRosterSize: 8, minRosterSize: 5 };

describe('T-JOUEURS — la carte d\'une équipe de tournoi', () => {
  test('3 joueurs, plus « 0 joueur » : le compteur passe par le résumé du serveur', () => {
    const summary = getTournamentRosterSummary(recetteSite333, payant);
    expect(summary.totalCount).toBe(3);
    expect(getTournamentMembersSummaryLine(summary.membersSummary, payant))
      .toBe('3 joueurs · 1 payé · 2 en attente');
  });

  test('la liste courte : « Samir B. · payé », « Lina D. · en attente », « Joueur »', () => {
    const { membersSummary } = getTournamentRosterSummary(recetteSite333, payant);
    expect(formatTournamentPlayersShortList(membersSummary, payant).split('\n')).toEqual([
      'Samir B. · payé',
      'Lina D. · en attente',
      'Joueur · en attente',
    ]);
  });

  test('tournoi gratuit : le nombre seul, sans « payé » ni « en attente »', () => {
    const gratuit = { maxRosterSize: 8 };
    const { membersSummary } = getTournamentRosterSummary(recetteSite333, gratuit);
    expect(getTournamentMembersSummaryLine(membersSummary, gratuit)).toBe('3 joueurs');
    expect(formatTournamentPlayerShortLine(membersSummary.list[0], gratuit)).toBe('Samir B.');
  });

  test('serveur plus ancien (pas de résumé) : l\'affichage d\'avant, compté sur `members`', () => {
    const ancien = {
      members: [
        { responseStatus: 'present' },
        { responseStatus: 'pending' },
        { responseStatus: 'invited' },
      ],
      name: 'Ancienne',
    };
    const summary = getTournamentRosterSummary(ancien, payant);
    expect(summary.totalCount).toBe(2);
    expect(summary.membersSummary).toBeNull();
    expect(getTournamentMembersSummaryLine(summary.membersSummary, payant)).toBeNull();
  });

  // ORGA-MINIS (aa786bba) : la carte du site était dans le code mort de l'organisateur
  // (ORGANISATEUR 8), retirée ; le site montre les équipes par TournamentTeamsPublic.
  test('la carte de l app lit ce résumé', () => {
    ['EventDetails.js'].forEach((fichier) => {
      const source = fs.readFileSync(path.join(__dirname, fichier), 'utf8');
      expect(source).toMatch(/getTournamentMembersSummaryLine\(/);
      expect(source).toMatch(/formatTournamentPlayersShortList\(/);
    });
  });
});
