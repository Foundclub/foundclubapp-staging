const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (/** @type {any} */ ...args) => mockGet(...args),
    post: (/** @type {any} */ ...args) => mockPost(...args),
  },
}));

const {
  getEventMatchStats,
  getLeagueMatchStats,
  saveEventMatchStatsDraft,
  saveLeagueMatchStatsDraft,
  submitEventMatchStats,
  submitLeagueMatchStats,
} = require('./matchStatsService');

// AC07 (E6) — TEMOIN 1 : « LE RETOUR DU COACH PART ET REVIENT ».
//
// 🧨 LE DEFAUT, MESURE LE 2026-08-20 : les quatre envois de statistiques
// recopiaient leurs clefs UNE PAR UNE (`playerLines`, `scoreFor`,
// `scoreAgainst`, `teamId`) et n avaient jamais recopie `coachPlayerReviews`,
// `collectiveComment` ni `collectiveRating`.
// ⇒ L ecran acceptait la saisie, disait « enregistre », et la jetait au
// passage du service. Le serveur, lui, les attendait deja : `upsertReport`
// (`admin/src/api/match-stats-report/services/match-stats-report.ts`) les lit
// depuis la charge dans ses quatre appelants.
//
// 🎯 CE QUE CE FICHIER VERROUILLE : pas « les trois champs sont dans la
// charge » — ca, un simple `expect` sur `mockPost` le dirait, et ca ne prouve
// rien sur le retour. Ici on monte un SERVEUR DE PAPIER qui enregistre ce
// qu il recoit et le rend a la relecture. Le temoin echoue donc aussi bien si
// le champ ne part pas que s il ne revient pas.

/**
 * Un serveur de papier : il garde ce qu on lui envoie et le rend tel quel.
 *
 * Il imite les deux regles du vrai `upsertReport` qui comptent pour ce temoin :
 * un champ ABSENT de la charge conserve la valeur enregistree, un champ a
 * `null` l efface.
 * @returns {{ lire: () => any }} - De quoi relire ce que le serveur a garde.
 */
const monterLeServeurDePapier = () => {
  /** @type {Record<string, any>} */
  let rapport = {};

  mockPost.mockImplementation((/** @type {string} */ _url, /** @type {any} */ body) => {
    const charge = body?.data || {};
    ['coachPlayerReviews', 'collectiveComment', 'collectiveRating'].forEach((champ) => {
      if (charge[champ] === undefined) return;
      rapport[champ] = charge[champ];
    });
    return Promise.resolve({ data: { data: { report: rapport } } });
  });

  mockGet.mockImplementation(() => Promise.resolve({ data: { data: { report: rapport } } }));

  return {
    lire: () => rapport,
    remettreAZero: () => { rapport = {}; },
  };
};

const RETOUR_DU_COACH = {
  coachPlayerReviews: [
    { comment: 'Enorme match', rating: 9, userDocumentId: 'joueur-1' },
    { comment: 'Doit defendre plus bas', rating: 6, userDocumentId: 'joueur-2' },
  ],
  collectiveComment: 'Bloc equipe tres solide en seconde periode.',
  collectiveRating: 8,
};

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('AC07/1 — le retour du coach part ET revient', () => {
  const CAS = [
    ['brouillon d un evenement', saveEventMatchStatsDraft, getEventMatchStats, 'evt-1'],
    ['publication d un evenement', submitEventMatchStats, getEventMatchStats, 'evt-1'],
    ['brouillon d un match de league', saveLeagueMatchStatsDraft, getLeagueMatchStats, 'match-1'],
    ['publication d un match de league', submitLeagueMatchStats, getLeagueMatchStats, 'match-1'],
  ];

  test.each(CAS)('%s : les trois champs traversent et se relisent', async (
    _libelle,
    envoyer,
    relire,
    identifiant,
  ) => {
    const serveur = monterLeServeurDePapier();

    await envoyer(identifiant, {
      ...RETOUR_DU_COACH,
      playerLines: [{ key: 'joueur-1' }],
      teamId: 'equipe-1',
    });

    // 1. Ce qui est PARTI.
    const chargeEnvoyee = mockPost.mock.calls[0][1].data;
    expect(chargeEnvoyee.coachPlayerReviews).toEqual(RETOUR_DU_COACH.coachPlayerReviews);
    expect(chargeEnvoyee.collectiveComment).toBe(RETOUR_DU_COACH.collectiveComment);
    expect(chargeEnvoyee.collectiveRating).toBe(RETOUR_DU_COACH.collectiveRating);

    // 2. Ce qui REVIENT — la moitie que « c est dans la charge » ne prouve pas.
    const relu = await relire(identifiant, 'equipe-1');
    expect(relu.report.coachPlayerReviews).toEqual(RETOUR_DU_COACH.coachPlayerReviews);
    expect(relu.report.collectiveComment).toBe(RETOUR_DU_COACH.collectiveComment);
    expect(relu.report.collectiveRating).toBe(RETOUR_DU_COACH.collectiveRating);

    expect(serveur.lire().collectiveRating).toBe(RETOUR_DU_COACH.collectiveRating);
  });

  test('un coach qui EFFACE son commentaire ne le voit pas revenir', async () => {
    // 🧨 Le mensonge d apres : une fois les trois champs propages, `null` doit
    // vraiment effacer. `payload ?? existing` le confondait avec « absent » et
    // rendait l ancien texte au rechargement.
    const serveur = monterLeServeurDePapier();

    await saveEventMatchStatsDraft('evt-1', { ...RETOUR_DU_COACH, playerLines: [] });
    expect(serveur.lire().collectiveComment).toBe(RETOUR_DU_COACH.collectiveComment);

    await saveEventMatchStatsDraft('evt-1', {
      coachPlayerReviews: [],
      collectiveComment: null,
      collectiveRating: null,
      playerLines: [],
    });

    const relu = await getEventMatchStats('evt-1');
    expect(relu.report.collectiveComment).toBeNull();
    expect(relu.report.collectiveRating).toBeNull();
    expect(relu.report.coachPlayerReviews).toEqual([]);
  });

  test('PROTEGE : une charge muette sur le retour du coach ne porte aucune des trois clefs', async () => {
    // Sans ce garde-fou, on aurait pu « reparer » en etalant le payload entier
    // ou en forcant `null` par defaut — ce qui EFFACERAIT le retour du coach a
    // chaque enregistrement de score fait depuis un autre ecran.
    monterLeServeurDePapier();

    await saveEventMatchStatsDraft('evt-1', { playerLines: [], scoreAgainst: 1, scoreFor: 2 });

    const chargeEnvoyee = mockPost.mock.calls[0][1].data;
    expect(Object.prototype.hasOwnProperty.call(chargeEnvoyee, 'coachPlayerReviews')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(chargeEnvoyee, 'collectiveComment')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(chargeEnvoyee, 'collectiveRating')).toBe(false);
  });

  test('PROTEGE : les quatre clefs deja transmises le sont toujours', async () => {
    monterLeServeurDePapier();

    await saveEventMatchStatsDraft('evt-1', {
      ...RETOUR_DU_COACH,
      playerLines: [{ key: 'joueur-1' }],
      scoreAgainst: 1,
      scoreFor: 3,
      teamId: 'equipe-1',
    });

    const chargeEnvoyee = mockPost.mock.calls[0][1].data;
    expect(chargeEnvoyee.playerLines).toEqual([{ key: 'joueur-1' }]);
    expect(chargeEnvoyee.scoreFor).toBe(3);
    expect(chargeEnvoyee.scoreAgainst).toBe(1);
    expect(chargeEnvoyee.teamId).toBe('equipe-1');
  });
});
