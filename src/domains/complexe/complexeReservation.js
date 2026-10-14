import { messageDeRefus } from '@/domains/complexe/complexeGerant';
import { texteHeure } from '@/domains/complexe/complexeTerrain';
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

const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/**
 * Le libellé d'un état (plan §1.2).
 * @param {(cle: string, defaut: string, options?: any) => string} t - Traduction.
 * @param {unknown} statut - L'état du serveur.
 * @returns {string} Le libellé, ou '' pour un état inconnu.
 */
export const libelleStatut = (t, statut) => {
  switch (statut) {
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
 * « Expire dans 5 h » (E-G06) : en minutes sous l'heure, en heures sous le jour, en jours au-delà.
 * @param {(cle: string, defaut: string, options?: any) => string} t - Traduction.
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
 * @param {(cle: string, defaut: string, options?: any) => string} t - Traduction.
 * @param {Array<{ at: string | null, by?: string | null, kind: string }>} etapes - `history`.
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
        return t('complexeReservations.historique.annuleePar', 'Annulée par {{nom}} le {{le}}', {
          ...options,
          nom: reserveur || t('complexeReservations.historique.leJoueur', 'le joueur'),
        });
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
 * @param {(cle: string, defaut: string) => string} t - Traduction.
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
 * @param {(cle: string, defaut: string, options?: any) => string} t - Traduction.
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
 *   texte: (t: (cle: string, defaut: string) => string) => string }>}
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
 * @param {(cle: string, defaut: string) => string} t - Traduction.
 * @param {any} erreur - Le refus.
 * @param {string} repli - La phrase de l'écran.
 * @returns {string} La phrase à afficher.
 */
export const messageDeRefusResa = (t, erreur, repli) => {
  switch (getServerErrorCode(erreur)) {
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
