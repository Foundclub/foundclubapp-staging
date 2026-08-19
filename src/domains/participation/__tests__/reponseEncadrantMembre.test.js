import { USER_ROLES } from '@/domains/auth/authUseCases';
import { getParticipationErrorMessage, resolveParticipationFlow } from '@/domains/participation/participationFlow';

// W01 — LE SERVEUR ACCEPTE, L'APP GRISE.
//
// Le lot U02 (admin `91da36c`) a rendu le droit de repondre a QUI FAIT DEJA
// PARTIE de l'equipe, encadrant compris. Son compte rendu le dit noir sur blanc :
// « Sans un lot app, un compte Entraineur ou Dirigeant verra toujours le bouton
// GRIS, meme serveur corrige. »
//
// 📌 LA REGLE DU SERVEUR, RECOPIEE — `event-audience.ts:612 resolveSourceTeamForUser`
// et `getTeamMembers` (ligne 253) :
//   « L equipe pour laquelle cette personne repond — joueur OU encadrant. »
//   Etre membre = figurer dans `players` OU dans `trainers` de l equipe
//   organisatrice ou d une equipe conviee. AUCUN role n intervient : sur ce
//   chemin le serveur ne lit jamais `user.role.name` (verifie le 2026-08-19 :
//   aucune occurrence dans `event-participation/controllers/`, `event-rsvp.ts`,
//   `event-audience.ts`).
//   Puis, dans les trois portes de reponse (`event-rsvp.ts:99`,
//   `event-participation.ts:433`, `event.ts:3050`), la meme phrase :
//   « si `sessionStatus === 'closed'` et qu on n est membre d aucune equipe
//     conviee -> refus `EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR` ».
//
// ⛔ CE QUE CE LOT NE FAIT PAS, ET C EST VOULU : sur un evenement OUVERT, le
// serveur accepterait aussi un etranger comme participant externe. L app garde
// sa porte plus etroite pour les non-joueurs — choix produit anterieur, exige
// par le temoin 3. On ne PROPOSE donc jamais ce que le serveur refuserait ;
// l ecart restant va dans l autre sens, et il est nomme dans le compte rendu.

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

describe('W01 · temoin 1 — un entraineur MEMBRE de l equipe peut repondre', () => {
  it('la regle partagee le declare actionnable', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: coachUser });

    expect(flow.blockedReason).toBe('');
    expect(flow.canAct).toBe(true);
  });
});

describe('W01 · temoin 2 — un dirigeant MEMBRE de l equipe aussi', () => {
  it('la regle partagee le declare actionnable', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: presidentUser });

    expect(flow.blockedReason).toBe('');
    expect(flow.canAct).toBe(true);
  });

  it('membre d une equipe CONVIEE, pas de l equipe organisatrice : meme droit', () => {
    const event = closedTeamEvent({
      invitedTeams: [{
        documentId: 'team-2',
        players: [],
        trainers: [{ documentId: 'president-1' }],
      }],
      team: { documentId: 'team-1', players: [], trainers: [] },
    });

    expect(resolveParticipationFlow(event, { user: presidentUser }).canAct).toBe(true);
  });
});

describe('W01 · temoin 3 🔒 — un encadrant NON membre reste bloque', () => {
  const strangerCoach = { documentId: 'coach-etranger', role: { name: USER_ROLES.coach } };

  it('la regle partagee le refuse', () => {
    expect(resolveParticipationFlow(closedTeamEvent(), { user: strangerCoach }).canAct).toBe(false);
  });

  it('et elle nomme la VRAIE raison du serveur : l appartenance, pas le role', () => {
    const flow = resolveParticipationFlow(closedTeamEvent(), { user: strangerCoach });

    expect(flow.blockedReason).toContain('réservé');
  });
});

describe('W01 · temoin 4 🔒 — le joueur ne change pas de comportement', () => {
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

describe('W01 · temoin 5 — si le serveur refuse quand meme, l ecran dit la VRAIE raison', () => {
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
