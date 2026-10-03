/**
 * COLL-C5 (03/10/2026) — ce que les écrans écrivent des CHIFFRES DE LA VILLE : la page « Chiffres »
 * (planche 30), la jauge de l'accueil (planches 2 et 3) et l'« Utilisation » de la fiche d'un club
 * (planche 37). Fonctions PURES, sans appel réseau (mémoire
 * piege-env-absent-worktree-import-service : les hooks restent dans services/).
 *
 * Les nombres viennent tels quels du serveur (`GET /collectivites/:id/chiffres`) ; leur
 * définition est écrite dans admin/docs/CONTRAT_CHIFFRES_VILLE.md. Ce module ne recalcule rien :
 * il met en mots, et il écrit « — » quand le serveur ne sait pas (jamais un 0 inventé).
 * 🔒 Aucune personne : des installations, des clubs, des nombres.
 */

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { lieuAvecPreposition } from './collectiviteDemandes';

/** @typedef {(cle: string, repli?: any, options?: Record<string, unknown>) => string} Traduire */

/** Les trois périodes de la page, dans l'ordre du sélecteur. */
export const PERIODES_CHIFFRES = /** @type {const} */ (['semaine', 'mois', 'saison']);

/**
 * Un nombre du serveur, ou null s'il est illisible.
 * @param {unknown} valeur - La valeur.
 * @returns {number | null} Le nombre.
 */
const nombre = (valeur) => (typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null);

/**
 * Une durée en mots : « 14 h », « 1 h 30 », « 45 min », « 0 h ».
 * @param {unknown} minutes - Les minutes du serveur.
 * @returns {string} La durée, ou « — ».
 */
export const dureeLisible = (minutes) => {
  const valeur = nombre(minutes);
  if (valeur === null) return '—';
  const total = Math.max(0, Math.round(valeur));
  if (total > 0 && total < 60) return `${total} min`;
  const heures = Math.floor(total / 60);
  const reste = total % 60;
  return reste ? `${heures} h ${String(reste).padStart(2, '0')}` : `${heures} h`;
};

/**
 * La largeur d'une barre, en % de la plus grande (la planche : « 14 h » pleine, « 0 h » vide).
 * @param {unknown} minutes - Les minutes de la ligne.
 * @param {number} maximum - Les minutes de la plus grande ligne.
 * @returns {number} De 0 à 100.
 */
export const largeurBarre = (minutes, maximum) => {
  const valeur = nombre(minutes);
  if (valeur === null || !(maximum > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((100 * valeur) / maximum)));
};

/**
 * La largeur de la jauge d'occupation : le taux, plafonné à 100 % ; 0 sans taux.
 * @param {unknown} taux - Le taux du serveur (peut dépasser 100, ou valoir null).
 * @returns {number} De 0 à 100.
 */
export const largeurJauge = (taux) => {
  const valeur = nombre(taux);
  return valeur === null ? 0 : Math.max(0, Math.min(100, valeur));
};

/**
 * Le taux en mots : « 6 % », ou « — » quand l'installation n'a pas d'horaires.
 * @param {unknown} taux - Le taux du serveur.
 * @returns {string} Le libellé.
 */
export const tauxLisible = (taux) => {
  const valeur = nombre(taux);
  return valeur === null ? '—' : `${valeur} %`;
};

/**
 * Un nombre accordé : « 1 tenue », « 6 tenues » (les deux formes viennent du catalogue).
 * @param {Traduire} t - La traduction.
 * @param {string} cle - La clé, sans `_one` / `_other`.
 * @param {number} compte - Le nombre.
 * @param {string} un - Le repli au singulier.
 * @param {string} plusieurs - Le repli au pluriel.
 * @param {Record<string, unknown>} [valeurs] - D'autres valeurs à poser dans la phrase.
 * @returns {string} Le libellé.
 */
const accorde = (t, cle, compte, un, plusieurs, valeurs = {}) => t(cle, {
  count: compte,
  defaultValue_one: un,
  defaultValue_other: plusieurs,
  ...valeurs,
  ...SANS_ECHAPPEMENT,
});

/**
 * « 6 tenues · 1 annulée par le club · 2 touchées par une fermeture » (+ « · 2 à venir » quand la
 * période n'est pas finie : sinon les trois nombres ne font pas le total).
 * @param {Traduire} t - La traduction.
 * @param {any} seances - `data.seances` du serveur.
 * @returns {string} La phrase.
 */
export const phraseSeancesTenues = (t, seances) => {
  const n = (/** @type {string} */ cle) => nombre(seances?.[cle]) ?? 0;
  const morceaux = [
    accorde(
      t,
      'collectiviteChiffres.seances.tenues',
      n('tenues'),
      '{{count}} tenue',
      '{{count}} tenues',
    ),
    accorde(
      t,
      'collectiviteChiffres.seances.annulees',
      n('annulees'),
      '{{count}} annulée par le club',
      '{{count}} annulées par le club',
    ),
    accorde(
      t,
      'collectiviteChiffres.seances.fermeture',
      n('fermeture'),
      '{{count}} touchée par une fermeture',
      '{{count}} touchées par une fermeture',
    ),
  ];
  if (n('aVenir') > 0) {
    morceaux.push(accorde(
      t,
      'collectiviteChiffres.seances.aVenir',
      n('aVenir'),
      '{{count}} à venir',
      '{{count}} à venir',
    ));
  }
  return morceaux.join(' · ');
};

/**
 * « 4 reçues · 1 acceptée · 1 refusée » (+ « · 1 en attente »).
 * @param {Traduire} t - La traduction.
 * @param {any} demandes - `data.demandes` du serveur.
 * @returns {string} La phrase.
 */
export const phraseDemandes = (t, demandes) => {
  const n = (/** @type {string} */ cle) => nombre(demandes?.[cle]) ?? 0;
  const morceaux = [
    accorde(
      t,
      'collectiviteChiffres.demandes.recues',
      n('recues'),
      '{{count}} reçue',
      '{{count}} reçues',
    ),
    accorde(
      t,
      'collectiviteChiffres.demandes.acceptees',
      n('acceptees'),
      '{{count}} acceptée',
      '{{count}} acceptées',
    ),
    accorde(
      t,
      'collectiviteChiffres.demandes.refusees',
      n('refusees'),
      '{{count}} refusée',
      '{{count}} refusées',
    ),
  ];
  if (n('enAttente') > 0) {
    morceaux.push(accorde(
      t,
      'collectiviteChiffres.demandes.enAttente',
      n('enAttente'),
      '{{count}} en attente',
      '{{count}} en attente',
    ));
  }
  return morceaux.join(' · ');
};

/**
 * « Délai moyen de réponse : 1,3 jour. » ; « — » sans demande tranchée.
 * @param {Traduire} t - La traduction.
 * @param {unknown} jours - `data.demandes.delaiMoyenJours`.
 * @returns {string} La phrase.
 */
export const phraseDelai = (t, jours) => {
  const valeur = nombre(jours);
  if (valeur === null) {
    return t('collectiviteChiffres.demandes.delaiInconnu', 'Délai moyen de réponse : —');
  }
  // En français, moins de 2 s'accorde au singulier : « 1,3 jour », « 2 jours ».
  return accorde(
    t,
    'collectiviteChiffres.demandes.delai',
    valeur < 2 ? 1 : 2,
    'Délai moyen de réponse : {{jours}} jour.',
    'Délai moyen de réponse : {{jours}} jours.',
    { jours: String(valeur).replace('.', ',') },
  );
};

/**
 * Sous les heures par club : « 9 séances, toutes au Gymnase des Tilleuls. », « 13 séances sur
 * 2 installations. », ou « Aucune séance sur la période. ».
 * @param {Traduire} t - La traduction.
 * @param {any} chiffres - La réponse du serveur.
 * @returns {string} La phrase.
 */
export const phraseSeancesDesClubs = (t, chiffres) => {
  const installations = (Array.isArray(chiffres?.installations) ? chiffres.installations : [])
    .filter((ligne) => (nombre(ligne?.seances) ?? 0) > 0);
  const total = installations.reduce((somme, ligne) => somme + Number(ligne.seances), 0);
  if (total === 0) return t('collectiviteChiffres.clubs.aucune', 'Aucune séance sur la période.');
  if (installations.length === 1) {
    return accorde(
      t,
      'collectiviteChiffres.clubs.toutesAu',
      total,
      '{{count}} séance, {{lieu}}.',
      '{{count}} séances, toutes {{lieu}}.',
      { lieu: lieuAvecPreposition(installations[0]?.name, t) },
    );
  }
  return t(
    'collectiviteChiffres.clubs.surPlusieurs',
    '{{total}} séances sur {{installations}} installations.',
    { installations: installations.length, total, ...SANS_ECHAPPEMENT },
  );
};

/**
 * Le « % séances tenues » d'un club (contrat §6) : tenues / (tenues + annulées + fermeture) ;
 * null quand aucune séance n'est passée.
 * @param {any} club - Une ligne `data.clubs` du serveur.
 * @returns {number | null} Le pourcentage arrondi.
 */
export const tauxTenues = (club) => {
  const tenues = nombre(club?.tenues) ?? 0;
  const manquees = (nombre(club?.annulees) ?? 0) + (nombre(club?.fermeture) ?? 0);
  return tenues + manquees > 0 ? Math.round((100 * tenues) / (tenues + manquees)) : null;
};

/**
 * Le nom du fichier exporté, comme le serveur le nomme : « chiffres-ville-de-montrivage-semaine-
 * 2026-09-28.csv » (sans accent ni espace).
 * @param {unknown} nomVille - Le nom de la Ville.
 * @param {string} periode - semaine | mois | saison.
 * @param {unknown} from - Le premier jour de la période (AAAA-MM-JJ).
 * @returns {string} Le nom du fichier.
 */
export const nomDuFichierExporte = (nomVille, periode, from) => {
  const ville = String(nomVille || 'ville')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ville';
  const debut = /^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) ? `-${from}` : '';
  return `chiffres-${ville}-${periode}${debut}.csv`;
};

/**
 * Le CSV tel qu'un tableur le lit avec ses accents : la marque UTF-8 (BOM) en tête, une seule fois.
 * Le navigateur la retire en décodant la réponse : on la remet.
 * @param {unknown} texte - Le CSV reçu.
 * @returns {string} Le CSV avec sa marque.
 */
export const avecMarqueUtf8 = (texte) => {
  const csv = String(texte ?? '');
  return csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`;
};
