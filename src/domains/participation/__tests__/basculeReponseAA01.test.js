import { USER_ROLES } from '@/domains/auth/authUseCases';
import { resolveParticipationFlow } from '@/domains/participation/participationFlow';

// LOT AA01 (E6) — LA BASCULE D UNE REPONSE, ET LA DECHARGE.
//
// 🔴 LES DEUX CONSTATS D ADEL, 2026-08-20 :
//   A. « si je suis absent et que je fais "modifier ma reponse" et que je mets
//      present, mon statut passe en "sans reponse" » ;
//   B. « les joueurs d une equipe, quand ils repondent aux evenements de leur
//      equipe et SEULEMENT de leur equipe, ne doivent pas avoir besoin de
//      l etape de declaration de risque et de responsabilite ».
//
// 📏 LA MECANIQUE, MESUREE : `POST /event-participations` est la porte des
// DEMANDES. Sur un evenement a validation manuelle elle rend `pending`, et
// `pending` n entre ni dans `participations` ni dans `missings`
// (`event-audience.ts:917`) : a l ecran, « sans reponse ». La porte des
// REPONSES est `POST /events/:id/rsvp` — c est deja celle du bandeau de
// l accueil (`useHomeEventAnswer.js`, lot T02).
//
// 🔒 CE QUE CES TEMOINS PROTEGENT AUTANT QUE LE RESTE : la declaration de
// responsabilite ne disparait QUE pour « evenement de MON equipe ». Elle reste
// entiere pour un evenement public, une DETECTION et une seance d essai.

const playerUser = {
  documentId: 'player-1',
  role: { name: USER_ROLES.player },
};

const outsiderUser = {
  documentId: 'outsider-1',
  role: { name: USER_ROLES.player },
};

/**
 * Un evenement d equipe, avec le joueur declare dans `team.players`.
 * @param {object} [overrides]
 * @returns {any} L evenement.
 */
const myTeamEvent = (overrides = {}) => ({
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
    trainers: [{ documentId: 'coach-1' }],
  },
  type: { name: 'Entrainement' },
  validationMode: 'manual',
  ...overrides,
});

describe('AA01 — repondre a son equipe passe par la porte des reponses', () => {
  test('AA01/6 — repondre a un evenement de MON equipe ne demande AUCUNE decharge', () => {
    const flow = resolveParticipationFlow(myTeamEvent(), { user: playerUser });

    expect(flow.canAct).toBe(true);
    expect(flow.submitMode).toBe('rsvpPresent');
    expect(flow.usesConfirmationModal).toBe(false);
  });

  test('AA01/6 bis — la validation manuelle ne transforme pas cette reponse en demande', () => {
    // Le pendant client du temoin serveur AA01/1 : tant que l app frappe a la
    // porte des reponses, `validationMode` ne peut plus faire naitre une
    // « demande en attente » a la place d une presence.
    const flow = resolveParticipationFlow(
      myTeamEvent({ validationMode: 'manual' }),
      { user: playerUser },
    );

    expect(flow.submitMode).toBe('rsvpPresent');
  });

  test('AA01/7 — 🔒 une DETECTION demande TOUJOURS la decharge', () => {
    const flow = resolveParticipationFlow(
      myTeamEvent({ type: { name: 'Détection' } }),
      { user: playerUser },
    );

    expect(flow.submitMode).not.toBe('rsvpPresent');
    expect(flow.usesConfirmationModal).toBe(true);
  });

  test('AA01/7 bis — 🔒 un evenement PUBLIC demande TOUJOURS la decharge', () => {
    const publicEvent = myTeamEvent({
      sessionStatus: 'open',
      team: { documentId: 'team-1', players: [], trainers: [] },
    });

    const flow = resolveParticipationFlow(publicEvent, { user: outsiderUser });

    expect(flow.submitMode).toBe('createEventParticipation');
    expect(flow.usesConfirmationModal).toBe(true);
  });

  test('AA01/7 ter — 🔒 une SEANCE D ESSAI garde la decharge', () => {
    const openTraining = myTeamEvent({
      externalParticipantLimit: 5,
      sessionStatus: 'open',
      team: { documentId: 'team-1', players: [], trainers: [] },
      type: { name: 'Entrainement' },
    });

    const flow = resolveParticipationFlow(openTraining, { user: outsiderUser });

    expect(flow.submitMode).toBe('createEventParticipation');
    expect(flow.usesConfirmationModal).toBe(true);
  });

  test('AA01/8 — la decharge n est plus redemandee au membre : il n y en a plus AUCUNE', () => {
    // ⚠️ CE QUE CE TEMOIN DIT EXACTEMENT, ET CE QU IL NE DIT PAS.
    // Rien ne STOCKE la declaration de responsabilite d un evenement : elle vit
    // dans l etat local de `JoinEventModal`, remis a zero a chaque ouverture, et
    // n est envoyee au serveur sur AUCUN des trois tuyaux de reponse. La seule
    // facon vraie de ne pas la redemander a un membre etait donc de ne plus la
    // lui demander du tout. Sur les parcours qui la gardent, elle EST rejouee a
    // chaque fois — c est l etat constate, pas un choix de ce lot.
    const answeredEvent = myTeamEvent({
      participations: [{ documentId: 'player-1' }],
    });

    const first = resolveParticipationFlow(myTeamEvent(), { user: playerUser });
    const second = resolveParticipationFlow(answeredEvent, { user: playerUser });

    expect(first.usesConfirmationModal).toBe(false);
    expect(second.usesConfirmationModal).toBe(false);
  });
});
