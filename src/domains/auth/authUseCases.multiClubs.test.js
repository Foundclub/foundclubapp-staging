import {
  canUserEditClub,
  getClubIds,
  getMemberClubIds,
  hasClubAccess,
  isClubMember,
  USER_ROLES,
} from '@/domains/auth/authUseCases';

// C3 — question d'Adel du 2026-08-13 : « il faut qu'on reflechisse a si ca
// marche dans le code d'avoir deux equipes dans 2 clubs differents ».
//
// CE QUI EST MESURE, et qui explique la forme de ce fichier :
//   · le serveur ACCEPTE deja le 2e club — `team-membership-request.accept`
//     fait `players: { connect }`, jamais `set`, et n'ecrit jamais `user.club` ;
//   · le serveur ENVOIE deja le club de chaque equipe — `myTeams.club` est dans
//     `firebase-auth/constants.ts` (ME_LIGHT_PROFILE_QUERY, DEFAULT_POPULATE,
//     PUBLIC_PROFILE_POPULATE), et `authSanitizer.js:122` le conserve ;
//   · `getClubIds` ne lit JAMAIS `myTeams[].club` — c'est le seul trou.
//
// ⛔ POURQUOI `getClubIds` N'EST PAS ELARGI SUR PLACE (mesure, pas prudence) :
// il porte deux notions a la fois, et trois de ses lecteurs demandent de
// l'AUTORITE, pas de l'appartenance :
//   1. `canUserEditClub` (ici meme, l.102) — `president` + `hasClubAccess` ;
//   2. `ClubDetails.js:1329/1334/1342` — president/coach du club, « quitter le club » ;
//   3. `useAuth.js:761` `canSendMessageToUser` — et celui-la casse DANS L'AUTRE
//      SENS : des que deux comptes « partagent un club », la fonction renvoie
//      `role === president` et ne teste plus jamais les equipes communes. En
//      production `user.club` est vide pour les joueurs (ils entrent par
//      l'equipe) : elargir `getClubIds` ferait donc perdre a deux joueurs de la
//      MEME equipe le droit de s'ecrire.
// D'ou deux notions nommees separement : `getClubIds` = rattachement
// administratif (inchange), `getMemberClubIds` = appartenance reelle.

/**
 * Un club, reduit a ce que l'app en garde apres `sanitizeClubSummary`.
 * @param {string} documentId - L'identifiant du club.
 * @param {string} name - Son nom affiche.
 * @returns {any} Le resume de club.
 */
const club = (documentId, name) => ({ documentId, id: null, name });

/**
 * Une equipe telle que `sanitizeTeamSummary` la rend : elle porte son club.
 * @param {string} documentId - L'identifiant de l'equipe.
 * @param {any} clubDoc - Le club auquel elle appartient.
 * @returns {any} Le resume d'equipe.
 */
const equipe = (documentId, clubDoc) => ({
  club: clubDoc,
  documentId,
  name: `Equipe ${documentId}`,
});

const CLUB_1 = club('club-1', 'Premier club');
const CLUB_2 = club('club-2', 'Second club');

/**
 * LE CAS D'ADEL — un joueur entre dans l'equipe d'un SECOND club.
 * Tel qu'il sort du serveur apres `accept` : `myTeams` grandit, `club` reste
 * celui du premier club, et AUCUNE `club-affiliation` n'est creee (mesure du
 * 2026-08-13 : la table `club_affiliations` est VIDE en production).
 * @returns {any} Le profil du joueur, deux equipes dans deux clubs.
 */
const joueurDeuxClubs = () => ({
  club: CLUB_1,
  clubAffiliations: [],
  clubs: [CLUB_1],
  documentId: 'user-c3',
  myTeams: [equipe('team-1', CLUB_1), equipe('team-2', CLUB_2)],
  role: { name: USER_ROLES.player },
  trainedTeams: [],
});

/**
 * Le joueur ordinaire : un club, une equipe. Il ne doit RIEN voir changer.
 * @returns {any} Le profil du joueur mono-club.
 */
const joueurUnSeulClub = () => ({
  club: CLUB_1,
  clubAffiliations: [],
  clubs: [CLUB_1],
  documentId: 'user-mono',
  myTeams: [equipe('team-1', CLUB_1)],
  role: { name: USER_ROLES.player },
  trainedTeams: [],
});

describe('C3 — un joueur dans les equipes de deux clubs differents', () => {
  test('TEMOIN 1 — le 2e club apparait dans ses clubs', () => {
    expect(getMemberClubIds(joueurDeuxClubs())).toContain('club-2');
    expect(isClubMember(joueurDeuxClubs(), 'club-2')).toBe(true);
  });

  test('TEMOIN 2 🔒 — son 1er club ne disparait pas', () => {
    const clubsDuJoueur = getMemberClubIds(joueurDeuxClubs());

    expect(clubsDuJoueur).toContain('club-1');
    expect(isClubMember(joueurDeuxClubs(), 'club-1')).toBe(true);
    // Aucun club retire a personne : l'appartenance CONTIENT toujours le
    // rattachement administratif, quel que soit le profil.
    getClubIds(joueurDeuxClubs()).forEach((clubId) => {
      expect(clubsDuJoueur).toContain(clubId);
    });
  });

  test('TEMOIN 3 🔒 — un joueur d un seul club voit exactement ce qu il voyait avant', () => {
    const joueur = joueurUnSeulClub();

    // Caracterisation : les sorties d avant le lot, ecrites en dur.
    expect(getClubIds(joueur)).toEqual(['club-1']);
    expect(hasClubAccess(joueur, 'club-1')).toBe(true);
    expect(hasClubAccess(joueur, 'club-2')).toBe(false);
    // Et la notion neuve ne lui ajoute rien : un seul club reste un seul club.
    expect(getMemberClubIds(joueur)).toEqual(['club-1']);
  });

  test('TEMOIN 4 — la fiche du 2e club le reconnait comme membre', () => {
    // La forme exacte que `ClubDetails.js:1012-1017` assemble (`relatedTeams`) :
    // `myTeams` + `trainedTeams` + `teams`, chacune portant son club.
    const joueur = joueurDeuxClubs();

    expect(isClubMember(joueur, 'club-2')).toBe(true);
    expect(isClubMember(joueur, 'club-inconnu')).toBe(false);
  });

  test('TEMOIN 5 🔒 — appartenir a un club n y donne AUCUNE autorite', () => {
    // Un dirigeant du club 1, joueur dans une equipe du club 2. Son role lui
    // donne les droits d edition ; ils s arretent a SON club.
    const dirigeantJoueurAilleurs = {
      ...joueurDeuxClubs(),
      role: { name: USER_ROLES.president },
    };

    expect(isClubMember(dirigeantJoueurAilleurs, 'club-2')).toBe(true);
    expect(canUserEditClub(dirigeantJoueurAilleurs, 'club-1')).toBe(true);
    expect(canUserEditClub(dirigeantJoueurAilleurs, 'club-2')).toBe(false);
    expect(hasClubAccess(dirigeantJoueurAilleurs, 'club-2')).toBe(false);
  });
});
