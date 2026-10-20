import { messageDeRefus } from '@/domains/complexe/complexeGerant';
import { heureDe, texteHeure } from '@/domains/complexe/complexeTerrain';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getServerErrorCode } from '@/utils/errors/displayError';
import { getZonedDateParts } from '@/utils/parisTime';

/**
 * LES RÉSERVATIONS DU COMPLEXE, CÔTÉ GÉRANT — RESA-L5A2 (14/10/2026), chantier Réservation.
 *
 * Les règles PURES des écrans « Demandes » (E-G06), « Réservations » (E-G04), « Fiche d'une
 * réservation » (E-G05), « Planning » (E-G03) et « Fermetures » (E-G10) : les libellés des états
 * (plan §1.2), « Expire dans 5 h », les jours et les heures (de PARIS : le serveur les rend ainsi,
 * `parisDayClock`), l'historique de la fiche, et les refus du serveur NOMMÉS (contrat d'API L2A,
 * `docs/RESERVATION_CONTRAT_API_L1.md` du dépôt méthode : le code est dans `error.details.code`).
 *
 * Témoin : `complexeReservation.test.js`.
 */

/**
 * @typedef {any} Traduire - La traduction (le TFunction d'i18next, qui ne se réduit pas à une
 *   signature : même choix que `complexeTerrain.js`).
 */

/** Les états d'une réservation, tels que le serveur L2A les écrit. */
export const STATUTS = Object.freeze({
  annulee: 'annulee',
  confirmee: 'confirmee',
  enAttente: 'en_attente',
  refusee: 'refusee',
  sansReponse: 'sans_reponse',
});

/** Une demande en attente ou une réservation confirmée TIENT le créneau (AT-08). */
export const STATUTS_ACTIFS = Object.freeze([STATUTS.enAttente, STATUTS.confirmee]);

/**
 * RESA-L5B-1 (20/10/2026) — deux états LUS par l'écran, pas écrits par le serveur (plan §1.2) :
 * « Non honorée » est une MARQUE sur une confirmée (`noShowAt`, RESA-L2B ; c'est aussi la valeur
 * du filtre `statut=non_honoree` de la liste) ; « Jouée », une confirmée dont le créneau est fini,
 * sans marque.
 */
export const ETATS_LUS = Object.freeze({ jouee: 'jouee', nonHonoree: 'non_honoree' });

const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/**
 * Le libellé d'un état (plan §1.2).
 * @param {Traduire} t - Traduction.
 * @param {unknown} statut - L'état du serveur.
 * @returns {string} Le libellé, ou '' pour un état inconnu.
 */
export const libelleStatut = (t, statut) => {
  switch (statut) {
    case ETATS_LUS.jouee:
      return t('complexeReservations.statut.jouee', 'Jouée');
    case ETATS_LUS.nonHonoree:
      return t('complexeReservations.statut.nonHonoree', 'Non honorée');
    case STATUTS.annulee:
      return t('complexeReservations.statut.annulee', 'Annulée');
    case STATUTS.confirmee:
      return t('complexeReservations.statut.confirmee', 'Confirmée');
    case STATUTS.enAttente:
      return t('complexeReservations.statut.enAttente', 'En attente');
    case STATUTS.refusee:
      return t('complexeReservations.statut.refusee', 'Refusée');
    case STATUTS.sansReponse:
      return t('complexeReservations.statut.sansReponse', 'Sans réponse');
    default:
      return '';
  }
};

/**
 * RESA-L5B-1 — l'état qu'une carte ou une fiche AFFICHE (plan §1.2) : « Non honorée » si le
 * complexe l'a marquée, « Jouée » pour une confirmée dont le créneau est fini, sinon l'état du
 * serveur.
 * @param {{ endsAt?: unknown, noShowAt?: unknown, status?: unknown }} reservation - Une ligne ou
 *   une fiche du gérant.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {string} L'état affiché.
 */
export const etatAffiche = (reservation, maintenant = new Date()) => {
  if (reservation?.noShowAt) return ETATS_LUS.nonHonoree;
  const fin = new Date(String(reservation?.endsAt || '')).getTime();
  if (reservation?.status === STATUTS.confirmee && Number.isFinite(fin)
    && fin <= maintenant.getTime()) {
    return ETATS_LUS.jouee;
  }
  return String(reservation?.status || '');
};

/**
 * RESA-L5B-1 — « 1 non honorée sur 3 » (E-G05 « Qui », E-G15) : le seuil du bannissement
 * automatique du complexe (`autoBanNoShows`, 0 = jamais) tant qu'il n'est pas atteint ; « 3 non
 * honorées » une fois atteint, ou sans seuil.
 * @param {Traduire} t - Traduction.
 * @param {unknown} nombre - Les non honorées du joueur ICI (`noShowsHere`, `noShows`).
 * @param {unknown} seuil - `autoBanNoShows` du complexe, s'il est connu.
 * @returns {string} Le texte, ou '' si le nombre est inconnu.
 */
export const nonHonoreesLisibles = (t, nombre, seuil) => {
  const compte = Number(nombre);
  if (nombre === null || nombre === undefined || !Number.isFinite(compte)) return '';
  const plafond = Number(seuil);
  if (Number.isInteger(plafond) && plafond > 0 && compte < plafond) {
    return t('complexeReservations.nonHonorees.sur', '{{count}} non honorée sur {{seuil}}', {
      count: compte,
      defaultValue_one: '{{count}} non honorée sur {{seuil}}',
      defaultValue_other: '{{count}} non honorées sur {{seuil}}',
      seuil: plafond,
      ...SANS_ECHAPPEMENT,
    });
  }
  return t('complexeReservations.nonHonorees.seules', '{{count}} non honorée', {
    count: compte,
    defaultValue_one: '{{count}} non honorée',
    defaultValue_other: '{{count}} non honorées',
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * « Expire dans 5 h » (E-G06) : en minutes sous l'heure, en heures sous le jour, en jours au-delà.
 * @param {Traduire} t - Traduction.
 * @param {unknown} expiresAt - L'échéance (ISO).
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {string} Le texte, ou '' sans échéance ou une fois passée.
 */
export const expireDans = (t, expiresAt, maintenant = new Date()) => {
  if (!expiresAt) return '';
  const reste = new Date(String(expiresAt)).getTime() - maintenant.getTime();
  if (!Number.isFinite(reste) || reste <= 0) return '';
  if (reste < HEURE) {
    return t('complexeReservations.demandes.expireMinutes', 'Expire dans {{nombre}} min', {
      nombre: Math.max(1, Math.floor(reste / MINUTE)),
      ...SANS_ECHAPPEMENT,
    });
  }
  if (reste < JOUR) {
    return t('complexeReservations.demandes.expireHeures', 'Expire dans {{nombre}} h', {
      nombre: Math.floor(reste / HEURE),
      ...SANS_ECHAPPEMENT,
    });
  }
  const jours = Math.floor(reste / JOUR);
  return t('complexeReservations.demandes.expireJours', 'Expire dans {{count}} jours', {
    count: jours,
    defaultValue_one: 'Expire dans {{count}} jour',
    defaultValue_other: 'Expire dans {{count}} jours',
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * Un jour civil « AAAA-MM-JJ » en date locale à midi (aucun décalage d'heure ne change le jour).
 * @param {string} date - Le jour.
 * @returns {Date} La date.
 */
const midi = (date) => {
  const [annee, mois, jour] = String(date).split('-').map(Number);
  return new Date(annee, (mois || 1) - 1, jour || 1, 12);
};

/**
 * Une date locale en « AAAA-MM-JJ ».
 * @param {Date} instant - La date.
 * @returns {string} Le jour.
 */
const enTexte = (instant) => [
  instant.getFullYear(),
  String(instant.getMonth() + 1).padStart(2, '0'),
  String(instant.getDate()).padStart(2, '0'),
].join('-');

/**
 * Le jour civil `n` jours plus tard (ou plus tôt).
 * @param {string} date - « AAAA-MM-JJ ».
 * @param {number} n - Le décalage.
 * @returns {string} Le jour.
 */
export const enJours = (date, n) => {
  const jour = midi(date);
  jour.setDate(jour.getDate() + n);
  return enTexte(jour);
};

/**
 * Les 7 jours de la semaine (lundi → dimanche) qui contient ce jour.
 * @param {string} date - « AAAA-MM-JJ ».
 * @returns {string[]} Les 7 jours.
 */
export const joursDeLaSemaine = (date) => {
  const decalage = (midi(date).getDay() + 6) % 7;
  const lundi = enJours(date, -decalage);
  return Array.from({ length: 7 }, (_v, index) => enJours(lundi, index));
};

/**
 * Le jour de PARIS d'un instant (le serveur pense en heure de Paris).
 * @param {Date} [instant] - L'instant.
 * @returns {string} « AAAA-MM-JJ ».
 */
export const aujourdhuiAParis = (instant = new Date()) => {
  const parts = getZonedDateParts(instant);
  return [
    parts.year,
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
};

/**
 * L'heure de PARIS d'un instant, en minutes depuis minuit.
 * @param {Date} [instant] - L'instant.
 * @returns {number} Les minutes.
 */
export const minutesAParis = (instant = new Date()) => {
  const parts = getZonedDateParts(instant);
  return (parts.hour % 24) * 60 + parts.minute;
};

/**
 * « dimanche 19/10 » (carte d'une demande, E-G06).
 * @param {string} date - « AAAA-MM-JJ ».
 * @returns {string} Le jour.
 */
export const jourCourt = (date) => {
  const [, mois, jour] = String(date).split('-');
  const semaine = midi(date).toLocaleDateString(localeDesFormats(), { weekday: 'long' });
  return `${semaine} ${jour}/${mois}`;
};

/**
 * RESA-L5B-1 — « jeudi 19 h » (la confirmation « non honorée », plan E-G04 §4).
 * @param {string} date - « AAAA-MM-JJ ».
 * @param {unknown} de - L'heure de début, « HH:MM ».
 * @returns {string} Le jour et l'heure.
 */
export const quandCourt = (date, de) => [
  midi(date).toLocaleDateString(localeDesFormats(), { weekday: 'long' }),
  texteHeure(String(de || '')),
].filter(Boolean).join(' ');

/**
 * « Jeudi 16 octobre » (intertitre d'une liste, en-tête d'une fiche).
 * @param {string} date - « AAAA-MM-JJ ».
 * @returns {string} Le jour.
 */
export const titreDuJour = (date) => {
  const texte = midi(date).toLocaleDateString(localeDesFormats(), {
    day: 'numeric', month: 'long', weekday: 'long',
  });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

/**
 * « 10 h – 11 h ».
 * @param {unknown} de - « HH:MM ».
 * @param {unknown} a - « HH:MM ».
 * @returns {string} La plage.
 */
export const plageHoraire = (de, a) => (
  `${texteHeure(String(de || ''))} – ${texteHeure(String(a || ''))}`
);

/**
 * Les lignes d'une lecture par pages (`useInfiniteQuery` : `{ pages: [{ items }] }`).
 * @param {any} donnees - `data` de la lecture.
 * @returns {any[]} Les lignes, toutes pages réunies.
 */
export const lignesDesPages = (donnees) => (Array.isArray(donnees?.pages) ? donnees.pages : [])
  .flatMap((/** @type {any} */ page) => (Array.isArray(page?.items) ? page.items : []));

/**
 * Le nombre total d'une lecture par pages (le serveur le compte), ou null avant la 1re page.
 * @param {any} donnees - `data` de la lecture.
 * @returns {number | null} Le total.
 */
export const totalDesPages = (donnees) => {
  const total = Number(donnees?.pages?.[0]?.pagination?.total);
  return Number.isFinite(total) ? total : null;
};

/**
 * Une liste groupée par jour, dans l'ordre reçu (le serveur trie).
 * @template {{ date: string }} T
 * @param {T[]} items - Les lignes.
 * @returns {Array<{ date: string, items: T[] }>} Les groupes.
 */
export const grouperParJour = (items) => {
  /** @type {Array<{ date: string, items: T[] }>} */
  const groupes = [];
  items.forEach((item) => {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.date === item.date) dernier.items.push(item);
    else groupes.push({ date: item.date, items: [item] });
  });
  return groupes;
};

/**
 * « 12/10 à 21 h 04 », à l'heure de Paris.
 * @param {unknown} iso - L'instant.
 * @returns {string} Le texte, ou ''.
 */
const quand = (iso) => {
  if (!iso) return '';
  const instant = new Date(String(iso));
  if (Number.isNaN(instant.getTime())) return '';
  const parts = getZonedDateParts(instant);
  const deux = (/** @type {number} */ nombre) => String(nombre).padStart(2, '0');
  const heure = `${deux(parts.hour % 24)}:${deux(parts.minute)}`;
  return `${deux(parts.day)}/${deux(parts.month)} à ${texteHeure(heure)}`;
};

/**
 * L'historique de la fiche (E-G05) : des faits datés ; « par toi » pour le complexe, le nom court
 * pour le réserveur (jamais plus, `managerLabel` du serveur).
 * RESA-L5B-1 (20/10/2026) : « Marquée non honorée par toi » (`non-honoree`, RESA-L2B) et
 * « — hors délai » sur une annulation du réserveur après le délai (`late`, AT-07).
 * @param {Traduire} t - Traduction.
 * @param {Array<{ at: string | null, by?: string | null, kind: string,
 *   late?: boolean }>} etapes - `history`.
 * @param {{ reserveur: string }} noms - Le nom court du réserveur.
 * @returns {string[]} Les lignes.
 */
export const historiqueLisible = (t, etapes, { reserveur }) => (Array.isArray(etapes) ? etapes : [])
  .map((etape) => {
    const le = quand(etape?.at);
    if (!le) return '';
    const options = { le, ...SANS_ECHAPPEMENT };
    switch (etape.kind) {
      case 'acceptee':
        return t('complexeReservations.historique.acceptee', 'Acceptée par toi le {{le}}', options);
      case 'annulee':
        if (etape.by === 'complexe') {
          return t(
            'complexeReservations.historique.annuleeParToi',
            'Annulée par toi le {{le}}',
            options,
          );
        }
        return t(
          etape.late
            ? 'complexeReservations.historique.annuleeParHorsDelai'
            : 'complexeReservations.historique.annuleePar',
          etape.late
            ? 'Annulée par {{nom}} le {{le}} — hors délai'
            : 'Annulée par {{nom}} le {{le}}',
          {
            le,
            nom: reserveur || t('complexeReservations.historique.leJoueur', 'le joueur'),
            ...SANS_ECHAPPEMENT,
          },
        );
      case 'non-honoree':
        return t(
          'complexeReservations.historique.nonHonoree',
          'Marquée non honorée par toi le {{le}}',
          options,
        );
      case 'notee':
        return t('complexeReservations.historique.notee', 'Notée par toi le {{le}}', options);
      case 'refusee':
        return t('complexeReservations.historique.refusee', 'Refusée par toi le {{le}}', options);
      case 'reservee':
        return t(
          'complexeReservations.historique.reservee',
          'Réservée le {{le}} dans l’app',
          options,
        );
      case 'sans-reponse':
        return t('complexeReservations.historique.sansReponse', 'Sans réponse le {{le}}', options);
      default:
        return '';
    }
  })
  .filter(Boolean);

// ---------------------------------------------------------------------------------------------
// Le planning (E-G03)
// ---------------------------------------------------------------------------------------------

/** Les états d'un créneau que le serveur ne laisse pas « Bloquer » par-dessus. */
const ETATS_FERMES = Object.freeze(['bloque', 'ferme']);

/** L'état d'un créneau du serveur (`gestion.ts`, `stateOf`) dans le vocabulaire de la frise. */
const VERS_LA_FRISE = Object.freeze({
  bloque: 'bloque',
  'en-attente': 'attente',
  ferme: 'ferme',
  libre: 'libre',
  'reserve-app': 'app',
  'reserve-exterieur': 'exterieur',
});

/**
 * L'état d'un créneau pour la frise et la grille (`FriseDuJour`, `GrillePlanning`).
 * @param {unknown} etat - `libre | reserve-app | reserve-exterieur | en-attente | bloque | ferme`.
 * @returns {'app' | 'attente' | 'bloque' | 'exterieur' | 'ferme' | 'libre'} L'état.
 */
export const etatDeFrise = (etat) => /** @type {any} */ (VERS_LA_FRISE)[String(etat)] || 'libre';

/**
 * Le motif d'une fermeture ou d'un blocage : le nom donné, sinon le motif de la liste du serveur
 * (« travaux », « vacances », « manifestation »).
 * @param {Traduire} t - Traduction.
 * @param {any} fermeture - `closure` d'un créneau, ou une fermeture.
 * @returns {string} Le motif, ou ''.
 */
export const motifDeFermeture = (t, fermeture) => {
  const nom = String(fermeture?.label || '').trim();
  if (nom) return nom;
  switch (fermeture?.reason) {
    case 'manifestation':
      return t('complexeReservations.fermetures.motifManifestation', 'manifestation');
    case 'travaux':
      return t('complexeReservations.fermetures.motifTravaux', 'travaux');
    case 'vacances':
      return t('complexeReservations.fermetures.motifVacances', 'vacances');
    default:
      return '';
  }
};

/**
 * Ce qu'un créneau dit dans la grille : « Julien M. · App », « M. Dupont · Extérieur », « Lina T. ·
 * En attente », « Bloqué : entretien », « Fermé : travaux », « Libre ».
 * @param {Traduire} t - Traduction.
 * @param {any} creneau - Un créneau du planning.
 * @returns {string} Le libellé.
 */
export const libelleDuCreneau = (t, creneau) => {
  const nom = String(creneau?.reservation?.label || '');
  const motif = motifDeFermeture(t, creneau?.closure);
  const avecMotif = { motif, ...SANS_ECHAPPEMENT };
  switch (creneau?.state) {
    case 'bloque':
      return motif
        ? t('complexeReservations.planning.bloqueMotif', 'Bloqué : {{motif}}', avecMotif)
        : t('complexeReservations.planning.bloque', 'Bloqué');
    case 'en-attente':
      return `${nom} · ${t('complexeReservations.statut.enAttente', 'En attente')}`;
    case 'ferme':
      return motif
        ? t('complexeReservations.planning.fermeMotif', 'Fermé : {{motif}}', avecMotif)
        : t('complexeReservations.planning.ferme', 'Fermé');
    case 'reserve-app':
      return `${nom} · ${t('complexeReservations.source.app', 'App')}`;
    case 'reserve-exterieur':
      return `${nom} · ${t('complexeReservations.source.exterieur', 'Extérieur')}`;
    default:
      return t('complexeReservations.planning.libre', 'Libre');
  }
};

/**
 * « 12 – 18 octobre » ; « 28 septembre – 4 octobre » à cheval sur deux mois.
 * @param {string} lundi - Le premier jour, « AAAA-MM-JJ ».
 * @returns {string} La semaine.
 */
export const semaineLisible = (lundi) => {
  const dimanche = enJours(lundi, 6);
  const jourMois = { day: 'numeric', month: 'long' };
  const fin = midi(dimanche).toLocaleDateString(localeDesFormats(), /** @type {any} */ (jourMois));
  const memeMois = lundi.slice(0, 7) === dimanche.slice(0, 7);
  const debut = memeMois
    ? String(midi(lundi).getDate())
    : midi(lundi).toLocaleDateString(localeDesFormats(), /** @type {any} */ (jourMois));
  return `${debut} – ${fin}`;
};

/**
 * « Bloquer à partir d'ici » (E-G03 état 4, le repli accessible du glisser) : depuis un créneau
 * LIBRE, les heures de fin possibles, créneau après créneau tant qu'ils se suivent et qu'aucun
 * n'est déjà bloqué ou fermé. Un créneau réservé dans la plage est GARDÉ par le serveur (un blocage
 * n'annule rien) : il est compté à part.
 * @param {any[]} creneaux - Les créneaux d'un terrain, un jour.
 * @param {string} depuis - L'heure de début du créneau touché, « HH:MM ».
 * @returns {Array<{ bloques: number, gardes: number, to: string }>} Les fins possibles.
 */
export const finsPossibles = (creneaux, depuis) => {
  const tries = [...creneaux].sort((a, b) => String(a.from).localeCompare(String(b.from)));
  const index = tries.findIndex((creneau) => creneau.from === depuis);
  if (index < 0 || tries[index].state !== 'libre') return [];
  /** @type {Array<{ bloques: number, gardes: number, to: string }>} */
  const fins = [];
  let bloques = 0;
  let gardes = 0;
  for (let i = index; i < tries.length; i += 1) {
    const creneau = tries[i];
    const suit = i === index || creneau.from === tries[i - 1].to;
    if (!suit || ETATS_FERMES.includes(creneau.state)) break;
    if (creneau.state === 'libre') bloques += 1;
    else gardes += 1;
    fins.push({ bloques, gardes, to: creneau.to });
  }
  return fins;
};

// ---------------------------------------------------------------------------------------------
// L'accueil (E-G02) : la frise, les chiffres, les prochaines réservations, « Hier »
// ---------------------------------------------------------------------------------------------

/** Les créneaux qu'une réservation (ou une demande, AT-08) occupe. */
const ETATS_OCCUPES = Object.freeze(['en-attente', 'reserve-app', 'reserve-exterieur']);

/**
 * Les créneaux d'un terrain, un jour, dans le planning du serveur.
 * @param {any} terrain - Une ligne `terrains[]` du planning.
 * @param {string} date - « AAAA-MM-JJ ».
 * @returns {any[]} Les créneaux.
 */
const creneauxDe = (terrain, date) => {
  const jours = Array.isArray(terrain?.days) ? terrain.days : [];
  const jour = jours.find((/** @type {any} */ d) => d?.date === date);
  return Array.isArray(jour?.slots) ? jour.slots : [];
};

/**
 * Les heures « HH:MM » d'un créneau (son modèle, sinon ses instants à Paris : une réservation hors
 * du modèle n'a pas d'heures de modèle).
 * @param {any} creneau - Le créneau.
 * @returns {{ from: string, to: string }} Les heures.
 */
const heuresDe = (creneau) => ({
  from: creneau?.from || heureDe(minutesAParis(new Date(creneau?.startsAt))),
  to: creneau?.to || heureDe(minutesAParis(new Date(creneau?.endsAt))),
});

/**
 * Les lignes de la frise « Aujourd'hui » (E-G02 bloc 3) depuis le planning : chaque créneau avec
 * son état et, pour une réservation, son nom et son identifiant (la toucher ouvre sa fiche).
 * @param {Traduire} t - Traduction.
 * @param {any} planning - `{ terrains }` du serveur.
 * @param {string} date - Le jour.
 * @returns {Array<{ cle: string, creneaux: any[], nom: string }>} Les lignes (sans couleur).
 */
export const lignesDeLaFrise = (t, planning, date) => (
  Array.isArray(planning?.terrains) ? planning.terrains : []
)
  .map((/** @type {any} */ terrain) => ({
    cle: String(terrain.documentId),
    creneaux: creneauxDe(terrain, date).map((/** @type {any} */ creneau) => {
      const etat = etatDeFrise(creneau.state);
      const libelle = creneau.reservation?.label || libelleDuCreneau(t, creneau);
      return {
        ...heuresDe(creneau),
        etat,
        ...(etat === 'libre' ? {} : { libelle }),
        reservationId: creneau.reservation?.documentId || null,
      };
    }),
    nom: String(terrain.name || ''),
  }))
  .filter((/** @type {any} */ ligne) => ligne.creneaux.length > 0);

/**
 * Les chiffres de l'accueil (RC-G01) tirés du planning de la semaine : les réservations du jour,
 * l'occupation de la semaine (minutes occupées sur minutes OUVERTES : un créneau fermé ou bloqué
 * n'est pas offert), et les réservations d'hier (l'alerte « Hier : … »).
 * ponytail: calculé sur le téléphone à partir du planning (8 jours au plus). Plafond : le taux
 * suit le modèle de créneaux, pas les horaires d'ouverture du complexe (plan E-G02 §8). Voie de
 * sortie : la lecture serveur « accueil du complexe » prévue par le plan, branchée ici.
 * @param {any} planning - `{ terrains }` du serveur, du lundi (ou d'hier) au dimanche.
 * @param {string} date - Aujourd'hui.
 * @returns {{ hier: number, occupation: number, reservations: number }} Les chiffres.
 */
export const chiffresDuPlanning = (planning, date) => {
  const terrains = Array.isArray(planning?.terrains) ? planning.terrains : [];
  const occupesLe = (
    /** @type {string} */ jour,
    /** @type {ReadonlyArray<string>} */ etats,
  ) => terrains
    .flatMap((/** @type {any} */ terrain) => creneauxDe(terrain, jour))
    .filter((/** @type {any} */ creneau) => etats.includes(creneau.state)).length;
  const duree = (/** @type {any} */ creneau) => {
    const debut = new Date(creneau.startsAt).getTime();
    const fin = new Date(creneau.endsAt).getTime();
    const valide = Number.isFinite(debut) && Number.isFinite(fin) && fin > debut;
    return valide ? (fin - debut) / 60000 : 0;
  };
  let ouvertes = 0;
  let occupees = 0;
  joursDeLaSemaine(date).forEach((jour) => {
    const duJour = terrains.flatMap((/** @type {any} */ terrain) => creneauxDe(terrain, jour));
    duJour.forEach((/** @type {any} */ creneau) => {
      if (ETATS_FERMES.includes(creneau.state)) return;
      ouvertes += duree(creneau);
      if (ETATS_OCCUPES.includes(creneau.state)) occupees += duree(creneau);
    });
  });
  return {
    hier: occupesLe(enJours(date, -1), ['reserve-app', 'reserve-exterieur']),
    occupation: ouvertes ? Math.round((100 * occupees) / ouvertes) : 0,
    reservations: occupesLe(date, ETATS_OCCUPES),
  };
};

/**
 * « Prochaines réservations » (E-G02 bloc 5) : les 3 prochaines, demandes comprises (elles tiennent
 * le créneau), d'aujourd'hui puis des jours suivants.
 * @param {any[]} lignes - Les lignes des vues « aujourd'hui » et « à venir ».
 * @param {Date} maintenant - L'instant.
 * @returns {any[]} Les 3 prochaines.
 */
export const prochainesReservations = (lignes, maintenant) => lignes
  .filter((ligne) => STATUTS_ACTIFS.includes(ligne?.status)
    && new Date(ligne?.startsAt).getTime() > maintenant.getTime())
  .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)))
  .slice(0, 3);

// ---------------------------------------------------------------------------------------------
// Les fermetures (E-G10)
// ---------------------------------------------------------------------------------------------

/**
 * Les motifs d'une fermeture (planche EG10 : Travaux · Jour férié · Météo · Autre) et ce qu'ils
 * envoient : le serveur connaît `travaux | vacances | manifestation | autre` ; « Jour férié » et
 * « Météo » partent en « autre » avec leur NOM (`label`, 40 caractères au plus), que le joueur lit
 * dans la notification (« Fermeture (Météo) »).
 * @type {ReadonlyArray<{ cle: string, corps: (t: Traduire) =>
 *   { label?: string, reason: string }, texte: (t: Traduire) =>
 *   string }>}
 */
export const MOTIFS_DE_FERMETURE = Object.freeze([
  {
    cle: 'travaux',
    corps: () => ({ reason: 'travaux' }),
    texte: (t) => t('complexeReservations.fermetures.travaux', 'Travaux'),
  },
  {
    cle: 'ferie',
    corps: (t) => ({
      label: t('complexeReservations.fermetures.ferie', 'Jour férié'), reason: 'autre',
    }),
    texte: (t) => t('complexeReservations.fermetures.ferie', 'Jour férié'),
  },
  {
    cle: 'meteo',
    corps: (t) => ({ label: t('complexeReservations.fermetures.meteo', 'Météo'), reason: 'autre' }),
    texte: (t) => t('complexeReservations.fermetures.meteo', 'Météo'),
  },
  {
    cle: 'autre',
    corps: () => ({ reason: 'autre' }),
    texte: (t) => t('complexeReservations.motifs.autre', 'Autre'),
  },
]);

/**
 * La première lettre en capitale (« travaux » ⇒ « Travaux »).
 * @param {string} texte - Le texte.
 * @returns {string} Le texte.
 */
const majuscule = (texte) => (texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : '');

/**
 * « 25/10/2026 » (le champ de date de l'app) en « 2026-10-25 ».
 * @param {unknown} saisie - La date saisie.
 * @returns {string} Le jour, ou '' s'il est illisible.
 */
export const versJourIso = (saisie) => {
  const morceaux = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(saisie || '').trim());
  return morceaux ? `${morceaux[3]}-${morceaux[2]}-${morceaux[1]}` : '';
};

/**
 * « 25/10 – 26/10 », ou « 25/10 » pour un seul jour.
 * @param {string} debut - « AAAA-MM-JJ ».
 * @param {string} fin - « AAAA-MM-JJ ».
 * @returns {string} Les jours.
 */
export const joursLisibles = (debut, fin) => {
  const court = (/** @type {string} */ jour) => `${jour.slice(8, 10)}/${jour.slice(5, 7)}`;
  return debut === fin ? court(debut) : `${court(debut)} – ${court(fin)}`;
};

/**
 * Les fermetures à venir d'un complexe, regroupées : une fermeture PAR terrain côté serveur, une
 * ligne par geste à l'écran (« 25/10 – 26/10 · Travaux · Terrain 1, Terrain 2 »). Les blocages
 * (une plage d'heures) vivent dans le planning, pas ici.
 * @param {Traduire} t - Traduction.
 * @param {any[]} fermetures - Les fermetures (`terrainId` ajouté par le service).
 * @param {any[]} terrains - Les terrains (leurs noms).
 * @param {string} aujourdhui - « AAAA-MM-JJ ».
 * @returns {Array<{ cle: string, debut: string, enCours: boolean, fin: string, ids: string[],
 *   motif: string, terrains: string[] }>} Les lignes, la plus proche d'abord.
 */
export const regrouperFermetures = (t, fermetures, terrains, aujourdhui) => {
  /** @type {Map<string, any>} */
  const groupes = new Map();
  fermetures
    .filter((fermeture) => fermeture?.kind === 'closure' && fermeture?.status !== 'reopened')
    .forEach((fermeture) => {
      const cle = [
        fermeture.startDate, fermeture.endDate, fermeture.reason, fermeture.label || '',
      ].join('|');
      const nom = terrains.find((terrain) => terrain.documentId === fermeture.terrainId)?.name;
      const groupe = groupes.get(cle) || {
        cle,
        debut: fermeture.startDate,
        enCours: fermeture.startDate <= aujourdhui,
        fin: fermeture.endDate,
        ids: [],
        motif: majuscule(motifDeFermeture(t, fermeture))
          || t('complexeReservations.motifs.autre', 'Autre'),
        terrains: [],
      };
      groupe.ids.push(fermeture.documentId);
      if (nom) groupe.terrains.push(String(nom));
      groupes.set(cle, groupe);
    });
  return [...groupes.values()].sort((a, b) => a.debut.localeCompare(b.debut));
};

/**
 * Le nom court d'un réserveur : prénom et initiale (« Julien M. »), la règle du serveur
 * (`bookerLabel`).
 * @param {{ firstname?: string | null, lastname?: string | null } | null | undefined} personne - Le
 *   réserveur.
 * @returns {string} Le nom court, ou ''.
 */
export const nomCourt = (personne) => {
  const prenom = String(personne?.firstname || '').trim();
  const nom = String(personne?.lastname || '').trim();
  if (!prenom) return nom ? `${nom.charAt(0).toUpperCase()}.` : '';
  return nom ? `${prenom} ${nom.charAt(0).toUpperCase()}.` : prenom;
};

/**
 * Les initiales d'un réserveur (l'avatar de la fiche) : « JM ».
 * @param {{ firstname?: string | null, lastname?: string | null } | null | undefined} personne - Le
 *   réserveur.
 * @returns {string} Les initiales, ou ''.
 */
export const initialesDe = (personne) => [personne?.firstname, personne?.lastname]
  .map((morceau) => String(morceau || '').trim().charAt(0).toUpperCase())
  .join('');

/**
 * Un numéro français en « 06 39 98 56 78 » ; un autre reste tel quel.
 * @param {unknown} numero - Le numéro (E.164 le plus souvent).
 * @returns {string} Le numéro lisible.
 */
export const telephoneLisible = (numero) => {
  const brut = String(numero || '').replace(/\s+/g, '');
  const national = brut.startsWith('+33') ? `0${brut.slice(3)}` : brut;
  if (!/^0\d{9}$/.test(national)) return String(numero || '');
  return national.match(/\d{2}/g)?.join(' ') || national;
};

/**
 * Les motifs d'un refus en un appui (E-G05 état 3, modèle `DecisionCreneauModal`) : ils remplissent
 * le champ, qu'on peut compléter. « Autre » laisse le champ vide.
 * @type {ReadonlyArray<{ cle: string,
 *   texte: (t: Traduire) => string }>}
 */
export const MOTIFS_DE_REFUS = Object.freeze([
  {
    cle: 'dejaPris',
    texte: (t) => t('complexeReservations.motifs.dejaPris', 'Créneau déjà pris à l’extérieur'),
  },
  { cle: 'fermeture', texte: (t) => t('complexeReservations.motifs.fermeture', 'Fermeture') },
  {
    cle: 'indisponible',
    texte: (t) => t('complexeReservations.motifs.indisponible', 'Terrain indisponible'),
  },
  { cle: 'autre', texte: (t) => t('complexeReservations.motifs.autre', 'Autre') },
]);

/**
 * Le refus du serveur, NOMMÉ (codes du contrat L2A), puis ceux du complexe (L5A1,
 * `messageDeRefus`).
 * Un refus d'état ou de saisie garde la phrase précise du serveur (déjà au « tu »).
 * @param {Traduire} t - Traduction.
 * @param {any} erreur - Le refus.
 * @param {string} repli - La phrase de l'écran.
 * @returns {string} La phrase à afficher.
 */
export const messageDeRefusResa = (t, erreur, repli) => {
  switch (getServerErrorCode(erreur)) {
    // RESA-L5B-1 — E-G15 : un compte qui n'a jamais réservé ici (le serveur n'énumère pas les
    // comptes).
    case 'COMPLEXE_CLIENT_NOT_FOUND':
      return t('complexeClients.fiche.jamaisVenu', 'Ce joueur n’a jamais réservé chez toi.');
    case 'COMPLEXE_RESERVATION_INVALID':
    case 'COMPLEXE_RESERVATION_STATE':
    case 'FACILITY_CLOSURE_INVALID_PAYLOAD':
      return String(erreur?.message || '').trim() || repli;
    case 'COMPLEXE_RESERVATION_NOT_FOUND':
      return t('complexeReservations.refus.introuvable', 'Cette réservation n’existe plus.');
    case 'COMPLEXE_RESERVATION_SLOT_CLOSED':
      return t('complexeReservations.refus.creneauFerme', 'Ce créneau est fermé.');
    case 'COMPLEXE_RESERVATION_SLOT_TAKEN':
      return t('complexeReservations.refus.creneauPris', 'Ce créneau vient d’être pris.');
    case 'FACILITY_CLOSURE_ALREADY_REOPENED':
      return t('complexeReservations.refus.dejaRouverte', 'Cette fermeture est déjà rouverte.');
    case 'FACILITY_CLOSURE_MANAGER_REQUIRED':
      return t('complexeReservations.refus.pasTonTerrain', 'Tu ne gères pas ce terrain.');
    default:
      return messageDeRefus(t, erreur, repli);
  }
};
