/* eslint-disable no-underscore-dangle */

import {
  annotateWaitingPlayersPerClub,
  buildClubArrivalInterestRows,
  CLUB_ARRIVAL_INTEREST_KIND,
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

// S02 — le compteur de la SECONDE porte. Adel, 2026-08-16 : « que NOUS on puisse
// savoir combien de personnes sont intéressées par tel club ».
// 💰 « 12 personnes sont interessees par votre club » est un appel qui se
// decroche ; « une personne a demande » ne l'est pas. ⇒ le compteur EST la
// moitie de la valeur du bouton, et un compteur faux vaut moins que rien.
const buildArrivalInterest = ({
  clubId, clubName, interestId, userId,
}) => ({
  club: clubId ? { documentId: clubId, name: clubName } : undefined,
  createdAt: '2026-08-16T10:00:00.000Z',
  documentId: interestId,
  status: 'pending',
  user: userId ? { documentId: userId } : undefined,
});

describe('buildClubArrivalInterestRows', () => {
  // LE TEMOIN DU LOT.
  it('deux personnes comptent pour 2, la meme personne deux fois pour 1', () => {
    const rows = buildClubArrivalInterestRows([
      buildArrivalInterest({
        clubId: 'club-1', clubName: 'AS Test', interestId: 'i1', userId: 'u1',
      }),
      buildArrivalInterest({
        clubId: 'club-1', clubName: 'AS Test', interestId: 'i2', userId: 'u2',
      }),
      buildArrivalInterest({
        clubId: 'club-2', clubName: 'FC Autre', interestId: 'i3', userId: 'u3',
      }),
      // Le meme compte, deux fois, sur le club 2 : il ne fait pas deux personnes.
      buildArrivalInterest({
        clubId: 'club-2', clubName: 'FC Autre', interestId: 'i4', userId: 'u3',
      }),
    ]);

    expect(rows.map((row) => [row.clubName, row.__interestedPeopleCount])).toEqual([
      ['AS Test', 2],
      ['FC Autre', 1],
    ]);
  });

  it('rend UNE ligne par club, jamais une par personne', () => {
    const rows = buildClubArrivalInterestRows([
      buildArrivalInterest({
        clubId: 'club-1', clubName: 'AS Test', interestId: 'i1', userId: 'u1',
      }),
      buildArrivalInterest({
        clubId: 'club-1', clubName: 'AS Test', interestId: 'i2', userId: 'u2',
      }),
      buildArrivalInterest({
        clubId: 'club-1', clubName: 'AS Test', interestId: 'i3', userId: 'u3',
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].documentId).toBe('club-arrival-interest:club-1');
    expect(rows[0].__requestType).toBe(CLUB_ARRIVAL_INTEREST_KIND);
  });

  it('classe les clubs les plus attendus en premier', () => {
    const rows = buildClubArrivalInterestRows([
      buildArrivalInterest({
        clubId: 'club-1', clubName: 'Un seul', interestId: 'i1', userId: 'u1',
      }),
      buildArrivalInterest({
        clubId: 'club-2', clubName: 'Trois', interestId: 'i2', userId: 'u2',
      }),
      buildArrivalInterest({
        clubId: 'club-2', clubName: 'Trois', interestId: 'i3', userId: 'u3',
      }),
      buildArrivalInterest({
        clubId: 'club-2', clubName: 'Trois', interestId: 'i4', userId: 'u4',
      }),
    ]);

    expect(rows.map((row) => row.clubName)).toEqual(['Trois', 'Un seul']);
  });

  it('un compte sans identifiant lisible compte quand meme pour 1', () => {
    const rows = buildClubArrivalInterestRows([
      buildArrivalInterest({ clubId: 'club-1', clubName: 'AS Test', interestId: 'i1' }),
      buildArrivalInterest({ clubId: 'club-1', clubName: 'AS Test', interestId: 'i2' }),
    ]);

    expect(rows[0].__interestedPeopleCount).toBe(2);
  });

  it('un interet sans club n\'invente pas de ligne', () => {
    expect(buildClubArrivalInterestRows([
      buildArrivalInterest({ interestId: 'i1', userId: 'u1' }),
    ])).toEqual([]);
  });

  // 🔒 Non-regression : ces lignes ne sont pas des demandes, donc l'ecran ne
  // doit surtout pas leur poser « Traiter » / « Refuser ».
  it('ne se fait jamais passer pour une demande a traiter', () => {
    const rows = buildClubArrivalInterestRows([
      buildArrivalInterest({
        clubId: 'club-1', clubName: 'AS Test', interestId: 'i1', userId: 'u1',
      }),
    ]);

    expect(rows[0].__isAffiliationHelp).toBe(false);
    expect(rows[0].__requestType).not.toBe(TEAM_NOT_FOUND_KIND);
  });
});
