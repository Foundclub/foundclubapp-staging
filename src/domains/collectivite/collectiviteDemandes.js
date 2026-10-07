import { format } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { isRequestTimeoutAbandon } from '@/utils/errors/apiError';

import { summarizeConflict } from './collectiviteAccueil';

// 🏛️ COLL-C3B (02/10) — LES DEMANDES DE CRÉNEAU EN PHRASES (planches P6v2, P6-fenetre, P8v2).
// Règles PURES : les écrans posent les mots (clés `collectiviteDemandes.*`), ces fonctions
// disent les nombres, les heures, le lieu et qui sera prévenu. Jamais un nom de membre : le
// club, l'équipe, et l'encadrant qui demande (décision d'Adel « nom B »).

// Les trois motifs de refus en un appui (planche P6-fenetre, état 2) : leurs clés. La fenêtre
// les dit par `collectiviteDemandes.motifs.<clé>`.
export const MOTIFS_DE_REFUS = Object.freeze(['complet', 'fermeture', 'manifestation']);

const localeDesDates = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * Une date lisible, ou null.
 * @param {unknown} valeur - Un instant ISO (ou une date).
 * @returns {Date | null} La date, ou null si elle est illisible.
 */
const lireDate = (valeur) => {
  if (!(typeof valeur === 'string' || valeur instanceof Date)) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Une demande « chaque semaine » ? (la série rendue par le serveur, ou la récurrence de sa séance).
 * @param {any} demande - Une demande de `/collectivites/:id/requests`.
 * @returns {boolean} Vrai pour une série.
 */
// eslint-disable-next-line max-len
export const estDemandeHebdo = (demande) => Boolean(demande?.series) || Boolean(demande?.event?.isRecurring);

/**
 * 🗓️ VILLE-T18C (07/10, tournée T18 G51) — UNE CARTE REFUSÉE D'UNE SÉRIE dit SES dates, jamais la
 * période de la série : `series` (serveur, `describeSeries`) décrit la récurrence entière, ses
 * séances NON annulées, donc les dates maintenues. Deux cartes de la même série, « Acceptée » et
 * « Refusée », disaient la même phrase. Règle de « Tes demandes à la Ville » (FINITIONS13-COLL),
 * partagée avec « Demandes de la Ville ».
 * @param {any} demande - Une carte de demande (une série repliée porte `seriesCount`).
 * @returns {number} Le nombre de dates refusées que la carte porte (1 et plus) ; 0 quand la carte
 *   se lit normalement (en attente, acceptée, ou demande d'une seule fois).
 */
export const datesRefuseesDUneSerie = (demande) => (
  demande?.status === 'refused' && estDemandeHebdo(demande) && demande?.series
    ? Math.max(1, Number(demande?.seriesCount || 1))
    : 0
);

// ponytail: la préposition se devine par le PREMIER mot du nom, comme côté serveur
// (season-slot/utils, facilityPlaceLabel). Plafond : un nom féminin hors de la liste reçoit
// « au ». Sortie : un champ « genre » sur l'installation, si une Ville le demande.
// eslint-disable-next-line max-len
const LIEUX_FEMININS = ['salle', 'piscine', 'piste', 'halle', 'maison', 'base', 'plaine', 'patinoire'];

/**
 * La sorte de préposition d'un lieu, par le premier mot de son nom.
 * @param {string} libelle - Le nom de l'installation.
 * @returns {'feminin' | 'masculin' | 'voyelle'} « à la », « au » ou « à l’ ».
 */
const genreDuLieu = (libelle) => {
  const premier = libelle.split(/\s+/)[0].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (/^[aeiouy]/.test(premier)) return 'voyelle';
  if (LIEUX_FEMININS.includes(premier)) return 'feminin';
  return 'masculin';
};

/**
 * Le lieu précédé de sa préposition, dans la langue de l'app : « au Gymnase des Tilleuls »,
 * « à la Salle Jean Moulin », « à l’Espace Mistral » (en anglais, « at … »).
 * @param {unknown} nom - Le nom de l'installation.
 * @param {any} t - La traduction (`t` de react-i18next, ou `i18next.t`).
 * @returns {string} Le lieu, ou '' sans nom.
 */
export const lieuAvecPreposition = (nom, t) => {
  const libelle = String(nom || '').trim();
  if (!libelle) return '';
  const valeurs = { nom: libelle, ...SANS_ECHAPPEMENT };
  const genre = genreDuLieu(libelle);
  if (genre === 'voyelle') return t('collectiviteDemandes.lieu.voyelle', 'à l’{{nom}}', valeurs);
  if (genre === 'feminin') return t('collectiviteDemandes.lieu.feminin', 'à la {{nom}}', valeurs);
  return t('collectiviteDemandes.lieu.masculin', 'au {{nom}}', valeurs);
};

/**
 * COLL-FIX2 (03/10), planche 25 : le lieu précédé de son ARTICLE, « le Gymnase des Tilleuls »,
 * « la Salle Jean Moulin », « l’Espace Mistral » (la maquette : « Fermer le Gymnase des
 * Tilleuls le vendredi 2 octobre ? »). Même devinette que la préposition.
 * @param {unknown} nom - Le nom de l'installation.
 * @param {any} t - La traduction.
 * @returns {string} Le lieu, ou '' sans nom.
 */
export const lieuAvecArticle = (nom, t) => {
  const libelle = String(nom || '').trim();
  if (!libelle) return '';
  const valeurs = { nom: libelle, ...SANS_ECHAPPEMENT };
  const genre = genreDuLieu(libelle);
  if (genre === 'voyelle') {
    return t('collectiviteDemandes.lieu.articleVoyelle', 'l’{{nom}}', valeurs);
  }
  if (genre === 'feminin') {
    return t('collectiviteDemandes.lieu.articleFeminin', 'la {{nom}}', valeurs);
  }
  return t('collectiviteDemandes.lieu.articleMasculin', 'le {{nom}}', valeurs);
};

/**
 * Le moment d'une demande, en mots : jour long (« jeudi 1 oct. »), jour court (« jeu. 1 oct. »),
 * jour de la semaine (« jeudi »), heures (« 18:00 »), et la fin d'une série (« 30 juin »).
 * @param {any} demande - Une demande (requestedStart, requestedEnd, series).
 * @returns {{ debut: string, fin: string, jour: string, jourCourt: string,
 *   jourSemaine: string, jusquAu: string } | null} Les mots, ou null si le moment est illisible.
 */
export const momentDeLaDemande = (demande) => {
  const debut = lireDate(demande?.requestedStart);
  const fin = lireDate(demande?.requestedEnd);
  if (!debut || !fin) return null;
  const locale = localeDesDates();
  const finDeSerie = lireDate(demande?.series?.until ? `${demande.series.until}T12:00:00` : null);
  return {
    debut: format(debut, 'HH:mm'),
    fin: format(fin, 'HH:mm'),
    jour: format(debut, 'EEEE d MMM', { locale }),
    jourCourt: format(debut, 'EEE d MMM', { locale }),
    jourSemaine: format(debut, 'EEEE', { locale }),
    jusquAu: finDeSerie ? format(finDeSerie, 'd MMMM', { locale }) : '',
  };
};

/**
 * La place sur place, en nombres : combien d'équipes y sont déjà, combien de places restent,
 * et combien d'équipes l'acceptation mettrait. Réutilise `summarizeConflict` (lot ACCUEIL).
 * @param {any} conflit - `conflict` d'une demande en attente.
 * @returns {{ apres: number, capacite: number, complet: boolean, depasse: boolean,
 *   equipes: number, restantes: number } | null} La place, ou null.
 */
export const etatDeLaPlace = (conflit) => {
  const resume = summarizeConflict(conflit);
  if (!resume) return null;
  const occupants = Array.isArray(conflit?.occupants) ? conflit.occupants.length : 0;
  const equipes = Math.max(resume.taken, occupants);
  const apres = equipes + 1;
  return {
    apres,
    capacite: resume.maxSlots,
    complet: resume.full,
    depasse: apres > resume.maxSlots,
    equipes,
    restantes: resume.remaining,
  };
};

/**
 * COLL-C3B-BIS (03/10), planche 34 — UNE SÉRIE SE LIT EN ENTIER, pas sur sa première date :
 * combien de semaines (« 12 mardis »), du … au …, et lesquelles sont pleines. Lit les dates en
 * attente que le serveur rend avec leur place (`seriesDates` : taken, maxSlots, remaining).
 * @param {any} demande - Une demande « chaque semaine » de `/collectivites/:id/requests`.
 * 🧮 FINITIONS13-COLL (04/10) — et le nombre d'équipes de la PLUPART des semaines (`prisCourant`),
 * avec les semaines qui s'en écartent (`ecarts`) : tournée T13, « il y a déjà 3 équipes » (le
 * maximum) pour 37 jeudis à 2 et un seul à 3.
 * @returns {{ au: string, capacite: number, completes: string[], du: string,
 *   ecarts: Array<{ date: string, pris: number }>, jourSemaine: string, nombre: number,
 *   prisCourant: number, prisMax: number, prisUniforme: number | null, restantes: number }
 *   | null} La lecture, ou null s'il n'y a pas au moins deux dates lisibles.
 */
export const lectureDeLaSerie = (demande) => {
  const dates = (Array.isArray(demande?.seriesDates) ? demande.seriesDates : [])
    .map((/** @type {any} */ date) => ({ ...date, debut: lireDate(date?.requestedStart) }))
    .filter((/** @type {any} */ date) => date.debut)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.debut.getTime() - b.debut.getTime());
  if (dates.length < 2) return null;
  const locale = localeDesDates();
  const capacite = Math.max(
    1,
    ...dates.map((/** @type {any} */ date) => Number(date?.maxSlots || 1)),
  );
  const pris = dates.map((/** @type {any} */ date) => Number(date?.taken || 0));
  const pleines = dates.filter((/** @type {any} */ date) => (
    Number(date?.taken || 0) >= Number(date?.maxSlots || 1)
  ));
  const uniforme = pris.every((/** @type {number} */ valeur) => valeur === pris[0]);
  /** @type {Map<number, number>} */
  const frequences = new Map();
  pris.forEach((/** @type {number} */ valeur) => {
    frequences.set(valeur, (frequences.get(valeur) || 0) + 1);
  });
  // Le nombre le plus fréquent ; à égalité, le plus petit.
  const [[prisCourant]] = [...frequences.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
  return {
    au: format(dates[dates.length - 1].debut, 'd MMMM', { locale }),
    capacite,
    completes: pleines.map((/** @type {any} */ date) => (
      format(date.debut, 'EEE d MMM', { locale })
    )),
    du: format(dates[0].debut, 'd MMMM', { locale }),
    ecarts: dates
      .filter((/** @type {any} */ date) => Number(date?.taken || 0) !== prisCourant)
      .map((/** @type {any} */ date) => ({
        date: format(date.debut, 'EEE d MMM', { locale }),
        pris: Number(date?.taken || 0),
      })),
    jourSemaine: format(dates[0].debut, 'EEEE', { locale }),
    nombre: dates.length,
    prisCourant,
    prisMax: Math.max(...pris),
    prisUniforme: uniforme ? pris[0] : null,
    restantes: Math.max(0, capacite - Math.max(...pris)),
  };
};

/**
 * Qui est déjà là, regroupé par horaire : « AS Montrivage · U15 et Montrivage FC · Senior B,
 * de 18:00 à 19:30 ». Le club et l'équipe, jamais une personne.
 * @param {any} conflit - `conflict` d'une demande en attente.
 * @returns {Array<{ debut: string, fin: string, noms: string[] }>} Un groupe par horaire.
 */
export const occupantsParHoraire = (conflit) => {
  const occupants = Array.isArray(conflit?.occupants) ? conflit.occupants : [];
  /** @type {Map<string, { debut: string, fin: string, noms: string[] }>} */
  const groupes = new Map();
  occupants.forEach((/** @type {any} */ occupant) => {
    const debut = lireDate(occupant?.start);
    const fin = lireDate(occupant?.end);
    const horaire = {
      debut: debut ? format(debut, 'HH:mm') : '',
      fin: fin ? format(fin, 'HH:mm') : '',
    };
    const cle = `${horaire.debut}|${horaire.fin}`;
    const nom = [occupant?.club, occupant?.team].filter(Boolean).join(' · ');
    if (!nom) return;
    if (!groupes.has(cle)) groupes.set(cle, { ...horaire, noms: [] });
    const groupe = groupes.get(cle);
    if (groupe && !groupe.noms.includes(nom)) groupe.noms.push(nom);
  });
  return [...groupes.values()];
};

/**
 * Qui sera prévenu si la mairie accepte (planche P6-fenetre, état 1) : l'encadrant qui demande
 * et son club ; puis les clubs déjà là (« club · équipe »), une fois chacun.
 * @param {any} demande - La demande (requestedBy, club, conflict).
 * @returns {{ club: string, clubsDejaLa: string[], personne: string }} Les destinataires.
 */
export const prevenusDe = (demande) => {
  const personne = [demande?.requestedBy?.firstname, demande?.requestedBy?.lastname]
    .filter(Boolean).join(' ');
  /** @type {string[]} */
  const clubsDejaLa = [];
  occupantsParHoraire(demande?.conflict).forEach((groupe) => {
    groupe.noms.forEach((nom) => { if (!clubsDejaLa.includes(nom)) clubsDejaLa.push(nom); });
  });
  return { club: String(demande?.club?.name || ''), clubsDejaLa, personne };
};

/**
 * La date de la décision d'une demande traitée (« acceptée le 1 oct. »). Le serveur ne garde
 * pas de champ « décidée le » : la dernière modification d'une demande traitée EST sa décision
 * (une demande tranchée ne se modifie plus ; périmée, elle quitte la liste).
 * @param {any} demande - Une demande traitée (updatedAt).
 * @returns {string} « 1 oct. », ou '' si la date est illisible.
 */
export const dateDeDecision = (demande) => {
  const date = lireDate(demande?.updatedAt);
  return date ? format(date, 'd MMM', { locale: localeDesDates() }) : '';
};

// ─── COLL-C3B — LE CLUB DEMANDE (planches P8v2-demande, tel et ordi) ─────────────────────────

/**
 * La fin de la saison qui contient un jour : le 30 juin (contrat C2A §2 : du 1er septembre au
 * 30 juin ; juillet et août préparent la saison qui vient).
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {string} AAAA-06-30.
 */
export const finDeSaison = (jour) => {
  const annee = Number(String(jour).slice(0, 4));
  const mois = Number(String(jour).slice(5, 7));
  return `${mois >= 7 ? annee + 1 : annee}-06-30`;
};

/**
 * VILLE-T18C (07/10, tournée T18 D09) — LA FIN D'UNE SÉRIE : le jour choisi (« Jusqu’au »), s'il
 * tombe entre le premier jour et la fin de la saison ; sinon la fin de la saison.
 * @param {string} jour - Le premier jour, AAAA-MM-JJ.
 * @param {string} [jusquA] - La fin choisie, AAAA-MM-JJ, ou ''.
 * @returns {string} Le dernier jour possible, AAAA-MM-JJ.
 */
export const finDeLaSerie = (jour, jusquA = '') => {
  const saison = finDeSaison(jour);
  const choisi = /^\d{4}-\d{2}-\d{2}$/.test(String(jusquA || '')) ? jusquA : '';
  return choisi && choisi >= jour && choisi < saison ? choisi : saison;
};

/**
 * Les dates d'une demande : le jour choisi, ou chaque semaine jusqu'à la fin choisie (la fin de la
 * saison par défaut, `finDeLaSerie`).
 * @param {string} jour - AAAA-MM-JJ.
 * @param {boolean} chaqueSemaine - « Chaque semaine ».
 * @param {string} [jusquA] - La fin choisie, AAAA-MM-JJ, ou ''.
 * @returns {string[]} Les jours, AAAA-MM-JJ.
 */
export const datesDeLaDemande = (jour, chaqueSemaine, jusquA = '') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour || ''))) return [];
  if (!chaqueSemaine) return [jour];
  const fin = finDeLaSerie(jour, jusquA);
  const dates = [];
  const curseur = new Date(`${jour}T12:00:00Z`);
  while (curseur.toISOString().slice(0, 10) <= fin && dates.length < 53) {
    dates.push(curseur.toISOString().slice(0, 10));
    curseur.setUTCDate(curseur.getUTCDate() + 7);
  }
  return dates;
};

/**
 * Hors des heures d'ouverture ? Le seul cas où l'envoi est impossible (P8v2, état 3).
 * @param {{ debut: number | null, fin: number | null, ouverture: number | null,
 *   fermeture: number | null }} heures - En minutes ; null si inconnu.
 * @returns {{ cas: 'ferme' | 'ouvre', heure: number } | null} La borne dépassée, ou null.
 */
export const horsOuverture = ({
  debut, fermeture, fin, ouverture,
}) => {
  if (debut === null || fin === null) return null;
  if (fermeture !== null && fin > fermeture) return { cas: 'ferme', heure: fermeture };
  if (ouverture !== null && debut < ouverture) return { cas: 'ouvre', heure: ouverture };
  return null;
};

// ─── FINITIONS12-COLL (03/10) — UNE RÉPONSE PERDUE N'EST PAS UNE ERREUR ──────────────────────

// Les relectures de la file après un délai dépassé : tout de suite, puis 2 s et 4 s après (le
// serveur peut finir d'écrire juste après l'abandon du client, à 15 s).
export const RELECTURES_APRES_DELAI_MS = [0, 2000, 4000];

/**
 * Faut-il RELIRE la file avant de dire « Erreur » sur une décision de la mairie ? Tournée T11 : la
 * Ville accepte 37 dates, le serveur répond 200 en 23,5 s, le client abandonne à 15 s, et la
 * fenêtre disait « Erreur » sur une décision écrite. Une réponse perdue (délai dépassé, réseau
 * coupé : aucun statut HTTP) ou « plus en attente » (un appui précédent l'a déjà tranchée) peut
 * cacher une décision passée ; toute autre erreur est une vraie erreur.
 * @param {any} error - Ce que le client HTTP a rejeté.
 * @returns {'delai' | 'reseau' | 'dejaTranchee' | null} Pourquoi relire, ou null.
 */
export const raisonDeRelireLaDecision = (error) => {
  if (isRequestTimeoutAbandon(error)) return 'delai';
  if (/no longer pending/i.test(String(error?.message || ''))) return 'dejaTranchee';
  // Sans réponse du serveur, l'intercepteur rejette le message nu d'axios (« Network Error »).
  if (typeof error === 'string' || Number(error?.status ?? -1) === 0) return 'reseau';
  return null;
};

/**
 * La demande est-elle encore dans la file relue ? (Une série = une carte, portée par sa plus
 * proche date : tant que la décision n'est pas passée, la carte garde la même.)
 * @param {any[]} file - La file en attente, relue.
 * @param {string} documentId - La demande tranchée.
 * @returns {boolean} Vrai si elle attend toujours.
 */
export const estEncoreEnAttente = (file, documentId) => (Array.isArray(file) ? file : [])
  .some((/** @type {any} */ demande) => demande?.documentId === documentId);
