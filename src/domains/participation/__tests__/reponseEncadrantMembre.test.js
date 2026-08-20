import { USER_ROLES } from '@/domains/auth/authUseCases';
import { getParticipationErrorMessage, resolveParticipationFlow } from '@/domains/participation/participationFlow';

// Y07 — SEULS LES JOUEURS REPONDENT. (GO Adel du 2026-08-20)
//
// 🔄 CE FICHIER A CHANGE DE CAMP, ET C EST VOULU. Il portait la regle du lot
// W01 : « l encadrant MEMBRE de l equipe repond comme un joueur ». Adel a
// tranche l inverse le 2026-08-20 — repondre Present / Absent est le geste du
// JOUEUR, l encadrant organise. Les temoins 1 et 2 disent donc maintenant le
// contraire de ce qu ils disaient : ce n est pas une regression, c est la
// decision. Les temoins 3, 4 et 5 n ont pas bouge d une ligne.
//
// 📌 LA REGLE DU SERVEUR, RECOPIEE — `event-audience.ts:819
// resolveResponderDecision` :
//   `sourceTeam` = equipe conviee dont on est MEMBRE (`players` OU `trainers`).
//   Puis, et c est tout Y07 : `canRespond = isUserInCollection(sourceTeam.players)`
//   et `isStaffOnly = !canRespond`. Membre sans etre joueur => on ne repond plus.
//   AUCUN role n intervient, ici non plus : le serveur ne lit jamais
//   `user.role.name` sur ce chemin. C est l APPARTENANCE A `players` qui decide.
//   `assertUserCanRespond` (l.836) refuse alors avec `EVENT_STAFF_DOES_NOT_RSVP`
//   et la phrase « Tu encadres cet evenement : ce sont les joueurs qui repondent. »
//
// 🎯 LE COACH-JOUEUR REPOND, sans exception ecrite nulle part : il figure dans
// `team.players`, donc `canRespond` vaut vrai pour lui. C est aussi le seul
// moyen d etre coche dans une compo publiee (`event-composition.ts:234` ne
// puise que dans `players`) — d ou la nuance du GO : « un encadrant coche dans
// la compo publiee repond quand meme ». Le temoin 1 le verrouille.
//
// ⛔ CE QUE Y07 NE FAIT PAS : il ne retire RIEN d autre a l encadrant. Il reste
// membre, il voit l evenement, il en recoit les notifications
// (`getTeamMembers`, l.357, n a pas bouge). Et une reponse DEJA ENREGISTREE
// n est ni effacee ni cachee — c est le dernier cas du temoin 4.

// La phrase EXACTE que le serveur renvoie avec `EVENT_STAFF_DOES_NOT_RSVP`
// (`event-audience.ts:840`). Elle est nommee une fois : le jour ou elle change,
// c est ici que ca se voit, et les trois temoins suivent tout seuls.
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

describe('Y07 · temoin 1 — un entraineur MEMBRE ne repond plus', () => {
  it('la regle partagee le declare NON actionnable', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: coachUser });

    expect(flow.canAct).toBe(false);
  });

  it('et elle nomme le motif du serveur, mot pour mot', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: coachUser });

    // La phrase de `EVENT_STAFF_DOES_NOT_RSVP` (`event-audience.ts:840`).
    // ⛔ Jamais « seuls les joueurs peuvent participer » : ce motif-la parle du
    // ROLE, et c est exactement le contresens que W01 avait corrige. Ici on ne
    // lui reproche pas ce qu il EST, on lui dit ce qu il FAIT : il encadre.
    expect(flow.blockedReason).toBe(PHRASE_ENCADRANT);
  });

  it('🎯 mais le COACH-JOUEUR repond, lui — la nuance du GO Adel', () => {
    // Inscrit dans `players` EN PLUS de `trainers` : c est le seul profil que la
    // compo peut cocher (`event-composition.ts:234` ne puise que dans
    // `players`), donc le seul encadrant a qui on demande encore de repondre.
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

describe('Y07 · temoin 2 — un dirigeant MEMBRE non plus', () => {
  it('la regle partagee le declare NON actionnable', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: presidentUser });

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toBe(PHRASE_ENCADRANT);
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

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toBe(PHRASE_ENCADRANT);
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
    expect(flow.actionLabel).toBe('Present');
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
