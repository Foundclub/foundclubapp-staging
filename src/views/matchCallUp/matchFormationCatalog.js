/**
 * 🎁 LOT TERRAIN (2026-09-05) — LE CATALOGUE DES COMPOS TYPE, ET LE PLACEMENT
 * AUTOMATIQUE PAR POSTE DECLARE.
 *
 * ## Ce qui existait avant, et pourquoi ça ne suffisait pas
 * Un sport = **UNE** disposition ecrite en dur (`MATCH_FORMATIONS`). Le coach
 * n'avait donc aucun choix, et l'ecran « Partir de… » n'offrait qu'une option
 * grisee. Ici, un sport a une **LISTE nommee** — et le football en a une par
 * FORMAT, parce qu'un U11 ne joue pas a 11.
 *
 * ## 🏠 Où vit ce catalogue, et pourquoi ici (decision 1 du lot)
 * **Dans l'app**, comme `MATCH_FORMATIONS` avant lui. Aucun deploiement, aucune
 * migration, aucun domaine serveur : une formation de football ne change pas
 * tous les mois. C'est le barreau le plus bas qui tient (§1 bis).
 *
 * ## 🔒 La seule source de verite
 * `matchCompositionUtils.MATCH_FORMATIONS` et `MATCH_POSITION_LABELS` — lus par
 * 4 autres ecrans — sont **DERIVES** d'ici (`buildLegacyFormationTables`), pas
 * recopies. Deux tables qui se ressemblent finissent toujours par diverger.
 *
 * ## 📐 Le repere du terrain
 * `positionX` / `positionY` sont des **pourcentages**, `y` croissant vers le BAS
 * et le camp de l'equipe en bas : le gardien de football est a `y = 93`, le
 * buteur a `y = 20`. C'est la convention de `design_reference/fields.jsx`,
 * conservee telle quelle pour que le 4-3-3 d'aujourd'hui ne bouge pas d'un pixel.
 */

import { getTacticalSportKey } from '@/utils/tacticalField';

/**
 * Un poste sur le terrain.
 * @typedef {{ label: string, positionX: number, positionY: number }} FormationSlot
 */

/**
 * Une compo type : un nom, et ses postes dans l'ordre.
 * @typedef {object} MatchFormation
 * @property {string} bucket La case du catalogue d'ou elle vient.
 * @property {string} key
 * @property {string} label
 * @property {FormationSlot[]} slots
 * @property {number} starters
 */

const slot = (
  /** @type {string} */ label,
  /** @type {number} */ positionX,
  /** @type {number} */ positionY,
) => ({ label, positionX, positionY });

/**
 * ⚽ FOOTBALL À 11 — U14 → U21 et Sénior.
 *
 * ⛔ Le `4-3-3` est celui d'aujourd'hui, AU PIXEL PRES : c'est la disposition
 * que tous les clubs de football voient deja, et la changer serait une
 * regression invisible. Un temoin fige ses 11 coordonnees.
 *
 * 📌 Lecture des libelles : `MD` / `MG` sont les milieux **DROIT** et **GAUCHE**
 * — ils sont en miroir autour de `x = 50`, c'est ce qui le prouve. Le milieu
 * **defensif** s'ecrit `MDF` et l'**offensif** `MO`, la ou une formation en
 * prevoit un.
 */
const FOOTBALL_11 = [
  {
    key: '4-3-3',
    label: '4-3-3',
    slots: [
      slot('GB', 50, 93),
      slot('DD', 86, 76), slot('DC', 62, 79), slot('DC', 38, 79), slot('DG', 14, 76),
      slot('MD', 72, 57), slot('MC', 50, 61), slot('MG', 28, 57),
      slot('AD', 82, 30), slot('BU', 50, 20), slot('AG', 18, 30),
    ],
  },
  {
    key: '4-4-2',
    label: '4-4-2',
    slots: [
      slot('GB', 50, 93),
      slot('DD', 86, 76), slot('DC', 62, 79), slot('DC', 38, 79), slot('DG', 14, 76),
      slot('MD', 84, 55), slot('MC', 60, 58), slot('MC', 40, 58), slot('MG', 16, 55),
      slot('BU', 62, 22), slot('AT', 38, 22),
    ],
  },
  {
    key: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      slot('GB', 50, 93),
      slot('DD', 86, 76), slot('DC', 62, 79), slot('DC', 38, 79), slot('DG', 14, 76),
      slot('MDF', 62, 63), slot('MDF', 38, 63),
      slot('AD', 82, 40), slot('MO', 50, 43), slot('AG', 18, 40),
      slot('BU', 50, 18),
    ],
  },
  {
    key: '3-5-2',
    label: '3-5-2',
    slots: [
      slot('GB', 50, 93),
      slot('DC', 70, 79), slot('DC', 50, 82), slot('DC', 30, 79),
      slot('MD', 88, 52), slot('MC', 66, 58), slot('MDF', 50, 64),
      slot('MC', 34, 58), slot('MG', 12, 52),
      slot('BU', 62, 22), slot('AT', 38, 22),
    ],
  },
  {
    key: '5-3-2',
    label: '5-3-2',
    slots: [
      slot('GB', 50, 93),
      slot('DD', 88, 71), slot('DC', 68, 80), slot('DC', 50, 83),
      slot('DC', 32, 80), slot('DG', 12, 71),
      slot('MD', 70, 56), slot('MC', 50, 59), slot('MG', 30, 56),
      slot('BU', 60, 22), slot('AT', 40, 22),
    ],
  },
];

/** ⚽ FOOTBALL À 8 — U10 → U13. */
const FOOTBALL_8 = [
  {
    key: '3-3-1',
    label: '3-3-1',
    slots: [
      slot('GB', 50, 92),
      slot('DD', 78, 74), slot('DC', 50, 78), slot('DG', 22, 74),
      slot('MD', 76, 50), slot('MC', 50, 54), slot('MG', 24, 50),
      slot('BU', 50, 22),
    ],
  },
  {
    key: '3-1-3',
    label: '3-1-3',
    slots: [
      slot('GB', 50, 92),
      slot('DD', 78, 74), slot('DC', 50, 78), slot('DG', 22, 74),
      slot('MDF', 50, 56),
      slot('AD', 78, 30), slot('BU', 50, 22), slot('AG', 22, 30),
    ],
  },
];

/** ⚽ FOOTBALL À 5 — U6 → U9. Le vocabulaire reste celui du football. */
const FOOTBALL_5 = [
  {
    key: '1-2-1',
    label: '1-2-1',
    slots: [
      slot('GB', 50, 90),
      slot('DC', 50, 71),
      slot('MD', 76, 50), slot('MG', 24, 50),
      slot('BU', 50, 24),
    ],
  },
  {
    key: '2-2',
    label: '2-2',
    slots: [
      slot('GB', 50, 90),
      slot('DC', 68, 71), slot('DC', 32, 71),
      slot('BU', 68, 30), slot('AT', 32, 30),
    ],
  },
];

/**
 * 🥅 FUTSAL — 5 joueurs, et son PROPRE vocabulaire.
 * Le futsal nomme ses postes autrement que le football : `DEF` (fixo),
 * `AIL D` / `AIL G` (ailes), `PIV` (pivot). Le placement automatique sait
 * traduire les postes de football declares par les joueurs (§ MAPPING).
 */
const FUTSAL = [
  {
    key: '1-2-1',
    label: '1-2-1',
    slots: [
      slot('GB', 50, 90),
      slot('DEF', 50, 70),
      slot('AIL D', 78, 50), slot('AIL G', 22, 50),
      slot('PIV', 50, 24),
    ],
  },
  {
    key: '2-2',
    label: '2-2',
    slots: [
      slot('GB', 50, 90),
      slot('DEF', 68, 68), slot('DEF', 32, 68),
      slot('PIV', 68, 30), slot('PIV', 32, 30),
    ],
  },
];

/**
 * 🏀 BASKETBALL — le panier est en HAUT (`y` petit).
 * La premiere entree est la disposition d'aujourd'hui, inchangee.
 */
const BASKETBALL = [
  {
    key: 'standard',
    label: 'Attaque placée',
    slots: [
      slot('MEN', 50, 76), slot('ARR', 19, 60), slot('AIL', 81, 60),
      slot('AF', 30, 32), slot('PIV', 66, 27),
    ],
  },
  {
    key: '1-3-1',
    label: '1-3-1',
    slots: [
      slot('MEN', 50, 70),
      slot('ARR', 20, 48), slot('AIL', 50, 45), slot('AF', 80, 48),
      slot('PIV', 50, 22),
    ],
  },
  {
    key: '2-3',
    label: '2-3 zone',
    slots: [
      slot('MEN', 34, 62), slot('ARR', 66, 62),
      slot('AIL', 18, 34), slot('PIV', 50, 24), slot('AF', 82, 34),
    ],
  },
];

/** 🤾 HANDBALL — 7 joueurs. La premiere entree est celle d'aujourd'hui. */
const HANDBALL = [
  {
    key: '6-0',
    label: '6-0',
    slots: [
      slot('GB', 50, 92),
      slot('ARG', 27, 62), slot('ARC', 50, 66), slot('ARD', 73, 62),
      slot('PIV', 50, 30), slot('AIG', 10, 45), slot('AID', 90, 45),
    ],
  },
  {
    key: '5-1',
    label: '5-1',
    slots: [
      slot('GB', 50, 92),
      slot('ARC', 50, 54),
      slot('AIG', 10, 70), slot('ARG', 30, 74), slot('PIV', 50, 77),
      slot('ARD', 70, 74), slot('AID', 90, 70),
    ],
  },
  {
    key: '3-2-1',
    label: '3-2-1',
    slots: [
      slot('GB', 50, 92),
      slot('ARC', 50, 44),
      slot('ARG', 32, 58), slot('ARD', 68, 58),
      slot('AIG', 14, 74), slot('PIV', 50, 77), slot('AID', 86, 74),
    ],
  },
];

/**
 * 🏐 VOLLEYBALL — 6 joueurs, filet en HAUT.
 * ⛔ La premiere entree est la rotation d'aujourd'hui (`P1` → `P6`) : elle
 * n'etait pas demandee, mais c'est celle que tous les clubs de volley voient
 * deja. La retirer aurait ete une regression silencieuse.
 */
const VOLLEYBALL = [
  {
    key: 'rotation',
    label: 'Rotation P1→P6',
    slots: [
      slot('P4', 22, 28), slot('P3', 50, 22), slot('P2', 78, 28),
      slot('P5', 22, 66), slot('P6', 50, 76), slot('P1', 78, 66),
    ],
  },
  {
    key: '5-1',
    label: '5-1',
    slots: [
      slot('R4', 22, 28), slot('CEN', 50, 22), slot('PAS', 78, 30),
      slot('PTU', 22, 66), slot('LIB', 50, 76), slot('R4', 78, 66),
    ],
  },
  {
    key: '4-2',
    label: '4-2',
    slots: [
      slot('R4', 22, 28), slot('CEN', 50, 22), slot('PAS', 78, 30),
      slot('PAS', 22, 68), slot('CEN', 50, 76), slot('R4', 78, 68),
    ],
  },
  {
    key: 'w',
    label: 'Réception en W',
    slots: [
      slot('PAS', 70, 24),
      slot('R4', 14, 50), slot('CEN', 50, 52), slot('R4', 86, 50),
      slot('LIB', 34, 72), slot('PTU', 66, 72),
    ],
  },
];

/** 🏉 RUGBY À XV — la disposition d'aujourd'hui, inchangée. */
const RUGBY_XV = [
  {
    key: 'xv',
    label: 'Rugby à XV',
    slots: [
      slot('ARR', 50, 92), slot('AI G', 10, 74), slot('AI D', 88, 82),
      slot('CE 1', 50, 68), slot('CE 2', 66, 76), slot('OUV', 34, 60), slot('MÊL', 50, 52),
      slot('PIL G', 34, 16), slot('TAL', 50, 16), slot('PIL D', 66, 16),
      slot('2L G', 42, 28), slot('2L D', 58, 28),
      slot('3L G', 20, 28), slot('3L D', 80, 28), slot('N°8', 50, 41),
    ],
  },
];

/**
 * 🏉 RUGBY À XIII — 13 joueurs, et c'est le cœur du chantier A : 155 clubs
 * recevaient jusqu'ici les 15 postes du XV. Les numeros 1 à 13 du rugby a XIII.
 */
const RUGBY_XIII = [
  {
    key: 'xiii',
    label: 'Rugby à XIII',
    slots: [
      slot('ARR', 50, 92),
      slot('AI G', 10, 74), slot('AI D', 90, 74),
      slot('CE G', 32, 66), slot('CE D', 68, 66),
      slot('OUV', 50, 56), slot('MÊL', 50, 44),
      slot('3L C', 50, 36),
      slot('2L G', 42, 29), slot('2L D', 58, 29),
      slot('PIL G', 38, 19), slot('TAL', 50, 19), slot('PIL D', 62, 19),
    ],
  },
];

/**
 * Le catalogue complet, range par « case » — une case = une discipline ET un
 * format. Le football en occupe trois.
 * @type {Record<string, Array<{ key: string, label: string, slots: FormationSlot[] }>>}
 */
const CATALOG_BY_BUCKET = {
  basketball: BASKETBALL,
  football11: FOOTBALL_11,
  football5: FOOTBALL_5,
  football8: FOOTBALL_8,
  futsal: FUTSAL,
  handball: HANDBALL,
  rugby: RUGBY_XV,
  rugby13: RUGBY_XIII,
  volleyball: VOLLEYBALL,
};

/**
 * La case par defaut de chaque sport — celle qui alimente les tables
 * historiques et le terrain quand aucune categorie n'est connue.
 * @type {Record<string, string>}
 */
export const DEFAULT_BUCKET_BY_SPORT_KEY = {
  basketball: 'basketball',
  football: 'football11',
  futsal: 'futsal',
  handball: 'handball',
  rugby: 'rugby',
  rugby13: 'rugby13',
  volleyball: 'volleyball',
};

const normalizeText = (/** @type {any} */ value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/**
 * ⚽ Le FORMAT du football se lit dans la catégorie de l'équipe.
 *
 * 📏 MESURE du 2026-09-05 en production : les categories vont de `U6` a `U21`,
 * plus `Sénior`, et chacune existe en DOUBLE — avec et sans l'age entre
 * parentheses (`U15 (15 ans)` et `U15`). Seules les variantes avec parentheses
 * portent des equipes. Cette fonction accepte les deux : un libelle ne doit pas
 * pouvoir faire rater un format.
 *
 * ⛔ Categorie absente ou inconnue ⇒ **11**, c'est-a-dire le comportement
 * d'aujourd'hui. On ne retire jamais des postes sur une supposition.
 * @param {string} [category]
 * @returns {5 | 8 | 11}
 */
export const getFootballFormatFromCategory = (category) => {
  const age = Number(normalizeText(category).match(/\bu\s?(\d{1,2})\b/)?.[1]);
  if (!Number.isFinite(age)) return 11;
  if (age <= 9) return 5;
  if (age <= 13) return 8;
  return 11;
};

/**
 * La case du catalogue qui correspond a ce sport et a cette categorie.
 * @param {string} [sport] Le libelle brut du sport.
 * @param {string} [category] La categorie de l'equipe (« U15 (15 ans) »).
 * @returns {string | null} `null` quand la discipline n'a aucune disposition.
 */
const resolveBucket = (sport, category) => {
  const sportKey = getTacticalSportKey(sport);
  if (sportKey !== 'football') return DEFAULT_BUCKET_BY_SPORT_KEY[sportKey] || null;
  return `football${getFootballFormatFromCategory(category)}`;
};

/**
 * Les compos type proposables pour ce sport et cette categorie.
 *
 * 🕳️ Rend une liste VIDE pour les ~130 activites sans terrain a postes (judo,
 * danse, roller, baseball, football americain…). ⛔ **On n'invente aucun
 * terrain** : l'ecran le DIT, avec une phrase, au lieu de griser en silence.
 * @param {string} [sport]
 * @param {string} [category]
 * @returns {MatchFormation[]}
 */
export const getMatchFormations = (sport, category) => {
  const bucket = resolveBucket(sport, category);
  if (!bucket) return [];
  return (CATALOG_BY_BUCKET[bucket] || []).map((formation) => ({
    bucket,
    key: formation.key,
    label: formation.label,
    slots: formation.slots,
    starters: formation.slots.length,
  }));
};

/**
 * Une compo type nommee, ou `null` si elle n'existe pas pour ce sport.
 * @param {string} [sport]
 * @param {string} [category]
 * @param {string} [key]
 * @returns {MatchFormation | null}
 */
export const getMatchFormationByKey = (sport, category, key) => (
  getMatchFormations(sport, category).find((formation) => formation.key === key) || null
);

/**
 * Les tables historiques `MATCH_FORMATIONS` / `MATCH_POSITION_LABELS`, derivees
 * de la PREMIERE compo type de chaque sport.
 *
 * 🔒 C'est ce qui garantit qu'il n'y a qu'UNE source de verite : le jour ou une
 * disposition change ici, les 4 ecrans qui lisent ces tables suivent tout seuls.
 * @returns {{ formations: Record<string, any>, labels: Record<string, string[]> }} Les 2
 *   tables historiques : positions `[x, y]` par sport, et libelles par sport.
 */
export const buildLegacyFormationTables = () => {
  /** @type {any} */
  const formations = {};
  /** @type {any} */
  const labels = {};

  Object.entries(DEFAULT_BUCKET_BY_SPORT_KEY).forEach(([sportKey, bucket]) => {
    const first = (CATALOG_BY_BUCKET[bucket] || [])[0];
    if (!first) return;
    formations[sportKey] = first.slots.map(
      (entry) => /** @type {[number, number]} */ ([entry.positionX, entry.positionY]),
    );
    labels[sportKey] = first.slots.map((entry) => entry.label);
  });

  return { formations, labels };
};

/**
 * 🥇 LA TRADUCTION « poste declare par le joueur » → « case du terrain ».
 *
 * 📏 MESURE du 2026-09-05 en production : **35 joueurs sur 133** renseignent
 * leur poste (`up_users.position`), un compte peut en declarer plusieurs
 * separes par des virgules, et le vocabulaire compte 14 valeurs. Elles viennent
 * de `src/constants/positions.js` — sauf deux, constatees en base et absentes
 * de cette liste : `Buteur` et `3 eme ligne`. Les deux sont traitees ici.
 *
 * ⚠️ **`3 eme ligne` est un poste de RUGBY** — le vocabulaire du champ n'est PAS
 * que du football. Ce qu'on en fait : il est reconnu dans les tables `rugby` et
 * `rugby13`, et **ignore** sur un terrain de football, ou son porteur reste au
 * banc. ⛔ Le poser « quelque part » serait un placement faux, donc pire qu'un
 * terrain vide.
 *
 * 🎯 CHAQUE ENTREE EST UNE LISTE DE PREFERENCE, dans l'ordre : on prend la
 * premiere case ENCORE LIBRE. C'est ce qui repond au cas des deux `DC` pour un
 * seul « Défenseur central », et c'est ce qui evite qu'un milieu central se
 * retrouve au banc parce que le 4-3-3 nomme ses trois milieux `MD` / `MC` / `MG`.
 * @type {Record<string, Record<string, string[]>>}
 */
const SLOT_PREFERENCES_BY_FAMILY = {
  basketball: {
    ailier: ['AIL', 'AF'],
    'ailier fort': ['AF', 'PIV', 'AIL'],
    arriere: ['ARR', 'MEN'],
    meneur: ['MEN', 'ARR'],
    pivot: ['PIV', 'AF'],
  },
  football: {
    // 🪤 CE QU'UN TEMOIN A ATTRAPE, et qu'aucune relecture n'aurait vu : un
    // 4-4-2 n'a AUCUN poste d'ailier. Sans les deux derniers replis, un joueur
    // qui declare « Ailier droit » restait au banc PENDANT QU'UN POSTE
    // D'ATTAQUANT RESTAIT VIDE. Un ailier qui glisse en pointe est un
    // deplacement d'entraineur banal ; le banc, lui, est un aveu d'echec.
    ailier: ['AD', 'AG', 'MD', 'MG', 'AT', 'BU'],
    'ailier droit': ['AD', 'MD', 'AT', 'BU'],
    'ailier gauche': ['AG', 'MG', 'AT', 'BU'],
    attaquant: ['BU', 'AT', 'AD', 'AG'],
    'avant centre': ['BU', 'AT'],
    buteur: ['BU', 'AT'],
    'defenseur central': ['DC'],
    gardien: ['GB'],
    'lateral droit': ['DD', 'DC'],
    'lateral gauche': ['DG', 'DC'],
    'milieu central': ['MC', 'MDF', 'MD', 'MG', 'MO'],
    'milieu defensif': ['MDF', 'MC', 'MD', 'MG', 'MO'],
    'milieu offensif': ['MO', 'MC', 'MD', 'MG', 'MDF'],
  },
  futsal: {
    ailier: ['AIL D', 'AIL G'],
    'ailier droit': ['AIL D', 'AIL G'],
    'ailier gauche': ['AIL G', 'AIL D'],
    attaquant: ['PIV', 'AIL D', 'AIL G'],
    'avant centre': ['PIV'],
    buteur: ['PIV'],
    'defenseur central': ['DEF'],
    gardien: ['GB'],
    'lateral droit': ['DEF', 'AIL D'],
    'lateral gauche': ['DEF', 'AIL G'],
    'milieu central': ['AIL D', 'AIL G', 'DEF'],
    'milieu defensif': ['DEF', 'AIL D', 'AIL G'],
    'milieu offensif': ['AIL D', 'AIL G', 'PIV'],
  },
  handball: {
    'ailier droit': ['AID'],
    'ailier gauche': ['AIG'],
    'arriere droit': ['ARD', 'ARC'],
    'arriere gauche': ['ARG', 'ARC'],
    'demi centre': ['ARC'],
    gardien: ['GB'],
    pivot: ['PIV'],
  },
  rugby: {
    '2 eme ligne': ['2L G', '2L D'],
    '3 eme ligne': ['3L G', '3L D', 'N°8'],
    ailier: ['AI G', 'AI D'],
    arriere: ['ARR'],
    centre: ['CE 1', 'CE 2'],
    'demi de melee': ['MÊL'],
    'demi d ouverture': ['OUV'],
    'deuxieme ligne': ['2L G', '2L D'],
    pilier: ['PIL G', 'PIL D'],
    talonneur: ['TAL'],
    'troisieme ligne': ['3L G', '3L D', 'N°8'],
    'troisieme ligne aile': ['3L G', '3L D'],
    'troisieme ligne centre': ['N°8', '3L G', '3L D'],
  },
  rugby13: {
    '2 eme ligne': ['2L G', '2L D'],
    '3 eme ligne': ['3L C'],
    ailier: ['AI G', 'AI D'],
    arriere: ['ARR'],
    centre: ['CE G', 'CE D'],
    'demi de melee': ['MÊL'],
    'demi d ouverture': ['OUV'],
    'deuxieme ligne': ['2L G', '2L D'],
    pilier: ['PIL G', 'PIL D'],
    talonneur: ['TAL'],
    'troisieme ligne': ['3L C'],
    'troisieme ligne aile': ['3L C'],
    'troisieme ligne centre': ['3L C'],
  },
  volleyball: {
    central: ['CEN', 'P3', 'P6'],
    libero: ['LIB', 'P6', 'P5'],
    passeur: ['PAS', 'P1', 'P2'],
    pointu: ['PTU', 'P2', 'P4'],
    'receptionneur attaquant': ['R4', 'P4', 'P5'],
  },
};

/**
 * La famille de vocabulaire d'une case du catalogue.
 * @type {Record<string, string>}
 */
const FAMILY_BY_BUCKET = {
  basketball: 'basketball',
  football11: 'football',
  football5: 'football',
  football8: 'football',
  futsal: 'futsal',
  handball: 'handball',
  rugby: 'rugby',
  rugby13: 'rugby13',
  volleyball: 'volleyball',
};

/**
 * L'identifiant de poste employe partout ailleurs dans la composition.
 * ⚠️ Meme forme que `buildFormationSlots` (`matchCompositionUtils`) : c'est ce
 * qui permet a un placement automatique d'etre repris, deplace et enregistre
 * comme un placement fait a la main.
 * @param {string} teamEntryId
 * @param {number} index
 * @returns {string}
 */
const buildSlotId = (teamEntryId, index) => `${teamEntryId}:slot_${index + 1}`;

/**
 * Les postes declares par un joueur, normalises, dans l'ordre ou il les a ecrits.
 * @param {any} player
 * @returns {string[]}
 */
const readDeclaredPositions = (player) => String(player?.position ?? '')
  .split(',')
  .map((entry) => normalizeText(entry))
  .filter(Boolean);

/**
 * 🥇 PLACE LES CONVOQUES SUR LEUR POSTE DECLARE.
 *
 * ## Les 3 regles, en mots d'utilisateur
 * 1. **Premier arrive, premier servi.** Deux joueurs qui visent la meme case :
 *    celui qui apparait le premier dans la liste des convoques la prend. C'est
 *    l'ordre que le coach VOIT, donc un resultat previsible — et il le corrige
 *    d'un seul glissement. *(Les deux autres dessins ont ete ecartes : « le
 *    mieux note d'abord » n'existe pas en base, et « on en place un et on dit
 *    que l'autre attend » est exactement ce que fait cette regle.)*
 * 2. **Sans poste declare, on reste au banc.** Jamais pose au hasard : un
 *    placement faux est pire qu'un terrain vide, parce que le coach ne le voit
 *    pas.
 * 3. **Personne ne disparait.** `placements.length + unplacedPlayerIds.length`
 *    vaut toujours le nombre de convoques — un temoin le fige.
 * @param {object} input
 * @param {MatchFormation | null} [input.formation]
 * @param {any[]} [input.players] Les convoques, dans l'ordre d'affichage.
 * @param {string} [input.teamEntryId]
 * @returns {{ placements: any[], unplacedPlayerIds: string[] }} Les jetons poses,
 *   et les convoques restes au banc — leur somme vaut toujours l'effectif convoque.
 */
export const buildAutoPlacementsByDeclaredPosition = ({
  formation = null, players = [], teamEntryId = 'team_1',
}) => {
  const list = Array.isArray(players) ? players : [];
  const family = FAMILY_BY_BUCKET[formation?.bucket || ''] || '';
  const preferences = SLOT_PREFERENCES_BY_FAMILY[family] || null;

  if (!formation || !preferences) {
    return {
      placements: [],
      unplacedPlayerIds: list
        .map((player) => String(player?.documentId || player?.id || ''))
        .filter(Boolean),
    };
  }

  /** Les cases encore libres, groupees par libelle et dans l'ordre du terrain. */
  const freeSlotsByLabel = new Map();
  formation.slots.forEach((entry, index) => {
    const bucket = freeSlotsByLabel.get(entry.label) || [];
    bucket.push({ ...entry, slotId: buildSlotId(teamEntryId, index) });
    freeSlotsByLabel.set(entry.label, bucket);
  });

  /** @type {any[]} */
  const placements = [];
  /** @type {string[]} */
  const unplacedPlayerIds = [];

  list.forEach((player) => {
    const playerId = String(player?.documentId || player?.id || '');
    if (!playerId) return;

    const wanted = readDeclaredPositions(player)
      .flatMap((declared) => preferences[declared] || []);
    const label = wanted.find((candidate) => (freeSlotsByLabel.get(candidate) || []).length > 0);

    if (!label) {
      unplacedPlayerIds.push(playerId);
      return;
    }

    const target = freeSlotsByLabel.get(label).shift();
    placements.push({
      playerId,
      positionX: target.positionX,
      positionY: target.positionY,
      slotId: target.slotId,
    });
  });

  return { placements, unplacedPlayerIds };
};
