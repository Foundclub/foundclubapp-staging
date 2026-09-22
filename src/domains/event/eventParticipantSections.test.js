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

test('PARTWEB/4 — l entraineur-joueur (inscrit aux DEUX listes) est range en entraineur', () => {
  const team = { documentId: 't', players: [entraineur, joueur(1)], trainers: [entraineur] };

  expect(ids(getEligibleTeamPlayers(team))).toEqual(['joueur-1']);
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

test('PARTWEB/9 — sans evenement : des listes vides, jamais une exception', () => {
  expect(sections(null)).toEqual({
    externalParticipationSection: null,
    participantsSummary: { capacity: 0, participatingCount: 0 },
    teamParticipationSections: [],
  });
  expect(getEventTrainerKeys(null).size).toBe(0);
});
