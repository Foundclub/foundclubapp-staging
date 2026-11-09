// ==========================================================================
// CONVOC-HORS-LISTE (07/11) — LE CONSTAT, AVANT TOUTE MODIFICATION.
//
// Demande d'Adel : un joueur de l'equipe que la convocation publiee laisse dehors
// doit lire qu'il n'est pas convoque, qu'il n'est pas compte, mais qu'il peut se
// marquer present. Ces temoins decrivent ce que l'app fait DEJA, sans rien changer :
//   (a) dans le fil, la carte de la convocation ne lui tend AUCUN bouton ;
//   (c) une reponse « present » de sa part n'entre ni dans les noms ni dans les
//       chiffres que le coach lit sous la carte et sur l'ecran 7.
// Le point (b) — il peut repondre depuis la fiche du match — est tenu par
// `views/event/__tests__/EventDetailsConvocHorsListe.test.js`.
// ==========================================================================

// La carte importe la porte de reponse, qui tire `react-native-blob-util` : doublee,
// comme dans les temoins de la carte (`CompositionMessageBubbleBULLE.test.js`).
jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

/* eslint-disable import/first -- les doublures de jest passent avant les imports. */
import {
  resolveCompositionAnswer,
} from '@/components/molecules/compositionMessageBubble/CompositionAnswerBar';
import {
  buildConvocationRoster,
  getConvocationCounts,
} from '@/views/matchCallUp/matchConvocationUtils';

import { buildAnswerGroups } from '../convocationWizardUtils';
/* eslint-enable import/first */

const TEAM_ID = 'team-1';
const TITULAIRE = 'joueur-1';
const REMPLACANT = 'joueur-2';
const HORS_LISTE = 'joueur-9';

const PACK = {
  requireResponse: true,
  reservePlayerIds: [REMPLACANT],
  reserveSnapshotPlayers: [{ documentId: REMPLACANT, firstname: 'Leo', lastname: 'Diarra' }],
  snapshotPlayers: [{ documentId: TITULAIRE, firstname: 'Karim', lastname: 'Sylla' }],
  teams: [{
    id: 'team_1',
    placements: [{ playerId: TITULAIRE, slotId: 'team_1:slot_1' }],
  }],
  version: 2,
};

// Le non-convoque a repondu « present » : meme si une charge le portait, la regle
// cote app ne le compte pas. (Le serveur, lui, ne le met meme pas dans
// `byPlayerId` : `buildConvocationResponses` ne parcourt que les convoques.)
const RESPONSES = {
  byPlayerId: { [HORS_LISTE]: 'present', [REMPLACANT]: 'pending', [TITULAIRE]: 'present' },
  counts: { absent: 0, pending: 1, present: 1 },
};

const CONVOCATION = {
  branches: [{ published: PACK, responses: RESPONSES, team: { documentId: TEAM_ID } }],
  event: { rsvpEnabled: true },
};

describe('CONVOC-HORS-LISTE · constat (a) — la carte du fil', () => {
  test('le convoque a les boutons Present / Absent sous la carte', () => {
    const vue = resolveCompositionAnswer({
      convocation: CONVOCATION, publishedVersion: 2, teamId: TEAM_ID, viewerId: TITULAIRE,
    });

    expect(vue.canAnswer).toBe(true);
  });

  test('le non-convoque n en a AUCUN : il ne repond pas depuis la carte', () => {
    const vue = resolveCompositionAnswer({
      convocation: CONVOCATION, publishedVersion: 2, teamId: TEAM_ID, viewerId: HORS_LISTE,
    });

    expect(vue.canAnswer).toBe(false);
  });
});

describe('CONVOC-HORS-LISTE · constat (c) — les chiffres du coach', () => {
  test('le bloc « Reponses » sous la carte ne le nomme nulle part', () => {
    const groupes = buildAnswerGroups({ published: PACK, responses: RESPONSES });

    expect(groupes.present).toEqual(['Karim Sylla']);
    expect(groupes.pending).toEqual(['Leo Diarra']);
    expect([...groupes.present, ...groupes.absent, ...groupes.pending]).toHaveLength(2);
  });

  test('l ecran 7 compte 2 convoques et 1 present', () => {
    const roster = buildConvocationRoster({ published: PACK, responses: RESPONSES });

    expect(roster.map((row) => row.playerId)).toEqual([TITULAIRE, REMPLACANT]);
    expect(getConvocationCounts({ responses: RESPONSES, roster })).toEqual({
      absent: 0, calledUp: 2, pending: 1, present: 1,
    });
  });
});
