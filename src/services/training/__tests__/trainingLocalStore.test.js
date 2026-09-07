/**
 * LE CARNET LOCAL — la seule promesse hors réseau que ce lot tient.
 *
 * 🔎 CE QUE CES TÉMOINS PROTÈGENT : sur un terrain, une saisie perdue ne se
 * retrouve pas. On ne redemande pas à quelqu'un de refaire trois sprints
 * maximaux parce qu'une requête a échoué. Ces témoins décrivent donc, en langage
 * exécutable, les quatre choses qui doivent rester vraies quoi qu'il arrive :
 *   1. une mesure saisie est lisible tout de suite, même sans réseau ;
 *   2. re-saisir le même essai remplace, il ne duplique pas ;
 *   3. ce qui n'est pas encore parti reste marqué « en attente » ;
 *   4. quand le serveur et le local disent deux choses, le local NON ENVOYÉ gagne.
 */

const store = {};

jest.mock('@/platform/storage', () => ({
  clearScoped: jest.fn(),
  getItem: jest.fn((key) => store[key]),
  removeItem: jest.fn((key) => { delete store[key]; }),
  setItem: jest.fn((key, value) => { store[key] = value; }),
}));

const {
  buildMeasureId,
  clearLocalSession,
  getLocalResults,
  getPendingSessions,
  getUnsyncedResults,
  markResultsSynced,
  mergeResults,
  putLocalResult,
  removeLocalResult,
} = require('@/services/training/trainingLocalStore');

const { setItem } = require('@/platform/storage');

const SESSION = 'session-abc';
const TEST_ID = 'test-b1';

const ligne = (surcharge = {}) => ({
  attempt: 1,
  measureKey: 'hauteur',
  side: 'none',
  testDocumentId: TEST_ID,
  unit: 'cm',
  value: 31.4,
  ...surcharge,
});

beforeEach(() => {
  Object.keys(store).forEach((key) => { delete store[key]; });
});

describe('le carnet local', () => {
  it('rend une mesure lisible tout de suite, sans aucun réseau', () => {
    putLocalResult(SESSION, ligne());

    const carnet = getLocalResults(SESSION);
    const entree = carnet[buildMeasureId(ligne())];

    expect(entree).toBeDefined();
    expect(entree.value).toBe(31.4);
    expect(entree.synced).toBe(false);
  });

  it('remplace au lieu de dupliquer quand on corrige le même essai', () => {
    putLocalResult(SESSION, ligne({ value: 31.4 }));
    putLocalResult(SESSION, ligne({ value: 32.9 }));

    const carnet = getLocalResults(SESSION);
    expect(Object.keys(carnet)).toHaveLength(1);
    expect(carnet[buildMeasureId(ligne())].value).toBe(32.9);
  });

  it('distingue deux essais, et les deux côtés, comme le protocole le demande', () => {
    putLocalResult(SESSION, ligne({ attempt: 1 }));
    putLocalResult(SESSION, ligne({ attempt: 2 }));
    putLocalResult(SESSION, ligne({ attempt: 1, side: 'left' }));
    putLocalResult(SESSION, ligne({ attempt: 1, side: 'right' }));

    expect(Object.keys(getLocalResults(SESSION))).toHaveLength(4);
  });

  it('garde la séance dans la file tant que quelque chose n est pas parti', () => {
    putLocalResult(SESSION, ligne());

    expect(getPendingSessions()).toContain(SESSION);
    expect(getUnsyncedResults(SESSION)).toHaveLength(1);
  });

  it('sort la séance de la file une fois TOUT envoyé, pas avant', () => {
    putLocalResult(SESSION, ligne({ attempt: 1 }));
    putLocalResult(SESSION, ligne({ attempt: 2 }));

    markResultsSynced(SESSION, [ligne({ attempt: 1 })]);
    expect(getPendingSessions()).toContain(SESSION);
    expect(getUnsyncedResults(SESSION)).toHaveLength(1);

    markResultsSynced(SESSION, [ligne({ attempt: 2 })]);
    expect(getPendingSessions()).not.toContain(SESSION);
    expect(getUnsyncedResults(SESSION)).toHaveLength(0);
  });

  it('efface une saisie quand la personne la retire', () => {
    putLocalResult(SESSION, ligne());
    removeLocalResult(SESSION, ligne());

    expect(getLocalResults(SESSION)).toEqual({});
  });

  it('ne casse pas quand le carnet stocké est illisible : il repart à vide', () => {
    store['training.results.session-abc'] = '{ ceci n est pas du JSON';

    expect(getLocalResults(SESSION)).toEqual({});
    expect(() => putLocalResult(SESSION, ligne())).not.toThrow();
  });

  it('ignore une ligne sans test ni mesure : elle ne veut rien dire', () => {
    putLocalResult(SESSION, { attempt: 1, value: 12 });

    expect(getLocalResults(SESSION)).toEqual({});
  });
});

describe('la fusion serveur / local', () => {
  it('fait gagner le local NON ENVOYÉ : c est la saisie la plus récente', () => {
    putLocalResult(SESSION, ligne({ value: 32.9 }));

    const fusion = mergeResults(
      [{
        attempt: 1,
        measureKey: 'hauteur',
        side: 'none',
        test: { documentId: TEST_ID },
        value: 31.4,
      }],
      SESSION,
    );

    expect(fusion[buildMeasureId(ligne())].value).toBe(32.9);
  });

  it('fait gagner le serveur quand le local a déjà été envoyé', () => {
    putLocalResult(SESSION, ligne({ value: 32.9 }));
    markResultsSynced(SESSION, [ligne()]);

    const fusion = mergeResults(
      [{
        attempt: 1,
        measureKey: 'hauteur',
        side: 'none',
        test: { documentId: TEST_ID },
        value: 31.4,
      }],
      SESSION,
    );

    expect(fusion[buildMeasureId(ligne())].value).toBe(31.4);
  });

  it('garde les mesures que le serveur ne connaît pas encore', () => {
    putLocalResult(SESSION, ligne({ attempt: 3, value: 33.1 }));

    const fusion = mergeResults([], SESSION);

    expect(Object.keys(fusion)).toHaveLength(1);
    expect(fusion[buildMeasureId(ligne({ attempt: 3 }))].value).toBe(33.1);
  });

  it('accepte une réponse serveur absente sans rien perdre', () => {
    putLocalResult(SESSION, ligne());

    expect(Object.keys(mergeResults(undefined, SESSION))).toHaveLength(1);
  });
});

describe('la remise à zéro', () => {
  it('efface le carnet ET la file d attente de la séance', () => {
    putLocalResult(SESSION, ligne());
    clearLocalSession(SESSION);

    expect(getLocalResults(SESSION)).toEqual({});
    expect(getPendingSessions()).not.toContain(SESSION);
  });
});

/**
 * 🚨 LA SEULE PROMESSE DONT L'ÉCHEC EST IRRATTRAPABLE, mesurée le 2026-09-07.
 *
 * `writeJson` rendait déjà `true` ou `false` selon qu'elle avait réussi. Les
 * QUATRE endroits qui l'appelaient ignoraient tous cette réponse : l'écran
 * affichait « enregistré » en vert même quand rien n'avait été écrit sur le
 * téléphone. Une séance entière pouvait disparaître pendant que les chiffres
 * s'affichaient normalement.
 *
 * On ne redemande pas à quelqu'un de refaire trois sprints maximaux. Une
 * sauvegarde qui rate doit donc SE DIRE, tout de suite.
 */
describe('une sauvegarde locale qui rate ne fait jamais semblant', () => {
  afterEach(() => {
    setItem.mockImplementation((/** @type {string} */ key, /** @type {string} */ value) => {
      store[key] = value;
    });
  });

  it('LÈVE une erreur quand le téléphone refuse d écrire', () => {
    setItem.mockImplementation(() => { throw new Error('storage full'); });

    expect(() => putLocalResult('seance-1', {
      attempt: 1, measureKey: 'temps_30m', testDocumentId: 'test-1',
    })).toThrow(/carnet local/i);
  });

  it('ne dit rien quand tout va bien', () => {
    expect(() => putLocalResult('seance-1', {
      attempt: 1, measureKey: 'temps_30m', testDocumentId: 'test-1',
    })).not.toThrow();
  });
});
