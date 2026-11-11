import i18next from 'i18next';

/**
 * AMICAUX-FORMAT (10/11/2026, maquette validée par Adel) — le catalogue des
 * formats de match amical, sport par sport, et leurs durées.
 *
 * Un format = combien contre combien (`11v11`, `9v9`, `10v11`) ou un nom court
 * quand le sport en a un (`futsal`, `3x3`, `XV`). Les codes déjà enregistrés
 * ne changent pas : seul le TEXTE affiché change (« 11v11 » → « 11 contre 11 »).
 * Une durée = { periods, minutes, points? } ou { sets, setsMode: 'win' | 'play' },
 * la même forme que celle que le serveur vérifie
 * (admin/src/api/friendly-match-ad/constants/index.ts, normalizeFriendlyMatchFormatDetails).
 * La première durée de chaque format est celle qui se pré-coche.
 *
 * Ajouter un sport ou un format = une ligne ici. Un sport absent ne propose que
 * « Personnalisé » : rien n'est jamais bloqué.
 */

/** La valeur du brouillon pour « Personnalisé ». Elle ne part jamais au serveur. */
export const CUSTOM_FORMAT = 'custom';

/** Bornes du personnalisé (le serveur accepte plus large : 1-6 périodes, 1-90 min, 1-5 sets). */
export const CUSTOM_LIMITS = /** @type {const} */ ({
  minutes: { max: 60, min: 5, step: 5 },
  periods: { max: 6, min: 1 },
  players: { max: 15, min: 1 },
  sets: { max: 5, min: 1 },
});

export const PRECISION_MAX_LENGTH = 40;

/**
 * Une durée en périodes × minutes (et en points pour le 3x3).
 * @param {number} periods
 * @param {number} minutes
 * @param {number} [points]
 * @returns {{ periods: number, minutes: number, points?: number }}
 */
const m = (periods, minutes, points) => (
  points ? { minutes, periods, points } : { minutes, periods }
);
/**
 * Une durée en sets, gagnants ou joués.
 * @param {number} sets
 * @param {'win' | 'play'} setsMode
 * @returns {{ sets: number, setsMode: 'win' | 'play' }}
 */
const s = (sets, setsMode) => ({ sets, setsMode });

/**
 * Une ligne du catalogue : le code enregistré, ses durées, et ses clefs de texte.
 * @typedef {{ code: string, nameKey?: string, detailKey?: string, durations: any[] }} FormatEntry
 */

/**
 * Fabrique une ligne du catalogue.
 * @param {string} code
 * @param {any[]} durations
 * @param {{ nameKey?: string, detailKey?: string }} [keys]
 * @returns {FormatEntry}
 */
const f = (code, durations, keys = {}) => ({ code, durations, ...keys });

const FOOTBALL_5 = f('5v5', [m(2, 25), m(2, 20), m(2, 30)]);
const FUTSAL = f('futsal', [m(2, 20), m(2, 25), m(2, 15)], {
  detailKey: 'futsal', nameKey: 'futsal',
});
const DOUBLE = f('double', [s(2, 'win'), s(1, 'win')], { detailKey: 'double', nameKey: 'double' });

/** Noms du référentiel comparés sans accent ni casse (« Football à 5 » → « football a 5 »). */
const CATALOG = /** @type {Array<{ names: string[], formats: FormatEntry[] }>} */ ([
  {
    formats: [
      f('11v11', [m(2, 45), m(2, 40), m(2, 35), m(2, 30)]),
      f('8v8', [m(2, 30), m(2, 25), m(2, 35)]),
      f('7v7', [m(2, 30), m(2, 25), m(2, 35)]),
      FOOTBALL_5,
      FUTSAL,
    ],
    names: ['football', 'foot'],
  },
  { formats: [FUTSAL], names: ['futsal'] },
  { formats: [FOOTBALL_5], names: ['football a 5', 'foot a 5'] },
  {
    formats: [
      f('5v5', [m(4, 10), m(4, 8), m(4, 6), m(2, 20)]),
      f('3x3', [m(1, 10, 21), m(2, 10)], { detailKey: 'basket3x3', nameKey: 'basket3x3' }),
    ],
    names: ['basketball', 'basket', 'basket-ball'],
  },
  {
    formats: [
      f('7v7', [m(2, 30), m(2, 25), m(2, 20)]),
      f('4v4', [m(2, 10)], { detailKey: 'beachHandball', nameKey: 'beachHandball' }),
    ],
    names: ['handball', 'hand', 'hand-ball'],
  },
  {
    formats: [
      f('6v6', [s(3, 'win'), s(3, 'play'), s(4, 'play'), s(2, 'win')]),
      f('4v4', [s(2, 'win'), s(3, 'play')]),
      f('2v2', [s(2, 'win'), s(3, 'play')], { detailKey: 'beachVolley', nameKey: 'beachVolley' }),
    ],
    names: ['volleyball', 'volley', 'volley-ball'],
  },
  {
    formats: [
      f('XV', [m(2, 40), m(2, 35), m(2, 30)], { detailKey: 'rugbyXV', nameKey: 'rugbyXV' }),
      f('VII', [m(2, 7), m(2, 10)], { detailKey: 'rugby7', nameKey: 'rugby7' }),
      f('X', [m(2, 10), m(2, 7)], { detailKey: 'rugbyX', nameKey: 'rugbyX' }),
      f('5v5', [m(2, 20), m(2, 15)], { detailKey: 'rugby5', nameKey: 'rugby5' }),
    ],
    names: ['rugby', 'rugby a xv', 'rugby a 15'],
  },
  {
    formats: [f('XIII', [m(2, 40), m(2, 35), m(2, 30)], {
      detailKey: 'rugbyXIII', nameKey: 'rugbyXIII',
    })],
    names: ['rugby a xiii', 'rugby a 13', 'rugby xiii', 'rugby league'],
  },
  {
    formats: [
      f('11v11', [m(4, 15), m(2, 30), m(2, 25)], { detailKey: 'hockeyField' }),
      f('7v7', [m(2, 25), m(2, 20)], { detailKey: 'hockeyYouth' }),
      f('6v6-salle', [m(2, 20), m(2, 15)], { detailKey: 'hockeyIndoor', nameKey: 'hockeyIndoor' }),
      f('glace', [m(3, 20), m(3, 15)], { detailKey: 'iceHockey', nameKey: 'iceHockey' }),
      f('roller', [m(2, 20), m(2, 15)], { detailKey: 'rollerHockey', nameKey: 'rollerHockey' }),
    ],
    names: ['hockey', 'hockey sur gazon'],
  },
  {
    formats: [f('7v7', [m(4, 8), m(4, 7), m(4, 6)])],
    names: ['water-polo', 'water polo', 'waterpolo'],
  },
  { formats: [f('11v11', [m(4, 12), m(4, 10)])], names: ['football americain'] },
  {
    formats: [
      f('simple', [s(2, 'win'), s(1, 'win')], { detailKey: 'single', nameKey: 'single' }),
      DOUBLE,
    ],
    names: ['tennis', 'badminton'],
  },
  { formats: [DOUBLE], names: ['padel'] },
]);

/**
 * Un nom de sport comparable : sans accent, sans espace de bord, en minuscules.
 * @param {any} value
 * @returns {string}
 */
const normalizeName = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toLowerCase();

/**
 * Les lignes du catalogue d'un sport (vide si le sport n'y est pas).
 * @param {any} sportName
 * @returns {FormatEntry[]}
 */
const findSportFormats = (sportName) => {
  const wanted = normalizeName(sportName);
  if (!wanted) return [];
  return CATALOG.find((sport) => sport.names.includes(wanted))?.formats || [];
};

/**
 * `9v9` → { us: 9, them: 9 } ; tout autre code → null.
 * @param {any} code
 * @returns {{ us: number, them: number } | null}
 */
export const parseVersusCode = (code) => {
  const match = /^(\d{1,2})v(\d{1,2})$/.exec(String(code ?? '').trim());
  return match ? { them: Number(match[2]), us: Number(match[1]) } : null;
};

/**
 * Le code d'un format personnalisé : « 10v11 ».
 * @param {number} us
 * @param {number} them
 * @returns {string}
 */
export const buildCustomFormatCode = (us, them) => `${us}v${them}`;

/**
 * Le texte d'un format : « 11 contre 11 », « Futsal », « Beach-volley ».
 * Un code inconnu de tous (texte libre d'une annonce ancienne passée par « Autre »)
 * ressort tel quel. Rien → chaîne vide.
 * @param {any} code
 * @param {any} [sportName]
 * @returns {string}
 */
export const getFormatLabel = (code, sportName) => {
  const value = String(code ?? '').trim();
  if (!value) return '';
  // D'abord le sport de l'annonce (2v2 = beach-volley au volley seulement), puis
  // « X contre Y », puis un nom court sans ambiguïté (XV, futsal…) tous sports confondus.
  const ownEntry = findSportFormats(sportName).find((format) => format.code === value);
  if (ownEntry?.nameKey) return i18next.t(`friendlyMatch.format.name.${ownEntry.nameKey}`);
  const versus = parseVersusCode(value);
  if (versus) return i18next.t('friendlyMatch.format.versus', '{{us}} contre {{them}}', versus);
  const named = CATALOG
    .flatMap((sport) => sport.formats)
    .find((format) => format.code === value && format.nameKey);
  return named ? i18next.t(`friendlyMatch.format.name.${named.nameKey}`) : value;
};

/**
 * Le texte d'une durée : « 2 × 45 min », « 10 min ou 21 points », « 3 sets gagnants ».
 * Une forme illisible → chaîne vide (l'écran affiche alors « À convenir »).
 * @param {any} duration
 * @returns {string}
 */
export const formatDurationLabel = (duration) => {
  if (!duration || typeof duration !== 'object') return '';
  const isInt = (/** @type {any} */ value) => Number.isInteger(value) && value > 0;
  if (duration.sets !== undefined) {
    if (!isInt(duration.sets)) return '';
    return duration.setsMode === 'play'
      ? i18next.t('friendlyMatch.format.duration.setsPlay', {
        count: duration.sets,
        defaultValue_one: '{{count}} set joué',
        defaultValue_other: '{{count}} sets joués',
      })
      : i18next.t('friendlyMatch.format.duration.setsWin', {
        count: duration.sets,
        defaultValue_one: '{{count}} set gagnant',
        defaultValue_other: '{{count}} sets gagnants',
      });
  }
  if (!isInt(duration.periods) || !isInt(duration.minutes)) return '';
  if (isInt(duration.points)) {
    return String(i18next.t(
      'friendlyMatch.format.duration.points',
      '{{minutes}} min ou {{points}} points',
      duration,
    ));
  }
  if (duration.periods === 1) {
    return String(i18next.t('friendlyMatch.format.duration.single', '{{minutes}} min', duration));
  }
  return String(i18next.t(
    'friendlyMatch.format.duration.periods',
    '{{periods}} × {{minutes}} min',
    duration,
  ));
};

/**
 * Les formats proposés pour le sport de l'équipe, prêts à afficher.
 * @param {any} sportName
 * @returns {Array<{ code: string, label: string, detail: string, durations: any[] }>}
 */
export const getSportFormats = (sportName) => findSportFormats(sportName).map((format) => ({
  code: format.code,
  detail: format.detailKey ? i18next.t(`friendlyMatch.format.detail.${format.detailKey}`) : '',
  durations: format.durations,
  label: getFormatLabel(format.code, sportName),
}));

/**
 * Deux durées identiques ? (pour cocher la bonne pastille)
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export const isSameDuration = (a, b) => Boolean(a && b)
  && ['periods', 'minutes', 'points', 'sets', 'setsMode'].every((key) => a[key] === b[key]);

/** La pastille « Autres formats » du filtre : tout ce qui n'est pas au catalogue du sport. */
export const OTHER_FORMATS_FILTER = '__autres__';

/** Les sports proposés au filtre quand le lecteur n'encadre aucune équipe. */
const FILTER_FALLBACK_SPORTS = [
  'Football', 'Futsal', 'Basketball', 'Handball', 'Volleyball', 'Rugby', 'Hockey',
];

/**
 * Les sports de la ligne « Sport » du filtre : ceux des équipes du lecteur, sinon
 * les sports collectifs les plus courants.
 * @param {any[]} teamSportNames
 * @returns {string[]}
 */
export const getFilterSports = (teamSportNames) => {
  const names = Array.from(new Set((Array.isArray(teamSportNames) ? teamSportNames : [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean)));
  return names.length > 0 ? names : FILTER_FALLBACK_SPORTS;
};

/**
 * AMICAUX-FORMAT (« 4 A » et « 5 A ») — le tri par sport et par format, au SERVEUR.
 * Rend les clauses Strapi à poser sous `filters.$and`. Une annonce SANS format
 * reste toujours dans la liste filtrée (« 5 A ») : ne rien dire, c'est être
 * ouvert à tout, comme une catégorie non cochée.
 * @param {{ format?: any, sport?: any }} [filters]
 * @returns {any[]}
 */
export const buildFormatServerFilters = ({ format, sport } = {}) => {
  const clauses = /** @type {any[]} */ ([]);
  const sportName = String(sport ?? '').trim();
  if (sportName) clauses.push({ activity: { name: { $eqi: sportName } } });

  const wanted = String(format ?? '').trim();
  if (!wanted) return clauses;
  const withoutFormat = [{ format: { $null: true } }, { format: { $eq: '' } }];
  if (wanted === OTHER_FORMATS_FILTER) {
    const codes = getSportFormats(sportName).map((item) => item.code);
    const outsideCatalog = codes.length > 0
      ? { format: { $notIn: codes } }
      : { format: { $notNull: true } };
    clauses.push({ $or: [outsideCatalog, ...withoutFormat] });
  } else {
    clauses.push({ $or: [{ format: { $eq: wanted } }, ...withoutFormat] });
  }
  return clauses;
};
