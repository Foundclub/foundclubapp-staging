/**
 * LE CARNET, RANGÉ POUR ÊTRE RELU — journée, puis test, puis essai.
 *
 * 🔎 POURQUOI CE FICHIER EXISTE À PART DE L'ÉCRAN. Le carnet brut ne contient que
 * des CODES : il écrit « T2 » là où on veut lire « Sprint 10 mètres », et
 * « images_chute » là où on veut lire « Images entre lâcher et impact ». Les noms
 * ne sont pas dans le carnet — ils sont dans le PROGRAMME, que l'app a déjà en
 * mémoire. Recoller les deux est un calcul pur : il se teste sans monter d'écran,
 * et c'est la seule partie de la vue lisible qui puisse se tromper en silence.
 *
 * 🪤 CE QUI A ÉTÉ TROUVÉ EN L'ÉCRIVANT, et qui était invisible : le serveur
 * renvoyait les résultats SANS leur test (`results: true` ne descend qu'un niveau
 * dans Strapi 5). Le code de la ligne était donc vide côté app — ce qui cassait
 * aussi, en silence, le compteur « n tests faits » de la fiche d'une journée.
 * Corrigé le 2026-09-08 côté serveur, avec son témoin.
 */

/**
 * Range les mesures saisies par journée, puis par test, puis dans l'ordre des essais.
 * @param {Record<string, any>[]} sessions Les séances, avec leurs résultats.
 * @param {Record<string, any>[]} journees Les journées du programme, qui portent les noms.
 * @returns {Record<string, any>[]} Les journées qui ont au moins une mesure, dans l'ordre
 *   du planning, chacune avec ses tests et leurs lignes.
 */
export const rangerLeCarnet = (sessions, journees) => {
  /** @type {Record<string, any>[]} */
  const seances = Array.isArray(sessions) ? sessions : [];
  /** @type {Record<string, any>[]} */
  const jours = Array.isArray(journees) ? journees : [];

  // Le programme est la SOURCE DES NOMS : on l'indexe une fois, par code de test,
  // plutôt que de le reparcourir pour chaque ligne du carnet.
  /** @type {Record<string, any>} */
  const testsParCode = {};
  jours.forEach((jour) => {
    (Array.isArray(jour.tests) ? jour.tests : []).forEach((test) => {
      if (test?.code) testsParCode[test.code] = test;
    });
  });

  return seances.map((seance) => {
    /** @type {Record<string, any>[]} */
    const lignes = Array.isArray(seance?.results) ? seance.results : [];
    /** @type {Record<string, any>[]} */
    const tests = [];
    /** @type {Record<string, number>} */
    const rangDuTest = {};

    lignes.forEach((ligne) => {
      const code = ligne?.test?.code;
      if (!code) return;
      const test = testsParCode[code] || {};
      const mesure = (Array.isArray(test.measures) ? test.measures : [])
        .find((m) => m?.key === ligne.measureKey) || {};

      if (rangDuTest[code] === undefined) {
        rangDuTest[code] = tests.length;
        tests.push({ code, lignes: [], name: test.name || code });
      }
      const rang = tests[rangDuTest[code]].lignes.length;
      tests[rangDuTest[code]].lignes.push({
        // ⚠️ `calculee` ne se lit PAS sur la ligne du carnet : aucune de ses onze
        // colonnes ne dit qu'une valeur a été calculée par l'app. L'information
        // vit sur la MESURE du programme, et c'est la seule façon de l'avoir.
        calculee: mesure.computed === true,
        // La clef de la ligne nait ICI plutot que dans l ecran : deux mesures
        // peuvent porter le meme libelle, le meme essai et le meme cote — un
        // essai ressaisi — et React les fusionnerait a l affichage.
        cle: `${code}-${ligne.measureKey}-${ligne.attempt}-${ligne.side}-${rang}`,
        cote: ligne.side && ligne.side !== 'none' ? ligne.side : null,
        essai: Number.isFinite(ligne.attempt) ? ligne.attempt : null,
        label: mesure.label || ligne.measureKey || '',
        // 🧑‍⚖️ QUI A JUGE. Un essai s annule sur le terrain (« un plot est touche »,
        // ca se voit tout de suite) ou a la lecture de la video le soir (« ballon
        // hors image entre les plots »). Sans ce mot, le carnet garde le verdict
        // mais pas son juge — et sur 22 des 33 tests du programme, les deux sortes
        // de criteres coexistent sur le MEME essai.
        jugePar: ligne.invalidatedBy === 'terrain' || ligne.invalidatedBy === 'video'
          ? ligne.invalidatedBy
          : null,
        motif: ligne.invalidReason || '',
        nulle: ligne.isValid === false,
        unit: ligne.unit || mesure.unit || '',
        valeur: ligne.value ?? ligne.textValue ?? '',
      });
    });

    // Les essais se relisent DANS L'ORDRE, jamais dans celui de la saisie : on
    // revient souvent corriger un essai raté, et la ligne repartait alors en bas.
    tests.forEach((test) => test.lignes.sort((a, b) => (a.essai || 0) - (b.essai || 0)));

    return {
      code: seance?.day?.code || '',
      date: seance?.plannedDate || '',
      tests,
      title: seance?.day?.title || '',
    };
  }).filter((jour) => jour.tests.length > 0);
};

export default rangerLeCarnet;
