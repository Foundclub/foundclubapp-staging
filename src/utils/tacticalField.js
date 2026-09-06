/**
 * L'aiguillage « nom de sport » → « terrain tactique ».
 *
 * 🚨 LOT TERRAIN (2026-09-05) — CE QUI A CHANGE, ET POURQUOI ÇA TOUCHAIT
 * 2 148 CLUBS.
 *
 * L'aiguillage devinait avec des `includes()` : tout ce qui contenait « foot »
 * devenait du football a 11. Mesure faite en PRODUCTION le 05/09 :
 *   · Futsal — 1 712 clubs — recevait les 11 postes du football (il se joue a 5)
 *   · Football americain / Flag — 281 clubs — recevait « Gardien », « Ailier »…
 *   · Rugby a XIII — 155 clubs — recevait les 15 postes du XV
 *
 * ⇒ On NOMME desormais chaque discipline, et l'ORDRE des regles fait partie du
 * comportement : « futsal » se reconnait AVANT « foot », « rugby a XIII » AVANT
 * « rugby ». Le temoin `__tests__/tacticalFieldTERRAIN.test.js` fige cet ordre.
 *
 * 🎨 DEUX NOTIONS, ET C'EST VOLONTAIRE :
 *   · `getTacticalSportKey`      — la DISCIPLINE (combien de joueurs, quels
 *     postes). Le futsal y a sa propre cle.
 *   · `getTacticalFieldFamilyKey` — la famille de DESSIN (quelles lignes,
 *     quelles couleurs). Le futsal y retombe sur le football.
 * Sans cette separation, ajouter `futsal` aurait fait tomber les 3 tables de
 * dessin de `RenderedTacticalField` dans leur repli `generic` : un terrain GRIS
 * pour 1 712 clubs. La carte des appelants (R2) l'a montre avant l'ecriture.
 */

const FIELD_ASPECT_RATIOS = {
  basketball: 1.7,
  football: 1.5,
  // Le futsal se joue sur un terrain de handball (40 × 20) : meme rapport.
  futsal: 1.5,
  generic: 1.5,
  handball: 1.5,
  rugby: 1.4,
  // Le XIII se joue sur la meme pelouse que le XV.
  rugby13: 1.4,
  volleyball: 1.8,
};

/**
 * La famille de DESSIN de chaque discipline qui n'a pas la sienne. Absente de
 * cette table = la discipline se dessine avec sa propre cle.
 * @type {Record<string, string>}
 */
const FIELD_FAMILY_BY_SPORT_KEY = {
  futsal: 'football',
  rugby13: 'rugby',
};

const normalizeSportInput = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ');

/**
 * Les regles d'aiguillage, DANS L'ORDRE — le premier motif qui accroche gagne.
 *
 * ⛔ NE PAS REORDONNER SANS LIRE LE TEMOIN : « football americain » contient
 * « foot », « rugby a xiii » contient « rugby ». C'est la position dans cette
 * liste, et rien d'autre, qui empeche le mauvais terrain.
 * @type {Array<{ key: string, patterns: RegExp[] }>}
 */
const SPORT_RULES = [
  // 1️⃣ D'abord les disciplines que les motifs generiques rattraperaient.
  {
    // 🕳️ Le football americain et le flag n'ont NI gardien NI ailier au sens du
    // football, et le depot n'a aucune disposition validee pour eux. On rend
    // donc `generic` : terrain neutre, placement libre, et l'ecran l'EXPLIQUE.
    // ⛔ Inventer une attaque a 11 ici serait inventer un terrain (§1 bis).
    key: 'generic',
    patterns: [/\bfootball americain\b/, /\bfoot us\b/, /\bamerican football\b/, /\bflag\b/],
  },
  {
    key: 'futsal',
    patterns: [/\bfutsal\b/, /\bfoot(ball)? en salle\b/, /\bfoot(ball)? a 5\b/],
  },
  {
    key: 'rugby13',
    patterns: [/\brugby a (xiii|13)\b/, /\brugby (xiii|13)\b/, /\brugby league\b/],
  },
  // 2️⃣ Puis les motifs larges, inchanges depuis toujours.
  { key: 'basketball', patterns: [/basket/] },
  { key: 'football', patterns: [/foot/, /soccer/] },
  { key: 'handball', patterns: [/hand/] },
  { key: 'rugby', patterns: [/rugby/] },
  { key: 'volleyball', patterns: [/volley/] },
];

/**
 * Normalizes a sport label to a tactical field key.
 * @param {string | null | undefined} sport
 * @returns {'basketball' | 'football' | 'futsal' | 'generic' | 'handball' | 'rugby' | 'rugby13' | 'volleyball'}
 */
export const getTacticalSportKey = (sport) => {
  const normalized = normalizeSportInput(sport);
  if (!normalized) return 'generic';

  const rule = SPORT_RULES.find(
    (candidate) => candidate.patterns.some((pattern) => pattern.test(normalized)),
  );
  return /** @type {any} */ (rule?.key || 'generic');
};

/**
 * La cle a employer pour DESSINER le terrain (lignes, couleurs, degrade).
 *
 * 🎨 Elle vaut la cle de sport pour tout le monde, sauf pour les disciplines
 * qui partagent le terrain d'une autre : le futsal se dessine en football, le
 * rugby a XIII en rugby.
 * ⚠️ Le type de retour n'a QUE les 6 cles d'origine, et ce n'est pas une
 * approximation : `futsal` et `rugby13` sont les 2 seules cles neuves, et
 * toutes deux ont une famille. Le dire au verificateur de types evite que les
 * 3 tables de dessin, indexees par cette cle, ne deviennent des `any`.
 * @param {string | null | undefined} sport
 * @returns {'basketball' | 'football' | 'generic' | 'handball' | 'rugby' | 'volleyball'}
 */
export const getTacticalFieldFamilyKey = (sport) => {
  const key = getTacticalSportKey(sport);
  return /** @type {any} */ (FIELD_FAMILY_BY_SPORT_KEY[key] || key);
};

/**
 * Returns the tactical field aspect ratio for a sport.
 * @param {string | null | undefined} sport
 * @returns {number}
 */
export const getTacticalFieldAspectRatio = (sport) => (
  FIELD_ASPECT_RATIOS[getTacticalSportKey(sport)] || FIELD_ASPECT_RATIOS.generic
);
