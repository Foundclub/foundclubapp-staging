/**
 * INVIT — LE REFUS QUI PARLE FRANCAIS.
 *
 * 🎯 CE QUE CE FILET PROUVE : aucun refus du serveur n'atteint l'ecran en
 * anglais, et aucun refus ne devient une phrase vide. C'est le controle
 * executable de la decision E4 n°3 (« un refus muet est un defaut, pas une
 * regle »).
 *
 * ⚠️ CE QU'IL NE PROUVE PAS : que le serveur envoie bien ces phrases-la. Elles
 * sont recopiees du controleur
 * (admin/src/api/team-membership-request/controllers/team-membership-request.ts:759
 * et :785) le 2026-09-05. Si le serveur les reecrit un jour, ce filet restera
 * vert et l'ecran retombera sur son repli — jamais sur un ecran muet.
 */

import {
  describePersonName,
  describeTeamInvitationRefusal,
  resolveTeamInvitationRefusalCause,
  selectInvitableCandidates,
  TEAM_INVITATION_FALLBACK_MESSAGE,
} from '../teamInvitation';

describe('INVIT — traduire le refus du serveur', () => {
  test('temoin 1 — « deja dans l equipe » se dit en francais', () => {
    const message = describeTeamInvitationRefusal({
      message: 'User already belongs to this team',
      status: 400,
    });

    expect(message).toBe('Cette personne fait déjà partie de l\'équipe.');
    expect(message).not.toMatch(/already/i);
  });

  test('temoin 2 — « invitation deja en attente » se dit en francais', () => {
    expect(describeTeamInvitationRefusal({
      message: 'User already has a pending invitation for this team',
      status: 400,
    })).toBe('Cette personne a déjà une invitation en attente pour cette équipe.');
  });

  test('temoin 3 — un 403 se lit comme un manque de DROIT, pas comme une panne', () => {
    // La policy rend `false` sans phrase : seul le STATUT porte le sens.
    expect(resolveTeamInvitationRefusalCause({ message: 'Forbidden', status: 403 }))
      .toBe('invitation.forbidden');
    expect(describeTeamInvitationRefusal({ message: 'Forbidden', status: 403 }))
      .toBe('Tu n\'as pas le droit d\'inviter dans cette équipe.');
  });

  test('🔒 temoin 4 — un message SERVEUR inconnu n est jamais affiche tel quel', () => {
    const message = describeTeamInvitationRefusal({
      message: 'Some unexpected internal failure',
      status: 500,
    });

    expect(message).toBe(TEAM_INVITATION_FALLBACK_MESSAGE);
    expect(message).not.toMatch(/unexpected/i);
  });

  test('🔒 temoin 5 — meme sans erreur du tout, on rend une phrase', () => {
    expect(describeTeamInvitationRefusal(null)).toBe(TEAM_INVITATION_FALLBACK_MESSAGE);
    expect(describeTeamInvitationRefusal({})).toBe(TEAM_INVITATION_FALLBACK_MESSAGE);
    expect(describeTeamInvitationRefusal(undefined).length).toBeGreaterThan(0);
  });
});

describe('INVIT — qui reste-t-il a inviter', () => {
  const EQUIPE = {
    players: [{ documentId: 'joueuse-1' }],
    trainers: [{ documentId: 'coach-1' }],
  };

  test('temoin 6 — un membre de l equipe n est PAS propose', () => {
    const retenus = selectInvitableCandidates({
      candidates: [{ documentId: 'joueuse-1' }, { documentId: 'inconnue-9' }],
      ...EQUIPE,
    });

    expect(retenus.map((p) => p.documentId)).toEqual(['inconnue-9']);
  });

  test('temoin 7 — un encadrant de l equipe non plus, et moi non plus', () => {
    const retenus = selectInvitableCandidates({
      candidates: [{ documentId: 'coach-1' }, { documentId: 'moi' }, { documentId: 'libre' }],
      currentUserId: 'moi',
      ...EQUIPE,
    });

    expect(retenus.map((p) => p.documentId)).toEqual(['libre']);
  });

  test('temoin 8 — une personne DEJA invitee reste visible, avec son etat', () => {
    // Elle ne disparait pas sous les doigts : elle porte « Invitation envoyée ».
    const retenus = selectInvitableCandidates({
      alreadyInvitedIds: ['libre'],
      candidates: [{ documentId: 'libre' }, { documentId: 'autre' }],
      ...EQUIPE,
    });

    expect(retenus).toHaveLength(2);
    expect(retenus[0].hasPendingInvitation).toBe(true);
    expect(retenus[1].hasPendingInvitation).toBe(false);
  });

  test('🔒 temoin 9 — un profil SANS documentId n est jamais propose', () => {
    // Le serveur le refuserait (« Invited user is required ») : on ne propose
    // pas un geste dont on sait qu il echouera.
    const retenus = selectInvitableCandidates({
      candidates: [{ firstname: 'Sans', lastname: 'Compte' }, { documentId: 'ok' }],
      ...EQUIPE,
    });

    expect(retenus.map((p) => p.documentId)).toEqual(['ok']);
  });

  test('temoin 10 — sans rien du tout, on rend une liste vide, pas une erreur', () => {
    expect(selectInvitableCandidates()).toEqual([]);
    expect(selectInvitableCandidates({ candidates: null })).toEqual([]);
  });

  test('temoin 11 — le nom affiche n est jamais vide', () => {
    expect(describePersonName({ firstname: 'Ada', lastname: 'L' })).toBe('Ada L');
    expect(describePersonName({ username: 'ada33' })).toBe('ada33');
    expect(describePersonName({})).toBe('Cette personne');
  });
});
