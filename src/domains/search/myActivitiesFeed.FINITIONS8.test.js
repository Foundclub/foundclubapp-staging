import '@/theme/strings';

import { getMyRecruitmentAds } from '@/services/recruitment/recruitmentService';

import { buildMyActivitiesReceivedResponses } from './myActivitiesFeed';

// FINITIONS8 · POINT 2 (tournee 9) — « REPONSES RECUES » DE MES ACTIVITES EST VIDE DEPUIS LE 29/07.
//
// Capture : .recette/tournee9/T9_P1_1b_karim_reponses_recues_vide.png
// Le serveur pose desormais les candidatures sur les annonces que le lecteur POSSEDE (admin,
// tests/authz/FINITIONS8-2-reponses-recues.test.js), par `toReviewerPayload` : le candidat y
// porte `firstname` / `lastname` — les noms du schema. Le fil lisait `firstName` / `lastName`,
// une forme qu'aucun serveur ne rend : il aurait titre « Candidat » une liste enfin remplie.
// Ce temoin part de la reponse du serveur, par le VRAI service (seul le client HTTP est double).

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

// L'annonce de Karim TELLE QUE le serveur la rend (FINITIONS8) : la candidature de Hugo, 14 ans,
// sans telephone ni e-mail (mineur masque).
const ANNONCE_DE_KARIM = {
  applications: [{
    applicant: {
      documentId: 'u-hugo',
      email: null,
      firstname: 'Hugo',
      id: 12,
      lastname: 'Lemaire',
      phoneNumber: null,
    },
    createdAt: '2026-10-02T13:40:00.000Z',
    documentId: 'cand-hugo',
    emailSnapshot: null,
    id: 91,
    message: 'Je suis gardien depuis 3 ans',
    phoneSnapshot: null,
    recruitmentAd: { documentId: 'ad-gardien', id: 3 },
    status: 'pending',
  }],
  applicationsCount: 1,
  audienceType: 'player',
  candidates: [],
  category: { name: 'U15' },
  documentId: 'ad-gardien',
  isActive: true,
  position: 'Gardien',
  team: { documentId: 'team-u15', name: 'U15' },
};

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: { data: [ANNONCE_DE_KARIM] } });
});

describe('FINITIONS8 · point 2 — Reponses recues : la candidature de Hugo chez Karim', () => {
  test('🚨 la candidature est listee, et nommee « Hugo Lemaire »', async () => {
    const annonces = await getMyRecruitmentAds({ authorDocumentId: 'u-karim' });
    const lignes = buildMyActivitiesReceivedResponses({ recruitmentAds: annonces });

    expect(lignes.map((ligne) => ligne.title)).toEqual(['Candidatures reçues · 1', 'Hugo Lemaire']);
    expect(lignes[1]).toMatchObject({ isNew: true, market: 'recruitment', type: 'response' });
  });

  test('jumeau : l ancienne forme (firstName) reste lue', () => {
    const lignes = buildMyActivitiesReceivedResponses({
      recruitmentAds: [{
        ...ANNONCE_DE_KARIM,
        applications: [{
          applicant: { firstName: 'Josh', lastName: 'Miles' },
          documentId: 'c',
          status: 'pending',
        }],
      }],
    });

    expect(lignes[1].title).toBe('Josh Miles');
  });
});
