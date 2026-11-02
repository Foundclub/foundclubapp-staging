import { compterAttendus, listConvoquesSansCompte } from '../attendanceCallModel';

// FIN-EVENEMENTS 3 — « 0 attendu » pour 2 convoqués : la feuille de présence ne liste que
// des comptes. Les convoqués sans compte se lisent dans la convocation publiée.

const PAUL = {
  documentId: 'manuel-paul', firstname: 'Paul', isManual: true, participantSource: 'manual',
};
const LINA = { documentId: 'fiche-lina', firstname: 'Lina', participantSource: 'declared_child' };
const HUGO = { documentId: 'hugo', firstname: 'Hugo', participantSource: 'team_player' };

const branche = (/** @type {any[]} */ joueurs, /** @type {any[]} */ reserve = []) => ({
  published: {
    manualPlayers: joueurs.filter((joueur) => joueur.isManual),
    reservePlayerIds: reserve.map((joueur) => joueur.documentId),
    reserveSnapshotPlayers: reserve,
    snapshotPlayers: joueurs,
    teams: [{ placements: joueurs.map((joueur) => ({ playerId: joueur.documentId })) }],
  },
});

describe('listConvoquesSansCompte', () => {
  it('garde le joueur sans app et la fiche enfant, pas les comptes', () => {
    const lignes = listConvoquesSansCompte({ branches: [branche([PAUL, LINA, HUGO])] });

    expect(lignes.map((ligne) => ligne.playerId)).toEqual(['manuel-paul', 'fiche-lina']);
  });

  it('compte aussi le banc', () => {
    const lignes = listConvoquesSansCompte({ branches: [branche([HUGO], [LINA])] });

    expect(lignes.map((ligne) => ligne.playerId)).toEqual(['fiche-lina']);
  });

  it('lit une charge sans branches (`published` à plat)', () => {
    expect(listConvoquesSansCompte(branche([PAUL]))).toHaveLength(1);
  });

  it('la même personne dans deux branches ne compte qu’une fois', () => {
    const lignes = listConvoquesSansCompte({ branches: [branche([LINA]), branche([LINA])] });

    expect(lignes).toHaveLength(1);
  });

  it('sans convocation publiée : personne', () => {
    expect(listConvoquesSansCompte(null)).toEqual([]);
    expect(listConvoquesSansCompte({ branches: [] })).toEqual([]);
    expect(listConvoquesSansCompte({ branches: [{ published: null }] })).toEqual([]);
  });
});

describe('compterAttendus', () => {
  const CONVOCATION = { branches: [branche([PAUL, LINA])] };

  it('🐞 additionne les comptes de la feuille et les convoqués sans compte', () => {
    expect(compterAttendus([], CONVOCATION)).toBe(2);
    expect(compterAttendus([{ user: { documentId: 'hugo' } }], CONVOCATION)).toBe(3);
  });

  it('feuille pas encore lue : on ne sait pas (`null`), jamais « 0 attendu »', () => {
    expect(compterAttendus(undefined, CONVOCATION)).toBeNull();
  });

  it('sans convocation : la feuille seule', () => {
    expect(compterAttendus([{}, {}], null)).toBe(2);
  });
});
