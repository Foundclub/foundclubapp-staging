import {
  buildParticipationsByStatus,
  buildTeamParticipationSections,
  getEligibleTeamPlayers,
  getEventTrainerKeys,
} from './eventParticipantSections';

// LOT PARTWEB (21/09) — LE CALCUL QUI RANGE LES GENS D UN EVENEMENT, PARTAGE.
//
// 📸 LE CONSTAT (Chrome d Adel, foundclub.app, entrainement Senior du 21/09) :
// « Faire l appel : 15 attendus », mais « Participants : Aucun participant
// confirme » et « Joueurs attendus : 0 ». Le site ne lisait que
// `event.participations` ; le telephone, lui, range Presents / Absents / Sans
// reponse par equipe, dans deux `useMemo` de `EventDetails.js`.
//
// 🎯 Ces deux calculs sortent de l ecran, A L IDENTIQUE, pour que le site
// appelle la MEME fonction au lieu d en recopier une seconde. Le filet de
// l extraction cote telephone reste celui des temoins d ecran (S1, AA02, AD06,
// AE02, P2, P7…) : ils lisent les props remises a `EventParticipants`.
// Ce fichier-ci fige le comportement du calcul lui-meme.

const t = (/** @type {string} */ _key, /** @type {string} */ fallback) => fallback;

const joueur = (/** @type {number} */ n) => ({
  documentId: `joueur-${n}`,
  firstname: `Prenom${n}`,
  lastname: `Nom${n}`,
});

const quinzeJoueurs = Array.from({ length: 15 }, (_, index) => joueur(index + 1));
const entraineur = { documentId: 'coach-1', firstname: 'Coach', lastname: 'Senior' };

const entrainementSenior = (overrides = {}) => ({
  documentId: 'evt-senior',
  invitedTeams: [],
  missings: [],
  participations: [],
  team: {
    documentId: 'team-senior',
    name: 'Senior',
    players: quinzeJoueurs,
    trainers: [entraineur],
  },
  ...overrides,
});

const ids = (/** @type {any[]} */ users) => users.map((user) => user.documentId);

const sections = (/** @type {any} */ event, extra = {}) => buildTeamParticipationSections({
  canEdit: true,
  event,
  inactiveParticipations: [],
  pendingParticipations: [],
  t,
  trainerKeys: getEventTrainerKeys(event),
  ...extra,
});

test('PARTWEB/1 — 15 joueurs sans reponse : les 15 sont « sans reponse » dans LEUR equipe', () => {
  const resultat = sections(entrainementSenior());

  expect(resultat.teamParticipationSections).toHaveLength(1);
  const [senior] = resultat.teamParticipationSections;
  expect(senior.teamName).toBe('Senior');
  expect(senior.isHome).toBe(true);
  expect(ids(senior.notAnswered)).toEqual(ids(quinzeJoueurs));
  expect(senior.participating).toEqual([]);
  expect(senior.missing).toEqual([]);
  expect(resultat.externalParticipationSection).toBeNull();
  expect(resultat.participantsSummary).toEqual({ capacity: 0, participatingCount: 0 });
});

test('PARTWEB/2 — present, absent, demande en attente : chacun dans UN seul groupe', () => {
  const event = entrainementSenior({
    missings: [joueur(2)],
    participations: [joueur(1)],
  });
  const resultat = sections(event, {
    pendingParticipations: [
      { documentId: 'req-3', participationStatus: 'pending', user: joueur(3) },
    ],
  });
  const [senior] = resultat.teamParticipationSections;

  expect(ids(senior.participating)).toEqual(['joueur-1']);
  expect(ids(senior.missing)).toEqual(['joueur-2']);
  expect(senior.pending.map((/** @type {any} */ request) => request.documentId)).toEqual(['req-3']);
  expect(senior.notAnswered).toHaveLength(12);
  expect(ids(senior.notAnswered)).not.toContain('joueur-3');
  expect(resultat.participantsSummary.participatingCount).toBe(1);
});

test('PARTWEB/3 — COACH1 : l entraineur qui repond « Present » ne compte dans AUCUNE liste', () => {
  // Decision d Adel du 21/09 (« 2-A ») : sa reponse ne compte pas dans
  // l assiduite des joueurs. Le telephone l ecarte par `trainerKeysForEvent`.
  const event = entrainementSenior({ participations: [entraineur] });
  const resultat = sections(event);
  const [senior] = resultat.teamParticipationSections;

  expect(ids(senior.participating)).toEqual([]);
  expect(senior.notAnswered).toHaveLength(15);
  expect(resultat.externalParticipationSection).toBeNull();
  expect(resultat.participantsSummary.participatingCount).toBe(0);
});

test('PARTWEB/4 — l entraineur-joueur (inscrit aux DEUX listes) est range en JOUEUR', () => {
  // 🔁 REVU PAR ROLES3 (decision d Adel du 28/09, « 2- oui ») : il etait range
  // en entraineur. C est ce rangement qui faisait « Presents · 0 » a la recette.
  const team = { documentId: 't', players: [entraineur, joueur(1)], trainers: [entraineur] };

  expect(ids(getEligibleTeamPlayers(team))).toEqual(['coach-1', 'joueur-1']);
});

test('PARTWEB/5 — quelqu un hors equipe qui vient : section « Participants externes »', () => {
  const exterieur = { documentId: 'ext-1', firstname: 'Venu', lastname: 'Dehors' };
  const resultat = sections(entrainementSenior({ participations: [exterieur] }));

  expect(resultat.externalParticipationSection?.teamName).toBe('Participants externes');
  expect(ids(resultat.externalParticipationSection?.participating || [])).toEqual(['ext-1']);
  expect(resultat.participantsSummary.participatingCount).toBe(1);
});

test('PARTWEB/6 — equipe invitee : sa propre section, apres l equipe organisatrice', () => {
  const invitee = {
    documentId: 'team-u17',
    name: 'U17',
    players: [joueur(40)],
    trainers: [],
  };
  const resultat = sections(entrainementSenior({ invitedTeams: [invitee] }));

  const noms = resultat.teamParticipationSections.map((/** @type {any} */ s) => s.teamName);
  expect(noms).toEqual(['Senior', 'U17']);
  expect(resultat.teamParticipationSections[1].isHome).toBe(false);
  expect(ids(resultat.teamParticipationSections[1].notAnswered)).toEqual(['joueur-40']);
});

test('PARTWEB/7 — sans equipe : aucune section, rien d invente', () => {
  const resultat = sections({ documentId: 'evt-libre', participations: [joueur(1)] });

  expect(resultat.teamParticipationSections).toEqual([]);
  expect(ids(resultat.externalParticipationSection?.participating || [])).toEqual(['joueur-1']);
});

test('PARTWEB/8 — les 3 listes a plat : completes pour qui organise, presents seuls sinon', () => {
  const event = entrainementSenior({
    missings: [joueur(2)],
    participations: [joueur(1), entraineur],
  });
  const trainerKeys = getEventTrainerKeys(event);

  const organisateur = buildParticipationsByStatus({
    canEdit: true,
    event,
    pendingParticipations: [],
    trainerKeys,
  });
  expect(ids(organisateur.participating)).toEqual(['joueur-1']);
  expect(ids(organisateur.missing)).toEqual(['joueur-2']);
  expect(organisateur.notAnswered).toHaveLength(13);

  const lecteur = buildParticipationsByStatus({
    canEdit: false,
    event,
    pendingParticipations: [],
    trainerKeys,
  });
  expect(ids(lecteur.participating)).toEqual(['joueur-1']);
  expect(lecteur.missing).toEqual([]);
  expect(lecteur.notAnswered).toEqual([]);
});

// LOT ENCADRE (22/09) — DECISION D ADEL « PARTWEB-1 → B ».
//
// 📸 LE TROU : depuis COACH1, un entraineur repond Present / Absent. PARTWEB/3
// prouve que sa reponse ne pese dans AUCUNE liste de joueurs — c est voulu
// (« 2-A »). Mais elle ne se voyait NULLE PART : sur un entrainement, personne
// ne savait si le coach venait.
//
// 🎯 Chaque carte d equipe porte desormais `staff` : SES encadrants, ranges par
// reponse, a cote des listes des joueurs et jamais dedans. Les compteurs, la
// relance et « Joueurs attendus » lisent les listes des joueurs : ils ne voient
// donc pas l encadrement, sans qu on ait eu a leur apprendre a l ecarter.

const staffIds = (/** @type {any} */ section) => ({
  missing: ids(section.staff.missing),
  notAnswered: ids(section.staff.notAnswered),
  participating: ids(section.staff.participating),
});

test('ENCADRE/1 — coach « Present » : Encadrement de SA carte, chiffres joueurs intacts', () => {
  const event = entrainementSenior({ participations: [entraineur, joueur(1)] });
  const resultat = sections(event);
  const [senior] = resultat.teamParticipationSections;

  expect(staffIds(senior)).toEqual({ missing: [], notAnswered: [], participating: ['coach-1'] });
  // Les listes des joueurs sont celles d avant ce lot, a l identique.
  expect(ids(senior.participating)).toEqual(['joueur-1']);
  expect(senior.missing).toEqual([]);
  expect(senior.notAnswered).toHaveLength(14);
  expect(ids(senior.notAnswered)).not.toContain('coach-1');
  expect(resultat.participantsSummary.participatingCount).toBe(1);
  expect(resultat.externalParticipationSection).toBeNull();
});

test('ENCADRE/2 — Absent, Sans reponse : chaque encadrant a sa reponse, et UNE seule', () => {
  const adjoint = { documentId: 'coach-2', firstname: 'Adjoint', lastname: 'Senior' };
  const preparateur = { documentId: 'coach-3', firstname: 'Prepa', lastname: 'Senior' };
  const event = entrainementSenior({
    missings: [adjoint, joueur(2)],
    participations: [entraineur],
    team: {
      ...entrainementSenior().team,
      trainers: [entraineur, adjoint, preparateur],
    },
  });
  const [senior] = sections(event).teamParticipationSections;

  expect(staffIds(senior)).toEqual({
    missing: ['coach-2'],
    notAnswered: ['coach-3'],
    participating: ['coach-1'],
  });
  expect(ids(senior.missing)).toEqual(['joueur-2']);
  expect(senior.notAnswered).toHaveLength(14);
});

test('ENCADRE/3 — l entraineur-joueur : chez les joueurs, PAS dans l Encadrement', () => {
  // 🔁 REVU PAR ROLES3 (decision d Adel du 28/09, « 2- oui ») : ENCADRE le
  // montrait dans l Encadrement et hors des joueurs. Il est desormais un joueur
  // de son equipe, et n est plus repete dans l Encadrement de CETTE equipe.
  const event = entrainementSenior({
    participations: [entraineur],
    team: {
      ...entrainementSenior().team,
      players: [entraineur, ...quinzeJoueurs],
    },
  });
  const resultat = sections(event);
  const [senior] = resultat.teamParticipationSections;

  expect(staffIds(senior).participating).toEqual([]);
  expect(ids(senior.participating)).toEqual(['coach-1']);
  expect(ids(senior.notAnswered)).toEqual(ids(quinzeJoueurs));
  expect(resultat.participantsSummary.participatingCount).toBe(1);
});

test('ENCADRE/4 — l encadrant d une equipe invitee est dans la carte de SON equipe', () => {
  const coachU17 = { documentId: 'coach-u17', firstname: 'Coach', lastname: 'U17' };
  const invitee = {
    documentId: 'team-u17',
    name: 'U17',
    players: [joueur(40)],
    trainers: [coachU17],
  };
  const event = entrainementSenior({ invitedTeams: [invitee], participations: [coachU17] });
  const [senior, u17] = sections(event).teamParticipationSections;

  expect(staffIds(senior)).toEqual({ missing: [], notAnswered: ['coach-1'], participating: [] });
  expect(staffIds(u17)).toEqual({ missing: [], notAnswered: [], participating: ['coach-u17'] });
  expect(ids(u17.notAnswered)).toEqual(['joueur-40']);
});

test('ENCADRE/5 — compte supprime ecarte ; equipe sans encadrant = Encadrement vide', () => {
  const fantome = {
    blocked: true,
    documentId: 'coach-supprime',
    email: 'deleted_user_7@deleted.com',
    username: 'deleted_user_7_1700000000',
  };
  const event = entrainementSenior({
    invitedTeams: [{
      documentId: 'team-u17',
      name: 'U17',
      players: [joueur(40)],
      trainers: [],
    }],
    team: { ...entrainementSenior().team, trainers: [entraineur, fantome] },
  });
  const [senior, u17] = sections(event).teamParticipationSections;

  expect(staffIds(senior)).toEqual({ missing: [], notAnswered: ['coach-1'], participating: [] });
  expect(staffIds(u17)).toEqual({ missing: [], notAnswered: [], participating: [] });
});

test('PARTWEB/9 — sans evenement : des listes vides, jamais une exception', () => {
  expect(sections(null)).toEqual({
    externalParticipationSection: null,
    participantsSummary: { capacity: 0, participatingCount: 0 },
    teamParticipationSections: [],
  });
  expect(getEventTrainerKeys(null).size).toBe(0);
});

// LOT ROLES3 (28/09) — DECISION D ADEL « 2- oui » : L ENTRAINEUR QUI JOUE EST
// UN JOUEUR DE SON EQUIPE.
//
// 📸 LE CONSTAT (recette emulateur du 28/09, defaut 4) : un dirigeant qui
// entraine SILENCE-Test-U15 et y joue aussi (« Je joue en … ») repond Present.
// Participants du match : « Presents · 0 », et son nom seulement sous
// « Staff · Present ». Le serveur, lui, le compte deja comme joueur (U02,
// `event-composition.ts`, `isStaffOnlyForTeams` = encadrant d une equipe de
// l evenement ET joueur d AUCUNE).
//
// 🎯 La regle, desormais la meme des deux cotes : l encadrement d une equipe,
// ce sont ses encadrants QUI N Y JOUENT PAS. Qui est aux deux listes est un
// joueur — il compte dans les presents, il n est plus repete dans
// l Encadrement de CETTE equipe. Un entraineur qui ne joue pas : inchange
// (COACH1 « 2-A », ENCADRE « PARTWEB-1 → B »).

const dirigeantJoueur = {
  documentId: 'dirigeant-joueur',
  firstname: 'Adel',
  lastname: 'Dirigeant',
};

const matchDuDirigeantJoueur = (overrides = {}) => entrainementSenior({
  team: {
    documentId: 'team-senior',
    name: 'Senior',
    players: [dirigeantJoueur, ...quinzeJoueurs],
    trainers: [dirigeantJoueur],
  },
  ...overrides,
});

test('ROLES3/1 — dirigeant qui joue, Present : « Presents · 1 », joueur, hors Encadrement', () => {
  const resultat = sections(matchDuDirigeantJoueur({ participations: [dirigeantJoueur] }));
  const [senior] = resultat.teamParticipationSections;

  expect(ids(senior.participating)).toEqual(['dirigeant-joueur']);
  expect(resultat.participantsSummary.participatingCount).toBe(1);
  expect(staffIds(senior)).toEqual({ missing: [], notAnswered: [], participating: [] });
  expect(ids(senior.notAnswered)).toEqual(ids(quinzeJoueurs));
  expect(resultat.externalParticipationSection).toBeNull();
});

test('ROLES3/2 — Absent ou sans reponse : il reste dans les listes des JOUEURS', () => {
  const absent = sections(matchDuDirigeantJoueur({ missings: [dirigeantJoueur] }));
  const [seniorAbsent] = absent.teamParticipationSections;
  expect(ids(seniorAbsent.missing)).toEqual(['dirigeant-joueur']);
  expect(staffIds(seniorAbsent).missing).toEqual([]);

  const muet = sections(matchDuDirigeantJoueur());
  const [seniorMuet] = muet.teamParticipationSections;
  expect(ids(seniorMuet.notAnswered)).toEqual(['dirigeant-joueur', ...ids(quinzeJoueurs)]);
  expect(staffIds(seniorMuet).notAnswered).toEqual([]);
});

test('ROLES3/3 — le simple entraineur qui ne joue pas : INCHANGE, a cote de celui qui joue', () => {
  const event = matchDuDirigeantJoueur({
    participations: [entraineur, dirigeantJoueur, joueur(1)],
    team: {
      documentId: 'team-senior',
      name: 'Senior',
      players: [dirigeantJoueur, ...quinzeJoueurs],
      trainers: [entraineur, dirigeantJoueur],
    },
  });
  const resultat = sections(event);
  const [senior] = resultat.teamParticipationSections;

  expect(ids(senior.participating)).toEqual(['dirigeant-joueur', 'joueur-1']);
  expect(staffIds(senior)).toEqual({ missing: [], notAnswered: [], participating: ['coach-1'] });
  expect(resultat.participantsSummary.participatingCount).toBe(2);
  expect(getEventTrainerKeys(event).has('doc:coach-1')).toBe(true);
  expect(getEventTrainerKeys(event).has('doc:dirigeant-joueur')).toBe(false);
});

test('ROLES3/4 — l equipe ou il n est QU encadrant : il reste dans SON Encadrement', () => {
  // Il joue en Senior, il entraine seulement les U17 invites.
  const u17 = {
    documentId: 'team-u17',
    name: 'U17',
    players: [joueur(40)],
    trainers: [dirigeantJoueur],
  };
  const resultat = sections(matchDuDirigeantJoueur({
    invitedTeams: [u17],
    participations: [dirigeantJoueur],
    team: {
      documentId: 'team-senior',
      name: 'Senior',
      players: [dirigeantJoueur, ...quinzeJoueurs],
      trainers: [],
    },
  }));
  const [senior, equipeU17] = resultat.teamParticipationSections;

  expect(ids(senior.participating)).toEqual(['dirigeant-joueur']);
  expect(staffIds(equipeU17).participating).toEqual(['dirigeant-joueur']);
  expect(ids(equipeU17.participating)).toEqual([]);
  expect(resultat.participantsSummary.participatingCount).toBe(1);
});

test('ROLES3/5 — les 3 listes a plat et la compo : il y est, comme un joueur', () => {
  const event = matchDuDirigeantJoueur({ participations: [dirigeantJoueur] });
  const aPlat = buildParticipationsByStatus({
    canEdit: true,
    event,
    pendingParticipations: [],
    trainerKeys: getEventTrainerKeys(event),
  });

  expect(ids(aPlat.participating)).toEqual(['dirigeant-joueur']);
  expect(aPlat.notAnswered).toHaveLength(15);
  // `getEligibleTeamPlayers` est aussi la liste de la compo du telephone
  // (`getCompositionPlayersForEvent`, EventDetails.js).
  expect(ids(getEligibleTeamPlayers(event.team)))
    .toEqual(['dirigeant-joueur', ...ids(quinzeJoueurs)]);
});
