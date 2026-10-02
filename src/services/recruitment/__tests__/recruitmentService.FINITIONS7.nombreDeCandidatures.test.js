import '@/theme/strings';

import { buildMyActivitiesPublications } from '@/domains/search/myActivitiesFeed';

import { getMyRecruitmentAds } from '../recruitmentService';

// FINITIONS7 · POINT 6 (tournee 8) — « MES ACTIVITES » DISAIT « 0 CANDIDATURE », LA FICHE
// « CANDIDATURES (1) ».
//
// 🧭 La liste des annonces (`GET /recruitment-ads`) n apporte jamais `applications` au
// proprietaire : aucun role n a plus `recruitment-application.find` (D10, 29/07) et Strapi retire
// la relation en silence. Le serveur pose desormais `applicationsCount` sur les annonces que le
// lecteur possede (admin, tests/authz/FINITIONS7-6-nombre-de-candidatures.test.js) — la meme
// source que la fiche. L app le LIT au lieu de le recalculer sur une liste vide.

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

const ANNONCE_DU_SERVEUR = {
  applicationsCount: 1,
  audienceType: 'player',
  candidates: [{ documentId: 'hugo' }],
  documentId: 'annonce-gardien',
  isActive: true,
  position: 'Gardien',
  team: { documentId: 'team-u15', name: 'U15' },
  type: 'saison',
};

beforeEach(() => {
  mockGet.mockReset();
});

describe('FINITIONS7 · point 6 — le nombre de candidatures de Mes activites', () => {
  test('🚨 le nombre du serveur est garde, meme quand `applications` n arrive pas', async () => {
    mockGet.mockResolvedValue({ data: { data: [ANNONCE_DU_SERVEUR] } });
    const [annonce] = await getMyRecruitmentAds({ authorDocumentId: 'karim' });

    expect(annonce.applicationsCount).toBe(1);
  });

  test('🚨 la carte de Mes activites dit « 1 candidature », comme la fiche', async () => {
    mockGet.mockResolvedValue({ data: { data: [ANNONCE_DU_SERVEUR] } });
    const annonces = await getMyRecruitmentAds({ authorDocumentId: 'karim' });
    const publication = buildMyActivitiesPublications({ recruitmentAds: annonces })
      .find((/** @type {any} */ ligne) => ligne.type === 'publication');

    expect(publication.countLabel).toBe('1 candidature');
  });

  test('sans nombre du serveur (ancien serveur, lecteur non proprietaire) : on compte ce qui est arrive', async () => {
    const { applicationsCount: _ignore, ...sansNombre } = ANNONCE_DU_SERVEUR;
    mockGet.mockResolvedValue({
      data: { data: [{ ...sansNombre, applications: [{ documentId: 'cand-1' }, { documentId: 'cand-2' }] }] },
    });
    const [annonce] = await getMyRecruitmentAds({ authorDocumentId: 'karim' });

    expect(annonce.applicationsCount).toBe(2);
  });
});
