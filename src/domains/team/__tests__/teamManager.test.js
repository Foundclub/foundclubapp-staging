import { canManageTeamAd, getManagedTeams, isTeamManager } from '../teamMembership';

// GERER-ANNONCE (audit V1, A15/A16, 2026-09-30) — « je GERE cette equipe »,
// la meme reponse que le serveur (`api::team.auth.canManageTeam`, admin
// src/api/team/services/auth.ts:92-113) : entraineur de l'equipe OU
// dirigeant/president de son club. Et pour une annonce : ca, OU son auteur
// (can-manage-recruitment-ad.ts:50-59, friendly-match-workflow.ts:143-151).

const CLUB = { documentId: 'club-mfc', name: 'Montrivage FC' };
const EQUIPE = { club: CLUB, documentId: 'eq-u15', name: 'U15' };
const AUTRE_EQUIPE = {
  club: { documentId: 'club-autre' }, documentId: 'eq-autre', name: 'Seniors',
};

const joueur = {
  documentId: 'u-joueur', id: null, myTeams: [EQUIPE], role: { name: 'Joueur' }, trainedTeams: [],
};
const entraineur = {
  documentId: 'u-coach',
  id: null,
  myTeams: [],
  role: { name: 'Entraineur' },
  trainedTeams: [EQUIPE],
};
const dirigeant = {
  club: CLUB,
  documentId: 'u-dirigeant',
  id: null,
  myTeams: [],
  role: { name: 'Dirigeant' },
  trainedTeams: [],
};

describe('GERER-ANNONCE — isTeamManager', () => {
  test('un JOUEUR de l equipe ne la gere pas', () => {
    expect(isTeamManager(EQUIPE, joueur)).toBe(false);
  });

  test('l ENTRAINEUR de l equipe la gere (profil)', () => {
    expect(isTeamManager(EQUIPE, entraineur)).toBe(true);
  });

  test('l ENTRAINEUR la gere aussi quand seule l equipe fraiche le dit', () => {
    const equipeFraiche = { ...EQUIPE, trainers: [{ documentId: 'u-coach-neuf' }] };

    const coachNeuf = { documentId: 'u-coach-neuf', role: { name: 'Entraineur' } };

    expect(isTeamManager(equipeFraiche, coachNeuf)).toBe(true);
  });

  test('le DIRIGEANT du club de l equipe la gere, sans l entrainer', () => {
    expect(isTeamManager(EQUIPE, dirigeant)).toBe(true);
    expect(isTeamManager(AUTRE_EQUIPE, dirigeant)).toBe(false);
  });

  test('un JOUEUR rattache au club (role Joueur) ne la gere pas', () => {
    expect(isTeamManager(EQUIPE, { ...joueur, club: CLUB })).toBe(false);
  });

  test('sans equipe ou sans compte, la reponse est non', () => {
    expect(isTeamManager(null, entraineur)).toBe(false);
    expect(isTeamManager(EQUIPE, null)).toBe(false);
  });
});

describe('GERER-ANNONCE — getManagedTeams', () => {
  test('une equipe ou l on ne fait que JOUER en sort', () => {
    expect(getManagedTeams({ ...entraineur, myTeams: [AUTRE_EQUIPE] })).toEqual([EQUIPE]);
  });

  test('une equipe ou l on joue RESTE si l on dirige son club, sans doublon', () => {
    const dirigeantJoueur = { ...dirigeant, myTeams: [EQUIPE], trainedTeams: [EQUIPE] };

    expect(getManagedTeams(dirigeantJoueur)).toEqual([EQUIPE]);
  });

  test('un joueur ne gere rien', () => {
    expect(getManagedTeams(joueur)).toEqual([]);
  });
});

describe('GERER-ANNONCE — canManageTeamAd', () => {
  const annonce = { author: { documentId: 'u-auteur', id: 7 }, documentId: 'ad-1', team: EQUIPE };

  test('joueur de l equipe : non ; entraineur ou dirigeant : oui', () => {
    expect(canManageTeamAd(annonce, joueur)).toBe(false);
    expect(canManageTeamAd(annonce, entraineur)).toBe(true);
    expect(canManageTeamAd(annonce, dirigeant)).toBe(true);
  });

  test('l AUTEUR hors equipe : oui, comme le serveur', () => {
    const auteur = { documentId: 'u-auteur', id: null, role: { name: 'Entraineur' } };

    expect(canManageTeamAd(annonce, auteur)).toBe(true);
    expect(canManageTeamAd(annonce, { documentId: '', id: 7 })).toBe(true);
  });

  test('deux identifiants VIDES ne font pas un auteur', () => {
    const sansAuteur = { ...annonce, author: { documentId: '', id: null } };

    expect(canManageTeamAd(sansAuteur, { documentId: '', id: null })).toBe(false);
  });
});
