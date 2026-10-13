// I18N-4 : le code teste lit ses textes par i18next (interpolation, pluriels) ;
// ce temoin initialise le VRAI i18next en francais, sans rien changer a ce qu'il affirme.
import '@/theme/strings';

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
  // PAR-L2L3 · L3 (12/10, PAR-007) — l'ENFANT passe au premier plan : son prénom
  // et son âge font le TITRE (« Léa, 7 ans »), la phrase dit ce qu'il demande, et
  // le parent devient le second plan (gardé dans `meta`, la carte le nomme).
  it('la ligne dit POUR QUI, avec le prenom et l age, et propose Accepter / Refuser', () => {
    const ligne = mapClubInterestRequestToHubItem(DEMANDE_POUR_LEA);

    expect(ligne.actions).toEqual({ primary: 'accept', secondary: 'reject' });
    expect(ligne.type).toBe('interest');
    expect(ligne.title).toBe('Léa, 7 ans');
    expect(ligne.subtitle).toBe('Demande une place dans U11.');
    expect(ligne.meta).toEqual(expect.objectContaining({
      childAge: 7,
      childFirstname: 'Léa',
      childId: 'enfant-lea',
      requestId: 'interest-lea',
    }));
  });

  it('le parent reste joignable en second plan : son nom et son identifiant', () => {
    const ligne = mapClubInterestRequestToHubItem(DEMANDE_POUR_LEA);

    expect(ligne.meta).toEqual(expect.objectContaining({
      requesterId: 'parent-1',
      requesterName: 'Karim Benali',
    }));
    expect(ligne.title).not.toContain('Karim');
  });

  it('sans equipe nommee, la place est demandee dans le club', () => {
    const { team, ...sansEquipe } = DEMANDE_POUR_LEA;
    expect(team).toBeDefined();

    const ligne = mapClubInterestRequestToHubItem(sansEquipe);

    expect(ligne.subtitle).toBe('Demande une place dans FC Test.');
  });

  it('un age inconnu ne s invente pas : le prenom seul, sans « ans »', () => {
    const ligne = mapClubInterestRequestToHubItem({
      ...DEMANDE_POUR_LEA,
      declaredChild: { age: null, documentId: 'enfant-lea', firstname: 'Léa' },
    });

    expect(ligne.title).toBe('Léa');
    expect(ligne.subtitle).toBe('Demande une place dans U11.');
  });

  it('l interet d un ADULTE ne change pas d un pixel', () => {
    const { declaredChild, ...demandeAdulte } = DEMANDE_POUR_LEA;
    expect(declaredChild).toBeDefined();

    const ligne = mapClubInterestRequestToHubItem(demandeAdulte);

    expect(ligne.actions).toEqual({ primary: 'respond', secondary: 'chat' });
    expect(ligne.subtitle).toContain('est intéressé par U11');
    expect(ligne.title).toBe('Intérêt club');
    expect(ligne.meta.childId).toBeUndefined();
  });
});
