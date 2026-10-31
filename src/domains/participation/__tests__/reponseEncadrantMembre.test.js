import { USER_ROLES } from '@/domains/auth/authUseCases';
import { getParticipationErrorMessage, resolveParticipationFlow } from '@/domains/participation/participationFlow';

// COACH1 — LES ENCADRANTS REPONDENT. (decision d Adel du 2026-09-21)
//
// 🔄 CE FICHIER A CHANGE DE CAMP DEUX FOIS, ET C EST VOULU. W01 : « l encadrant
// MEMBRE repond comme un joueur ». Y07 (2026-08-20) : l inverse, seuls les
// joueurs. COACH1 (2026-09-21) : « les entraineurs des equipes, pour leurs
// evenements, peuvent repondre present / absent » — retour a W01. Les temoins
// 1 et 2 disent donc de nouveau qu il repond ; 3, 4 et 5 n ont pas bouge.
//
// 📌 LA REGLE DU SERVEUR, RECOPIEE — `event-audience.ts`,
// `resolveResponderDecision` :
//   `sourceTeam` = equipe conviee dont on est MEMBRE (`players` OU `trainers`)
//   ⇒ `canRespond: true`. `isStaffOnly` dit seulement « encadrant, pas joueur »
//   — pour ne pas le compter parmi les joueurs (appel, statistiques), jamais
//   pour le faire taire. AUCUN role n intervient : c est l APPARTENANCE.
//
// 🎯 LE COACH-JOUEUR est un joueur : il figure dans `team.players`.
//
// 🔒 CE QUI NE BOUGE PAS : un encadrant d une AUTRE equipe reste dehors
// (temoin 3), le joueur repond exactement comme avant (temoin 4).

// La phrase que Y07 affichait a la place des boutons. Elle est nommee une fois
// pour que les temoins 1 et 2 prouvent qu elle a DISPARU du chemin.
const PHRASE_ENCADRANT = 'Tu encadres cet événement : ce sont les joueurs qui répondent.';

const coachUser = {
  documentId: 'coach-1',
  role: { name: USER_ROLES.coach },
};

const presidentUser = {
  documentId: 'president-1',
  role: { name: USER_ROLES.president },
};

const playerUser = {
  documentId: 'player-1',
  role: { name: USER_ROLES.player },
};

/**
 * Un evenement ferme d une equipe, avec ses joueurs ET ses encadrants declares.
 *
 * 🎯 Le profil des comptes ne porte AUCUNE equipe (`myTeams`/`trainedTeams`
 * absents) : l appartenance ne peut donc se lire que sur l evenement, comme le
 * serveur la lit. C est le seul montage qui met en cause `players` seul.
 * @param {object} [overrides]
 * @returns {any} L evenement.
 */
const closedTeamEvent = (overrides = {}) => ({
  capacity: 20,
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  invitedTeams: [],
  missings: [],
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed',
  team: {
    documentId: 'team-1',
    players: [{ documentId: 'player-1' }],
    trainers: [{ documentId: 'coach-1' }, { documentId: 'president-1' }],
  },
  type: { name: 'Match' },
  ...overrides,
});

describe('COACH1 · temoin 1 — un entraineur MEMBRE repond', () => {
  it('la regle partagee le declare actionnable', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: coachUser });

    expect(flow.canAct).toBe(true);
    expect(flow.blockedReason).toBe('');
  });

  it('par la porte des REPONSES, en un geste, comme un joueur membre', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: coachUser });

    // AA01 : un membre REPOND (`/rsvp`), il ne DEMANDE pas a entrer. Ni
    // declaration de responsabilite, ni « en attente ».
    expect(flow.submitMode).toBe('rsvpPresent');
    expect(flow.usesConfirmationModal).toBe(false);
    expect(flow.blockedReason).not.toBe(PHRASE_ENCADRANT);
  });

  it('🎯 le COACH-JOUEUR repond aussi, comme avant', () => {
    const event = closedTeamEvent({
      team: {
        documentId: 'team-1',
        players: [{ documentId: 'player-1' }, { documentId: 'coach-1' }],
        trainers: [{ documentId: 'coach-1' }],
      },
    });

    const flow = resolveParticipationFlow(event, { user: coachUser });

    expect(flow.blockedReason).toBe('');
    expect(flow.canAct).toBe(true);
  });
});

describe('COACH1 · temoin 2 — un dirigeant inscrit aux encadrants repond aussi', () => {
  it('la regle partagee le declare actionnable', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: presidentUser });

    expect(flow.canAct).toBe(true);
    expect(flow.blockedReason).toBe('');
  });

  it('membre d une equipe CONVIEE, pas de l equipe organisatrice : meme sort', () => {
    const event = closedTeamEvent({
      invitedTeams: [{
        documentId: 'team-2',
        players: [],
        trainers: [{ documentId: 'president-1' }],
      }],
      team: { documentId: 'team-1', players: [], trainers: [] },
    });

    const flow = resolveParticipationFlow(event, { user: presidentUser });

    expect(flow.canAct).toBe(true);
    expect(flow.blockedReason).toBe('');
  });
});

describe('Y07 · temoin 3 🔒 — un encadrant NON membre reste bloque', () => {
  const strangerCoach = { documentId: 'coach-etranger', role: { name: USER_ROLES.coach } };

  it('la regle partagee le refuse', () => {
    expect(resolveParticipationFlow(closedTeamEvent(), { user: strangerCoach }).canAct).toBe(false);
  });

  it('et elle nomme la VRAIE raison du serveur : l appartenance, pas le role', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: strangerCoach });

    expect(flow.blockedReason).toContain('réservé');
  });
});

describe('Y07 · temoin 4 🔒 — le joueur ne change pas de comportement', () => {
  it('joueur convoque : actionnable, exactement comme avant', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: playerUser });

    expect(flow.canAct).toBe(true);
    expect(flow.actionLabel).toBe('Présent');
  });

  it('joueur NON convoque sur un evenement ferme : bloque, meme phrase qu avant', () => {
    const outsider = { documentId: 'joueur-etranger', role: { name: USER_ROLES.player } };

    const flow = resolveParticipationFlow(closedTeamEvent(), { user: outsider });

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toContain('réservé');
  });

  it('joueur qui a deja repondu : le motif reste « tu as déjà répondu »', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), {
      participationState: { isParticipating: true },
      user: playerUser,
    });

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toContain('déjà répondu');
  });

  it('un encadrant MEMBRE qui a deja repondu est traite comme un joueur', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), {
      participationState: { isParticipating: true },
      user: coachUser,
    });

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toContain('déjà répondu');
  });
});

describe('Y07 · temoin 5 — si le serveur refuse quand meme, l ecran dit la VRAIE raison', () => {
  it('le refus d appartenance ne se raconte plus « pas joueur de l équipe »', () => {
    // Forme REELLE de l objet rejete par l intercepteur axios
    // (`services/client.native.js:89-95`), avec le code envoye par les trois
    // portes de reponse du serveur.
    const refus = {
      details: {
        code: 'EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR',
        error: 'Cet evenement est reserve aux equipes conviees',
      },
      message: 'Cet evenement est reserve aux equipes conviees',
      name: 'BadRequestError',
      status: 400,
    };

    const message = getParticipationErrorMessage(refus);

    // Le motif du serveur est une APPARTENANCE, jamais un role : un encadrant
    // membre lisait « l utilisateur n est pas joueur de l equipe » et en
    // concluait que son role lui interdisait de repondre.
    expect(message).not.toContain('joueur de');
    expect(message).toContain('conviée');
  });
});
