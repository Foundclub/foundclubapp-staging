import { countClubTrainers } from './clubStaff';

// ROLES2 (recette du 2026-09-28) — « Staff : 1 dirigeant · 0 entraîneur » pour un
// dirigeant qui entraîne les deux équipes : on compte ceux qui ENTRAÎNENT.

describe('ROLES2 — countClubTrainers', () => {
  it('compte une personne qui entraîne deux équipes UNE fois', () => {
    const teams = [{ trainers: [{ documentId: 'u-1' }] }, { trainers: [{ documentId: 'u-1' }] }];
    expect(countClubTrainers({ coachs: [], teams })).toBe(1);
  });

  it('ajoute les comptes Entraîneur sans doublon', () => {
    const coachs = [{ documentId: 'u-2' }, { documentId: 'u-3' }];
    const teams = [{ trainers: [{ documentId: 'u-2' }] }];
    expect(countClubTrainers({ coachs, teams })).toBe(2);
  });

  it('ne compte jamais un compte supprimé', () => {
    const fantome = {
      blocked: true, documentId: 'u-9', email: 'x@deleted.com', username: 'deleted_user_9',
    };
    expect(countClubTrainers({ coachs: [], teams: [{ trainers: [fantome] }] })).toBe(0);
  });

  it('supporte un club sans équipe ni entraîneur', () => {
    expect(countClubTrainers({ coachs: undefined, teams: undefined })).toBe(0);
  });
});
