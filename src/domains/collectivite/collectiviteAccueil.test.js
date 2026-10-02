import { RouteNames } from '@/navigation/routeNames';

import {
  availableHomeActions,
  clubInitials,
  clubTotals,
  COLLECTIVITE_HOME_ACTIONS,
  firstFullMoment,
  formatWeekMoment,
  isOwnClubRequest,
  isVilleOnlyAccount,
  latestManagerRequest,
  managerRequestPayload,
  oldestPendingRequest,
  PREMIERS_PAS,
  premiersPas,
  signupContactErrors,
  summarizeConflict,
} from './collectiviteAccueil';

// 🏛️ COLL-ACCUEIL (01/10) — les calculs PURS de l'accueil de la Ville.

describe('COLL-ACCUEIL — les actions de l accueil', () => {
  it('six actions, dans l ordre de la planche', () => {
    expect(COLLECTIVITE_HOME_ACTIONS.map((action) => action.key)).toEqual([
      'assignSlot', 'publishNews', 'closeInstallation',
      'blockSlot', 'inviteClub', 'addInstallation',
    ]);
  });

  it('seules celles dont l écran EXISTE sont affichées, et leur route est une vraie route', () => {
    const affichees = availableHomeActions();
    // COLL-C4A (02/10) : « Publier une actualité » a son écran.
    // COLL-C4B (02/10) : « Fermer une installation » et « Bloquer un créneau » aussi.
    expect(affichees.map((action) => action.key)).toEqual([
      'publishNews', 'closeInstallation', 'blockSlot', 'addInstallation',
    ]);
    affichees.forEach((action) => {
      expect(RouteNames[/** @type {keyof typeof RouteNames} */ (action.route)]).toBe(action.route);
    });
  });
});

describe('COLL-ACCUEIL — ce qui attend', () => {
  it('la plus ancienne demande est en tête ; une date illisible passe derrière', () => {
    expect(oldestPendingRequest([
      { createdAt: '2026-10-01T10:00:00Z', documentId: 'b' },
      { createdAt: null, documentId: 'x' },
      { createdAt: '2026-09-28T10:00:00Z', documentId: 'a' },
    ])?.documentId).toBe('a');
    expect(oldestPendingRequest([])).toBeNull();
    expect(oldestPendingRequest(undefined)).toBeNull();
  });

  it('le conflit en nombres : places prises, plein, équipes si on accepte', () => {
    expect(summarizeConflict({ maxSlots: 2, remaining: 0 })).toEqual({
      full: true, maxSlots: 2, remaining: 0, taken: 2, teamsIfAccepted: 3,
    });
    expect(summarizeConflict({ maxSlots: 3, remaining: 1 })).toEqual({
      full: false, maxSlots: 3, remaining: 1, taken: 2, teamsIfAccepted: 3,
    });
    // Déjà en surréservation : la capacité est dépassée, accepter ajoute encore une équipe.
    expect(summarizeConflict({ maxSlots: 1, remaining: -1 })?.teamsIfAccepted).toBe(3);
    expect(summarizeConflict(null)).toBeNull();
    expect(summarizeConflict({ maxSlots: 0, remaining: 0 })).toBeNull();
  });
});

describe('COLL-ACCUEIL — la vision', () => {
  it('les clubs en NOMBRES ; un compteur de membres illisible rend null, jamais 0', () => {
    expect(clubTotals([
      { membersCount: 3, teamsCount: 4 },
      { membersCount: 2, teamsCount: 2 },
    ])).toEqual({ clubs: 2, members: 5, teams: 6 });
    expect(clubTotals([{ membersCount: 3, teamsCount: 1 }, { membersCount: null, teamsCount: 1 }]))
      .toEqual({ clubs: 2, members: null, teams: 2 });
    expect(clubTotals(undefined)).toEqual({ clubs: 0, members: 0, teams: 0 });
  });

  it('les initiales d un club pour son écusson', () => {
    expect(clubInitials('AS Montrivage')).toBe('AM');
    expect(clubInitials('Montrivage Basket')).toBe('MB');
    expect(clubInitials('Aïkido')).toBe('A');
    expect(clubInitials('')).toBe('?');
  });

  it('le premier moment où l installation est PLEINE ; une fin libère avant un début', () => {
    const blocs = [
      { date: '2030-10-03', endTime: '19:30', startTime: '18:00' },
      { date: '2030-10-03', endTime: '20:00', startTime: '19:30' },
      { date: '2030-10-03', endTime: '19:30', startTime: '18:30' },
    ];
    const moment = firstFullMoment(blocs, 2);
    expect(moment?.getHours()).toBe(18);
    expect(moment?.getMinutes()).toBe(30);
    // 19:30 : une équipe sort, une entre — jamais 3 en même temps.
    expect(firstFullMoment(blocs, 3)).toBeNull();
    expect(firstFullMoment([], 1)).toBeNull();
    expect(firstFullMoment(blocs, null)).toBeNull();
  });

  it('le moment s écrit « jeu 18:00 »', () => {
    expect(formatWeekMoment(new Date(2030, 9, 3, 18, 0))).toBe('jeu 18:00');
    expect(formatWeekMoment(null)).toBe('');
  });
});

describe('COLL-ACCUEIL — D69 : la demande de son propre club', () => {
  it('reconnaît le club du compte (club principal ou liste de clubs)', () => {
    const demande = { club: { documentId: 'club-as' } };
    expect(isOwnClubRequest(demande, { club: { documentId: 'club-as' } })).toBe(true);
    expect(isOwnClubRequest(demande, { clubs: [{ documentId: 'club-as' }] })).toBe(true);
    expect(isOwnClubRequest(demande, { club: { documentId: 'club-fc' } })).toBe(false);
    expect(isOwnClubRequest({}, { club: { documentId: 'club-as' } })).toBe(false);
    expect(isOwnClubRequest(demande, null)).toBe(false);
  });
});

describe('COLL-ACCUEIL — « Ville seule » ou compte mixte (décision « accueil A »)', () => {
  it('Ville seule = aucun rôle sportif, et une Ville gérée ou demandée', () => {
    expect(isVilleOnlyAccount({
      hasManagerRequest: false, managedCount: 1, roleKey: 'new',
    })).toBe(true);
    expect(isVilleOnlyAccount({
      hasManagerRequest: true, managedCount: 0, roleKey: 'new',
    })).toBe(true);
  });

  it('un dirigeant qui gère aussi la Ville garde son accueil ; un neuf sans Ville aussi', () => {
    expect(isVilleOnlyAccount({
      hasManagerRequest: false, managedCount: 1, roleKey: 'president',
    })).toBe(false);
    expect(isVilleOnlyAccount({
      hasManagerRequest: false, managedCount: 0, roleKey: 'new',
    })).toBe(false);
    expect(isVilleOnlyAccount({
      hasManagerRequest: true, managedCount: 0, roleKey: 'superAdmin',
    })).toBe(false);
  });
});

describe('COLL-ACCUEIL — l inscription « Je représente une collectivité »', () => {
  it('« Vous » : une faute par champ fautif ; l e-mail doit être complet', () => {
    expect(signupContactErrors({
      firstname: 'Agnès',
      jobTitle: 'Service des sports',
      lastname: 'Mairie',
      professionalEmail: 'sports@mairie.fr',
    })).toEqual({});
    expect(signupContactErrors({ professionalEmail: 'sports@' })).toEqual({
      firstname: 'required', jobTitle: 'required', lastname: 'required', professionalEmail: 'email',
    });
  });

  it('le corps : l id d une Ville existante, ou le nom et le type d une Ville à créer', () => {
    const vous = { jobTitle: ' Service des sports ', professionalEmail: ' Sports@Mairie.FR ' };
    const existante = { documentId: 'ville-1', name: 'Ville', type: 'commune' };
    expect(managerRequestPayload(existante, vous)).toEqual({
      collectiviteDocumentId: 'ville-1',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@mairie.fr',
    });
    const aCreer = { documentId: null, name: ' Valfleuri ', type: 'commune' };
    expect(managerRequestPayload(aCreer, vous)).toEqual({
      collectiviteName: 'Valfleuri',
      collectiviteType: 'commune',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@mairie.fr',
    });
  });

  it('la demande la plus récente', () => {
    expect(latestManagerRequest([
      { createdAt: '2026-09-01T00:00:00Z', documentId: 'a' },
      { createdAt: '2026-10-01T00:00:00Z', documentId: 'b' },
    ])?.documentId).toBe('b');
    expect(latestManagerRequest([])).toBeNull();
  });
});

describe('COLL-ACCUEIL — les premiers pas (planche P1v3)', () => {
  it('quatre étapes au registre ; celles des lots à venir sont masquées', () => {
    expect(PREMIERS_PAS.map((etape) => etape.key))
      .toEqual(['installations', 'clubs', 'creneaux', 'actualite']);
    // COLL-C4A (02/10) : « Présentez-vous aux clubs » a son écran ; « les créneaux » attend C2b.
    expect(premiersPas({ clubsVus: false, installationsCount: 0 }).total).toBe(3);
  });

  it('elles se cochent d elles-mêmes ; UNE seule porte le bouton', () => {
    const neuve = premiersPas({ clubsVus: false, installationsCount: 0 });
    expect(neuve.etapes.map((etape) => [etape.key, etape.fait, etape.suivante])).toEqual([
      ['installations', false, true],
      ['clubs', false, false],
      ['actualite', false, false],
    ]);
    const amiChemin = premiersPas({ clubsVus: false, installationsCount: 3 });
    expect(amiChemin.faits).toBe(1);
    expect(amiChemin.etapes.find((etape) => etape.suivante)?.key).toBe('clubs');
    const avantLaPremiere = premiersPas({ clubsVus: true, installationsCount: 1 });
    expect(avantLaPremiere.etapes.find((etape) => etape.suivante)?.key).toBe('actualite');
    expect(premiersPas({ actualitesCount: 1, clubsVus: true, installationsCount: 1 }).tousFaits)
      .toBe(true);
  });

  it('une étape dont le lot pose sa route apparaît à sa place', () => {
    const avecCreneaux = PREMIERS_PAS.map((etape) => (
      etape.key === 'creneaux' ? { ...etape, route: 'CollectiviteSlots' } : etape
    ));
    expect(premiersPas({ clubsVus: true, installationsCount: 1 }, avecCreneaux).etapes
      .map((etape) => etape.key)).toEqual(['installations', 'clubs', 'creneaux', 'actualite']);
  });
});
