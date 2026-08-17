import fr from '@/theme/strings/translations/fr';

import { getRequestsHubData } from '../requestsHubService';

/**
 * T05 — la liste des demandes doit contenir ce qui ATTEND une decision, et rien
 * d autre.
 *
 * 🔎 CE QUE LA MESURE A ETABLI AVANT D ECRIRE CE FILET (2026-08-17) :
 *
 * Les HUIT types de demandes empechent DEJA une seconde demande tant que la
 * premiere est en attente (policy `had-pending-membership-request` pour equipe
 * et club, dedoublonnage en ligne pour `club-request` (D95), `club-interest`,
 * `friendly-match-application`, `event-highlight-request`, une seule
 * `facility-override-request` par evenement, `validateUserHasNoPendingParticipationRequest`).
 * ⇒ Le doublon A L ENVOI est deja couvert, et par PREVENTION plutot que par un
 * delai : personne n attend, personne n est puni.
 *
 * 🧨 Il restait pourtant UN doublon, et il vit ici, dans l agregation :
 * une candidature de match amical est lue DEUX FOIS quand les deux equipes
 * concernees sont a moi — une fois cote « recue » (mon annonce porte la
 * candidature) et une fois cote « envoyee » (mon autre equipe a candidate).
 * `mergeRequestsById` ne peut rien : les deux lignes portent des identifiants
 * differents (`friendly:<id>` et `friendly-sent:<id>`).
 * Rien cote serveur ne l empeche : `applyToAd` n interdit que de candidater a sa
 * PROPRE annonce (`teamDocumentId === ad.team`), pas a celle d une equipe soeur.
 *
 * 🧨 Et il restait une PEREMPTION : le menage serveur (`cleanupExpiredAds`)
 * passe bien l annonce en `expired` des que sa derniere date candidate est
 * passee, mais il laisse ses candidatures en `pending`, et l annonce vit encore
 * 90 jours en retention. La liste affichait donc une proposition de match pour
 * une date deja passee.
 */

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  getClubInterestRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  getClubMembershipRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(async () => ({ data: [] })),
  getPendingFeaturedRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getPendingFacilityOverrideRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  getTeamMembershipRequests: jest.fn(async () => ({ data: [] })),
}));

const mockGetMyFriendlyMatchAds = jest.fn();
const mockGetMyFriendlyMatchApplications = jest.fn();
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getMyFriendlyMatchAds: (...args) => mockGetMyFriendlyMatchAds(...args),
  getMyFriendlyMatchApplications: (...args) => mockGetMyFriendlyMatchApplications(...args),
}));

/** La candidature de mon equipe B sur l annonce de mon equipe A. */
const APPLICATION_ENTRE_MES_DEUX_EQUIPES = {
  documentId: 'app-partagee',
  status: 'pending',
  team: { documentId: 'team-b', name: 'U17 Maison' },
};

const buildAd = (overrides = {}) => ({
  applications: [],
  documentId: 'ad-1',
  status: 'open',
  team: { documentId: 'team-a', name: 'U15 Maison' },
  ...overrides,
});

const buildCandidature = (documentId) => ({
  documentId,
  status: 'pending',
  team: { documentId: 'team-x', name: 'US Voisine' },
});

const friendlyItems = (data) => data.items.filter((item) => item.type === 'friendly');

describe('T05 — une meme candidature ne compte qu UNE fois dans « Demandes »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyFriendlyMatchAds.mockResolvedValue([]);
    mockGetMyFriendlyMatchApplications.mockResolvedValue([]);
  });

  it('temoin 1 — deux demandes identiques du meme joueur ne creent qu UNE ligne', async () => {
    // La MEME candidature, lue des deux cotes : mon equipe A possede l annonce,
    // mon equipe B y a candidate. Les deux equipes sont dans `teamIds`.
    const adRecue = buildAd({ applications: [APPLICATION_ENTRE_MES_DEUX_EQUIPES] });
    const adEnvoyee = buildAd({ myApplication: APPLICATION_ENTRE_MES_DEUX_EQUIPES });

    mockGetMyFriendlyMatchAds.mockResolvedValue([adRecue]);
    mockGetMyFriendlyMatchApplications.mockResolvedValue([adEnvoyee]);

    const data = await getRequestsHubData({
      clubId: 'club-1',
      teamIds: ['team-a', 'team-b'],
    });

    expect(friendlyItems(data)).toHaveLength(1);
    // 🔑 Et c est la ligne ACTIONNABLE qui reste : celle qui porte le bouton,
    // pas le simple accuse de reception « en attente de sa reponse ».
    expect(friendlyItems(data)[0].meta.isOutgoing).toBe(false);
    expect(data.counts.friendly).toBe(1);
  });

  it('temoin de controle — une proposition envoyee a un TIERS reste affichee', async () => {
    // Non-regression du lot D92 : ce qu on envoie doit rester visible quelque
    // part, sinon on ne sait plus si c est parti.
    mockGetMyFriendlyMatchApplications.mockResolvedValue([
      buildAd({
        documentId: 'ad-tiers',
        myApplication: { documentId: 'app-tiers', status: 'pending' },
        team: { documentId: 'team-adverse', name: 'US Voisine' },
      }),
    ]);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-b'] });

    expect(friendlyItems(data)).toHaveLength(1);
    expect(friendlyItems(data)[0].meta.isOutgoing).toBe(true);
  });
});

describe('T05 — le refus d un doublon n est jamais MUET', () => {
  it('⛔ temoin 2 — le code de refus du serveur a une phrase francaise, jamais un mur vide', () => {
    // La MOITIE app du temoin. L autre moitie vit dans
    // `admin/tests/authz/demandes-anti-spam-sans-delai.test.js` : elle prouve
    // que la policy serveur emet bien CE code-la quand elle refuse un doublon.
    // 📌 Aucun delai n a ete pose (decision T05) : le message dit donc « tu as
    // deja une demande en attente », il n a aucune duree a annoncer.
    const message = fr?.APIerrors?.HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR;

    expect(typeof message).toBe('string');
    expect(message.trim().length).toBeGreaterThan(0);
    expect(message).toContain('déjà');
  });
});

describe('T05 — une demande liee a un evenement passe n apparait plus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyFriendlyMatchAds.mockResolvedValue([]);
    mockGetMyFriendlyMatchApplications.mockResolvedValue([]);
  });

  it('temoin 4 — une candidature sur une annonce EXPIREE ne remonte plus', async () => {
    mockGetMyFriendlyMatchAds.mockResolvedValue([
      buildAd({
        applications: [buildCandidature('app-morte')],
        status: 'expired',
      }),
    ]);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-a'] });

    expect(friendlyItems(data)).toHaveLength(0);
    expect(data.counts.friendly).toBe(0);
  });

  it('temoin 4 bis — ma proposition ENVOYEE sur une annonce annulee ne remonte plus', async () => {
    mockGetMyFriendlyMatchApplications.mockResolvedValue([
      buildAd({
        documentId: 'ad-annulee',
        myApplication: { documentId: 'app-envoyee-morte', status: 'pending' },
        status: 'cancelled',
        team: { documentId: 'team-adverse', name: 'US Voisine' },
      }),
    ]);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-b'] });

    expect(friendlyItems(data)).toHaveLength(0);
  });

  it('temoin de controle — une annonce encore ouverte garde sa candidature', async () => {
    mockGetMyFriendlyMatchAds.mockResolvedValue([
      buildAd({
        applications: [buildCandidature('app-vivante')],
        status: 'open',
      }),
    ]);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-a'] });

    expect(friendlyItems(data)).toHaveLength(1);
  });

  it('🔒 garde-fou — une annonce SANS statut lisible reste affichee, jamais escamotee', async () => {
    // Le piege deja paye sur la purge des demandes de club (D97) : une borne qui
    // peut rester vide fait disparaitre en silence. Ici, pas de statut lisible
    // = on ne sait pas, donc on GARDE et le dirigeant tranche.
    mockGetMyFriendlyMatchAds.mockResolvedValue([
      buildAd({
        applications: [buildCandidature('app-sans-statut')],
        status: undefined,
      }),
    ]);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-a'] });

    expect(friendlyItems(data)).toHaveLength(1);
  });
});
