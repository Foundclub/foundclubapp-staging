import { getUserRoleKey } from '@/domains/auth/authUseCases';

import { getLocationCoordinates } from '@/utils/location';

/**
 * Regles metier de l onglet « Matchs amicaux » (spec
 * docs/SPEC_ONGLET_MATCHS_AMICAUX_2026_07_31.md, arbitrages Adel du 31/07).
 *
 * Ce fichier est le pendant app de admin/src/api/friendly-match-ad/constants/index.ts :
 * il porte la regle « qui recoit » (§3.3, Q1), le catalogue de formats par sport
 * (§3.4, Q4) et le partage des onglets par role (Q12 : la liste est visible SANS
 * compte, candidater exige Entraineur ou Dirigeant).
 *
 * Le mecanisme des sous-onglets est celui de recruitmentFlow.js, volontairement
 * recopie plutot qu etendu : les deux parcours n ont ni les memes onglets ni la
 * meme population.
 */

/** Onglets du staff (Entraineur, Dirigeant, SuperAdmin). */
export const STAFF_FRIENDLY_MATCH_TABS = /** @type {const} */ ([
  'annonces',
  'mes-annonces',
  'candidatures',
]);

/** Onglets d un visiteur : joueur, compte neuf, ou personne non connectee (Q12). */
export const VISITOR_FRIENDLY_MATCH_TABS = /** @type {const} */ (['annonces']);

export const VALID_FRIENDLY_MATCH_TABS = /** @type {const} */ ([
  ...STAFF_FRIENDLY_MATCH_TABS,
]);

/** Preferences d hebergement portees par une annonce (§3.1). */
export const HOSTING_PREFERENCES = /** @type {const} */ (['HOST', 'AWAY', 'BOTH']);

/** Choix possibles pour une candidature (§3.2). */
export const CHOSEN_HOSTINGS = /** @type {const} */ (['HOST', 'AWAY']);

/** Intentions de recherche du filtre « je veux recevoir / me deplacer » (§4.2). */
export const HOSTING_INTENTS = /** @type {const} */ (['any', 'host', 'away']);

/** Valeur libre du catalogue de formats, pour ne bloquer aucun sport (§3.4). */
export const FORMAT_OTHER = 'Autre';

const SPORT_FORMAT_CATALOG = /** @type {Record<string, string[]>} */ ({
  basketball: ['5v5', '3x3'],
  football: ['11v11', '8v8', '7v7', '5v5'],
  'football a 5': ['5v5'],
  handball: ['7v7', '4v4'],
  padel: ['double'],
  rugby: ['XV', 'X', 'VII'],
  tennis: ['simple', 'double'],
  volleyball: ['6v6', '4v4', '2v2'],
});

const EARTH_RADIUS_KM = 6371;

/**
 * Le nom de role, qu on recoive un utilisateur complet ou juste une chaine.
 * @param {any} userOrRole
 * @returns {string}
 */
const getRoleName = (userOrRole) => {
  if (typeof userOrRole === 'string') return userOrRole;
  if (userOrRole?.role?.name) return userOrRole.role.name;
  if (userOrRole?.name) return userOrRole.name;
  return '';
};

/**
 * Texte comparable : sans accent, sans espaces de bord, en minuscules.
 * @param {any} value
 * @returns {string}
 */
const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toLowerCase();

/**
 * Mode de lecture de l onglet : « staff » publie et candidate, « visitor » lit.
 * @param {any} userOrRole
 * @returns {'staff' | 'visitor'}
 */
export const getFriendlyMatchRoleMode = (userOrRole) => {
  const roleKey = getUserRoleKey(getRoleName(userOrRole));
  if (roleKey === 'coach' || roleKey === 'president' || roleKey === 'superAdmin') {
    return 'staff';
  }
  return 'visitor';
};

/**
 * Publier une annonce : Entraineur ou Dirigeant uniquement (§5.2).
 * @param {any} userOrRole
 * @returns {boolean}
 */
export const canPublishFriendlyMatchAd = (userOrRole) => (
  getFriendlyMatchRoleMode(userOrRole) === 'staff'
);

/**
 * Candidater : meme population que publier (Q12). Un visiteur voit, mais ne
 * repond pas — c est une equipe qui candidate, donc son staff.
 * @param {any} userOrRole
 * @returns {boolean}
 */
export const canApplyToFriendlyMatchAd = (userOrRole) => (
  getFriendlyMatchRoleMode(userOrRole) === 'staff'
);

/**
 * Les onglets que ce role a le droit de voir.
 * @param {any} userOrRole
 * @returns {string[]}
 */
export const getAllowedFriendlyMatchTabs = (userOrRole) => (
  getFriendlyMatchRoleMode(userOrRole) === 'staff'
    ? [...STAFF_FRIENDLY_MATCH_TABS]
    : [...VISITOR_FRIENDLY_MATCH_TABS]
);

/**
 * L onglet d atterrissage : toujours la liste publique.
 * @param {any} userOrRole
 * @returns {string}
 */
export const getDefaultFriendlyMatchTab = (userOrRole) => (
  getAllowedFriendlyMatchTabs(userOrRole)[0]
);

/**
 * Ramene un onglet demande dans ce que le role autorise. Un visiteur a qui on
 * demande « candidatures » retombe sur « annonces », il ne voit pas d ecran vide.
 * @param {any} tab
 * @param {any} userOrRole
 * @param {string} [fallbackTab]
 * @returns {string}
 */
export const sanitizeFriendlyMatchTabForRole = (tab, userOrRole, fallbackTab = undefined) => {
  const allowedTabs = getAllowedFriendlyMatchTabs(userOrRole);
  const normalizedTab = typeof tab === 'string' ? tab.trim().toLowerCase() : '';
  if (allowedTabs.includes(normalizedTab)) return normalizedTab;
  if (fallbackTab && allowedTabs.includes(fallbackTab)) return fallbackTab;
  return getDefaultFriendlyMatchTab(userOrRole);
};

/**
 * Les choix qu une annonce autorise a son candidat (§3.3).
 * L annonceur recoit (HOST) → le candidat se deplace (AWAY), et reciproquement.
 * @param {any} preference
 * @returns {string[]}
 */
export const getAllowedChosenHostings = (preference) => {
  switch (String(preference ?? '').trim().toUpperCase()) {
    case 'AWAY':
      return ['HOST'];
    case 'BOTH':
      return ['HOST', 'AWAY'];
    case 'HOST':
      return ['AWAY'];
    default:
      return [];
  }
};

/**
 * Un choix absent est refuse : le choix est toujours explicite (Q1).
 * @param {any} preference
 * @param {any} chosenHosting
 * @returns {boolean}
 */
export const isChosenHostingAllowed = (preference, chosenHosting) => (
  getAllowedChosenHostings(preference).includes(String(chosenHosting ?? '').trim().toUpperCase())
);

/**
 * Ce que l annonce dit, en clair, du point de vue du lecteur (§3.3).
 * Le libelle porte toujours du TEXTE : la couleur seule ne dit rien.
 * @param {any} ad
 * @returns {{ label: string, tone: 'away' | 'both' | 'host' | 'unknown' }}
 */
export const getHostingSummary = (ad) => {
  switch (String(ad?.hostingPreference ?? '').trim().toUpperCase()) {
    case 'AWAY':
      return { label: 'Il se déplace', tone: 'away' };
    case 'BOTH':
      return { label: 'Reçoit ou se déplace', tone: 'both' };
    case 'HOST':
      return { label: 'Il reçoit', tone: 'host' };
    default:
      return { label: 'À convenir', tone: 'unknown' };
  }
};

/**
 * L icone de chaque etat de lieu, et le libelle COURT des surfaces compactes.
 *
 * Les deux tables sont indexees par le `tone` de getHostingSummary, jamais par
 * `hostingPreference` : un seul endroit du depot lit la valeur brute, donc un
 * seul endroit peut se tromper. C est ce qui evite qu un quatrieme etat ajoute
 * demain soit gere a trois endroits sur quatre.
 *
 * Le libelle est court parce que sur une carte le club est nomme juste au-dessus :
 * « Il » y serait redondant. Le detail et le recapitulatif, eux, gardent la
 * phrase longue de getHostingSummary — elle s y lit sans contexte.
 * @type {Record<'away' | 'both' | 'host' | 'unknown', {iconKey: string, label: string}>}
 */
const HOSTING_TAG_BY_TONE = {
  // D41 ③ — une fleche, plus un coureur : les DEUX surfaces qui affichent cet
  // etat (la carte-option du tunnel et le tag de chaque annonce) lisent cette
  // seule table, donc elles changent forcement ensemble.
  away: { iconKey: 'arrow', label: 'Se déplace' },
  both: { iconKey: 'switch', label: 'Reçoit ou se déplace' },
  host: { iconKey: 'stadium', label: 'Reçoit' },
  // Pas d icone : inventer un pictogramme pour « on ne sait pas » ferait croire
  // a une information. Le libelle seul dit la verite.
  unknown: { iconKey: 'none', label: 'À convenir' },
};

/**
 * Le tag « qui recoit » d une carte d annonce : une icone ET un libelle.
 *
 * L icone ne voyage jamais seule (regle color-not-only, et un pictogramme
 * s interprete mal) ; le libelle ne voyage jamais seul non plus, sinon le tag
 * se confond avec les autres lignes de la carte.
 * @param {any} ad
 * @returns {{ iconKey: string, label: string, tone: 'away' | 'both' | 'host' | 'unknown' }}
 */
export const getHostingTag = (ad) => {
  const { tone } = getHostingSummary(ad);
  return { ...HOSTING_TAG_BY_TONE[tone], tone };
};

/**
 * Le filtre « je veux recevoir / me deplacer » MASQUE les annonces incompatibles
 * (§3.3) : le conflit ne se produit jamais, il n y a donc aucun message d erreur.
 * @param {any} ad
 * @param {any} intent
 * @returns {boolean}
 */
export const matchesHostingIntent = (ad, intent) => {
  const normalizedIntent = String(intent ?? '').trim().toLowerCase();
  if (!normalizedIntent || normalizedIntent === 'any') return true;
  if (normalizedIntent !== 'host' && normalizedIntent !== 'away') return true;
  return getAllowedChosenHostings(ad?.hostingPreference).includes(normalizedIntent.toUpperCase());
};

/**
 * Catalogue ferme + « Autre » (§3.4) : une liste fermee se filtre, « Autre »
 * evite qu un sport oublie bloque une publication. Ajouter un sport = une ligne.
 * @param {any} sportName
 * @returns {string[]}
 */
export const getFormatsForSport = (sportName) => [
  ...(SPORT_FORMAT_CATALOG[normalizeText(sportName)] || []),
  FORMAT_OTHER,
];

/**
 * Tous les formats connus, tous sports confondus. Sert le filtre de la liste,
 * ou aucun sport n est encore choisi : proposer l union est plus honnete que
 * d imposer le catalogue d un sport que le lecteur n a pas demande.
 * @returns {string[]}
 */
export const getAllFriendlyMatchFormats = () => Array.from(new Set([
  FORMAT_OTHER,
  ...Object.values(SPORT_FORMAT_CATALOG).flat(),
])).sort();

/**
 * Dates candidates d une annonce, nettoyees et triees (§3.1).
 * Cote app on ECARTE les entrees illisibles au lieu de lever : le serveur est la
 * frontiere de confiance, l ecran ne doit pas planter sur une ligne abimee.
 * @param {any} value
 * @returns {Array<{ date: string, end?: string, start?: string }>}
 */
export const normalizeCandidateDates = (value) => {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];

  return source
    .filter((entry) => entry && typeof entry === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    .map((entry) => {
      const slot = /** @type {{ date: string, end?: string, start?: string }} */ ({
        date: String(entry.date),
      });
      if (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(entry.start || ''))) slot.start = entry.start;
      if (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(entry.end || ''))) slot.end = entry.end;
      return slot;
    })
    .sort((left, right) => (
      `${left.date}${left.start || ''}` < `${right.date}${right.start || ''}` ? -1 : 1
    ));
};

/**
 * L instant ou un creneau candidat cesse d etre jouable : sa fin si elle est
 * connue, sinon la fin de la journee. Convention UNIQUE du dossier — la meme
 * formule ecrite a deux endroits finit toujours par diverger.
 * @param {any} slot
 * @returns {number} L horodatage, ou NaN si le creneau est illisible.
 */
export const getCandidateSlotInstant = (slot) => (
  new Date(`${slot?.date}T${slot?.end || '23:59'}:59.999Z`).getTime()
);

/**
 * Premier creneau encore a venir, sinon le premier de la liste.
 * @param {any} ad
 * @param {Date} [now]
 * @returns {{ date: string, end?: string, start?: string } | null}
 */
export const getNextCandidateDate = (ad, now = new Date()) => {
  const slots = normalizeCandidateDates(ad?.candidateDates);
  if (slots.length === 0) return null;

  const nowTimestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const upcoming = slots.find((slot) => {
    const instant = getCandidateSlotInstant(slot);
    return Number.isFinite(instant) && instant >= nowTimestamp;
  });

  return upcoming || slots[0];
};

/**
 * Reste-t-il au moins un creneau jouable ? Une annonce dont toutes les dates
 * sont passees naitrait `expired` (§4.7) : c est ce que l assistant refuse de
 * publier, et ce que la liste utilise pour dire « c est fini ».
 * @param {any} ad
 * @param {Date} [now]
 * @returns {boolean}
 */
export const hasUpcomingCandidateDate = (ad, now = new Date()) => {
  const nowTimestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return normalizeCandidateDates(ad?.candidateDates).some((slot) => {
    const instant = getCandidateSlotInstant(slot);
    return Number.isFinite(instant) && instant >= nowTimestamp;
  });
};

/**
 * Distance a vol d oiseau, en km. Aucune donnee exploitable → null, jamais 0 :
 * « 0 km » serait lu comme « juste a cote » alors qu on ne sait pas.
 * @param {any} fromLocation
 * @param {any} toLocation
 * @returns {number | null}
 */
export const getDistanceKm = (fromLocation, toLocation) => {
  const from = getLocationCoordinates(fromLocation);
  const to = getLocationCoordinates(toLocation);
  if (!from || !to) return null;
  if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng)) return null;
  if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng)) return null;

  const fromLat = Number(from.lat);
  const fromLng = Number(from.lng);
  const toLat = Number(to.lat);
  const toLng = Number(to.lng);

  const toRadians = (/** @type {number} */ value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

/**
 * L annonce a-t-elle au moins une date candidate dans la fenetre demandee ?
 * @param {any} ad
 * @param {any} periodDays
 * @param {Date} now
 * @returns {boolean}
 */
const matchesPeriod = (ad, periodDays, now) => {
  const days = Number(periodDays);
  if (!Number.isFinite(days) || days <= 0) return true;

  const slots = normalizeCandidateDates(ad?.candidateDates);
  if (slots.length === 0) return false;

  const nowTimestamp = now.getTime();
  const horizon = nowTimestamp + days * 24 * 60 * 60 * 1000;
  return slots.some((slot) => {
    const instant = getCandidateSlotInstant(slot);
    return Number.isFinite(instant) && instant >= nowTimestamp && instant <= horizon;
  });
};

/**
 * Les references portees par une annonce pour un critere donne : la LISTE si
 * elle porte quelque chose, sinon la valeur unique d avant (D90).
 *
 * 🔒 C est ce repli qui garde trouvables les annonces publiees AVANT D90.
 * Elles n ont que `category` / `level` ; lire seulement `categories` / `levels`
 * les ferait disparaitre de la recherche sans le moindre message.
 * ⚠️ Une liste VIDE et une liste ABSENTE se lisent pareil, et c est voulu :
 * Strapi rend `[]` des qu on peuple une relation multiple vide, on ne peut donc
 * pas distinguer « annonce d avant » de « annonce neuve sans choix ». Les deux
 * retombent sur le singulier, puis sur « ouverte a tous » — le comportement le
 * plus large, jamais celui qui cache.
 * @param {any} ad
 * @param {string} pluralKey
 * @param {string} singularKey
 * @returns {any[]}
 */
const getAdReferences = (ad, pluralKey, singularKey) => {
  const many = ad?.[pluralKey];
  if (Array.isArray(many)) {
    const kept = many.filter(Boolean);
    if (kept.length > 0) return kept;
  }
  const one = ad?.[singularKey];
  return one ? [one] : [];
};

/**
 * Les categories visees par une annonce (ou par le brouillon du tunnel, qui
 * porte les memes cles). Toujours une liste, jamais null.
 * @param {any} ad
 * @returns {any[]}
 */
export const getAdCategories = (ad) => getAdReferences(ad, 'categories', 'category');

/**
 * Les niveaux vises par une annonce. Toujours une liste, jamais null.
 * @param {any} ad
 * @returns {any[]}
 */
export const getAdLevels = (ad) => getAdReferences(ad, 'levels', 'level');

/**
 * Les noms d une liste de references, en une seule phrase lisible. Rend '' quand
 * il n y a rien : l appelant choisit alors son propre texte de repli.
 * @param {any[]} references
 * @returns {string}
 */
export const getReferenceNames = (references) => (Array.isArray(references) ? references : [])
  .map((reference) => String(reference?.name || '').trim())
  .filter(Boolean)
  .join(', ');

/**
 * Une reference de l annonce correspond-elle a la valeur attendue ? On compare
 * par documentId, id ou nom : le filtre peut porter l un ou l autre.
 * @param {any} adValue
 * @param {string} wanted
 * @returns {boolean}
 */
const referenceEquals = (adValue, wanted) => {
  const candidates = typeof adValue === 'object'
    ? [adValue?.documentId, adValue?.id, adValue?.name]
    : [adValue];
  return candidates.some((candidate) => normalizeText(candidate) === wanted);
};

/**
 * Compare les references d une annonce a la valeur demandee par le filtre.
 * Un filtre vide laisse tout passer, et une annonce qui ne vise RIEN passe
 * aussi : ne rien cocher veut dire « je prends tout » (c est ce que le tunnel
 * promet a l ecran), pas « je ne veux personne ».
 * @param {any[]} adValues
 * @param {any} expected
 * @returns {boolean}
 */
const matchesReference = (adValues, expected) => {
  const wanted = normalizeText(expected);
  if (!wanted) return true;
  if (adValues.length === 0) return true;
  return adValues.some((adValue) => referenceEquals(adValue, wanted));
};

/**
 * Le filtrage cote app des annonces (§4.2). Le serveur expose un `find` Strapi
 * standard : il ne sait ni calculer une distance, ni ouvrir `candidateDates`.
 * C est donc ici que « distance », « periode » et « qui recoit » s appliquent.
 * @param {any[]} ads
 * @param {{
 *  category?: any, format?: any, hostingIntent?: any, level?: any,
 *  maxDistanceKm?: any, periodDays?: any, viewerLocation?: any
 * }} [filters]
 * @param {Date} [now]
 * @returns {any[]}
 */
export const filterFriendlyMatchAds = (ads, filters = {}, now = new Date()) => {
  if (!Array.isArray(ads)) return [];

  const maxDistanceKm = Number(filters.maxDistanceKm);
  const hasDistanceLimit = Number.isFinite(maxDistanceKm) && maxDistanceKm > 0;

  return ads.filter((ad) => {
    if (!matchesHostingIntent(ad, filters.hostingIntent)) return false;
    if (!matchesReference(getAdCategories(ad), filters.category)) return false;
    if (!matchesReference(getAdLevels(ad), filters.level)) return false;
    if (filters.format && normalizeText(ad?.format) !== normalizeText(filters.format)) return false;
    if (!matchesPeriod(ad, filters.periodDays, now)) return false;

    if (hasDistanceLimit) {
      const distanceKm = getDistanceKm(filters.viewerLocation, ad?.location);
      // Distance inconnue : on garde l annonce. Masquer sur une donnee absente
      // reviendrait a cacher des annonces valides sans que personne le sache.
      if (distanceKm !== null && distanceKm > maxDistanceKm) return false;
    }

    return true;
  });
};
