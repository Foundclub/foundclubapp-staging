import { mapClubInterestRequestToHubItem } from './requestMappers';

// ─────────────────────────────────────────────────────────────────────────────
// 👶 PARENT P3 (2026-09-11) — UNE PLACE DEMANDEE POUR UN ENFANT, DANS « DEMANDES ».
//
// Decision d'Adel du 11/09 (« 1- a ») : les responsables de l'equipe voient le
// PRENOM et l'AGE de l'enfant, et ils TRANCHENT : accepter fait entrer l'enfant
// dans l'equipe, refuser efface la demande. La ligne doit donc :
//   · dire POUR QUI est la demande (« Léa (7 ans) »), pas « X est interesse » ;
//   · proposer Accepter / Refuser, et non « Repondre / Ouvrir chat » — un message
//     type laisserait la demande traitee sans que l'enfant soit jamais entre.
// ─────────────────────────────────────────────────────────────────────────────

const DEMANDE_POUR_LEA = {
  club: { documentId: 'club-1', name: 'FC Test' },
  createdAt: '2026-09-11T09:00:00.000Z',
  declaredChild: { age: 7, documentId: 'enfant-lea', firstname: 'Léa' },
  documentId: 'interest-lea',
  status: 'pending',
  team: { documentId: 'team-u11', name: 'U11' },
  user: { documentId: 'parent-1', firstname: 'Karim', lastname: 'Benali' },
};

describe('P3 — une place pour un enfant, dans « Demandes »', () => {
  it('la ligne dit POUR QUI, avec le prenom et l age, et propose Accepter / Refuser', () => {
    const ligne = mapClubInterestRequestToHubItem(DEMANDE_POUR_LEA);

    expect(ligne.actions).toEqual({ primary: 'accept', secondary: 'reject' });
    expect(ligne.type).toBe('interest');
    expect(ligne.subtitle).toContain('Léa (7 ans)');
    expect(ligne.subtitle).toContain('U11');
    expect(ligne.meta).toEqual(expect.objectContaining({
      childAge: 7,
      childFirstname: 'Léa',
      childId: 'enfant-lea',
      requestId: 'interest-lea',
    }));
  });

  it('un age inconnu ne s invente pas : la phrase se passe des parentheses', () => {
    const ligne = mapClubInterestRequestToHubItem({
      ...DEMANDE_POUR_LEA,
      declaredChild: { age: null, documentId: 'enfant-lea', firstname: 'Léa' },
    });

    expect(ligne.subtitle).toContain('Léa');
    expect(ligne.subtitle).not.toContain('ans)');
  });

  it('l interet d un ADULTE ne change pas d un pixel', () => {
    const { declaredChild, ...demandeAdulte } = DEMANDE_POUR_LEA;
    expect(declaredChild).toBeDefined();

    const ligne = mapClubInterestRequestToHubItem(demandeAdulte);

    expect(ligne.actions).toEqual({ primary: 'respond', secondary: 'chat' });
    expect(ligne.subtitle).toContain('est intéressé par U11');
    expect(ligne.meta.childId).toBeUndefined();
  });
});
