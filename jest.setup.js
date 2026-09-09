/* eslint-env jest, es2020 */
/**
 * LE FILET DE FIN DE TEMOIN — et pourquoi il vit ICI, en un seul fichier.
 *
 * La chaine de controle de l'app a ete ROUGE du 2026-09-03 au 2026-09-09, plus
 * de vingt executions d'affilee, avec ce journal :
 *
 *   Test Suites: 529 passed, 529 total
 *   Tests:       6403 passed, 6403 total
 *   Jest did not exit one second after the test run has completed.
 *   Process completed with exit code 1.
 *
 * AUCUN temoin n'etait rouge. Jest ne pouvait pas s'eteindre : des minuteurs
 * survivaient aux temoins qui les avaient armes, et GitHub tuait le processus
 * quatre minutes plus tard. ⚠️ Sans `--runInBand`, chaque fichier tourne dans
 * un ouvrier que Jest abat en sortant : la fuite est invisible et la suite sort
 * EXIT=0. C'est pour ca que « ca passe chez moi » a dure six jours.
 *
 * Il y avait DEUX fuites distinctes, mesurees le 2026-09-09 :
 *
 *   1. 🧪 react-query arme un `setTimeout` de nettoyage (`gcTime`, cinq minutes
 *      par defaut, une heure dans `placesQueries.js`) par requete et par
 *      mutation. 49 temoins fabriquent un client sans le regler.
 *   2. ⏱️ 149 temoins sur 341 ouvrent un ecran avec `react-test-renderer` et ne
 *      le referment jamais. Un ecran vivant garde ses minuteurs : le compteur
 *      « T+33 » de `TrainingSessionNow` bat toutes les minutes tant qu'on ne
 *      le demonte pas — et aucune bibliotheque de test avec nettoyage
 *      automatique n'est installee dans ce depot.
 *
 * Cinq balayages automatiques de ces 198 fichiers ont echoue (cles en double,
 * lignes coupees, import au milieu d'un import). La discipline du depot dit :
 * on corrige la fonction PARTAGEE une fois, pas 198 appelants. Ce fichier est
 * cette fonction partagee. Il tourne avant chaque fichier de test
 * (`setupFilesAfterEnv` dans `jest.config.js`).
 *
 * ⛔ CE N'EST PAS `--forceExit`. Cette option rendrait la chaine verte en
 * MASQUANT une fuite qui existe aussi dans la vraie app. Elle est interdite.
 *
 * 🔑 CE QUE CE FICHIER NE CHANGE PAS : un temoin qui pose `gcTime: 0` le fait
 * expres (il mesure l'eviction du cache) — zero reste zero. Un temoin qui
 * demonte lui-meme son arbre ne voit rien : `unmount` est sans effet la
 * deuxieme fois (verifie dans react-test-renderer 19.1.0). Et les arbres ne
 * sont refermes qu'a la FIN DU FICHIER, jamais entre deux temoins : un ecran
 * ouvert dans `beforeAll` et lu par plusieurs `it` reste ouvert pour eux.
 */

/**
 * Les arbres ouverts par `react-test-renderer` dans le fichier en cours, chacun
 * sous la forme de la fonction qui le referme. Le nom commence par `mock` :
 * c'est la seule forme que Jest laisse entrer dans une fabrique de `jest.mock`.
 * @type {Set<() => void>}
 */
const mockArbresOuverts = new Set();

// Les VRAIS minuteurs, captures avant qu'un temoin n'installe les faux
// (`jest.useFakeTimers`, 29 fichiers) : un `setTimeout` factice attendu en
// `afterAll` ne se resoudrait jamais, et le crochet mourrait en timeout.
const setTimeoutReel = globalThis.setTimeout;
const setImmediateReel = globalThis.setImmediate;

/**
 * Laisse passer un tour d'horloge reelle, puis un tour d'ordonnanceur React.
 *
 * 🧨 POURQUOI : react-query livre ses notifications par `setTimeout(cb, 0)`
 * (`notifyManager`, ordonnanceur par defaut). Quand le DERNIER temoin d'un
 * fichier demonte un ecran, la notification part apres la fin du fichier —
 * et Jest, des qu'un fichier est fini, GELE sa console : tout journal tardif
 * imprime « Cannot log after tests are done » ET pose `process.exitCode = 1`
 * (`jest-runner/build/runTest.js:149`). Mesure le 2026-09-09 : 529 suites
 * vertes, UN journal tardif, EXIT=1. Un tour d'horloge suffit a livrer la
 * notification pendant que la console est encore vivante. Le `setImmediate`
 * qui suit couvre le rendu que React ordonnance derriere (`scheduler.native`).
 * @returns {Promise<void>} resolue quand les deux tours sont passes
 */
const laisserPasserUnTour = () => new Promise((resoudre) => {
  setTimeoutReel(() => { setImmediateReel(resoudre); }, 0);
});

jest.mock('react-test-renderer', () => {
  const reel = jest.requireActual('react-test-renderer');
  return {
    ...reel,
    /**
     * Ouvre un arbre exactement comme le vrai `create`, et retient comment le
     * refermer avec le `act` de la MEME copie de React (un `jest.resetModules`
     * en fabrique une nouvelle, et un `act` etranger ne flusherait rien).
     * @param {...any} args ce que le temoin passe a `create`, inchange
     * @returns {any} l'arbre rendu, inchange
     */
    create: (...args) => {
      const arbre = reel.create(...args);
      mockArbresOuverts.add(() => reel.act(() => { arbre.unmount(); }));
      return arbre;
    },
  };
});

jest.mock('@tanstack/query-core', () => {
  const reel = jest.requireActual('@tanstack/query-core');
  // `Query` et `Mutation` heritent toutes deux de `Removable`, la classe qui
  // transforme `gcTime` en `setTimeout`. Elle n'est pas exportee : on la
  // retrouve par le prototype de `Query` (verifie identique a celui de
  // `Mutation` en 5.85.9). `updateGcTime` est son seul point d'entree — le
  // regler ici couvre les 49 clients de test, le vrai client de l'app et le
  // `gcTime` d'une heure de `placesQueries.js`, sans toucher un seul temoin.
  const Removable = Object.getPrototypeOf(reel.Query.prototype);
  const reglerReellement = Removable.updateGcTime;
  /**
   * Applique le reglage reel, puis desarme tout minuteur positif : `Infinity`
   * n'est pas un delai valide pour react-query, aucun `setTimeout` n'est arme.
   * Zero reste zero — c'est une eviction immediate, voulue par le temoin.
   * @this {{ gcTime: number }}
   * @param {number | undefined} nouveau le `gcTime` demande par les options
   * @returns {void} rien
   */
  Removable.updateGcTime = function updateGcTime(nouveau) {
    reglerReellement.call(this, nouveau);
    if (this.gcTime > 0) this.gcTime = Infinity;
  };
  return reel;
});

afterAll(async () => {
  mockArbresOuverts.forEach((refermer) => {
    try {
      refermer();
    } catch (erreur) {
      // Un ecran qui explose en se refermant est un defaut de l'ecran, pas du
      // temoin qui vient de passer : on ne rougit pas un fichier vert pour ca,
      // mais on le dit, pour qu'un journal le montre.
      // eslint-disable-next-line no-console -- c'est le seul canal d'un setup
      console.warn('jest.setup : un arbre a refuse de se refermer', erreur);
    }
  });
  mockArbresOuverts.clear();
  await laisserPasserUnTour();
});
