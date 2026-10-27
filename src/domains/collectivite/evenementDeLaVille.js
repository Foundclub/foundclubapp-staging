import {
  addDays, format, isValid, parseISO,
} from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import { closureCoversDay } from '@/domains/facilityClosure/facilityClosureDisplay';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { LEAGUE_TIMEZONE, toUtcFromZonedLocal } from '@/utils/parisTime';
import { getPlanningItemWindow, normalizePlanningItems } from '@/utils/planning/planningSlots';

/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — L ÉVÉNEMENT DE LA VILLE, en règles pures (sans réseau).
 *
 * Planches validées (« ok go » d'Adel, 19/10 vers 17:05) : P10-evenement-ordi, P10-evenement-tel,
 * P11-evenement-v2-tel (sans « Une réponse ? » ni « À qui ? » : R17-EVT-2),
 * P11-evenement-ou-ca-vit.
 * Décisions d'Adel : « Qui le voit ? » PAR événement en 3 niveaux (1 les clubs · 2 + une actualité,
 * dirigeants ou tous les membres · 3 + « Mon planning » et la recherche publique) ; « Quelle
 * place ? » : toute l'installation, ou aucune. « Sur plusieurs jours » : les mêmes heures chaque
 * jour. Le serveur (`api::collectivite-evenement`) juge ; ces règles disent et préparent.
 */

export const EVENEMENT_TYPES = ['manifestation', 'tournoi', 'portes_ouvertes', 'reunion', 'autre'];
// Les 3 niveaux de « Qui le voit ? », du plus discret au plus large.
export const NIVEAUX = ['clubs', 'actualite', 'public'];
export const AUDIENCES = ['dirigeants', 'membres'];
export const NOM_MAX = 80;
export const DESCRIPTION_MAX = 2000;
export const ADRESSE_MAX = 200;
// VILLEEVT-CODE (3B) : la borne du serveur (EVENEMENT_MAX_CAPACITY).
export const PLACES_MAX = 100000;

const ETAPES_COMPLETES = ['quoi', 'quand', 'ou', 'place', 'qui', 'recap'];

const dateLocale = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * Les étapes du tunnel (téléphone). Depuis une case du planning d'une installation (le jour,
 * l'heure et l'installation sont choisis) : « Quel événement ? › Quelle place ? › Qui le voit ? ›
 * Récapitulatif ». Un événement « ailleurs » ne prend la place de personne : « Quelle place ? »
 * est sautée.
 * @param {{ depuisUneCase?: boolean, ailleurs?: boolean }} options - D'où part le tunnel.
 * @returns {string[]} Les clés des étapes, dans l'ordre.
 */
export const etapesDuTunnel = ({ ailleurs = false, depuisUneCase = false } = {}) => {
  const sautees = new Set([
    ...(ailleurs ? ['place'] : []),
    ...(depuisUneCase ? ['quand', 'ou'] : []),
  ]);
  return ETAPES_COMPLETES.filter((etape) => !sautees.has(etape));
};

/**
 * L'état du formulaire à l'ouverture. Depuis une case : l'installation, le jour et l'heure
 * (une heure et demie, comme « Attribuer un créneau »). Par défaut, comme la planche :
 * « Toute l'installation » et « Les clubs et une actualité » aux dirigeants.
 * @param {{ date?: string, endTime?: string, facilityId?: string, startTime?: string }} [initial]
 *   - Ce que la case du planning sait déjà (jour AAAA-MM-JJ, heures HH:MM).
 * @returns {any} L'état.
 */
/**
 * R17-EVT-1-BIS (e) : le point d'une adresse choisie (`{ lat, lng }`), ou null.
 * @param {any} lieu - Une option de la saisie d'adresse, ou la vue du serveur.
 * @returns {{ lat: number, lng: number } | null} Le point.
 */
const pointDe = (lieu) => {
  // ⛔ Number(null) vaut 0 : sans ce garde, un lieu sans point serait au large du Golfe de Guinée.
  const nombre = (/** @type {any} */ valeur) => (
    valeur === null || valeur === undefined || valeur === '' ? Number.NaN : Number(valeur)
  );
  const lat = nombre(lieu?.lat);
  const lng = nombre(lieu?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

export const etatInitial = (initial = {}) => ({
  adresse: '',
  // R17-EVT-1-BIS (e) : l'adresse « ailleurs » choisie dans la saisie partagée, ou null.
  adresseLieu: null,
  // R17-EVT-1-BIS (f) : l'affiche (`{ id, url }`, id null pour celle déjà en place) ; le corps ne
  // la porte que si elle a changé (`afficheModifiee`).
  affiche: null,
  afficheModifiee: false,
  ailleurs: false,
  audience: 'dirigeants',
  date: initial?.date || '',
  dateFin: '',
  description: '',
  facilityId: initial?.facilityId || null,
  heureDebut: initial?.startTime || '',
  heureFin: initial?.endTime || '',
  kind: 'manifestation',
  name: '',
  plusieursJours: false,
  // VILLEEVT-CODE (3B) : « Nombre de places », tel que saisi ('' = sans limite).
  capacite: '',
  // VILLEEVT-CODE (2B) : « Répéter », au format du bloc partagé DateEtHoraire
  // (`{ frequence, intervalleTexte, jours, du, au }`), ou null (« Une seule fois ») ; « Sauf vacances
  // scolaires » à côté.
  repetition: null,
  saufVacances: false,
  takesPlace: true,
  visibility: 'actualite',
});

/**
 * L'état depuis la vue d'un événement (« Modifier »).
 * @param {any} vue - La vue de la Ville (`toGestionnaireView`).
 * @returns {any} L'état.
 */
export const etatDepuisLaVue = (vue) => ({
  ...etatInitial(),
  adresse: vue?.address || '',
  adresseLieu: pointDe(vue?.addressLocation)
    ? { label: vue?.address || '', ...pointDe(vue?.addressLocation) }
    : null,
  affiche: vue?.poster?.url ? { id: null, url: vue.poster.url } : null,
  ailleurs: !vue?.facility?.documentId,
  capacite: Number.isInteger(vue?.capacity) ? String(vue.capacity) : '',
  audience: vue?.audience || 'dirigeants',
  date: vue?.startDate || '',
  dateFin: vue?.endDate && vue.endDate !== vue.startDate ? vue.endDate : '',
  description: vue?.description || '',
  facilityId: vue?.facility?.documentId || null,
  heureDebut: vue?.startTime || '',
  heureFin: vue?.endTime || '',
  kind: EVENEMENT_TYPES.includes(vue?.kind) ? vue.kind : 'autre',
  name: vue?.name || '',
  plusieursJours: Boolean(vue?.endDate && vue.endDate !== vue.startDate),
  takesPlace: Boolean(vue?.takesPlace),
  visibility: NIVEAUX.includes(vue?.visibility) ? vue.visibility : 'clubs',
});

const minutes = (/** @type {unknown} */ heure) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(heure || '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const deuxChiffres = (/** @type {number} */ nombre) => String(nombre).padStart(2, '0');

/**
 * 🕐 VILLEEVT-CODE (ligne 3, comme l'étape « Date & horaire » de l'entraîneur) — LA FIN SUIT LE
 * DÉBUT : vide, ou pas après le nouveau début, elle passe une heure après (23:59 au plus) ; choisie
 * plus tard, elle reste.
 * @param {string} heureDebut - « HH:MM ».
 * @param {string} heureFin - « HH:MM », ou ''.
 * @returns {string} La fin à garder.
 */
export const finAutomatique = (heureDebut, heureFin) => {
  const debut = minutes(heureDebut);
  const fin = minutes(heureFin);
  if (debut === null || (fin !== null && fin > debut)) return heureFin;
  const suite = Math.min(debut + 60, 23 * 60 + 59);
  return `${deuxChiffres(Math.floor(suite / 60))}:${deuxChiffres(suite % 60)}`;
};

const jourIso = (/** @type {Date} */ date) => format(date, 'yyyy-MM-dd');

/**
 * VILLEEVT-CODE (3B) : les places saisies, en nombre ; null si vide ; NaN si ce n'en est pas un.
 * @param {unknown} saisie - La saisie.
 * @returns {number | null} Les places.
 */
const placesLues = (saisie) => {
  const texte = String(saisie ?? '').trim();
  if (!texte) return null;
  return /^\d+$/.test(texte) ? Number(texte) : Number.NaN;
};

/**
 * Les refus du formulaire (planche P10-evenement-ordi, état 10), champ par champ : des CLÉS de
 * traduction, l'écran les dit sous le champ. VILLEEVT-CODE (ligne 3) : un jour passé, ou un début
 * déjà passé aujourd'hui, se refuse (pas en « Modifier » : le serveur juge la fin) ; 3B : les
 * places ; 2B : « jusqu'au » après la date.
 * @param {any} etat - L'état du formulaire.
 * @param {{ maintenant?: Date, modification?: boolean }} [options] - L'heure de l'appareil.
 * @returns {Record<string, string>} `{ champ: clé }` ; vide si tout va bien.
 */
export const verifierEvenement = (etat, { maintenant = new Date(), modification = false } = {}) => {
  /** @type {Record<string, string>} */
  const erreurs = {};
  if (!String(etat?.name || '').trim()) erreurs.name = 'collectiviteEvenement.refus.nom';
  if (!etat?.date) erreurs.date = 'collectiviteEvenement.refus.date';
  const debut = minutes(etat?.heureDebut);
  const fin = minutes(etat?.heureFin);
  if (debut === null || fin === null) erreurs.heures = 'collectiviteEvenement.refus.heures';
  else if (fin <= debut) erreurs.heures = 'collectiviteEvenement.refus.finApresDebut';
  // ponytail: l'heure de l'appareil, pas celle de Paris ; le serveur refuse de toute façon un jour
  // passé. Sortie : lire le jour de Paris (parisTime) si une Ville hors fuseau le demande.
  const aujourdhui = jourIso(maintenant);
  if (!modification && etat?.date && etat.date < aujourdhui) {
    erreurs.date = 'collectiviteEvenement.refus.datePassee';
  } else if (!modification && etat?.date === aujourdhui && debut !== null && !erreurs.heures
    && debut <= maintenant.getHours() * 60 + maintenant.getMinutes()) {
    erreurs.heures = 'collectiviteEvenement.refus.debutPasse';
  }
  const places = placesLues(etat?.capacite);
  if (places !== null && !(Number.isInteger(places) && places >= 1 && places <= PLACES_MAX)) {
    erreurs.capacite = 'collectiviteEvenement.refus.places';
  }
  if (etat?.repetition && !etat?.plusieursJours && etat?.date && isValid(etat.repetition.au)
    && jourIso(etat.repetition.au) < etat.date) {
    erreurs.repetition = 'collectiviteEvenement.refus.repetitionFin';
  }
  if (etat?.plusieursJours && (!etat?.dateFin || etat.dateFin <= etat.date)) {
    erreurs.dateFin = 'collectiviteEvenement.refus.finApresDebut';
  }
  if (etat?.ailleurs ? !String(etat?.adresse || '').trim() : !etat?.facilityId) {
    erreurs.lieu = 'collectiviteEvenement.refus.lieu';
  }
  return erreurs;
};

/**
 * Le corps envoyé au serveur (`POST/PUT /collectivites/:id/evenements`). « Ailleurs » : une
 * adresse et aucune place ; niveau 3 : l'actualité va aux membres ; niveau 1 : aucune actualité.
 * @param {any} etat - L'état du formulaire.
 * @returns {{ data: Record<string, any> }} Le corps.
 */
export const versCorpsDeLApi = (etat) => {
  let audience = null;
  if (etat?.visibility === 'actualite') {
    audience = etat.audience === 'membres' ? 'membres' : 'dirigeants';
  }
  if (etat?.visibility === 'public') audience = 'membres';
  const description = String(etat?.description || '').trim();
  const places = placesLues(etat?.capacite);
  // VILLEEVT-CODE (2B) : une série, jamais avec « Sur plusieurs jours » (deux façons de dire quand).
  const repetition = etat?.repetition && !etat?.plusieursJours ? etat.repetition : null;
  return {
    data: {
      address: etat?.ailleurs ? String(etat?.adresse || '').trim() : null,
      // R17-EVT-1-BIS (e) : « ailleurs », son point sur la carte (null s'il n'est que du texte).
      ...(etat?.ailleurs ? { addressLocation: pointDe(etat?.adresseLieu) } : {}),
      audience,
      capacity: Number.isInteger(places) ? places : null,
      description: description || null,
      endDate: etat?.plusieursJours && etat?.dateFin ? etat.dateFin : null,
      endTime: etat?.heureFin,
      facilityId: etat?.ailleurs ? null : etat?.facilityId || null,
      kind: etat?.kind || 'manifestation',
      name: String(etat?.name || '').trim(),
      // R17-EVT-1-BIS (f) : l'affiche, seulement si elle a changé (ajoutée : son id ; retirée :
      // null) ; sinon le serveur garde celle en place.
      ...(etat?.afficheModifiee ? { poster: etat?.affiche?.id ?? null } : {}),
      ...(repetition ? {
        repetition: {
          au: isValid(repetition.au) ? jourIso(repetition.au) : '',
          frequence: repetition.frequence === 'month' ? 'month' : 'week',
          intervalle: Math.max(1, Number.parseInt(String(repetition.intervalleTexte || '1'), 10) || 1),
          jours: (Array.isArray(repetition.jours) ? repetition.jours : []).map(Number),
          saufVacances: Boolean(etat?.saufVacances),
        },
      } : {}),
      startDate: etat?.date,
      startTime: etat?.heureDebut,
      takesPlace: etat?.ailleurs ? false : Boolean(etat?.takesPlace),
      visibility: NIVEAUX.includes(etat?.visibility) ? etat.visibility : 'clubs',
    },
  };
};

const jourCourt = (/** @type {unknown} */ jour) => {
  const date = parseISO(String(jour || ''));
  return isValid(date) ? format(date, 'EEE d MMM', { locale: dateLocale() }) : '';
};

/**
 * « sam. 24 oct. · 10:00 – 17:00 » ; sur plusieurs jours : « du sam. 24 au dim. 25 oct. ·
 * 10:00 – 17:00 ».
 * @param {any} t - i18next.
 * @param {{ endDate?: string, endTime?: string, startDate?: string, startTime?: string }} evenement
 *   - Les jours et les heures.
 * @returns {string} La phrase.
 */
export const quandLabel = (t, evenement) => {
  const heures = `${evenement?.startTime || ''} – ${evenement?.endTime || ''}`;
  if (!evenement?.endDate || evenement.endDate === evenement.startDate) {
    return t('collectiviteEvenement.quand.unJour', '{{jour}} · {{heures}}', {
      heures,
      interpolation: { escapeValue: false },
      jour: jourCourt(evenement?.startDate),
    });
  }
  return t(
    'collectiviteEvenement.quand.plusieursJoursPhrase',
    'du {{debut}} au {{fin}} · {{heures}}',
    {
      debut: jourCourt(evenement.startDate),
      fin: jourCourt(evenement.endDate),
      heures,
      interpolation: { escapeValue: false },
    },
  );
};

/**
 * VILLEEVT-CODE (3B) : « 1 place », « 200 places » ; '' sans places.
 * @param {any} t - i18next.
 * @param {unknown} capacite - Les places (`capacity`).
 * @returns {string} La phrase.
 */
export const placesLabel = (t, capacite) => {
  if (!Number.isInteger(capacite)) return '';
  return Number(capacite) === 1
    ? t('collectiviteEvenement.places.une', '1 place')
    : t('collectiviteEvenement.places.plusieurs', '{{nombre}} places', { nombre: capacite });
};

const NOMS_DES_JOURS = [1, 2, 3, 4, 5, 6, 0];

/**
 * VILLEEVT-CODE (2B) — la phrase d'une série, d'après sa règle (`serie.regle` du serveur) :
 * « Chaque semaine (samedi) jusqu'au sam. 14 nov. », « Tous les 2 mois jusqu'au … , sauf vacances
 * scolaires » ; '' sans règle.
 * @param {any} t - i18next.
 * @param {{ au?: string, frequence?: string, intervalle?: number, jours?: number[],
 *   saufVacances?: boolean } | null | undefined} regle - La règle.
 * @returns {string} La phrase.
 */
export const repetitionLabel = (t, regle) => {
  if (!regle?.au) return '';
  const intervalle = Math.max(1, Number(regle.intervalle) || 1);
  const jours = NOMS_DES_JOURS.filter((jour) => (regle.jours || []).map(Number).includes(jour))
    // Un lundi (1er janvier 2024) : le nom d'un jour se lit sur la date du même rang.
    .map((jour) => format(new Date(2024, 0, 1 + ((jour + 6) % 7)), 'EEEE', { locale: dateLocale() }))
    .join(', ');
  let rythme;
  if (regle.frequence === 'month') {
    rythme = intervalle === 1
      ? t('collectiviteEvenement.repetition.chaqueMois', 'Chaque mois')
      : t('collectiviteEvenement.repetition.tousLesMois', 'Tous les {{nombre}} mois', { nombre: intervalle });
  } else {
    rythme = intervalle === 1
      ? t('collectiviteEvenement.repetition.chaqueSemaine', 'Chaque semaine ({{jours}})', { jours, ...SANS_ECHAPPEMENT })
      : t('collectiviteEvenement.repetition.toutesLesSemaines', 'Toutes les {{nombre}} semaines ({{jours}})', {
        jours, nombre: intervalle, ...SANS_ECHAPPEMENT,
      });
  }
  const phrase = t('collectiviteEvenement.repetition.jusquau', '{{rythme}} jusqu’au {{au}}', {
    au: jourCourt(regle.au), rythme, ...SANS_ECHAPPEMENT,
  });
  return regle.saufVacances
    ? t('collectiviteEvenement.repetition.saufVacances', '{{phrase}}, sauf vacances scolaires', {
      phrase, ...SANS_ECHAPPEMENT,
    })
    : phrase;
};

// ---------------------------------------------------------------------------------------------
// 📝 VILLEEVT-CODE (ligne 12) — LE BROUILLON, comme celui de l'entraîneur (EventWizardContext) :
// `sessionStorage` du navigateur ; au téléphone, rien (pas de rechargement de page).
// ---------------------------------------------------------------------------------------------

const cleDuBrouillon = (/** @type {string} */ collectiviteId) => `fc:evenement-ville:${collectiviteId}`;
const stockage = () => {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

/**
 * Garde la saisie (création seulement : l'écran en décide).
 * @param {string} collectiviteId - La Ville.
 * @param {any} etat - L'état du formulaire.
 */
export const garderBrouillon = (collectiviteId, etat) => {
  try {
    stockage()?.setItem(cleDuBrouillon(collectiviteId), JSON.stringify(etat));
  } catch {
    // Un stockage plein ou refusé ne casse pas la saisie.
  }
};

/**
 * La saisie gardée, ou null. Les dates de « Répéter » redeviennent des dates. ⚠️ Le stockage du
 * navigateur se modifie à la main : on ne relit que les champs connus, et le serveur juge tout.
 * @param {string} collectiviteId - La Ville.
 * @returns {any | null} L'état.
 */
export const lireBrouillon = (collectiviteId) => {
  try {
    const texte = stockage()?.getItem(cleDuBrouillon(collectiviteId));
    const lu = texte ? JSON.parse(texte) : null;
    if (!lu || typeof lu !== 'object') return null;
    const base = etatInitial();
    const etat = Object.fromEntries(Object.keys(base).map((cle) => [cle, cle in lu ? lu[cle] : base[cle]]));
    if (etat.repetition) {
      etat.repetition = {
        ...etat.repetition,
        au: etat.repetition.au ? new Date(etat.repetition.au) : null,
        du: etat.repetition.du ? new Date(etat.repetition.du) : null,
      };
    }
    return etat;
  } catch {
    return null;
  }
};

/**
 * Oublie la saisie (publiée, ou abandonnée par « Annuler »).
 * @param {string} collectiviteId - La Ville.
 */
export const oublierBrouillon = (collectiviteId) => {
  try {
    stockage()?.removeItem(cleDuBrouillon(collectiviteId));
  } catch {
    // Rien à oublier.
  }
};

/**
 * « Stade municipal · toute l'installation », « Stade municipal · à côté », ou l'adresse.
 * @param {any} t - i18next.
 * @param {{ address?: string|null, facilityName?: string|null, takesPlace?: boolean }} lieu
 *   - Le lieu.
 * @returns {string} La phrase.
 */
export const lieuLabel = (t, { address, facilityName, takesPlace }) => {
  if (!facilityName) return String(address || '');
  return takesPlace
    ? t('collectiviteEvenement.lieu.toute', '{{installation}} · toute l’installation', {
      installation: facilityName,
      interpolation: { escapeValue: false },
    })
    : t('collectiviteEvenement.lieu.aCote', '{{installation}} · à côté', {
      installation: facilityName,
      interpolation: { escapeValue: false },
    });
};

/**
 * La ligne « Qui le voit » du récapitulatif : « Les clubs », « Les clubs + actualité aux
 * dirigeants », « Les clubs + actualité à tous les membres », « Tout le monde ».
 * @param {any} t - i18next.
 * @param {{ audience?: string|null, visibility?: string }} evenement - Le niveau et l'audience.
 * @returns {string} La phrase.
 */
export const quiLeVoitLabel = (t, { audience, visibility }) => {
  if (visibility === 'public') return t('collectiviteEvenement.qui.recapPublic', 'Tout le monde');
  if (visibility === 'actualite') {
    return audience === 'membres'
      ? t('collectiviteEvenement.qui.recapMembres', 'Les clubs + actualité à tous les membres')
      : t('collectiviteEvenement.qui.recapDirigeants', 'Les clubs + actualité aux dirigeants');
  }
  return t('collectiviteEvenement.qui.recapClubs', 'Les clubs');
};

/**
 * Le titre de l'encadré des séances touchées : « 1 séance touchée », « 3 séances touchées ».
 * @param {any} t - i18next.
 * @param {number} nombre - Le nombre de séances.
 * @returns {string} Le titre.
 */
export const seancesToucheesTitre = (t, nombre) => (Number(nombre) === 1
  ? t('collectiviteEvenement.touchees.une', '1 séance touchée')
  : t('collectiviteEvenement.touchees.plusieurs', '{{nombre}} séances touchées', {
    nombre: Number(nombre) || 0,
  }));

/**
 * Une séance touchée (« AS Montrivage · U13, sam. 24 oct. 14:00 – 15:30 ») : un club, une équipe,
 * des heures — jamais une personne (le serveur ne rend rien d'autre).
 * @param {any} t - i18next.
 * @param {{ club?: any, date?: string, endTime?: string|null, startTime?: string,
 *   team?: any }} seance
 *   - La séance (`affected.sessions`).
 * @returns {string} La ligne.
 */
export const seanceToucheeLabel = (t, seance) => {
  const qui = [seance?.club?.name, seance?.team?.name].filter(Boolean).join(' · ');
  const heures = seance?.endTime
    ? `${seance?.startTime} – ${seance.endTime}`
    : String(seance?.startTime || '');
  return t('collectiviteEvenement.touchees.ligne', '{{qui}}, {{jour}} {{heures}}', {
    heures,
    interpolation: { escapeValue: false },
    jour: jourCourt(seance?.date),
    qui,
  });
};

/**
 * L'étiquette du bloc clair sur un planning (planche P10-planning-ordi) : « Ville · toute
 * l'installation » s'il prend la place (bloc plein), « Ville · à côté » sinon (contour).
 * @param {any} t - i18next.
 * @param {{ takesPlace?: boolean }} evenement - L'événement.
 * @returns {string} L'étiquette.
 */
export const etiquetteDuPlanning = (t, evenement) => (evenement?.takesPlace
  ? t('collectiviteEvenement.planning.toute', 'Ville · toute l’installation')
  : t('collectiviteEvenement.planning.aCote', 'Ville · à côté'));

const AAAAMMJJ = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 🗓️ Les blocs des événements de la Ville sur le planning d'UNE installation
 * (`meta.evenementsDeLaVille`) : un par jour de la fenêtre, aux heures de l'événement (les mêmes
 * chaque jour). Au format d'un bloc du planning (`startAt`, `endAt`), SANS `documentId` (la grille
 * n'en fait pas une séance à ouvrir) mais avec `evenementDeLaVille` (la vue, pour le bloc clair et
 * la fiche). « Mon planning » reçoit du serveur des créneaux de la même forme.
 * @param {any[]} evenements - `meta.evenementsDeLaVille`.
 * @param {{ from: string, to: string }} plage - La fenêtre lue (AAAA-MM-JJ).
 * @returns {any[]} Les blocs.
 */
export const blocsDesEvenements = (evenements, plage) => {
  const debut = String(plage?.from || '').slice(0, 10);
  const fin = String(plage?.to || '').slice(0, 10);
  if (!AAAAMMJJ.test(debut) || !AAAAMMJJ.test(fin)) return [];
  return (Array.isArray(evenements) ? evenements : []).flatMap((evenement) => {
    const premier = String(evenement?.startDate || '');
    const dernier = String(evenement?.endDate || premier);
    if (!AAAAMMJJ.test(premier) || !evenement?.startTime || !evenement?.endTime) return [];
    const blocs = [];
    const jour = parseISO(premier);
    while (isValid(jour) && format(jour, 'yyyy-MM-dd') <= dernier) {
      const iso = format(jour, 'yyyy-MM-dd');
      if (iso >= debut && iso <= fin) {
        // C05 (Q2-08) : l'heure de l'événement est celle de Paris, que le planning relit comme
        // telle ; construite à l'heure de l'appareil, elle glissait hors du fuseau de Paris.
        const instant = (/** @type {string} */ heure) => {
          const [h, m] = String(heure).split(':').map(Number);
          return toUtcFromZonedLocal({
            day: jour.getDate(),
            hour: h,
            minute: m,
            month: jour.getMonth() + 1,
            second: 0,
            year: jour.getFullYear(),
          }, LEAGUE_TIMEZONE).toISOString();
        };
        blocs.push({
          documentId: null,
          endAt: instant(evenement.endTime),
          evenementDeLaVille: evenement,
          hasExplicitTime: true,
          startAt: instant(evenement.startTime),
          title: evenement.name,
        });
      }
      jour.setDate(jour.getDate() + 1);
    }
    return blocs;
  });
};

/**
 * Les fermetures à dessiner, SANS les blocages liés à un événement de la Ville : le bloc clair de
 * l'événement dit déjà que la place est prise (planche P10-evenement-ordi, état 11).
 * @param {any[]} fermetures - `meta.closures`.
 * @param {any[]} evenements - `meta.evenementsDeLaVille`.
 * @returns {any[]} Les fermetures restantes.
 */
export const fermeturesSansLesEvenements = (fermetures, evenements) => {
  const lies = new Set(
    (Array.isArray(evenements) ? evenements : [])
      .map((evenement) => evenement?.closureDocumentId)
      .filter(Boolean),
  );
  return (Array.isArray(fermetures) ? fermetures : []).filter(
    (fermeture) => !fermeture?.documentId || !lies.has(fermeture.documentId),
  );
};

/**
 * Le plus grand nombre de séances EN MÊME TEMPS dans une plage (chacune rognée à la plage).
 * @param {Array<{ startAt: Date, endAt: Date }>} fenetres - Les séances qui touchent la plage.
 * @returns {number} Le pic.
 */
const picSimultane = (fenetres) => fenetres.reduce((pic, fenetre) => Math.max(
  pic,
  fenetres.filter((autre) => autre.startAt <= fenetre.startAt && fenetre.startAt < autre.endAt)
    .length,
), 0);

/**
 * 🏟️ R17-EVT-1-BIS (d) (20/10/2026, tri du chef) — « OÙ ? » : l'occupation de chaque
 * installation aux jours et heures choisis, lue sur son planning (comme le planning de toutes les
 * installations) : combien de séances touchent la plage, « complet » quand sa capacité
 * (`maxSlots`) est atteinte EN MÊME TEMPS un des jours (une demande en attente ne compte pas),
 * et la FERMETURE (jamais un blocage) qui touche un des jours. Une installation dont le planning
 * n'est pas lu n'a pas de nombre (`seances: null`) : on ne dit pas « libre » sans le savoir.
 * @param {{ fenetre: { date: string, dateFin?: string, heureDebut: string, heureFin: string },
 *   fermetures?: any[] | null, installations: any[], lectures: Array<any> }} entree
 *   - `lectures` : les réponses de `GET /facilities/:id/planning`, dans l'ordre des installations.
 * @returns {Record<string, { complet: boolean, fermeture: any, seances: number | null }>} Par
 *   installation (documentId).
 */
export const occupationDesLieux = ({
  echecs = [], fenetre, fermetures, installations, lectures,
}) => {
  const premier = parseISO(String(fenetre?.date || ''));
  if (!isValid(premier)) return {};
  const dernier = fenetre?.dateFin && fenetre.dateFin > fenetre.date
    ? parseISO(fenetre.dateFin)
    : premier;
  const jours = [];
  for (let jour = premier; jour <= dernier && jours.length < 31; jour = addDays(jour, 1)) {
    jours.push(format(jour, 'yyyy-MM-dd'));
  }
  const fermeturesDeLaVille = (Array.isArray(fermetures) ? fermetures : [])
    .filter((fermeture) => fermeture?.kind !== 'block');
  const lieux = Array.isArray(installations) ? installations : [];
  return Object.fromEntries(lieux.map((lieu, rang) => {
    const fermeture = fermeturesDeLaVille.find((une) => (
      une?.facility?.documentId === lieu?.documentId
      && jours.some((jour) => closureCoversDay(une, jour)))) || null;
    const lecture = lectures?.[rang];
    // VILLEEVT-CODE (ligne 5) : une lecture en échec n'est pas « libre » : « Impossible de vérifier ».
    if (!lecture) {
      return [lieu?.documentId, {
        complet: false, erreur: Boolean(echecs?.[rang]), fermeture, seances: null,
      }];
    }
    const fenetresDesSeances = normalizePlanningItems(lecture?.data || [])
      .filter((bloc) => bloc?.raw?.pending !== true && !bloc?.raw?.evenementDeLaVille)
      .map((bloc) => getPlanningItemWindow(bloc))
      .filter(Boolean);
    const capacite = Math.max(1, Number(lieu?.maxSlots || 1));
    let seances = 0;
    let complet = false;
    jours.forEach((jour) => {
      const debut = new Date(`${jour}T${fenetre.heureDebut}:00`);
      const fin = new Date(`${jour}T${fenetre.heureFin}:00`);
      const touchees = fenetresDesSeances
        .filter((une) => une.startAt < fin && debut < une.endAt)
        .map((une) => ({
          endAt: une.endAt < fin ? une.endAt : fin,
          startAt: une.startAt > debut ? une.startAt : debut,
        }));
      seances += touchees.length;
      if (picSimultane(touchees) >= capacite) complet = true;
    });
    return [lieu?.documentId, { complet, fermeture, seances }];
  }));
};

/**
 * La phrase de « Où ? » sous une installation : sa fermeture d'abord, puis « complet », puis le
 * nombre de séances (rien si son planning n'est pas lu).
 * @param {any} t - i18next.
 * @param {{ complet?: boolean, fermeture?: any, seances?: number | null } | undefined} occupation
 *   - L'occupation (`occupationDesLieux`).
 * @returns {string} La phrase, ou ''.
 */
export const occupationLabel = (t, occupation) => {
  if (!occupation) return '';
  if (occupation.fermeture) {
    return t('collectiviteEvenement.ou.occupationFermee', 'Fermeture ce jour-là');
  }
  if (occupation.erreur) {
    return t('collectiviteEvenement.ou.occupationErreur', 'Impossible de vérifier');
  }
  if (occupation.seances === null || occupation.seances === undefined) return '';
  if (occupation.complet) {
    return t('collectiviteEvenement.ou.occupationComplet', 'Complet sur ces heures');
  }
  if (occupation.seances === 0) {
    return t('collectiviteEvenement.ou.occupationLibre', 'Libre sur ces heures');
  }
  if (occupation.seances === 1) {
    return t('collectiviteEvenement.ou.occupationUne', '1 séance sur ces heures');
  }
  return t('collectiviteEvenement.ou.occupationPlusieurs', '{{nombre}} séances sur ces heures', {
    nombre: occupation.seances,
  });
};
