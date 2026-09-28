import {
  buildMemberRoleChange,
  filterMembersByName,
  hasMemberRole,
  memberRoleChangeNeedsConfirmation,
  replaceMemberRow,
  sortMembersForDisplay,
} from './clubMemberRoles';

// LOT RÔLES (2026-09-28) — la logique pure de l'écran « Membres et rôles ».

const joueur = {
  documentId: 'p1',
  firstname: 'Élodie',
  isManager: false,
  isSelf: false,
  lastname: 'Joueuse',
  playerTeamIds: ['u15'],
  roleKey: 'player',
  trainerTeamIds: [],
};
const moi = {
  documentId: 'me',
  firstname: 'Adel',
  isManager: true,
  isSelf: true,
  lastname: 'Z',
  playerTeamIds: [],
  roleKey: 'president',
  trainerTeamIds: ['seniors'],
};

describe('RÔLES — clubMemberRoles (pur)', () => {
  it('lit les trois rôles là où le serveur les rend', () => {
    expect(hasMemberRole(joueur, 'player', 'u15')).toBe(true);
    expect(hasMemberRole(joueur, 'player', 'seniors')).toBe(false);
    expect(hasMemberRole(moi, 'coach', 'seniors')).toBe(true);
    expect(hasMemberRole(moi, 'manager')).toBe(true);
    expect(hasMemberRole(null, 'manager')).toBe(false);
  });

  it('un appui DONNE le rôle qui manque et RETIRE celui qui est là', () => {
    expect(buildMemberRoleChange(joueur, 'player', 'u15')).toEqual({
      action: 'remove', role: 'player', teamDocumentId: 'u15', userDocumentId: 'p1',
    });
    expect(buildMemberRoleChange(joueur, 'player', 'seniors').action).toBe('add');
    expect(buildMemberRoleChange(joueur, 'manager')).toEqual({
      action: 'add',
      role: 'manager',
      userDocumentId: 'p1',
    });
  });

  it('confirme les retraits et les promotions, jamais l\'ajout d\'un joueur', () => {
    const add = (role) => ({ action: 'add', role });
    expect(memberRoleChangeNeedsConfirmation(add('player'), joueur)).toBe(false);
    expect(memberRoleChangeNeedsConfirmation(add('coach'), joueur)).toBe(true);
    expect(memberRoleChangeNeedsConfirmation(add('coach'), moi)).toBe(false);
    expect(memberRoleChangeNeedsConfirmation(add('manager'), joueur)).toBe(true);
    const retrait = { action: 'remove', role: 'player' };
    expect(memberRoleChangeNeedsConfirmation(retrait, joueur)).toBe(true);
  });

  it('met le lecteur en tête, puis garde l\'ordre du serveur', () => {
    expect(sortMembersForDisplay([joueur, moi]).map((m) => m.documentId)).toEqual(['me', 'p1']);
    expect(sortMembersForDisplay(undefined)).toEqual([]);
  });

  it('cherche sans casse ni accents', () => {
    expect(filterMembersByName([joueur, moi], 'ELODIE').map((m) => m.documentId)).toEqual(['p1']);
    expect(filterMembersByName([joueur, moi], '  ')).toHaveLength(2);
  });

  it('remplace la seule ligne rendue par le serveur', () => {
    const avant = { members: [joueur, moi], teams: [] };
    const apres = replaceMemberRow(avant, { ...joueur, playerTeamIds: [] });
    expect(apres.members[0].playerTeamIds).toEqual([]);
    expect(apres.members[1]).toBe(moi);
    expect(replaceMemberRow(avant, null)).toBe(avant);
  });
});
