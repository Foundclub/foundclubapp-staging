import { USER_ROLES } from '@/domains/auth/authUseCases';

import {
  ParticipationFlowKind,
  resolveParticipationFlow,
} from './participationFlow';

describe('participationFlow', () => {
  const playerUser = {
    documentId: 'user-1',
    role: { name: USER_ROLES.player },
  };

  test('routes recruiting reservations to the dedicated reservation flow', () => {
    const reservation = {
      bookingStatus: 'shared',
      date: '2099-01-01T10:00:00.000Z',
      missingPlayers: 2,
      reservationMode: 'RECRUITING',
      type: { name: 'Réservation' },
    };

    const flow = resolveParticipationFlow(reservation, { user: playerUser });

    expect(flow.kind).toBe(ParticipationFlowKind.reservationRecruiting);
    expect(flow.submitMode).toBe('joinReservation');
    expect(flow.canAct).toBe(true);
  });

  test('does not classify a detection as reservation when technical booking fields are present', () => {
    const detection = {
      bookingStatus: 'open',
      date: '2099-01-01T10:00:00.000Z',
      documentId: 'detection-1',
      reservationMode: 'FULL_GROUP',
      type: { name: 'Détection' },
    };

    const flow = resolveParticipationFlow(detection, { user: playerUser });

    // 🎯 CE QUE CE TEMOIN GARDE, ET QUI EST SON TITRE : une detection portant
    // des champs techniques de reservation ne DOIT PAS partir dans le flux des
    // reservations. C est toujours vrai, et c est la seule chose qu il protege.
    expect(flow.kind).not.toBe(ParticipationFlowKind.reservationRecruiting);
    expect(flow.submitMode).not.toBe('joinReservation');
    expect(flow.actionLabel).toBe('Participer');

    // 🔄 R9 (24/08) — CES DEUX LIGNES ONT CHANGE, ET C EST VOULU. Elles
    // decrivaient l aiguillage d avant (`eventOpen` / `createEventParticipation`)
    // qui etait justement le defaut de recette : « Participer » depuis une carte
    // creait une participation SANS poste. L appelant ici ne compte aucun poste,
    // donc la detection propose desormais de choisir le sien.
    expect(flow.kind).toBe(ParticipationFlowKind.detectionSlot);
    expect(flow.submitMode).toBe('detection-slot-picker');
  });

  test('allows closed match answers when user belongs to the event team by team id', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      participations: [],
      sessionStatus: 'closed',
      team: {
        documentId: 'team-1',
      },
      type: { name: 'Match' },
    };
    const user = {
      ...playerUser,
      myTeams: [{ documentId: 'team-1' }],
    };

    const flow = resolveParticipationFlow(event, { user });

    expect(flow.kind).toBe(ParticipationFlowKind.eventClosed);
    expect(flow.canAct).toBe(true);
    expect(flow.actionLabel).toBe('Present');
  });

  test('redirects stage day children to their parent event', () => {
    const event = {
      eventFormat: 'stage_day',
      parentEvent: { documentId: 'parent-1' },
    };

    const flow = resolveParticipationFlow(event, { user: playerUser });

    expect(flow.kind).toBe(ParticipationFlowKind.eventStageDayRedirect);
    expect(flow.submitMode).toBe('redirect-parent');
  });

  test('blocks closed event participation for users outside allowed teams', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      invitedTeams: [],
      participations: [],
      sessionStatus: 'closed',
      team: {
        players: [{ documentId: 'someone-else' }],
      },
    };

    const flow = resolveParticipationFlow(event, { user: playerUser });

    expect(flow.kind).toBe(ParticipationFlowKind.eventClosed);
    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toContain('réservé');
  });

  test('allows re-apply semantics for withdrawn non-detection applications', () => {
    const ad = {
      audienceType: 'player',
      documentId: 'ad-1',
      isActive: true,
    };

    const flow = resolveParticipationFlow(ad, {
      applicationState: { status: 'withdrawn' },
      currentUserApplication: { documentId: 'application-1' },
      entityType: 'recruitment-ad',
      isOwner: false,
      user: playerUser,
    });

    expect(flow.kind).toBe(ParticipationFlowKind.recruitmentPlayer);
    expect(flow.canAct).toBe(true);
    expect(flow.canWithdraw).toBe(false);
  });

  test('blocks external users when the external training quota is full', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      externalParticipantLimit: 2,
      participationRequests: [
        {
          documentId: 'request-1',
          isActive: true,
          participationStatus: 'accepted',
          user: { documentId: 'user-a' },
        },
        {
          documentId: 'request-2',
          isActive: true,
          participationStatus: 'pending',
          user: { documentId: 'user-b' },
        },
      ],
      participations: [],
      sessionStatus: 'open',
      team: { documentId: 'team-1', players: [] },
      type: { name: 'Entrainement' },
    };

    const flow = resolveParticipationFlow(event, { user: playerUser });

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toContain('quota');
  });

  test('keeps internal members eligible even when the external training quota is full', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      externalParticipantLimit: 1,
      participationRequests: [
        {
          documentId: 'request-1',
          isActive: true,
          participationStatus: 'accepted',
          user: { documentId: 'user-a' },
        },
      ],
      participations: [],
      sessionStatus: 'open',
      team: { documentId: 'team-1', players: [] },
      type: { name: 'Entrainement' },
    };
    const internalUser = {
      ...playerUser,
      myTeams: [{ documentId: 'team-1' }],
    };

    const flow = resolveParticipationFlow(event, { user: internalUser });

    expect(flow.canAct).toBe(true);
    // AA01 (2026-08-20) — cette ligne attendait `createEventParticipation`.
    // Le sujet de ce temoin est l ELIGIBILITE du membre malgre le quota externe
    // (`canAct`, ligne au-dessus) ; la porte n etait qu un detail de passage.
    // Depuis AA01, un membre d une equipe conviee repond par la porte des
    // REPONSES et sans declaration de responsabilite — il ne demande rien, il
    // repond. Le detail est verrouille par
    // `__tests__/basculeReponseAA01.test.js`.
    expect(flow.submitMode).toBe('rsvpPresent');
    expect(flow.usesConfirmationModal).toBe(false);
  });
});

// Lot R9 (vague R du 24/08) — REPONDRE « PARTICIPER » DEPUIS UNE CARTE DOIT
// PROPOSER LES POSTES.
//
// 🧨 LE DEFAUT MESURE : trois surfaces savaient DEJA quoi faire d un
// `submitMode: 'detection-slot-picker'` — le tchat (`Conversation.js`), la liste
// des participants (`ParticipantEventList.js`) et `handleJoinEvent` dans
// `EventListContent.js`. Mais AUCUNE ne passe `detectionSlotsCount`, et c etait
// la seule chose qui produisait ce mode. Les trois branches etaient donc
// INATTEIGNABLES, et « Participer » depuis une carte creait une participation
// generique SANS poste — qui verrouille ensuite la candidature aux postes.
//
// 🔒 CE QUE CES TEMOINS PROTEGENT EN MEME TEMPS : l aiguillage se decide a la
// SORTIE, apres les garde-fous. Le placer en tete aurait saute la date passee,
// la capacite, « deja repondu » et l evenement ferme, et surtout aurait mis
// `usesConfirmationModal` a faux — c est-a-dire retire la DECLARATION DE
// RESPONSABILITE sur les treize surfaces qui appellent cette fonction.
describe('R9 - une detection propose ses postes meme quand l appelant ne les a pas comptes', () => {
  const playerUser = {
    documentId: 'user-1',
    role: { name: USER_ROLES.player },
  };

  const detectionAVenir = {
    date: '2099-01-01T10:00:00.000Z',
    documentId: 'detection-1',
    participations: [],
    type: { name: 'Détection' },
  };

  test('R9 · temoin 8 — sans compte de postes, on aiguille vers le choix du poste', () => {
    const flow = resolveParticipationFlow(detectionAVenir, { user: playerUser });

    expect(flow.submitMode).toBe('detection-slot-picker');
    expect(flow.kind).toBe(ParticipationFlowKind.detectionSlot);
    expect(flow.canAct).toBe(true);
  });

  test('R9 · temoin 9 — un contexte qui dit EXPLICITEMENT « zero poste » ne l aiguille pas', () => {
    // 🎯 La distinction qui fait tout le lot : « le contexte ne dit rien » n est
    // pas « il n y a aucun poste ». L ecran de detail, lui, COMPTE ses postes :
    // quand il annonce zero, il n y a aucun poste a proposer et le chemin
    // generique reste le bon.
    const flow = resolveParticipationFlow(detectionAVenir, {
      detectionSlotsCount: 0,
      user: playerUser,
    });

    expect(flow.submitMode).toBe('createEventParticipation');
    expect(flow.kind).toBe(ParticipationFlowKind.eventOpen);
  });

  test('R9 · temoin 10 — LA DECLARATION DE RESPONSABILITE NE BOUGE PAS', () => {
    // ⛔ Le garde-fou juridique du lot. Une detection n est pas une convocation :
    // celui qui s y inscrit passe par la modale de confirmation.
    const flow = resolveParticipationFlow(detectionAVenir, { user: playerUser });

    expect(flow.usesConfirmationModal).toBe(true);
    expect(flow.confirmLabel).toBe('Confirmer ma participation');
  });

  test('R9 · temoin 11 — une detection DEJA PASSEE reste bloquee, et n est pas aiguillee', () => {
    // 🔒 Les garde-fous d abord : ce qui est bloque garde son motif exact et son
    // `kind` d avant le lot. Aiguiller un evenement bloque enverrait la personne
    // vers un choix de poste qu elle n a pas le droit de faire.
    const flow = resolveParticipationFlow(
      { ...detectionAVenir, date: '2020-01-01T10:00:00.000Z' },
      { user: playerUser },
    );

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toBe('Cet événement est déjà passe.');
    expect(flow.submitMode).toBe('createEventParticipation');
    expect(flow.kind).toBe(ParticipationFlowKind.eventOpen);
  });

  test('R9 · temoin 12 — une detection COMPLETE garde son motif, sans aiguillage', () => {
    const flow = resolveParticipationFlow(
      { ...detectionAVenir, capacity: 1, participations: [{ documentId: 'quelqu-un' }] },
      { user: playerUser },
    );

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toBe('Cet événement est complet.');
    expect(flow.submitMode).toBe('createEventParticipation');
  });

  test('R9 · temoin 13 — ce qui n est PAS une detection ne change pas d un iota', () => {
    // 🔒 Le temoin qui borne le lot : treize surfaces appellent cette fonction
    // pour tous les types d evenement. Seule la detection bouge.
    const flow = resolveParticipationFlow(
      { ...detectionAVenir, type: { name: 'Match' } },
      { user: playerUser },
    );

    expect(flow.submitMode).toBe('createEventParticipation');
    expect(flow.kind).toBe(ParticipationFlowKind.eventOpen);
  });

  test('R9 · temoin 14 — le chemin d avant, avec des postes comptes, est intact', () => {
    const flow = resolveParticipationFlow(detectionAVenir, {
      detectionSlotsCount: 3,
      user: playerUser,
    });

    expect(flow.submitMode).toBe('detection-slot-picker');
    expect(flow.kind).toBe(ParticipationFlowKind.detectionSlot);
  });
});
