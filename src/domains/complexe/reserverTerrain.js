import { formatEuros, lignesDePrix, texteHeure } from '@/domains/complexe/complexeTerrain';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getErrorStatus, getServerErrorCode } from '@/utils/errors/displayError';
import { getZonedDateParts } from '@/utils/parisTime';

/**
 * @typedef {any} Traduire - La traduction (TFunction d'i18next, qui ne se réduit pas à une
 *   signature simple ; même choix que complexeTerrain.js).
 */

/**
 * RÉSERVER UN TERRAIN, CÔTÉ JOUEUR — RESA-L6A (14/10/2026), chantier Réservation.
 *
 * Les règles PURES que partagent les écrans du joueur (plan des écrans E-P01 à E-P07 et E-P13 ;
 * planches P00 blocs 3 à 8, EP01-EP07, EP13, RA1, RA2) : le jour civil DE PARIS (le serveur
 * raisonne en heure de Paris, `parisDate`), les 14 jours de E-P03, les mots d'un créneau, d'un
 * mode et d'un prix, les filtres de la recherche, le corps de « Réserver » (la liste blanche du
 * serveur, `readBookingPayload`, et rien d'autre), et chaque refus du serveur NOMMÉ (contrat L1 +
 * L2A : le code est dans `error.details.code`).
 *
 * Le serveur reste le SEUL juge (RG-SECU) : il recalcule le prix, le mode, l'état, l'âge, le
 * plafond ; l'app ne fait que dire ce qu'il a décidé.
 *
 * Témoin : `reserverTerrain.test.js`.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;
const RECHERCHE_MIN = 2;
const RECHERCHE_MAX = 60;
const MOT_MAX = 140;
const HORS_CONNEXION = new Set(['ECONNABORTED', 'ERR_NETWORK', 'REQUEST_TIMEOUT_ABANDONED']);

/**
 * Les noms des jours (0 = dimanche, comme `getUTCDay`). Un appel `t()` par nom : le repli
 * français reste traduisible (porte `i18n:no-regression`).
 * @param {Traduire} t - Traduction.
 * @returns {string[]} « Dimanche » … « Samedi ».
 */
const nomsDesJours = (t) => [
  t('reserverTerrain.jours.dimanche', 'Dimanche'),
  t('reserverTerrain.jours.lundi', 'Lundi'),
  t('reserverTerrain.jours.mardi', 'Mardi'),
  t('reserverTerrain.jours.mercredi', 'Mercredi'),
  t('reserverTerrain.jours.jeudi', 'Jeudi'),
  t('reserverTerrain.jours.vendredi', 'Vendredi'),
  t('reserverTerrain.jours.samedi', 'Samedi'),
];

/**
 * Les noms courts des jours (0 = dimanche).
 * @param {Traduire} t - Traduction.
 * @returns {string[]} « Dim. » … « Sam. ».
 */
const nomsCourtsDesJours = (t) => [
  t('reserverTerrain.joursCourts.dimanche', 'Dim.'),
  t('reserverTerrain.joursCourts.lundi', 'Lun.'),
  t('reserverTerrain.joursCourts.mardi', 'Mar.'),
  t('reserverTerrain.joursCourts.mercredi', 'Mer.'),
  t('reserverTerrain.joursCourts.jeudi', 'Jeu.'),
  t('reserverTerrain.joursCourts.vendredi', 'Ven.'),
  t('reserverTerrain.joursCourts.samedi', 'Sam.'),
];

/**
 * Les noms des mois (0 = janvier).
 * @param {Traduire} t - Traduction.
 * @returns {string[]} « janvier » … « décembre ».
 */
const nomsDesMois = (t) => [
  t('reserverTerrain.mois.janvier', 'janvier'),
  t('reserverTerrain.mois.fevrier', 'février'),
  t('reserverTerrain.mois.mars', 'mars'),
  t('reserverTerrain.mois.avril', 'avril'),
  t('reserverTerrain.mois.mai', 'mai'),
  t('reserverTerrain.mois.juin', 'juin'),
  t('reserverTerrain.mois.juillet', 'juillet'),
  t('reserverTerrain.mois.aout', 'août'),
  t('reserverTerrain.mois.septembre', 'septembre'),
  t('reserverTerrain.mois.octobre', 'octobre'),
  t('reserverTerrain.mois.novembre', 'novembre'),
  t('reserverTerrain.mois.decembre', 'décembre'),
];

/**
 * Les heures « Avant 12 h », « 12 h – 18 h », « Après 18 h » de la feuille des filtres (EP01
 * état 4) : le serveur ne sait filtrer que par « après » (`apres=HH:MM`). « Avant 12 h » se lit
 * donc dans la liste rendue (créneaux avant midi), « 12 h – 18 h » part de midi.
 * ponytail: plafond : « avant » n'est pas un filtre du serveur ; voie de sortie : un paramètre
 * `avant` dans `GET /public-complexes` (lot serveur), l'écran filtrerait moins.
 */
export const HEURES_DE_RECHERCHE = Object.freeze({
  apresMidi: { apres: '12:00', avant: 18 * 60 },
  matin: { apres: null, avant: 12 * 60 },
  soir: { apres: '18:00', avant: null },
});

/** Les distances proposées (EP01 état 4) ; le serveur borne à 50 km. */
export const DISTANCES_DE_RECHERCHE = Object.freeze([5, 10, 20]);

// ---------------------------------------------------------------------------------------------
// Les jours (le jour civil de Paris)
// ---------------------------------------------------------------------------------------------

const deuxChiffres = (/** @type {number} */ nombre) => String(nombre).padStart(2, '0');

/**
 * Le jour civil de Paris d'un instant : « AAAA-MM-JJ » (le « aujourd'hui » du complexe).
 * @param {Date} [instant] - L'instant (maintenant par défaut).
 * @returns {string} La date.
 */
export const jourDeParis = (instant = new Date()) => {
  const parts = getZonedDateParts(instant, 'Europe/Paris');
  return `${parts.year}-${deuxChiffres(parts.month)}-${deuxChiffres(parts.day)}`;
};

/**
 * Une date civile « AAAA-MM-JJ » en midi UTC (jamais à cheval sur deux jours).
 * @param {string} date - La date.
 * @returns {Date} L'instant.
 */
const midi = (date) => new Date(`${date}T12:00:00Z`);

/**
 * Ajoute des jours à une date civile.
 * @param {string} date - « AAAA-MM-JJ ».
 * @param {number} jours - Le nombre de jours.
 * @returns {string} La date.
 */
export const ajouterJours = (date, jours) => {
  const instant = new Date(midi(date).getTime() + jours * JOUR_MS);
  const mois = deuxChiffres(instant.getUTCMonth() + 1);
  return `${instant.getUTCFullYear()}-${mois}-${deuxChiffres(instant.getUTCDate())}`;
};

/**
 * Le nom d'un jour de la semaine.
 * @param {Traduire} t - Traduction.
 * @param {number} indice - 0 = dimanche.
 * @returns {string} « Mardi ».
 */
const nomDuJour = (t, indice) => nomsDesJours(t)[indice];

/**
 * Les 14 jours de E-P03 : « Auj. 14 », « Mer. 15 »…
 * @param {Traduire} t - Traduction.
 * @param {string} aujourdhui - « AAAA-MM-JJ » (le jour de Paris).
 * @returns {Array<{ court: string, date: string, numero: number }>} Les jours.
 */
export const quatorzeJours = (t, aujourdhui) => Array.from({ length: 14 }, (_, decalage) => {
  const date = ajouterJours(aujourdhui, decalage);
  const instant = midi(date);
  const indice = instant.getUTCDay();
  return {
    court: decalage === 0
      ? t('reserverTerrain.jours.aujourdhuiCourt', 'Auj.')
      : nomsCourtsDesJours(t)[indice],
    date,
    numero: instant.getUTCDate(),
  };
});

/**
 * « Mardi 14 octobre » (E-P03, E-P04, E-P07).
 * @param {Traduire} t - Traduction.
 * @param {string} date - « AAAA-MM-JJ ».
 * @returns {string} Le jour en toutes lettres, ou ''.
 */
export const texteJourLong = (t, date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  const instant = midi(date);
  const mois = instant.getUTCMonth();
  return t('reserverTerrain.jours.long', '{{jour}} {{numero}} {{mois}}', {
    jour: nomDuJour(t, instant.getUTCDay()),
    mois: nomsDesMois(t)[mois],
    numero: instant.getUTCDate(),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * « Mardi 14/10 » (E-P03 pied, E-P05, E-P13).
 * @param {Traduire} t - Traduction.
 * @param {string} date - « AAAA-MM-JJ ».
 * @returns {string} Le jour court, ou ''.
 */
export const texteJourCourt = (t, date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  const [, mois, jour] = String(date).split('-');
  return t('reserverTerrain.jours.court', '{{jour}} {{numero}}/{{mois}}', {
    jour: nomDuJour(t, midi(date).getUTCDay()),
    mois,
    numero: jour,
    ...SANS_ECHAPPEMENT,
  });
};

// ---------------------------------------------------------------------------------------------
// Un créneau, un mode, un prix
// ---------------------------------------------------------------------------------------------

/**
 * « 18 h – 19 h » (P00 bloc 3).
 * @param {unknown} debut - « HH:MM ».
 * @param {unknown} fin - « HH:MM ».
 * @returns {string} Le créneau lisible.
 */
export const texteCreneau = (debut, fin) => [texteHeure(debut), texteHeure(fin)]
  .filter(Boolean)
  .join(' – ');

/**
 * L'état d'un créneau, au mot du joueur (P00 bloc 3) : il ne voit jamais QUI a réservé, ni
 * pourquoi un créneau est pris (D7) — seulement s'il peut le prendre.
 * @param {Traduire} t - Traduction.
 * @param {unknown} etat - `libre | pris | ferme | trop-tard`.
 * @returns {string} Le mot.
 */
export const libelleEtatDuCreneau = (t, etat) => {
  switch (etat) {
    case 'ferme':
      return t('reserverTerrain.creneau.ferme', 'Fermé');
    case 'libre':
      return t('reserverTerrain.creneau.libre', 'Libre');
    case 'pris':
      return t('reserverTerrain.creneau.pris', 'Pris');
    case 'trop-tard':
      return t('reserverTerrain.creneau.tropTard', 'Trop tard ici');
    default:
      return '';
  }
};

/**
 * Le mode d'un terrain, côté JOUEUR (P00 bloc 5) : une configuration, pas un état.
 * @param {Traduire} t - Traduction.
 * @param {unknown} mode - `automatique | manuel | telephone`.
 * @returns {string} Le libellé, ou ''.
 */
export const libelleModeJoueur = (t, mode) => {
  switch (mode) {
    case 'automatique':
      return t('reserverTerrain.mode.automatique', 'Confirmation immédiate');
    case 'manuel':
      return t('reserverTerrain.mode.manuel', 'Sur demande');
    case 'telephone':
      return t('reserverTerrain.mode.telephone', 'Par téléphone');
    default:
      return '';
  }
};

/**
 * Le prix d'UN créneau (`{ amount, perPlayer, unit }` du serveur), en deux lignes (RA2, A-G28) :
 * « 60 € le créneau » puis « soit 6 € par joueur à 10 » ; ou « 6 € par joueur » puis « 24 € pour
 * 4 joueurs ». Jamais un total à payer (D4).
 * @param {Traduire} t - Traduction.
 * @param {{ amount?: number | null, perPlayer?: number | null, unit?: string | null } | null
 *   | undefined} prix - Le prix du serveur.
 * @param {unknown} capacite - Le nombre de joueurs du terrain.
 * @returns {{ principal: string, secondaire: string | null } | null} Les deux lignes, ou null.
 */
export const prixDuCreneau = (t, prix, capacite) => {
  if (!prix || prix.amount === null || prix.amount === undefined) return null;
  return lignesDePrix(t, {
    basePrice: prix.amount,
    capacity: Number(capacite) > 0 ? Number(capacite) : null,
    priceUnit: prix.unit === 'joueur' ? 'joueur' : 'creneau',
  });
};

/**
 * Le prix d'un terrain sur la page du complexe (E-P02, P00 bloc 5 « Joueur ») : « 60 €, à régler
 * sur place » ; si le complexe a plusieurs tarifs (`price.min < price.max`), « dès 50 € ».
 * @param {Traduire} t - Traduction.
 * @param {{ price?: { max?: number, min?: number, unit?: string } | null }} terrain - Le terrain
 *   public (`GET /public-complexes/:slug/terrains`).
 * @returns {string} Le prix lisible, ou '' sans prix.
 */
export const prixDuTerrainPublic = (t, terrain) => {
  const prix = terrain?.price;
  if (!prix || prix.min === null || prix.min === undefined || !Number.isFinite(Number(prix.min))) {
    return '';
  }
  const montant = formatEuros(Number(prix.min));
  let base = montant;
  if (prix.unit === 'joueur') {
    base = t('reserverTerrain.prix.parJoueur', '{{prix}} par joueur', {
      prix: montant,
      ...SANS_ECHAPPEMENT,
    });
  }
  const debut = Number(prix.max) > Number(prix.min)
    ? t('reserverTerrain.prix.des', 'dès {{prix}}', { prix: base, ...SANS_ECHAPPEMENT })
    : base;
  return t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
    prix: debut,
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * Le prix d'un terrain sur la page du complexe, en deux lignes (RA2, A-G28) : « 60 € le créneau »
 * puis « soit 6 € par joueur à 10, à régler sur place » ; « par joueur » puis le prix du terrain
 * plein. Plusieurs tarifs (`price.min < price.max`) : « dès … ». Jamais un total à payer (D4).
 * @param {Traduire} t - Traduction.
 * @param {{ capacity?: number | null, price?: { max?: number, min?: number, unit?: string }
 *   | null }} terrain - Le terrain public.
 * @returns {{ principal: string, secondaire: string } | null} Les deux lignes, ou null.
 */
export const lignesDuTerrainPublic = (t, terrain) => {
  const prix = terrain?.price;
  if (!prix || !Number.isFinite(Number(prix.min))) return null;
  const lignes = lignesDePrix(t, {
    basePrice: Number(prix.min),
    capacity: Number(terrain?.capacity) > 0 ? Number(terrain?.capacity) : null,
    priceUnit: prix.unit === 'joueur' ? 'joueur' : 'creneau',
  });
  if (!lignes) return null;
  const principal = Number(prix.max) > Number(prix.min)
    ? t('reserverTerrain.prix.des', 'dès {{prix}}', { prix: lignes.principal, ...SANS_ECHAPPEMENT })
    : lignes.principal;
  const secondaire = lignes.secondaire
    ? t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
      prix: lignes.secondaire,
      ...SANS_ECHAPPEMENT,
    })
    : t('reserverTerrain.prix.aReglerSurPlace', 'à régler sur place');
  return { principal, secondaire };
};

/**
 * Les horaires d'accueil d'un complexe (`openingHours` : `[{ day 1-7, ranges [{ from, to }] }]`),
 * en lignes : les jours qui se suivent avec les mêmes heures vont ensemble (« Lundi – Vendredi »,
 * « 17 h – 23 h »).
 * @param {Traduire} t - Traduction.
 * @param {unknown} horaires - Les horaires du complexe.
 * @returns {Array<{ heures: string, jours: string }>} Les lignes.
 */
export const horairesLisibles = (t, horaires) => {
  const jours = nomsDesJours(t);
  // 1 = lundi … 7 = dimanche ; `nomsDesJours` commence au dimanche.
  const nomDuJourIso = (/** @type {number} */ jour) => jours[jour % 7];
  const lignes = (Array.isArray(horaires) ? horaires : [])
    .filter((jour) => Number.isInteger(jour?.day) && jour.day >= 1 && jour.day <= 7)
    .sort((a, b) => a.day - b.day)
    .map((jour) => ({
      day: jour.day,
      heures: (Array.isArray(jour.ranges) ? jour.ranges : [])
        .map((/** @type {any} */ plage) => texteCreneau(plage?.from, plage?.to))
        .filter(Boolean)
        .join(', '),
    }))
    .filter((jour) => jour.heures);
  /** @type {Array<{ debut: number, fin: number, heures: string }>} */
  const groupes = [];
  lignes.forEach((jour) => {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.heures === jour.heures && dernier.fin === jour.day - 1) {
      dernier.fin = jour.day;
    } else {
      groupes.push({ debut: jour.day, fin: jour.day, heures: jour.heures });
    }
  });
  return groupes.map((groupe) => ({
    heures: groupe.heures,
    jours: groupe.debut === groupe.fin
      ? nomDuJourIso(groupe.debut)
      : `${nomDuJourIso(groupe.debut)} – ${nomDuJourIso(groupe.fin)}`,
  }));
};

/**
 * Le délai d'annulation d'un complexe en mots (E-P02 bloc « Règles », E-P04).
 * @param {Traduire} t - Traduction.
 * @param {unknown} heures - `cancellationDelayHours` (0 à 48).
 * @returns {string} « Annulation gratuite jusqu'à 24 h avant ».
 */
export const texteAnnulation = (t, heures) => (Number(heures) > 0
  ? t('reserverTerrain.regles.annulation', 'Annulation gratuite jusqu’à {{heures}} h avant', {
    heures: Number(heures),
  })
  : t(
    'reserverTerrain.regles.annulationJusquauDebut',
    'Annulation gratuite jusqu’au début du créneau',
  ));

/**
 * Un numéro français lisible : « +33639981234 » ⇒ « 06 39 98 12 34 » (le serveur garde le format
 * E.164). Un numéro étranger ou inattendu reste tel quel.
 * @param {unknown} numero - Le numéro.
 * @returns {string} Le numéro à afficher, ou ''.
 */
export const numeroLisible = (numero) => {
  const brut = String(numero || '').replace(/[\s.-]/g, '');
  const francais = /^\+33([1-9]\d{8})$/.exec(brut);
  const chiffres = francais ? `0${francais[1]}` : brut;
  if (!/^0[1-9]\d{8}$/.test(chiffres)) return String(numero || '').trim();
  return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ');
};

/**
 * Une distance en kilomètres : « 2,4 km », « 600 m ».
 * @param {unknown} kilometres - La distance.
 * @returns {string} Le texte, ou ''.
 */
export const texteKilometres = (kilometres) => {
  if (kilometres === null || kilometres === undefined || kilometres === '') return '';
  const valeur = Number(kilometres);
  if (!Number.isFinite(valeur)) return '';
  if (valeur < 1) return `${Math.round(valeur * 1000)} m`;
  return `${valeur.toFixed(1).replace('.', ',')} km`;
};

// ---------------------------------------------------------------------------------------------
// La recherche (E-P01) et « Réserver » (E-P04)
// ---------------------------------------------------------------------------------------------

/**
 * Les filtres de l'écran au format de `GET /public-complexes` : seuls ceux qui sont choisis
 * partent (le serveur refuse un filtre mal formé). Le rayon ne part qu'avec une position.
 * @param {{ cadre?: string | null, date?: string | null, distanceKm?: number | null,
 *   heure?: 'matin' | 'apresMidi' | 'soir' | null, position?: { lat: number, lng: number } | null,
 *   sport?: string | null, texte?: string | null }} choix - Ce que l'écran a choisi.
 * @returns {Record<string, string | number>} La requête.
 */
export const filtresDeRecherche = (choix) => {
  const requete = /** @type {Record<string, string | number>} */ ({});
  const texte = String(choix?.texte || '').replace(/\s+/g, ' ').trim();
  if (texte.length >= RECHERCHE_MIN) requete.q = texte.slice(0, RECHERCHE_MAX);
  if (choix?.sport) requete.sport = String(choix.sport);
  if (choix?.date) requete.date = String(choix.date);
  const heure = choix?.heure ? HEURES_DE_RECHERCHE[choix.heure] : null;
  if (heure?.apres) requete.apres = heure.apres;
  if (choix?.cadre === 'interieur' || choix?.cadre === 'exterieur') requete.cadre = choix.cadre;
  const lat = Number(choix?.position?.lat);
  const lng = Number(choix?.position?.lng);
  if (choix?.position && Number.isFinite(lat) && Number.isFinite(lng)) {
    requete.lat = lat;
    requete.lng = lng;
    if (Number(choix?.distanceKm) > 0) requete.rayon = Number(choix?.distanceKm);
  }
  return requete;
};

/**
 * Le corps de « Réserver » (E-P04) : la liste blanche du serveur (`readBookingPayload` : terrain,
 * jour, heure de début, nombre de joueurs, petit mot, case du numéro), et rien d'autre (RG-SECU).
 * AT-04 : la case du numéro n'existe pas pour un mineur — et quand bien même, rien ne part.
 * @param {{ date: string, from: string, joueurs?: number | null, mot?: string | null,
 *   partagerNumero?: boolean, peutPartagerNumero?: boolean, terrainId: string }} choix - Le
 *   récapitulatif rempli.
 * @returns {{ date: string, from: string, note: string | null, phoneShared: boolean,
 *   players?: number, terrain: string }} Le corps.
 */
export const demandeDeReservation = (choix) => {
  const mot = String(choix?.mot || '').replace(/\s+/g, ' ').trim().slice(0, MOT_MAX);
  const joueurs = Number(choix?.joueurs);
  return {
    date: String(choix.date),
    from: String(choix.from),
    note: mot || null,
    phoneShared: choix?.peutPartagerNumero === true && choix?.partagerNumero === true,
    ...(Number.isInteger(joueurs) && joueurs > 0 ? { players: joueurs } : {}),
    terrain: String(choix.terrainId),
  };
};

// ---------------------------------------------------------------------------------------------
// Les refus NOMMÉS (E-P13)
// ---------------------------------------------------------------------------------------------

/** Le code du serveur → la variante de E-P13 (contrat L1 + L2A ; `BANNED` : RESA-L2B, en cours). */
const VARIANTE_DU_CODE = Object.freeze({
  COMPLEXE_NOT_FOUND: 'complexeParti',
  COMPLEXE_RESERVATION_AGE: 'age',
  COMPLEXE_RESERVATION_BANNED: 'banni',
  COMPLEXE_RESERVATION_BIRTHDATE_REQUIRED: 'dateDeNaissance',
  COMPLEXE_RESERVATION_CANCEL_TOO_LATE: 'delaiAnnulation',
  COMPLEXE_RESERVATION_INVALID: 'invalide',
  COMPLEXE_RESERVATION_NOT_FOUND: 'introuvable',
  COMPLEXE_RESERVATION_PLAFOND: 'plafond',
  COMPLEXE_RESERVATION_SLOT_CLOSED: 'ferme',
  COMPLEXE_RESERVATION_SLOT_TAKEN: 'pris',
  COMPLEXE_RESERVATION_STATE: 'etat',
  COMPLEXE_RESERVATION_TELEPHONE: 'telephone',
  COMPLEXE_RESERVATION_TOO_LATE: 'tropTard',
  COMPLEXE_TERRAIN_NOT_FOUND: 'terrainParti',
});

/**
 * La variante de E-P13 d'un refus du serveur.
 * @param {any} erreur - Le refus (corps d'erreur Strapi déballé par le client, ou erreur réseau).
 * @returns {string} La variante ; `reseau` sans connexion, `panne` pour le reste.
 */
export const varianteDEchec = (erreur) => {
  const code = getServerErrorCode(erreur);
  const variante = /** @type {Record<string, string>} */ (VARIANTE_DU_CODE)[code];
  if (variante) return variante;
  const status = getErrorStatus(erreur);
  const messageReseau = /network|r[ée]seau|timeout/i.test(String(erreur?.message || ''));
  if (HORS_CONNEXION.has(code) || (!status && messageReseau)) return 'reseau';
  return 'panne';
};

/**
 * La variante de E-P13 que porte une réservation (son en-tête sur E-P07, variantes 3 à 7) : null
 * pour une réservation en cours (en attente, confirmée).
 * @param {{ cancelledBy?: string | null, status?: string | null } | null | undefined} reservation
 *   - La réservation vue par son réserveur.
 * @param {{ change?: string | null }} [contexte] - La notification qui l'a ouverte (`data.change`).
 * @returns {string | null} La variante.
 */
export const varianteDeLaReservation = (reservation, contexte = {}) => {
  switch (reservation?.status) {
    case 'annulee':
      if (reservation?.cancelledBy === 'reserveur') return 'annuleeParToi';
      return contexte?.change === 'fermeture' ? 'fermeture' : 'annuleeParLeComplexe';
    case 'refusee':
      return 'refusee';
    case 'sans_reponse':
      return 'sansReponse';
    default:
      return null;
  }
};

/**
 * Le jour et l'heure de Paris d'un instant (une échéance, une date de création).
 * @param {unknown} instant - L'instant (ISO).
 * @returns {{ date: string, heure: string } | null} « AAAA-MM-JJ » et « HH:MM », ou null.
 */
export const dateEtHeureDeParis = (instant) => {
  if (!instant) return null;
  const quand = new Date(String(instant));
  if (Number.isNaN(quand.getTime())) return null;
  const parts = getZonedDateParts(quand, 'Europe/Paris');
  return {
    date: `${parts.year}-${deuxChiffres(parts.month)}-${deuxChiffres(parts.day)}`,
    heure: `${deuxChiffres(parts.hour)}:${deuxChiffres(parts.minute)}`,
  };
};

/**
 * Un moment lisible, à Paris : « 16/10 » et « 18 h » (« Gratuit jusqu'au 15/10 à 18 h »).
 * @param {unknown} instant - L'instant (ISO).
 * @returns {{ heure: string, jour: string } | null} Le jour et l'heure, ou null.
 */
export const momentLisible = (instant) => {
  const lu = dateEtHeureDeParis(instant);
  if (!lu) return null;
  const [, mois, jour] = lu.date.split('-');
  return { heure: texteHeure(lu.heure), jour: `${jour}/${mois}` };
};

/**
 * @typedef {{ debut: unknown, details?: string, fin: unknown, lieu?: string, titre: string }}
 *   RendezVous
 */

/**
 * Un instant au format de Google Agenda : « 20261016T160000Z » (UTC).
 * @param {unknown} instant - L'instant (ISO).
 * @returns {string | null} Le texte, ou null.
 */
const instantPourAgenda = (instant) => {
  if (!instant) return null;
  const quand = new Date(String(instant));
  if (Number.isNaN(quand.getTime())) return null;
  return quand.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * « Ajouter à l'agenda » (E-P07) : le lien Google Agenda d'une réservation, comme les matchs League
 * (`hooks/useNotifications.js`), sans fichier `.ics`.
 * ponytail: troisième écriture de ce lien (useNotifications.js:126, Conversation.js:772,
 * celle-ci) ; plafond : trois copies ; voie de sortie : un module `utils` commun qu'importeraient
 * les trois.
 * @param {RendezVous} rendezVous - Le titre, le début et la fin (ISO), le lieu, le détail.
 * @returns {string | null} Le lien, ou null sans heures valables.
 */
export const lienAgendaGoogle = (rendezVous) => {
  const debut = instantPourAgenda(rendezVous?.debut);
  const fin = instantPourAgenda(rendezVous?.fin);
  if (!debut || !fin) return null;
  const enc = (/** @type {unknown} */ texte) => encodeURIComponent(String(texte || ''));
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${enc(rendezVous.titre)}`
    + `&dates=${debut}/${fin}`
    + `&details=${enc(rendezVous.details)}`
    + `&location=${enc(rendezVous.lieu)}`;
};

/**
 * L'état AFFICHÉ d'une réservation (P00 bloc 4, plan §1.2) : ceux du serveur, « jouée » pour une
 * confirmée dont le créneau est fini, et « non honorée » quand le complexe l'a marquée (serveur
 * L2B, `noShowAt` ; RESA-L6B-1). « En collecte » et « non aboutie » viendront avec L3.
 * @param {{ cancelledBy?: string | null, endsAt?: string | null, noShowAt?: string | null,
 *   status?: string | null } | null | undefined} reservation - La réservation vue par son
 *   réserveur.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {string} `enAttente | confirmee | jouee | nonHonoree | refusee | sansReponse |
 *   annuleeParToi | annuleeParLeComplexe`, ou ''.
 */
export const etatAffiche = (reservation, maintenant = new Date()) => {
  switch (reservation?.status) {
    case 'annulee':
      return reservation?.cancelledBy === 'reserveur' ? 'annuleeParToi' : 'annuleeParLeComplexe';
    case 'confirmee': {
      if (reservation?.noShowAt) return 'nonHonoree';
      const fin = new Date(String(reservation?.endsAt || '')).getTime();
      return Number.isFinite(fin) && fin <= maintenant.getTime() ? 'jouee' : 'confirmee';
    }
    case 'en_attente':
      return 'enAttente';
    case 'refusee':
      return 'refusee';
    case 'sans_reponse':
      return 'sansReponse';
    default:
      return '';
  }
};

/**
 * Le texte d'un détail du refus (le numéro du complexe, l'âge minimum, le plafond).
 * @param {any} erreur - Le refus.
 * @returns {Record<string, any>} Ses détails.
 */
const detailsDe = (erreur) => (
  erreur?.details && typeof erreur.details === 'object' ? erreur.details : {}
);

/** Les détails d'un refus qui peuvent voyager jusqu'à E-P13 (liste blanche ; jamais `reason`). */
const DETAILS_PERMIS = Object.freeze(['code', 'max', 'minAge', 'phone']);

/**
 * Les paramètres de route de E-P13 : la variante, le refus du serveur réduit à ce que l'écran
 * affiche (code, détails permis, phrase), le créneau et le complexe. Des valeurs simples
 * seulement (les paramètres de route se sérialisent). ⛔ RC-P08 : la raison privée d'un
 * bannissement (`details.reason`) ne part jamais.
 * @param {{ complexe?: string | null, creneau?: { from?: string, to?: string } | null,
 *   date?: string | null, erreur?: any, slug?: string | null, telephone?: string | null,
 *   terrain?: { documentId?: string, name?: string } | null, variante: string }} source - Ce
 *   que l'écran sait.
 * @returns {Record<string, any>} Les paramètres.
 */
export const parametresDEchec = (source) => {
  const detailsBruts = detailsDe(source?.erreur);
  const details = Object.fromEntries(Object.entries(detailsBruts).filter(([cle, valeur]) => (
    DETAILS_PERMIS.includes(cle) && valeur !== undefined && valeur !== null
  )));
  const message = source?.variante === 'banni' ? '' : String(source?.erreur?.message || '').trim();
  const params = {
    complexe: source?.complexe ? String(source.complexe) : undefined,
    date: source?.date || undefined,
    details: Object.keys(details).length ? details : undefined,
    from: source?.creneau?.from || undefined,
    message: message || undefined,
    slug: source?.slug || undefined,
    telephone: source?.telephone || undefined,
    terrain: source?.terrain?.name || undefined,
    terrainId: source?.terrain?.documentId || undefined,
    to: source?.creneau?.to || undefined,
    variante: source.variante,
  };
  return Object.fromEntries(Object.entries(params).filter(([, valeur]) => valeur !== undefined));
};

/**
 * Le contenu d'une variante de E-P13 (même gabarit : pictogramme, titre, texte, boutons). Les
 * actions sont des clefs que l'écran traduit en boutons : `autresCreneaux` (E-P03), `ailleurs`
 * (E-P01), `autreJour` (E-P03), `appeler` (le numéro du complexe), `profil` (sa date de naissance),
 * `reessayer`. ⛔ RC-P08 : le banni ne lit JAMAIS la raison du complexe, et rien d'autre ne
 * l'expose ici.
 * @param {Traduire} t - Traduction.
 * @param {string} variante - La variante (`varianteDEchec`, `varianteDeLaReservation`).
 * @param {{ complexe?: string | null, erreur?: any, fermeture?: string | null,
 *   motif?: string | null, telephone?: string | null }} [contexte] - Ce que l'écran sait.
 * @returns {{ actions: string[], icone: string, telephone: string | null, texte: string | null,
 *   titre: string, ton: 'cyan' | 'orange' | 'rouge' }} Le contenu.
 */
export const contenuDEchec = (t, variante, contexte = {}) => {
  const details = detailsDe(contexte?.erreur);
  const complexe = String(contexte?.complexe || '').trim()
    || t('reserverTerrain.echec.leComplexe', 'Le complexe');
  const motif = String(contexte?.motif || '').trim();
  const texteMotif = motif
    ? t('reserverTerrain.echec.motif', 'Motif : {{motif}}', { motif, ...SANS_ECHAPPEMENT })
    : null;
  const numeroDetails = typeof details.phone === 'string' ? details.phone : details.phone?.number;
  const telephone = String(numeroDetails || contexte?.telephone || '').trim() || null;
  const messageServeur = String(contexte?.erreur?.message || '').trim();
  /**
   * Ce que toutes les variantes ont en commun.
   * @type {{ actions: string[], icone: string, telephone: string | null, texte: string | null,
   *   ton: 'cyan' | 'orange' | 'rouge' }}
   */
  const base = {
    actions: [], icone: 'croix', telephone, texte: null, ton: 'rouge',
  };

  switch (variante) {
    case 'age':
      return {
        ...base,
        actions: ['ailleurs'],
        icone: 'personnes',
        titre: Number(details.minAge) > 0
          ? t(
            'reserverTerrain.echec.age',
            'Ce complexe accepte les réservations à partir de {{age}} ans.',
            {
              age: Number(details.minAge),
            },
          )
          : t(
            'reserverTerrain.echec.ageSansChiffre',
            'Ce complexe fixe un âge minimum pour réserver.',
          ),
        ton: 'cyan',
      };
    case 'annuleeParLeComplexe':
      return {
        ...base,
        texte: texteMotif,
        titre: t(
          'reserverTerrain.echec.annuleeParLeComplexe',
          'Réservation annulée par le complexe',
        ),
      };
    case 'annuleeParToi':
      return {
        ...base,
        actions: ['ailleurs'],
        icone: 'coche',
        texte: t(
          'reserverTerrain.echec.annuleeParToiTexte',
          'Le complexe est prévenu : le créneau est de nouveau libre.',
        ),
        titre: t('reserverTerrain.echec.annuleeParToi', 'Ta réservation est annulée'),
      };
    case 'banni':
      return {
        ...base,
        actions: ['ailleurs'],
        icone: 'interdit',
        telephone: null,
        titre: t('reserverTerrain.echec.banni', 'Tu ne peux plus réserver dans ce complexe.'),
      };
    case 'complexeParti':
      return {
        ...base,
        actions: ['ailleurs'],
        titre: t('reserverTerrain.echec.complexeParti', 'Ce complexe n’est plus sur FoundClub.'),
      };
    case 'dateDeNaissance':
      return {
        ...base,
        actions: ['profil'],
        icone: 'personnes',
        texte: t(
          'reserverTerrain.echec.dateDeNaissanceTexte',
          'Chaque complexe fixe un âge minimum.',
        ),
        titre: t(
          'reserverTerrain.echec.dateDeNaissance',
          'Ajoute ta date de naissance pour réserver.',
        ),
        ton: 'cyan',
      };
    case 'delaiAnnulation':
      return {
        ...base,
        actions: telephone ? ['appeler'] : [],
        icone: 'horloge',
        titre: t(
          'reserverTerrain.echec.delaiAnnulation',
          'Le délai est passé : appelle le complexe.',
        ),
        ton: 'orange',
      };
    case 'etat':
    case 'invalide':
      return {
        ...base,
        titre: messageServeur || t(
          'reserverTerrain.echec.panne',
          'Quelque chose n’a pas marché. Réessaie.',
        ),
      };
    case 'ferme':
      return {
        ...base,
        actions: ['autresCreneaux'],
        icone: 'horloge',
        titre: t('reserverTerrain.echec.ferme', 'Ce créneau est fermé par le complexe.'),
        ton: 'orange',
      };
    case 'fermeture': {
      const fermeture = String(contexte?.fermeture || '').trim();
      return {
        ...base,
        actions: ['autreJour'],
        icone: 'horloge',
        texte: fermeture
          ? t(
            'reserverTerrain.echec.fermetureTexte',
            'Fermé {{fermeture}} : ta réservation est annulée.',
            {
              fermeture,
              ...SANS_ECHAPPEMENT,
            },
          )
          : t(
            'reserverTerrain.echec.fermetureSansDate',
            'Une fermeture du complexe a annulé ta réservation.',
          ),
        titre: t('reserverTerrain.echec.fermeture', 'Le complexe sera fermé'),
        ton: 'orange',
      };
    }
    case 'introuvable':
      return {
        ...base,
        titre: t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.'),
      };
    case 'plafond': {
      const max = Number(details.max) > 0 ? Number(details.max) : null;
      return {
        ...base,
        icone: 'calendrier',
        titre: max
          ? t('reserverTerrain.echec.plafond', {
            count: max,
            defaultValue_one: 'Tu as déjà {{count}} réservation à venir dans ce complexe '
              + '(le maximum).',
            defaultValue_other: 'Tu as déjà {{count}} réservations à venir dans ce complexe '
              + '(le maximum).',
          })
          : t(
            'reserverTerrain.echec.plafondSansChiffre',
            'Tu as déjà le maximum de réservations à venir dans ce complexe.',
          ),
        ton: 'cyan',
      };
    }
    case 'pris':
      return {
        ...base,
        actions: ['autresCreneaux'],
        texte: t('reserverTerrain.echec.prisTexte', 'Choisis-en un autre : rien n’a été réservé.'),
        titre: t('reserverTerrain.echec.pris', 'Ce créneau vient d’être pris'),
      };
    case 'refusee':
      return {
        ...base,
        actions: ['autresCreneaux'],
        texte: texteMotif,
        titre: t('reserverTerrain.echec.refusee', '{{complexe}} a refusé ta demande', {
          complexe,
          ...SANS_ECHAPPEMENT,
        }),
      };
    case 'reseau':
      return {
        ...base,
        actions: ['reessayer'],
        titre: t('reserverTerrain.echec.reseau', 'La réservation n’est pas partie. Réessaie.'),
      };
    case 'sansReponse':
      return {
        ...base,
        actions: ['autresCreneaux'],
        icone: 'sablier',
        texte: t(
          'reserverTerrain.echec.sansReponseTexte',
          '{{complexe}} n’a pas répondu avant le créneau : rien n’est réservé.',
          { complexe, ...SANS_ECHAPPEMENT },
        ),
        titre: t('reserverTerrain.echec.sansReponse', 'Pas de réponse à temps'),
        ton: 'orange',
      };
    case 'telephone':
      return {
        ...base,
        actions: telephone ? ['appeler'] : [],
        icone: 'tel',
        titre: String(details.phone?.text || '').trim() || t(
          'reserverTerrain.telephone.texteParDefaut',
          'Ce terrain ne peut être réservé que par appel au',
        ),
        ton: 'cyan',
      };
    case 'terrainParti':
      return {
        ...base,
        actions: ['ailleurs'],
        titre: t('reserverTerrain.echec.terrainParti', 'Ce terrain n’est plus proposé.'),
      };
    case 'tropTard':
      return {
        ...base,
        actions: telephone ? ['appeler'] : [],
        icone: 'horloge',
        titre: t(
          'reserverTerrain.echec.tropTard',
          'Trop tard pour réserver ici : appelle le complexe.',
        ),
        ton: 'orange',
      };
    default:
      return {
        ...base,
        actions: ['reessayer'],
        titre: t('reserverTerrain.echec.panne', 'Quelque chose n’a pas marché. Réessaie.'),
      };
  }
};
