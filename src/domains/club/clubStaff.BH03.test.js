import { countClubTrainers } from './clubStaff';

// BH03 · P3-16 — un compte Entraineur SUPPRIME etait compte dans le staff
// (seuls les entraineurs d'equipe etaient filtres).
describe('BH03 · P3-16 — countClubTrainers', () => {
  it('ne compte pas un compte Entraineur supprime', () => {
    const fantome = {
      blocked: true, documentId: 'u-9', email: 'x@deleted.com', username: 'deleted_user_9',
    };
    expect(countClubTrainers({ coachs: [fantome], teams: [] })).toBe(0);
  });
});
