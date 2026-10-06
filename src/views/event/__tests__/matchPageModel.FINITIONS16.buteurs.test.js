/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import fs from 'fs';
import path from 'path';

import { buildMatchHeaderScoreSummary } from '../matchPageModel';

// FINITIONS16 · POINT 16 (tournee T15, page du match du 5 sept., Karim et Papa Test, site) —
// L'ENCART DU SCORE DISAIT « 2 buts sans buteur », LA FEUILLE DU MEME MATCH « 1 but sur 2 a un
// buteur » (Hugo, 1 but).
//
// 🔬 La charge capturee par le relais de la T15 (`/api/events/t0hm…/match-stats`) : la feuille a
// ete PUBLIEE le 01/10, AVANT la reponse de Hugo (02/10). Sa ligne y est VIDE (0 min, 0 but) ; le
// serveur joint ses chiffres envoyes (`availablePlayers[].suggestedStats` : 90 min, 1 but). La
// feuille applique la regle ST-MATCH10 (defaut 19) : une ligne vide cede la place aux chiffres
// que le joueur a envoyes. L'encart, lui, comptait la ligne vide.
// 🎯 Une seule regle (`chiffresQuiComptent`, feuilleDeMatchModel.js), lue par les deux. ROUGE avant.

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next;

const HUGO = 'xf8nhqxdtl2sipkiq0wmzpxh';

// Ce que le serveur a rendu a Hugo le 06/10 (relais T15, ligne 91 de relay_corps.log), reduit.
const CHARGE = {
  availablePlayers: [
    {
      documentId: HUGO,
      firstname: 'Hugo',
      lastname: 'Lemaire',
      suggestedStats: {
        manualPlayerName: null,
        minutesPlayed: 90,
        sportPayload: {
          assists: 0, cleanSheet: false, goals: 1, goalsConceded: 0,
        },
        userDocumentId: HUGO,
      },
    },
    {
      documentId: 'dnttirhe8zl4txcsige97ieo',
      firstname: 'Recette',
      lastname: 'Onboarding',
      suggestedStats: null,
    },
  ],
  playerResponses: [{ status: 'submitted', userDocumentId: HUGO }],
  report: {
    playerLines: [{
      manualPlayerName: null,
      minutesPlayed: 0,
      sportPayload: {
        assists: 0, cleanSheet: false, goals: 0, goalsConceded: 0,
      },
      user: { documentId: HUGO, firstname: 'Hugo', lastname: 'Lemaire' },
      userDocumentId: HUGO,
    }],
  },
  score: {
    available: true,
    recordedAt: '2026-10-01T20:35:19.018Z',
    recordedBy: { documentId: 'sma3qnjb5p4jefg4dd192190', firstname: 'Karim' },
    scoreAgainst: 1,
    scoreFor: 2,
    source: 'manual',
  },
};

const encart = (/** @type {any} */ extra = {}) => buildMatchHeaderScoreSummary({
  canEdit: false,
  canManage: false,
  canSeeDetails: true,
  event: { documentId: 't0hmjdmvvl54dq17tsuenc30' },
  isFinal: true,
  isFinished: true,
  isViewerFromInvitedTeam: false,
  opponentName: 'Test-COMPO',
  playerLines: CHARGE.report.playerLines,
  scoreState: CHARGE.score,
  sport: 'football',
  t,
  ...extra,
});

describe('FINITIONS16 16 — l encart compte les buteurs comme la feuille', () => {
  test('🔴 la ligne vide de Hugo cede la place a son but envoye : « Hugo L. · 1 but sans buteur »', () => {
    const { scorersLine } = encart({
      availablePlayers: CHARGE.availablePlayers,
      playerResponses: CHARGE.playerResponses,
    });

    expect(scorersLine).toBe('Hugo L. · 1 but sans buteur');
  });

  test('🔴 la page du match (telephone et site) donne a l encart les chiffres envoyes', () => {
    ['EventDetails.js', 'EventDetails.web.js'].forEach((fichier) => {
      const source = fs.readFileSync(path.join(__dirname, '..', fichier), 'utf8');
      const appel = /buildMatchHeaderScoreSummary\(\{[\s\S]*?\}\)/.exec(source);
      expect([fichier, Boolean(appel)]).toEqual([fichier, true]);
      expect(appel?.[0]).toMatch(/availablePlayers:/);
      expect(appel?.[0]).toMatch(/playerResponses:/);
    });
  });

  test('🔒 sans les chiffres envoyes (un lecteur qui ne les recoit pas) : la feuille publiee', () => {
    expect(encart().scorersLine).toBe('2 buts sans buteur');
  });

  test('🔒 une ligne REMPLIE par l entraineur garde ses chiffres (il a pu corriger la reponse)', () => {
    const ligneDuCoach = [{ ...CHARGE.report.playerLines[0], minutesPlayed: 60, sportPayload: { goals: 2 } }];
    const { scorersLine } = encart({
      availablePlayers: CHARGE.availablePlayers,
      playerLines: ligneDuCoach,
      playerResponses: CHARGE.playerResponses,
    });

    expect(scorersLine).toBe('Hugo L. ×2');
  });

  test('🔒 une reponse NON envoyee (brouillon) ne remplace pas une ligne publiee', () => {
    const { scorersLine } = encart({
      availablePlayers: CHARGE.availablePlayers,
      playerResponses: [{ status: 'draft', userDocumentId: HUGO }],
    });

    expect(scorersLine).toBe('2 buts sans buteur');
  });
});
