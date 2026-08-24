import { OwnAnswerAction, resolveOwnAnswerAction } from './ownAnswerAction';

// LOT R4 (decision d Adel du 2026-08-24) — LA DECISION VIT ICI, ET NULLE PART
// AILLEURS.
//
// Le bouton « Annuler ma participation » de la vue joueur ne choisit plus
// lui-meme entre supprimer et marquer absent : il frappe TOUJOURS la meme
// porte, et c est cette fonction pure qui tranche. Une seule regle, deux
// surfaces (la fiche et la carte de liste) — le libelle ne peut plus dire
// autre chose que ce que le geste fait.
//
// 🔒 LA LIGNE DE PARTAGE, ET ELLE EST CELLE DU SERVEUR :
//   · MEMBRE d une equipe conviee + reponse « present »  → marque ABSENT
//     (`POST /events/:id/missing`, qui EXIGE une equipe source, `event.ts:3068`)
//   · venu du DEHORS                                     → supprime sa reponse
//   · demande EN ATTENTE                                 → supprime sa demande
//     (un demandeur non accepte range dans les absents polluerait le compteur)

const ME = 'user-me';
const me = { documentId: ME };

/**
 * L equipe conviee, dans la forme que le serveur rend sur la fiche.
 * @param {object} [overrides]
 * @returns {any} L evenement.
 */
const buildTeamEvent = (overrides = {}) => ({
  documentId: 'event-1',
  invitedTeams: [],
  missings: [],
  participations: [me],
  team: {
    documentId: 'team-1',
    name: 'Senior A',
    players: [me],
    trainers: [{ documentId: 'user-coach' }],
  },
  ...overrides,
});

// La MEME equipe conviee, mais sans moi dedans : je viens du dehors.
const teamWithoutMe = {
  documentId: 'team-1',
  name: 'Senior A',
  players: [],
  trainers: [],
};

const myAnswer = (participationStatus) => ([{
  documentId: 'participation-1',
  isActive: true,
  participationStatus,
  user: { documentId: ME },
}]);

describe('resolveOwnAnswerAction — R4', () => {
  it('R4/6 — un MEMBRE deja present : on le MARQUE ABSENT, on n efface pas', () => {
    expect(resolveOwnAnswerAction({
      activeEventParticipations: myAnswer('accepted'),
      event: buildTeamEvent(),
      user: me,
    })).toEqual({ kind: OwnAnswerAction.declareMissing, participationId: '' });
  });

  it('R4/7 — 🔒 le meme membre, mais sa demande est EN ATTENTE : suppression pure', () => {
    // Ranger un demandeur non accepte dans les absents fausserait le compteur :
    // il n a jamais ete attendu.
    expect(resolveOwnAnswerAction({
      activeEventParticipations: myAnswer('pending'),
      event: buildTeamEvent({ participations: [] }),
      user: me,
    })).toEqual({
      kind: OwnAnswerAction.deleteParticipation,
      participationId: 'participation-1',
    });
  });

  it('R4/8 — 🔒 un participant VENU DU DEHORS : suppression, comme avant', () => {
    // Aucune equipe source : `POST /missing` le refuserait. Lui promettre
    // « tu seras marque absent » serait lui promettre un appel qui echoue.
    expect(resolveOwnAnswerAction({
      activeEventParticipations: myAnswer('accepted'),
      event: buildTeamEvent({
        team: teamWithoutMe,
      }),
      user: me,
    })).toEqual({
      kind: OwnAnswerAction.deleteParticipation,
      participationId: 'participation-1',
    });
  });

  it('R4/9 — 🔒 un membre d une equipe INVITEE compte comme membre', () => {
    expect(resolveOwnAnswerAction({
      activeEventParticipations: myAnswer('accepted'),
      event: buildTeamEvent({
        invitedTeams: [{ documentId: 'team-2', players: [me] }],
        team: teamWithoutMe,
      }),
      user: me,
    })).toEqual({ kind: OwnAnswerAction.declareMissing, participationId: '' });
  });

  it('R4/10 — 🔒 sans identifiant d evenement, on ne promet rien : suppression', () => {
    // `missingEventMutation` prend `event.documentId` : sans lui, l appel
    // partirait sur `undefined`. Le chemin sur est celui qui a un identifiant.
    expect(resolveOwnAnswerAction({
      activeEventParticipations: myAnswer('accepted'),
      event: buildTeamEvent({ documentId: '' }),
      user: me,
    })).toEqual({
      kind: OwnAnswerAction.deleteParticipation,
      participationId: 'participation-1',
    });
  });

  it('R4/11 — 🔒 ACQUIS : la bascule absent -> present passe avant tout', () => {
    expect(resolveOwnAnswerAction({
      activeEventParticipations: myAnswer('missing'),
      event: buildTeamEvent({ missings: [me], participations: [] }),
      user: me,
    })).toEqual({ kind: OwnAnswerAction.switchToPresent, participationId: '' });
  });
});
