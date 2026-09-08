/**
 * CE QUI RESTE À RELEVER SUR LA VIDÉO — la file du soir.
 *
 * 🔎 POURQUOI CETTE FILE EXISTE. Cinquante-huit des six cent dix-neuf mesures du
 * programme ne se prennent PAS sur le terrain : le nombre d'images entre le lâcher et
 * l'impact, l'angle du genou à l'appui, la position du bassin. Elles se lisent image
 * par image, sur un logiciel, le soir. Sans liste, on les oublie — et un test dont il
 * manque la moitié des mesures ne vaut rien, alors que le terrain a été fait.
 *
 * 🪤 LA DONNÉE N'EST PAS UNE NOUVEAUTÉ. Le champ `moment` porte déjà l'information sur
 * les 619 mesures, et l'appel « mon entraînement » rend déjà tout ce qu'il faut : le
 * programme avec ses mesures, les séances avec leurs résultats. Il ne manquait aucun
 * appel serveur — seulement le calcul qui croise les deux, et il est ici.
 */

/** Le moment d'une mesure qui se prend sur le terrain. */
const TERRAIN = 'terrain';

/**
 * Les outils de bureau cités par les mesures, et le nom qu'on affiche.
 *
 * 🔎 L'outil se lit dans l'aide de la mesure — « à lire dans Kinovea », « My Jump Lab ».
 * C'est la seule source : aucun champ ne le déclare. La pastille dit donc ce que la
 * mesure elle-même dit, jamais une supposition.
 */
const OUTILS = [
  { motif: /kinovea/i, nom: 'Kinovea' },
  { motif: /my ?jump/i, nom: 'My Jump Lab' },
  { motif: /tracker/i, nom: 'Tracker' },
];

/**
 * Le logiciel à ouvrir pour une mesure, s'il est nommé.
 * @param {Record<string, any>} measure la mesure
 * @returns {string|null} le nom du logiciel, ou `null`
 */
export const outilDeLaMesure = (measure) => {
  const aide = String(measure?.helper || '');
  const trouve = OUTILS.find((outil) => outil.motif.test(aide));
  return trouve ? trouve.nom : null;
};

/**
 * LE NOM DU FICHIER VIDÉO d'un essai.
 *
 * ⚠️ C'EST UNE CONVENTION QUE L'APP PROPOSE, pas une donnée qu'elle lit : rien dans le
 * programme ne prescrit de nom de fichier. Mais sans nom affiché, on cherche « laquelle
 * des douze vidéos » dans une pellicule de trois cents éléments. Mieux vaut une
 * convention claire, écrite au même endroit qu'on la lit, que rien du tout.
 * @param {string} code le code du test
 * @param {number} essai le numéro de l'essai
 * @returns {string} le nom de fichier proposé
 */
export const nomDuFichier = (code, essai) => (
  `${code || 'test'}_essai${String(essai).padStart(2, '0')}.mp4`
);

/**
 * CE QUI RESTE À RELEVER, rangé par journée puis par test.
 *
 * 🪤 UN TEST N'APPARAÎT QUE SI SES ESSAIS EXISTENT. Un test dont on n'a fait aucun essai
 * n'a rien à relever : le faire figurer dans la file du soir ferait croire à un oubli,
 * et on chercherait une vidéo qui n'a jamais été filmée.
 * @param {Record<string, any>[]} sessions les séances avec leurs résultats
 * @param {Record<string, any>[]} journees les journées du programme
 * @returns {Record<string, any>[]} les journées qui ont quelque chose à relever
 */
export const fileDesRelevés = (sessions, journees) => {
  /** @type {Record<string, any>[]} */
  const seances = Array.isArray(sessions) ? sessions : [];
  /** @type {Record<string, any>[]} */
  const jours = Array.isArray(journees) ? journees : [];

  return seances.map((seance) => {
    const jour = jours.find((j) => j.documentId === seance?.day?.documentId) || seance?.day || {};
    /** @type {Record<string, any>[]} */
    const lignes = Array.isArray(seance?.results) ? seance.results : [];

    // Les essais réellement faits, par code de test : c'est eux qui décident ce
    // qui est à relever, jamais le programme seul.
    /** @type {Record<string, Set<number>>} */
    const essaisFaits = {};
    /** @type {Set<string>} */
    const dejaReleve = new Set();
    lignes.forEach((row) => {
      const code = row?.test?.code;
      if (!code) return;
      const essai = row.attempt ?? 1;
      if (!essaisFaits[code]) essaisFaits[code] = new Set();
      essaisFaits[code].add(essai);
      if (row.value != null || row.textValue) dejaReleve.add(`${code}|${row.measureKey}|${essai}`);
    });

    const tests = (Array.isArray(jour.tests) ? jour.tests : [])
      .map((test, testIndex) => {
        const faits = essaisFaits[test.code];
        if (!faits || !faits.size) return null;

        /** @type {Record<string, any>[]} */
        const aRelever = [];
        (Array.isArray(test.measures) ? test.measures : [])
          .filter((m) => m?.moment !== TERRAIN)
          .forEach((mesure) => {
            [...faits].sort((a, b) => a - b).forEach((essai) => {
              const attendus = Number(mesure.attempts) || 1;
              if (essai > attendus) return;
              aRelever.push({
                cle: `${test.code}|${mesure.key}|${essai}`,
                essai,
                fait: dejaReleve.has(`${test.code}|${mesure.key}|${essai}`),
                mesure,
              });
            });
          });

        if (!aRelever.length) return null;
        const faites = aRelever.filter((l) => l.fait).length;
        return {
          code: test.code,
          essais: faits.size,
          faites,
          name: test.name,
          outil: aRelever.map((l) => outilDeLaMesure(l.mesure)).find(Boolean) || null,
          ratio: aRelever.length ? faites / aRelever.length : 0,
          restantes: aRelever.length - faites,
          testIndex,
          total: aRelever.length,
        };
      })
      .filter(Boolean);

    return {
      code: jour.code || '',
      commencee: lignes.length > 0,
      date: seance?.plannedDate || '',
      dayId: jour.documentId,
      restantes: tests.reduce((n, t) => n + t.restantes, 0),
      sessionId: seance?.documentId,
      tests,
      title: jour.title || '',
    };
  }).filter((jour) => jour.tests.length > 0 || !jour.commencee);
};

/**
 * Le total de ce qui reste à relever, tous jours confondus.
 * @param {Record<string, any>[]} file la file des relevés
 * @returns {number} le nombre de mesures qui attendent
 */
export const totalARelever = (file) => (Array.isArray(file) ? file : [])
  .reduce((n, jour) => n + (jour.restantes || 0), 0);

export default fileDesRelevés;
