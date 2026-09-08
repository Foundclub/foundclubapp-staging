/**
 * LES ÉTAPES D'UNE SÉANCE — la décomposition qui répond à « je fais quoi maintenant ? ».
 *
 * 🔎 POURQUOI CE CALCUL EXISTE. Une journée s'affichait comme une liste de tests, et
 * un test comme un formulaire. Entre les deux, il manquait la seule chose qu'on se
 * demande vraiment sur un terrain, entre deux essais, avec un partenaire qui attend :
 * QU'EST-CE QUE JE FAIS MAINTENANT ? Compter les tests faits ne répond pas — un test
 * de douze essais reste « pas fait » pendant quarante minutes.
 *
 * 🪤 UNE ÉTAPE EST CE QU'ON FAIT, PAS CE QU'ON REMPLIT. La mise en place d'un test
 * (installer le ruban, poser la caméra) est une étape entière : elle prend cinq
 * minutes et elle ne produit aucune mesure. Un compteur basé sur les seules mesures
 * la rendrait invisible, et la barre resterait à zéro pendant qu'on travaille.
 *
 * ⚠️ CE QUI N'EST PAS UNE ÉTAPE, ET POURQUOI. Le pack cite la récupération entre deux
 * essais comme une étape de la frise. Elle n'en est pas une ici, faute de donnée :
 * AUCUN test du programme ne déclare de durée de récupération. Seul le tableau du
 * déroulé en porte, et par BLOC, pas par test. Inventer un compte à rebours qu'aucun
 * protocole ne prescrit mettrait à l'écran un chiffre faux — pire que pas de chiffre.
 * La récupération se montre donc comme un ÉTAT de l'étape en cours, jamais comme une
 * ligne de la frise.
 */

/** Sans rien qui dise le contraire, un test se fait en un seul essai. */
const ESSAIS_PAR_DEFAUT = 1;

/**
 * Combien d'essais un test demande.
 *
 * 🪤 C'est le MAXIMUM des mesures, jamais leur somme ni la première : un test porte
 * souvent une mesure à trois essais et une autre à un seul (la hauteur de la box se
 * mesure une fois, le saut trois fois). Le nombre d'essais du test est celui de sa
 * mesure la plus répétée.
 * @param {Record<string, any>} test le test du programme
 * @returns {number} le nombre d'essais, au moins 1
 */
export const essaisDuTest = (test) => {
  const mesures = Array.isArray(test?.measures) ? test.measures : [];
  const compte = mesures
    .map((m) => Number(m?.attempts))
    .filter((n) => Number.isFinite(n) && n > 0);
  return compte.length ? Math.max(...compte) : ESSAIS_PAR_DEFAUT;
};

/**
 * Combien de mesures un essai donné attend, sur un test donné.
 * @param {Record<string, any>} test le test du programme
 * @param {number} essai le numéro de l'essai, à partir de 1
 * @returns {number} le nombre de mesures attendues pour cet essai
 */
const mesuresAttendues = (test, essai) => {
  const mesures = Array.isArray(test?.measures) ? test.measures : [];
  return mesures.filter((m) => {
    const n = Number(m?.attempts);
    return Number.isFinite(n) && n > 0 ? essai <= n : essai === 1;
  }).length;
};

/**
 * TOUTES LES ÉTAPES D'UNE JOURNÉE, dans l'ordre où on les fait.
 * @param {Record<string, any>} day la journée du programme, avec ses tests
 * @param {Record<string, any>[]} resultats les lignes déjà saisies pour cette séance
 * @returns {Record<string, any>[]} les étapes, chacune avec son état
 */
export const etapesDuJour = (day, resultats) => {
  /** @type {Record<string, any>[]} */
  const tests = Array.isArray(day?.tests) ? day.tests : [];
  /** @type {Record<string, any>[]} */
  const lignes = Array.isArray(resultats) ? resultats : [];

  // Combien de lignes saisies, par test et par essai. C'est ce qui dit ce qui est
  // fait — pas un drapeau qu'il faudrait poser et qu'on oublierait de poser.
  /** @type {Record<string, number>} */
  const saisies = {};
  lignes.forEach((row) => {
    const code = row?.test?.code;
    if (!code) return;
    const clef = `${code}|${row.attempt ?? 1}`;
    saisies[clef] = (saisies[clef] || 0) + 1;
  });

  /** @type {Record<string, any>[]} */
  const etapes = [];
  tests.forEach((test, testIndex) => {
    const mesures = Array.isArray(test.measures) ? test.measures : [];
    // 🔎 « Se calcule tout seul » : rien à mesurer sur le terrain, tout se calcule
    // après. Le dire dans la frise évite de chercher un chronomètre.
    const calculSeul = mesures.length > 0 && mesures.every((m) => m?.moment === 'differe');
    const nombreEssais = essaisDuTest(test);
    // Un test est « entamé » dès la première ligne : sa mise en place est alors
    // forcément faite, même si personne ne l'a déclarée.
    const entame = Array.from({ length: nombreEssais }, (_, i) => saisies[`${test.code}|${i + 1}`])
      .some((n) => n > 0);

    etapes.push({
      calculSeul,
      cle: `${test.code}-prep`,
      etat: entame ? 'done' : 'todo',
      // La mise en place ne produit aucune mesure : elle se déduit du fait que le
      // test a commencé, elle ne se coche pas à la main.
      testCode: test.code,
      testIndex,
      titre: test.name || test.code,
      type: 'prep',
    });

    for (let essai = 1; essai <= nombreEssais; essai += 1) {
      const attendues = mesuresAttendues(test, essai);
      const faites = saisies[`${test.code}|${essai}`] || 0;
      etapes.push({
        calculSeul,
        cle: `${test.code}-e${essai}`,
        essai,
        etat: attendues > 0 && faites >= attendues ? 'done' : 'todo',
        testCode: test.code,
        testIndex,
        titre: test.name || test.code,
        total: nombreEssais,
        type: 'attempt',
      });
    }
  });

  // 🪤 « EN COURS » EST LA PREMIÈRE ÉTAPE PAS FAITE, jamais la dernière faite. On
  // revient souvent corriger un essai raté au milieu d'une série : marquer « en
  // cours » d'après la dernière ligne saisie renverrait alors en arrière, et le
  // bouton « Continuer » proposerait de refaire un essai déjà valide.
  const premiere = etapes.findIndex((etape) => etape.etat === 'todo');
  if (premiere >= 0) etapes[premiere].etat = 'current';
  return etapes;
};

/**
 * L'étape en cours, celle que le bouton principal reprend.
 * @param {Record<string, any>[]} etapes les étapes de la journée
 * @returns {Record<string, any>|null} l'étape en cours, ou `null` si tout est fait
 */
export const etapeCourante = (etapes) => (Array.isArray(etapes) ? etapes : [])
  .find((etape) => etape.etat === 'current') || null;

/**
 * Où en est la séance, en une ligne de chiffres.
 * @param {Record<string, any>[]} etapes les étapes de la journée
 * @returns {{faites: number, ratio: number, testsFaits: number, total: number}} l'avancement
 */
export const avancement = (etapes) => {
  /** @type {Record<string, any>[]} */
  const toutes = Array.isArray(etapes) ? etapes : [];
  const faites = toutes.filter((e) => e.etat === 'done').length;
  // Un test est fait quand TOUTES ses étapes le sont — la mise en place comprise.
  const parTest = {};
  toutes.forEach((e) => {
    if (parTest[e.testCode] === undefined) parTest[e.testCode] = true;
    if (e.etat !== 'done') parTest[e.testCode] = false;
  });
  return {
    faites,
    ratio: toutes.length ? faites / toutes.length : 0,
    testsFaits: Object.values(parTest).filter(Boolean).length,
    total: toutes.length,
  };
};

export default etapesDuJour;
