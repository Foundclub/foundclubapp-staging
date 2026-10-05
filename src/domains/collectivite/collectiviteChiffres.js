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

import { finDeSaison, lieuAvecPreposition } from './collectiviteDemandes';

/** @typedef {any} Traduire - La traduction (TFunction d i18next, qui ne se reduit pas a une signature simple). */

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
 * « occupation : 6 % » (ou « occupation : — ») : la fin de la ligne « 9 séances · … » de
 * l'accueil (planches 2 et 3).
 * @param {Traduire} t - La traduction.
 * @param {unknown} taux - Le taux de la semaine, ou null.
 * @returns {string} Le libellé.
 */
export const phraseOccupation = (t, taux) => t(
  'collectiviteChiffres.jauge.occupation',
  'occupation : {{taux}}',
  { taux: tauxLisible(taux), ...SANS_ECHAPPEMENT },
);

/**
 * « 6 tenues · 1 annulée par le club · 2 touchées par une fermeture » (+ « · 2 à venir » quand la
 * période n'est pas finie : sinon les trois nombres ne font pas le total). Les replis restent DANS
 * `t()` : c'est là que le compteur du français en dur les sait traduisibles.
 * @param {Traduire} t - La traduction.
 * @param {any} seances - `data.seances` du serveur.
 * @returns {string} La phrase.
 */
export const phraseSeancesTenues = (t, seances) => {
  const n = (/** @type {string} */ cle) => nombre(seances?.[cle]) ?? 0;
  const morceaux = [
    t('collectiviteChiffres.seances.tenues', {
      count: n('tenues'),
      defaultValue_one: '{{count}} tenue',
      defaultValue_other: '{{count}} tenues',
    }),
    t('collectiviteChiffres.seances.annulees', {
      count: n('annulees'),
      defaultValue_one: '{{count}} annulée par le club',
      defaultValue_other: '{{count}} annulées par le club',
    }),
    t('collectiviteChiffres.seances.fermeture', {
      count: n('fermeture'),
      defaultValue_one: '{{count}} touchée par une fermeture',
      defaultValue_other: '{{count}} touchées par une fermeture',
    }),
  ];
  if (n('aVenir') > 0) {
    morceaux.push(t('collectiviteChiffres.seances.aVenir', {
      count: n('aVenir'),
      defaultValue_one: '{{count}} à venir',
      defaultValue_other: '{{count}} à venir',
    }));
  }
  return morceaux.join(' · ');
};

/**
 * 🧮 FINITIONS12-COLL (03/10) et FINITIONS13-COLL (04/10) — MÊME MOT, MÊME NOMBRE : les séances
 * de la semaine d'une installation sont celles de « Chiffres » (`seances` de sa ligne : tenues + à
 * venir, admin docs/CONTRAT_CHIFFRES_VILLE.md §4.1 et §5), jamais les BLOCS du planning, qui
 * comptent aussi les créneaux (§1 : un créneau est une attribution, pas une séance). L'accueil de
 * la Ville et la liste « Installations de la Ville » lisent cette règle (tournée T13 : la liste
 * disait 14 et 1 quand l'accueil disait 10 et 0).
 * @param {any} chiffres - La réponse de « Chiffres » (`{ installations }`).
 * @param {string | null | undefined} facilityId - documentId de l'installation.
 * @returns {number | null} Le nombre, ou null tant qu'il n'est pas connu (jamais un 0 inventé).
 */
export const seancesDeLInstallation = (chiffres, facilityId) => {
  const lignes = chiffres?.installations;
  const ligne = Array.isArray(lignes) ? lignes.find((l) => l?.documentId === facilityId) : null;
  return typeof ligne?.seances === 'number' ? ligne.seances : null;
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
    t('collectiviteChiffres.demandes.recues', {
      count: n('recues'),
      defaultValue_one: '{{count}} reçue',
      defaultValue_other: '{{count}} reçues',
    }),
    t('collectiviteChiffres.demandes.acceptees', {
      count: n('acceptees'),
      defaultValue_one: '{{count}} acceptée',
      defaultValue_other: '{{count}} acceptées',
    }),
    t('collectiviteChiffres.demandes.refusees', {
      count: n('refusees'),
      defaultValue_one: '{{count}} refusée',
      defaultValue_other: '{{count}} refusées',
    }),
  ];
  if (n('enAttente') > 0) {
    morceaux.push(t('collectiviteChiffres.demandes.enAttente', {
      count: n('enAttente'),
      defaultValue_one: '{{count}} en attente',
      defaultValue_other: '{{count}} en attente',
    }));
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
  return t('collectiviteChiffres.demandes.delai', {
    count: valeur < 2 ? 1 : 2,
    defaultValue_one: 'Délai moyen de réponse : {{jours}} jour.',
    defaultValue_other: 'Délai moyen de réponse : {{jours}} jours.',
    jours: String(valeur).replace('.', ','),
    ...SANS_ECHAPPEMENT,
  });
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
    .filter((/** @type {any} */ ligne) => (nombre(ligne?.seances) ?? 0) > 0);
  const total = installations.reduce(
    (/** @type {number} */ somme, /** @type {any} */ ligne) => somme + Number(ligne.seances),
    0,
  );
  if (total === 0) return t('collectiviteChiffres.clubs.aucune', 'Aucune séance sur la période.');
  if (installations.length === 1) {
    return t('collectiviteChiffres.clubs.toutesAu', {
      count: total,
      defaultValue_one: '{{count}} séance, {{lieu}}.',
      defaultValue_other: '{{count}} séances, toutes {{lieu}}.',
      lieu: lieuAvecPreposition(installations[0]?.name, t),
      ...SANS_ECHAPPEMENT,
    });
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
 * « Ville de Montrivage » => « ville-de-montrivage » : sans accent ni espace (comme le serveur).
 * @param {unknown} nom - Le nom.
 * @param {string} secours - Ce qu'on écrit quand le nom est vide.
 * @returns {string} Le nom nettoyé.
 */
const enNomDeFichier = (nom, secours) => String(nom || secours)
  .normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || secours;

/**
 * Le nom du fichier exporté, comme le serveur le nomme : « chiffres-ville-de-montrivage-semaine-
 * 2026-09-28.csv » (sans accent ni espace).
 * @param {unknown} nomVille - Le nom de la Ville.
 * @param {string} periode - semaine | mois | saison.
 * @param {unknown} from - Le premier jour de la période (AAAA-MM-JJ).
 * @returns {string} Le nom du fichier.
 */
export const nomDuFichierExporte = (nomVille, periode, from) => {
  const debut = /^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) ? `-${from}` : '';
  return `chiffres-${enNomDeFichier(nomVille, 'ville')}-${periode}${debut}.csv`;
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

// ---------------------------------------------------------------------------
// COLL-AFFICHE (03/10/2026) — « Une affiche pour l'installation » (planche 30 B, décision d'Adel
// « affiche A ») : le PDF du planning d'UNE installation pour UNE semaine. Contrat :
// admin/docs/CONTRAT_CHIFFRES_VILLE.md §7 bis.
// ---------------------------------------------------------------------------

/**
 * Le lundi (AAAA-MM-JJ) de la semaine d'un jour, décalé de n semaines. Calcul en UTC : un jour
 * civil reste ce jour-là, quel que soit le fuseau de l'appareil.
 * @param {unknown} jour - Un jour AAAA-MM-JJ.
 * @param {number} [semaines] - Le décalage (−1 : la semaine d'avant).
 * @returns {string | null} Le lundi, ou null si le jour est illisible.
 */
export const lundiDecale = (jour, semaines = 0) => {
  const texte = String(jour || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return null;
  const date = new Date(`${texte}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== texte) return null;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 7 * semaines);
  return date.toISOString().slice(0, 10);
};

/**
 * Le dimanche (AAAA-MM-JJ) de la semaine qui commence ce lundi.
 * @param {string} lundi - Le lundi AAAA-MM-JJ.
 * @returns {string} Le dimanche.
 */
export const dimancheDe = (lundi) => {
  const date = new Date(`${lundi}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
};

/**
 * Le jour où l'on est (AAAA-MM-JJ), sur l'appareil.
 * @param {Date} [maintenant] - Maintenant.
 * @returns {string} Le jour.
 */
export const aujourdhui = (maintenant = new Date()) => {
  const deux = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const mois = deux(maintenant.getMonth() + 1);
  return `${maintenant.getFullYear()}-${mois}-${deux(maintenant.getDate())}`;
};

/**
 * Le lundi de la semaine où l'on est, sur l'appareil.
 * @param {Date} [maintenant] - Maintenant.
 * @returns {string} Le lundi AAAA-MM-JJ.
 */
export const lundiDeMaintenant = (maintenant = new Date()) => (
  /** @type {string} */ (lundiDecale(aujourdhui(maintenant)))
);

/**
 * L'installation proposée d'abord : la plus utilisée de la période (ses heures), à égalité la
 * première du serveur (ordre du nom). La planche montre celle où sont toutes les séances.
 * @param {unknown} installations - `installations` des chiffres.
 * @returns {any} L'installation, ou null s'il n'y en a aucune.
 */
export const installationParDefaut = (installations) => {
  const liste = Array.isArray(installations) ? installations.filter((i) => i?.documentId) : [];
  const minutes = (/** @type {any} */ i) => Number(i?.minutes) || 0;
  return liste.reduce(
    (meilleure, i) => (meilleure === null || minutes(i) > minutes(meilleure) ? i : meilleure),
    null,
  );
};

/**
 * Le nom du PDF, comme le serveur le nomme : « affiche-gymnase-des-tilleuls-2026-09-28.pdf ».
 * @param {unknown} nomInstallation - Le nom de l'installation.
 * @param {string} lundi - Le lundi de la semaine (AAAA-MM-JJ).
 * @returns {string} Le nom du fichier.
 */
export const nomDuFichierAffiche = (nomInstallation, lundi) => (
  `affiche-${enNomDeFichier(nomInstallation, 'installation')}-${lundi}.pdf`
);

/**
 * COLL-AFFICHE-2 (03/10, décision d'Adel « saison A ») — le nom du PDF de l'affiche de la SAISON,
 * comme le serveur le nomme : « affiche-gymnase-des-tilleuls-saison-2026-2027.pdf ». La saison est
 * celle qui contient le jour (du 1er septembre au 30 juin, `finDeSaison`).
 * @param {unknown} nomInstallation - Le nom de l'installation.
 * @param {string} jour - Un jour de la saison (AAAA-MM-JJ), d'ordinaire aujourd'hui.
 * @returns {string} Le nom du fichier.
 */
export const nomDuFichierAfficheSaison = (nomInstallation, jour) => {
  const fin = Number(finDeSaison(jour).slice(0, 4));
  return `affiche-${enNomDeFichier(nomInstallation, 'installation')}-saison-${fin - 1}-${fin}.pdf`;
};
