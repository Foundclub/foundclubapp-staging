import { normalizeHomeCounters, selectHomeAlerts } from '@/domains/home/homeCounters';

import { getRequestsHubData } from '../requestsHubService';

/**
 * 🎟️ S10-C / D1 + D2 — LES INVITATIONS D EQUIPE DANS « DEMANDES »,
 * ET LE VERROU CONTRE LA PASTILLE FANTOME.
 *
 * 🧨 LE PIEGE DEJA PAYE (Q1) : un compteur et sa liste ajoutes chacun de leur
 * cote finissent par ne plus poser la meme question. La pastille annonce alors
 * « 3 », l ecran n en montre aucune, et personne ne sait laquelle des deux ment.
 *
 * 🔒 CE QUE CE FICHIER VERROUILLE, ET C EST TOUT CE QUE L APP PEUT VERROUILLER :
 * le serveur pose la MEME question aux deux (contrat S10-A du 2026-08-26,
 * section 5 — un temoin serveur compare les deux requetes reellement emises).
 * L app, elle, ne doit RIEN filtrer par-dessus : ni statut, ni date, ni equipe.
 * Ces temoins echouent des qu un tri cote app se glisse d un seul cote.
 */

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  getClubInterestRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  getClubMembershipRequests: jest.fn(async () => ({ data: [] })),
}));

const mockGetMyPendingEventTeamInvitations = jest.fn(async () => []);

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(async () => ({ data: [] })),
  getMyPendingEventTeamInvitations: (/** @type {any} */ ...args) => (
    mockGetMyPendingEventTeamInvitations(...args)
  ),
  getPendingFeaturedRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getPendingFacilityOverrideRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getMyFriendlyMatchAds: jest.fn(async () => []),
  getMyFriendlyMatchApplications: jest.fn(async () => []),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  getTeamMembershipRequests: jest.fn(async () => ({ data: [] })),
}));

/** Une invitation telle que `GET /event-team-audiences/mine` la rend. */
const invitation = (/** @type {string} */ suffixe) => ({
  audienceId: `audience-${suffixe}`,
  audienceKind: 'external_invited',
  event: {
    date: '2027-01-15T18:00:00.000Z',
    id: `event-${suffixe}`,
    name: 'Match vs US Adverse U15',
    teamName: 'U15 A',
    typeName: 'Match',
  },
  selectionMode: 'ALL_MEMBERS',
  status: 'PENDING',
  team: { id: `team-${suffixe}`, name: 'US Adverse U15' },
});

const erreur = (/** @type {number} */ status) => Object.assign(
  new Error(`HTTP ${status}`),
  { status },
);

describe('S10-C — les invitations d equipe dans l ecran Demandes', () => {
  beforeEach(() => {
    mockGetMyPendingEventTeamInvitations.mockReset();
    mockGetMyPendingEventTeamInvitations.mockResolvedValue([]);
  });

  test('la rangee nomme l evenement et l equipe, et elle mene a la fiche', async () => {
    mockGetMyPendingEventTeamInvitations.mockResolvedValue([invitation('1')]);

    const { items } = await getRequestsHubData({ teamIds: ['team-1'] });
    const rangee = items.find((/** @type {any} */ item) => item.type === 'teamInvite');

    expect(rangee.title).toBe('Invitation - Match vs US Adverse U15');
    expect(rangee.subtitle).toBe('U15 A invite US Adverse U15.');
    // 🚪 D5 — CE QUI REMPLACE DES BOUTONS EN DOUBLE : l identifiant de
    // l evenement. C est lui qui fait apparaitre « Repondre a l invitation »
    // dans la rangee, et qui ouvre la fiche ou vivent Accepter et Refuser.
    expect(rangee.meta.eventId).toBe('event-1');
    expect(rangee.meta.audienceId).toBe('audience-1');
    expect(rangee.actions).toEqual({});
  });

  test('🔒 Q1 — la liste ne filtre RIEN : elle rend ce que le serveur a compte', async () => {
    // Le serveur a deja retenu « PENDING · mon perimetre · evenement a venir ».
    // On lui renvoie volontairement une ligne au statut inattendu : si l app se
    // mettait a trier, elle la perdrait et divergerait de la pastille.
    mockGetMyPendingEventTeamInvitations.mockResolvedValue([
      invitation('1'),
      invitation('2'),
      { ...invitation('3'), status: 'UN_STATUT_QUE_L_APP_NE_CONNAIT_PAS' },
    ]);

    const { counts } = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(counts.teamInvite).toBe(3);
  });

  test('🔒 Q1 — la pastille d accueil et la liste annoncent le MEME nombre', async () => {
    mockGetMyPendingEventTeamInvitations.mockResolvedValue([invitation('1'), invitation('2')]);

    const { counts } = await getRequestsHubData({ teamIds: ['team-1'] });
    // La meme reponse serveur, vue par l accueil.
    const compteurs = normalizeHomeCounters({ demandes: 0, invitationsEquipe: 2 });

    expect(compteurs.invitationsEquipe).toBe(counts.teamInvite);
    expect(selectHomeAlerts(compteurs)['manage-requests']).toBe(true);
  });

  test('🔒 Q1 — sans invitation, aucune pastille ne s allume', async () => {
    const { counts } = await getRequestsHubData({ teamIds: ['team-1'] });
    const compteurs = normalizeHomeCounters({ demandes: 0, invitationsEquipe: 0 });

    expect(counts.teamInvite).toBe(0);
    expect(selectHomeAlerts(compteurs)['manage-requests']).toBe(false);
  });

  test('la pastille additionne les demandes et les invitations', () => {
    const compteurs = normalizeHomeCounters({ demandes: 4, invitationsEquipe: 3 });

    // ⚠️ Le champ absent vaut 0 : tant que le serveur n envoie rien, la
    // pastille garde exactement le comportement d avant ce lot.
    expect(selectHomeAlerts(normalizeHomeCounters({ demandes: 0 }))['manage-requests']).toBe(false);
    expect(compteurs.demandes + compteurs.invitationsEquipe).toBe(7);
    expect(selectHomeAlerts(compteurs)['manage-requests']).toBe(true);
  });

  test('le perimetre est celui du SERVEUR : l app ne lui envoie aucun parametre', async () => {
    mockGetMyPendingEventTeamInvitations.mockResolvedValue([invitation('1')]);

    await getRequestsHubData({ clubId: 'club-1' });

    expect(mockGetMyPendingEventTeamInvitations).toHaveBeenCalledWith();
  });

  test('un compte sans equipe ni club n interroge meme pas la route', async () => {
    await getRequestsHubData({ cmId: 'cm-1' });

    expect(mockGetMyPendingEventTeamInvitations).not.toHaveBeenCalled();
  });

  // 🕓 LES DEUX MOITIES NE VOYAGENT PAS A LA MEME VITESSE : la route n existe
  // qu une fois S10-A deploye. Un 404 en attendant ne doit pas annoncer une
  // panne — le bouton « Reessayer » n y pourrait rien.
  test('un 404 laisse la rubrique vide, sans banniere de panne', async () => {
    mockGetMyPendingEventTeamInvitations.mockRejectedValue(erreur(404));

    const { counts, errors } = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(counts.teamInvite).toBe(0);
    expect(errors).toEqual([]);
  });

  test('une vraie panne, elle, se dit', async () => {
    mockGetMyPendingEventTeamInvitations.mockRejectedValue(erreur(500));

    const { errors } = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(errors).toEqual([
      { message: 'HTTP 500', source: 'teamInvite', status: 500 },
    ]);
  });
});
