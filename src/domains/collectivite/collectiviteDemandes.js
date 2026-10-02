import { format } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

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
 * Les dates d'une demande : le jour choisi, ou chaque semaine jusqu'à la fin de la saison.
 * @param {string} jour - AAAA-MM-JJ.
 * @param {boolean} chaqueSemaine - « Chaque semaine ».
 * @returns {string[]} Les jours, AAAA-MM-JJ.
 */
export const datesDeLaDemande = (jour, chaqueSemaine) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour || ''))) return [];
  if (!chaqueSemaine) return [jour];
  const fin = finDeSaison(jour);
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
