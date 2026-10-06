import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// ==========================================================================
// 📐 ST-MATCH10 (écran 10 du design des statistiques validé le 02/10) — CE QUE
// LA FEUILLE DE MATCH DIT, SANS L'AFFICHER.
//
// Sorti de `MatchStatsEditor.js` pour être TESTÉ seul, comme
// `views/event/matchEncartLines.js` : ces fonctions ne lisent rien, n'appellent
// rien. Elles reçoivent `t` de l'écran (les pluriels et les {{…}} passent par lui).
// ==========================================================================

/** Les dix notes d'une grille « sur 10 ». */
export const NOTES_SUR_DIX = Array.from({ length: 10 }, (_, index) => index + 1);

/** Le seuil de « moyenne B » (Adel, 02/10), le même que `MatchBilanCard`. */
export const MOYENNE_MIN_REPONSES = 3;

const chiffre = (/** @type {any} */ valeur) => Number.parseInt(String(valeur ?? '0'), 10) || 0;

const chiffreOuRien = (/** @type {any} */ valeur) => {
  if (valeur === null || valeur === undefined || String(valeur).trim() === '') return null;
  const lu = Number.parseInt(String(valeur), 10);
  return Number.isFinite(lu) ? Math.max(0, lu) : null;
};

/**
 * Les trois colonnes de la ligne par joueur (planche, état 2) : le temps de jeu, le
 * chiffre qui marque (buts ou points), les passes.
 * @param {string} sport - « football » ou « basketball ».
 * @returns {string[]} Les clés des chiffres, dans l'ordre des colonnes.
 */
export const colonnesDeLaLigne = (sport) => (sport === 'basketball'
  ? ['minutesPlayed', 'points', 'assists']
  : ['minutesPlayed', 'goals', 'assists']);

/**
 * Une ligne de feuille sans aucun chiffre : celle qu'un brouillon enregistré AVANT
 * la réponse du joueur a laissée (défaut 19).
 * @param {any} ligne - Une ligne de la feuille, telle que le serveur la rend.
 * @returns {boolean} Vrai si rien n'y est saisi.
 */
export const estUneLigneVide = (ligne) => chiffre(ligne?.minutesPlayed) === 0
  && Object.values(ligne?.sportPayload || {}).every((valeur) => !valeur);

/**
 * FINITIONS16 · POINT 16 — LES CHIFFRES QUI COMPTENT pour un joueur de la feuille, une seule
 * règle pour l'éditeur de la feuille et l'encart du score (ST-MATCH10, défaut 19) : sans ligne, ou
 * avec une ligne VIDE et une réponse ENVOYÉE, les chiffres que le joueur a envoyés ; sinon la
 * ligne (l'entraîneur a pu corriger la réponse). La T15 lisait « 2 buts sans buteur » à l'encart
 * et « 1 but sur 2 a un buteur » sur la feuille du même match.
 * @param {{ aEnvoye?: boolean, chiffresEnvoyes?: any, ligne?: any }} entree - La ligne de la
 *   feuille, les chiffres envoyés par le joueur (`suggestedStats`), et s'il a envoyé sa réponse.
 * @returns {any} La source des chiffres : les chiffres envoyés, ou la ligne (null si aucune).
 */
export const chiffresQuiComptent = ({ aEnvoye = false, chiffresEnvoyes = null, ligne = null }) => (
  chiffresEnvoyes && (!ligne || (aEnvoye && estUneLigneVide(ligne))) ? chiffresEnvoyes : ligne
);

/**
 * FINITIONS16 · POINT 16 — les lignes d'une feuille PUBLIÉE telles que la feuille les montre :
 * chaque joueur de la feuille prend `chiffresQuiComptent`. Sans les chiffres envoyés (un lecteur
 * à qui le serveur ne les donne pas), les lignes publiées telles quelles.
 * @param {{ joueurs?: any[] | null, lignes?: any[] | null, reponses?: any[] | null }} feuille -
 *   `availablePlayers`, `report.playerLines` et `playerResponses` de la charge du match.
 * @returns {any[]} Les lignes, au format de la feuille publiée (`user`, `sportPayload`…).
 */
export const lignesDeLaFeuilleQuiComptent = ({ joueurs = [], lignes = [], reponses = [] }) => {
  const publiees = Array.isArray(lignes) ? lignes : [];
  const avecJoueur = (Array.isArray(joueurs) ? joueurs : []).filter((joueur) => joueur?.documentId);
  if (!avecJoueur.some((joueur) => joueur?.suggestedStats)) return publiees;

  const cleDeLigne = (/** @type {any} */ ligne) => ligne?.userDocumentId || ligne?.user?.documentId;
  const parJoueur = new Map(publiees.map((ligne) => [cleDeLigne(ligne), ligne]));
  const envoyees = new Set((Array.isArray(reponses) ? reponses : [])
    .filter((reponse) => reponse?.status === 'submitted')
    .map((reponse) => reponse?.userDocumentId)
    .filter(Boolean));

  const desJoueurs = avecJoueur.map((joueur) => {
    const ligne = parJoueur.get(joueur.documentId) || null;
    const source = chiffresQuiComptent({
      aEnvoye: envoyees.has(joueur.documentId),
      chiffresEnvoyes: joueur?.suggestedStats || null,
      ligne,
    });
    if (!source || source === ligne) return ligne;
    return {
      ...(ligne || {}),
      minutesPlayed: source?.minutesPlayed,
      sportPayload: source?.sportPayload || {},
      user: ligne?.user || {
        documentId: joueur.documentId, firstname: joueur.firstname, lastname: joueur.lastname,
      },
      userDocumentId: joueur.documentId,
    };
  }).filter(Boolean);
  const dejaLa = new Set(avecJoueur.map((joueur) => joueur.documentId));

  return [...desJoueurs, ...publiees.filter((ligne) => !dejaLa.has(cleDeLigne(ligne)))];
};

/**
 * Les chiffres de la ligne sont-ils ceux de la réponse du joueur ?
 * @param {any} ligne - Une ligne en cours de saisie (valeurs en texte).
 * @param {string[]} cles - Les chiffres du sport.
 * @returns {boolean} Vrai si la ligne reprend sa réponse, mot pour mot.
 */
export const repriseDeSaReponse = (ligne, cles) => {
  const reponse = ligne?.responseFigures;
  if (!reponse) return false;
  return chiffre(ligne?.minutesPlayed) === chiffre(reponse?.minutesPlayed)
    && cles.every((cle) => chiffre(ligne?.[cle]) === chiffre(reponse?.sportPayload?.[cle]));
};

/**
 * « Hugo », « Hugo et Léo », « Hugo, Léo et Enzo », « Hugo, Léo et 3 autres ».
 * @param {string[]} noms - Les noms, dans l'ordre.
 * @param {Function} t - La traduction.
 * @returns {string} Les noms, joints.
 */
export const joindreLesNoms = (noms, t) => {
  const liste = (Array.isArray(noms) ? noms : []).filter(Boolean);
  if (liste.length <= 1) return liste[0] || '';
  if (liste.length <= 3) {
    return t('stMatch.feuille.namesAnd', '{{first}} et {{last}}', {
      first: liste.slice(0, -1).join(', '),
      last: liste[liste.length - 1],
      ...SANS_ECHAPPEMENT,
    });
  }
  return t('stMatch.feuille.namesAndOthers', {
    count: liste.length - 2,
    defaultValue_one: '{{names}} et {{count}} autre',
    defaultValue_other: '{{names}} et {{count}} autres',
    names: liste.slice(0, 2).join(', '),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * @typedef {{ cle: string, lignes: string[], texte: string }} Correction
 */

/**
 * L'ALERTE UNIQUE (planche, état 6 ; amélioration 5) : chaque incohérence entre le
 * score et les lignes, dite une fois, avec les joueurs à vérifier NOMMÉS. Les mêmes
 * règles que le serveur (`assertMatchStatsConsistency`), qui refuse la feuille sinon.
 * @param {{ lignes: any[], scoreAdverse: any, scorePour: any, sport: string, t: Function }} entree
 *   Les lignes en cours de saisie, le score saisi, le sport et la traduction.
 * @returns {Correction[]} Les corrections, dans l'ordre de la feuille.
 */
export const corrigerLaFeuille = ({
  lignes, scoreAdverse, scorePour, sport, t,
}) => {
  const liste = Array.isArray(lignes) ? lignes : [];
  if (!liste.length) return [];
  const pour = chiffreOuRien(scorePour);
  const contre = chiffreOuRien(scoreAdverse);
  /** @type {Correction[]} */
  const corrections = [];
  const somme = (/** @type {string} */ cle) => liste
    .reduce((total, ligne) => total + chiffre(ligne?.[cle]), 0);
  /**
   * Une correction : la règle, les lignes visées, et la phrase qui les nomme.
   * @param {string} cle - La règle.
   * @param {any[]} visees - Les lignes à vérifier.
   * @param {(noms: string) => string} dire - La phrase, avec les noms.
   */
  const ajouter = (cle, visees, dire) => {
    corrections.push({
      cle,
      lignes: visees.map((ligne) => ligne.key),
      texte: dire(joindreLesNoms(visees.map((ligne) => ligne.label), t)),
    });
  };

  if (sport === 'basketball') {
    const points = somme('points');
    if (pour !== null && points > pour) {
      const marqueurs = liste.filter((ligne) => chiffre(ligne?.points) > 0);
      ajouter('points', marqueurs, (noms) => t('stMatch.feuille.issue.points', {
        count: points,
        defaultValue_one: '{{count}} point saisi pour un score de {{score}}. Vérifie {{names}}.',
        // eslint-disable-next-line max-len
        defaultValue_other: '{{count}} points saisis pour un score de {{score}}. Vérifie {{names}}.',
        names: noms,
        score: pour,
        ...SANS_ECHAPPEMENT,
      }));
    }
    // Le total des paniers à 3 points ne peut dépasser les points que si UNE ligne le
    // fait : la vérification ligne par ligne suffit, et elle nomme le joueur.
    const troisPoints = liste
      .filter((ligne) => chiffre(ligne?.threePointsMade) * 3 > chiffre(ligne?.points));
    if (troisPoints.length) {
      ajouter('threes', troisPoints, (noms) => t(
        'stMatch.feuille.issue.threes',
        'Plus de points à 3 pts que de points marqués. Vérifie {{names}}.',
        { names: noms, ...SANS_ECHAPPEMENT },
      ));
    }
    return corrections;
  }

  const buts = somme('goals');
  if (pour !== null && buts > pour) {
    const buteurs = liste.filter((ligne) => chiffre(ligne?.goals) > 0);
    ajouter('goals', buteurs, (noms) => t('stMatch.feuille.issue.goals', {
      count: buts,
      defaultValue_one: '{{count}} but saisi pour un score de {{score}}. Vérifie {{names}}.',
      defaultValue_other: '{{count}} buts saisis pour un score de {{score}}. Vérifie {{names}}.',
      names: noms,
      score: pour,
      ...SANS_ECHAPPEMENT,
    }));
  }
  const passes = somme('assists');
  if (passes > buts) {
    ajouter('assists', liste.filter((ligne) => chiffre(ligne?.assists) > 0), (noms) => t(
      'stMatch.feuille.issue.assists',
      'Plus de passes décisives ({{assists}}) que de buts ({{goals}}). Vérifie {{names}}.',
      {
        assists: passes, goals: buts, names: noms, ...SANS_ECHAPPEMENT,
      },
    ));
  }
  if (contre !== null) {
    const encaisses = liste.filter((ligne) => chiffre(ligne?.goalsConceded) > contre);
    if (encaisses.length) {
      ajouter('conceded', encaisses, (noms) => t(
        'stMatch.feuille.issue.conceded',
        'Plus de buts encaissés que le score adverse ({{score}}). Vérifie {{names}}.',
        { names: noms, score: contre, ...SANS_ECHAPPEMENT },
      ));
    }
    const cleanSheets = liste.filter((ligne) => Boolean(ligne?.cleanSheet));
    if (contre > 0 && cleanSheets.length) {
      ajouter('cleanSheetScore', cleanSheets, (noms) => t(
        'stMatch.feuille.issue.cleanSheetScore',
        'Clean sheet impossible : l’adversaire a marqué. Vérifie {{names}}.',
        { names: noms, ...SANS_ECHAPPEMENT },
      ));
    }
  }
  const cleanSheetsEncaisses = liste
    .filter((ligne) => Boolean(ligne?.cleanSheet) && chiffre(ligne?.goalsConceded) > 0);
  if (cleanSheetsEncaisses.length) {
    ajouter('cleanSheetConceded', cleanSheetsEncaisses, (noms) => t(
      'stMatch.feuille.issue.cleanSheetConceded',
      'Un clean sheet impose 0 but encaissé. Vérifie {{names}}.',
      { names: noms, ...SANS_ECHAPPEMENT },
    ));
  }
  return corrections;
};

/**
 * « 90 minutes », « 1 but », « 0 passe » : un chiffre de la ligne, accordé.
 * @param {string} cle - La clé du chiffre.
 * @param {number} valeur - Sa valeur.
 * @param {Function} t - La traduction.
 * @returns {string} Le chiffre et son mot.
 */
export const direUnChiffre = (cle, valeur, t) => {
  const options = { count: valeur, ...SANS_ECHAPPEMENT };
  switch (cle) {
    case 'goals':
      return t('stMatch.feuille.figure.goals', {
        ...options, defaultValue_one: '{{count}} but', defaultValue_other: '{{count}} buts',
      });
    case 'minutesPlayed':
      return t('stMatch.feuille.figure.minutes', {
        ...options, defaultValue_one: '{{count}} minute', defaultValue_other: '{{count}} minutes',
      });
    case 'points':
      return t('stMatch.feuille.figure.points', {
        ...options, defaultValue_one: '{{count}} point', defaultValue_other: '{{count}} points',
      });
    default:
      return t('stMatch.feuille.figure.assists', {
        ...options, defaultValue_one: '{{count}} passe', defaultValue_other: '{{count}} passes',
      });
  }
};

/**
 * Ce qu'un joueur a répondu, en deux ou trois mots (onglet Retours, état 5).
 * @param {any} reponse - Sa réponse, telle que le serveur la résume.
 * @param {Function} t - La traduction.
 * @returns {string} « A joué · avec un mot », « Présent sans jouer »…
 */
export const direSaReponse = (reponse, t) => {
  let participation = '';
  if (reponse?.participation === 'played') {
    participation = reponse?.quantitativeState === 'unknown'
      ? t('stMatch.feuille.answer.playedUnknown', 'A joué, sans ses chiffres')
      : t('stMatch.feuille.answer.played', 'A joué');
  } else if (reponse?.participation === 'present_no_play') {
    participation = t('stMatch.feuille.answer.present', 'Présent sans jouer');
  } else if (reponse?.participation === 'not_involved') {
    participation = t('stMatch.feuille.answer.notInvolved', 'Pas concerné');
  }
  const mot = String(reponse?.selfComment || '').trim()
    ? t('stMatch.feuille.answer.withWord', 'avec un mot')
    : '';
  return [participation, mot].filter(Boolean).join(' · ');
};

/**
 * « 1 sur 3 a répondu » : LE compte, le même que la carte « Après le match »
 * (défaut 19 : l'éditeur disait « 0/1 joueurs ont repondu » quand Hugo avait répondu).
 * @param {number} recues - Les réponses envoyées.
 * @param {number} attendues - Les joueurs de la feuille.
 * @param {Function} t - La traduction.
 * @returns {string} Le compte, accordé sur ceux qui ont répondu.
 */
export const direLeCompte = (recues, attendues, t) => t('stMatch.carte.responsesCount', {
  count: recues,
  defaultValue_one: '{{count}} sur {{total}} a répondu',
  defaultValue_other: '{{count}} sur {{total}} ont répondu',
  total: attendues,
  ...SANS_ECHAPPEMENT,
});
