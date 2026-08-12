/* eslint-disable no-underscore-dangle */

import {
  annotateWaitingPlayersPerClub,
  TEAM_NOT_FOUND_KIND,
} from '@/services/admin/adminWaitingPlayers';

// D95 — troisieme temoin du lot : « la demande apparait dans la console
// super-admin », et surtout AVEC le chiffre qui la rend vendable.
// `adminService.js` n'avait aucun test (E6) : celui-ci decrit le comportement
// attendu du seul morceau de logique que D95 y ajoute.
const buildTeamNotFoundItem = ({
  clubId,
  clubName,
  requestId,
  userId,
}) => ({
  __isAffiliationHelp: true,
  __requestType: TEAM_NOT_FOUND_KIND,
  clubName,
  documentId: requestId,
  searchContext: clubId ? { clubId } : {},
  user: userId ? { documentId: userId } : undefined,
});

describe('annotateWaitingPlayersPerClub', () => {
  it('counts how many distinct players wait for the same club', () => {
    const annotated = annotateWaitingPlayersPerClub([
      buildTeamNotFoundItem({
        clubId: 'club-1', clubName: 'AS Test', requestId: 'r1', userId: 'u1',
      }),
      buildTeamNotFoundItem({
        clubId: 'club-1', clubName: 'AS Test', requestId: 'r2', userId: 'u2',
      }),
      buildTeamNotFoundItem({
        clubId: 'club-2', clubName: 'FC Autre', requestId: 'r3', userId: 'u3',
      }),
    ]);

    expect(annotated.map((item) => item.__waitingPlayersCount)).toEqual([2, 2, 1]);
  });

  it('counts one player once even if the same club was asked twice', () => {
    const annotated = annotateWaitingPlayersPerClub([
      buildTeamNotFoundItem({
        clubId: 'club-1', clubName: 'AS Test', requestId: 'r1', userId: 'u1',
      }),
      buildTeamNotFoundItem({
        clubId: 'club-1', clubName: 'AS Test', requestId: 'r2', userId: 'u1',
      }),
    ]);

    expect(annotated.every((item) => item.__waitingPlayersCount === 1)).toBe(true);
  });

  // 222 294 clubs en base : les homonymes sont courants. Deux clubs differents
  // qui portent le meme nom ne doivent pas etre comptes ensemble.
  it('keeps two same-named clubs apart when they carry different ids', () => {
    const annotated = annotateWaitingPlayersPerClub([
      buildTeamNotFoundItem({
        clubId: 'club-a', clubName: 'AS Saint-Michel', requestId: 'r1', userId: 'u1',
      }),
      buildTeamNotFoundItem({
        clubId: 'club-b', clubName: 'AS Saint-Michel', requestId: 'r2', userId: 'u2',
      }),
    ]);

    expect(annotated.map((item) => item.__waitingPlayersCount)).toEqual([1, 1]);
  });

  it('leaves claims and other request kinds untouched', () => {
    const claim = { __isAffiliationHelp: false, __requestType: 'claim', documentId: 'c1' };
    const onboarding = {
      __isAffiliationHelp: true,
      __requestType: 'club_creation',
      documentId: 'o1',
    };

    const annotated = annotateWaitingPlayersPerClub([claim, onboarding]);

    expect(annotated[0]).toBe(claim);
    expect(annotated[1]).toBe(onboarding);
  });

  // Les demandes venues de l'onboarding n'ont pas de `clubId` : on retombe sur
  // le nom, sinon le chiffre serait toujours 1 pour tout ce parcours.
  it('falls back to the club name when the request carries no club id', () => {
    const annotated = annotateWaitingPlayersPerClub([
      buildTeamNotFoundItem({ clubName: 'AS Test', requestId: 'r1', userId: 'u1' }),
      buildTeamNotFoundItem({ clubName: 'as test', requestId: 'r2', userId: 'u2' }),
    ]);

    expect(annotated.map((item) => item.__waitingPlayersCount)).toEqual([2, 2]);
  });
});
