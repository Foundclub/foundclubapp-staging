import { OwnAnswerAction, resolveOwnAnswerAction } from './ownAnswerAction';

// LOT L22 (defaut D3 / audit T3 « bonus constate ») — filet sur la decision
// derriere le bouton qui porte la reponse du joueur, extraite de
// `handleDeleteParticipation` (EventDetails.js, 6 000 lignes, aucun test — E6).
// Meme motif que `eventAttendanceGate.js` : la decision est pure et testee ici,
// l'Alert reste dans l'ecran.
//
// Le defaut corrige : « Modifier ma reponse » SUPPRIMAIT la reponse. La branche
// qui devait basculer absent -> present etait inatteignable, parce qu'elle etait
// gardee par « aucune ligne de participation » alors qu'une reponse « absent »
// EST une participation active. C'est le tri qui etait faux, pas le libelle.
//
// Reference : docs/AUDIT_PARTICIPATION_2026_08_02.md, T3.

const ME = 'user-me';
const me = { documentId: ME };

// Une reponse « absent » EST une participation active : le serveur ecrit une
// ligne `missing` (isActive: true) ET ajoute le joueur a `event.missings`.
const answeredAbsent = {
  activeEventParticipations: [
    {
      documentId: 'participation-1',
      isActive: true,
      participationStatus: 'missing',
      user: { documentId: ME },
    },
  ],
  event: { documentId: 'event-1', missings: [me], participations: [] },
  user: me,
};

const answeredPresent = {
  activeEventParticipations: [
    {
      documentId: 'participation-2',
      isActive: true,
      participationStatus: 'accepted',
      user: { documentId: ME },
    },
  ],
  event: { documentId: 'event-1', missings: [], participations: [me] },
  user: me,
};

describe('resolveOwnAnswerAction (caracterisation)', () => {
  it('le joueur a repondu ABSENT : le bouton fait ce qu il dit, il BASCULE', () => {
    // Le bouton s'appelle « Modifier ma reponse » (EventAnswerButtons.js, cle
    // `eventDetails.actions.editResponse`) et la modale de bascule existait deja
    // dans fr.js — elle etait simplement inatteignable.
    expect(resolveOwnAnswerAction(answeredAbsent)).toEqual({
      kind: OwnAnswerAction.switchToPresent,
      participationId: '',
    });
  });

  it('la bascule ne depend plus de l absence de ligne : les 2 signaux la declenchent', () => {
    // Le serveur produit TOUJOURS les deux ensemble (une ligne `missing` active
    // ET le joueur dans `event.missings`) : c est ce cumul qui rendait la
    // branche inatteignable. Chaque signal seul doit suffire.
    expect(resolveOwnAnswerAction({ ...answeredAbsent, activeEventParticipations: [] }))
      .toEqual({ kind: OwnAnswerAction.switchToPresent, participationId: '' });

    expect(resolveOwnAnswerAction({
      ...answeredAbsent,
      event: { documentId: 'event-1', missings: [], participations: [] },
    })).toEqual({ kind: OwnAnswerAction.switchToPresent, participationId: '' });
  });

  it('ACQUIS protege — le joueur a repondu PRESENT : le bouton annule sa reponse', () => {
    expect(resolveOwnAnswerAction(answeredPresent)).toEqual({
      kind: OwnAnswerAction.deleteParticipation,
      participationId: 'participation-2',
    });
  });

  it('ACQUIS protege — present sans ligne lisible : on le declare absent', () => {
    expect(resolveOwnAnswerAction({
      ...answeredPresent,
      activeEventParticipations: [],
    })).toEqual({ kind: OwnAnswerAction.declareMissing, participationId: '' });
  });

  it('ACQUIS protege — aucune reponse retrouvee, et visiteur sans identite', () => {
    expect(resolveOwnAnswerAction({
      activeEventParticipations: [],
      event: { documentId: 'event-1', missings: [], participations: [] },
      user: me,
    })).toEqual({ kind: OwnAnswerAction.notFound, participationId: '' });

    expect(resolveOwnAnswerAction({ event: {}, user: null }))
      .toEqual({ kind: OwnAnswerAction.none, participationId: '' });
  });
});
