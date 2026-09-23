// LE SON D'UN VOCAL, EN NOMBRES — un seul exemplaire pour toute l'app.
//
// MSGLIVE (22/09) avait sorti ici, de `Conversation.js`, la conversion
// « niveau sonore → hauteur de barre » que quatre endroits recopiaient. VOCAL
// (23/09) l'a remplacée par les formules de la maquette de Claude Design, et a
// retiré l'ancienne avec son dernier utilisateur (`VoiceLevelBars`) : deux
// exemplaires du même calcul, c'est un des deux qu'on oublie de corriger.

/**
 * Borne une valeur entre un minimum et un maximum.
 * @param {number} value - La valeur.
 * @param {number} min - Le minimum.
 * @param {number} max - Le maximum.
 * @returns {number} La valeur bornée.
 */
export const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

// ─────────────────────────────────────────────────────────────────────────────
// VOCAL — LES CALCULS DE LA MAQUETTE DE CLAUDE DESIGN (23/09), en un seul
// exemplaire pour les trois endroits qui dessinent une onde : l'onde qui défile
// pendant l'enregistrement, la pastille de réécoute, et la bulle envoyée.
// Référence : `claude design/export/design_handoff_messages_vocaux/README.md`,
// sections « Forme d'onde » et « Gestes ». Témoins : `__tests__/voiceWaveform.test.js`.
//
// Les fonctions marquées « worklet » tournent AUSSI sur le fil d'animation
// (Reanimated) : c'est là que les barres se redessinent, sans jamais repasser
// par l'écran de conversation.
// ─────────────────────────────────────────────────────────────────────────────

/** La barre la plus basse : le souffle et le silence. */
export const VOICE_BAR_MIN = 3;
/** La barre la plus haute. */
export const VOICE_BAR_MAX = 24;
/** Le nombre de barres d'une bulle : sa largeur est fixe (280), jamais liée à la durée. */
export const VOICE_BUBBLE_BARS = 31;

/** L'appui qui démarre l'enregistrement. En dessous, c'est un toucher : la bulle d'aide. */
export const VOICE_HOLD_ACTIVATION_MS = 200;
/** Le carré autour du point de départ : le premier axe qui en sort gagne. */
export const VOICE_AXIS_LOCK_PX = 12;
/** Glisser à gauche jusqu'ici annule, sans attendre le relâché. */
export const VOICE_CANCEL_TX = -120;
/** Glisser vers le haut jusqu'ici verrouille : mains libres. */
export const VOICE_LOCK_TY = -80;
/** Une prise plus courte est jetée (un doigt qui a traîné, pas un message). */
export const VOICE_MIN_TAKE_MS = 800;
// VOCAL2 — LA DURÉE MAXIMALE : 10 MINUTES (décision d'Adel, 23/09 ~17h50 ;
// la maquette proposait 5:00, le lot VOCAL avait posé 20:00 en attendant).
// Arrivé là, l'enregistrement s'arrête tout seul et passe en RÉÉCOUTE : le
// vocal est gardé, jamais perdu. On prévient 15 s avant (chrono rouge +
// annonce au lecteur d'écran).
// 📏 LA MARGE avec le seul plafond qui existe, celui de l'envoi (20 Mo,
// `MAX_ATTACHMENT_BYTES.audio`, Conversation.js) : 10 min à 128 kbit/s
// (`VOICE_ENCODING_BITRATE`, réglé à l'enregistrement) = 9,6 Mo, moins de la
// moitié. Même un débit double tiendrait. Témoin : `voiceWaveform.test.js`.
/** Au-delà, l'enregistrement s'arrête tout seul et passe en réécoute. */
export const VOICE_MAX_TAKE_MS = 10 * 60 * 1000;
/** Combien de temps avant la limite on prévient. */
export const VOICE_LIMIT_WARNING_MS = 15 * 1000;
/** Le débit demandé à l'enregistreur (AAC, mono). */
export const VOICE_ENCODING_BITRATE = 128000;

/**
 * La prise approche-t-elle de la durée maximale ?
 * @param {number} dureeMs - La durée enregistrée.
 * @returns {boolean} true dans les 15 dernières secondes.
 */
export const isNearTakeLimit = (dureeMs) => {
  const duree = Number(dureeMs) || 0;
  return duree >= VOICE_MAX_TAKE_MS - VOICE_LIMIT_WARNING_MS && duree < VOICE_MAX_TAKE_MS;
};

/**
 * La forme d'un niveau : le seuil 0,02 écrase le souffle, l'exposant 0,7 rend
 * lisible une voix normale.
 * @param {number} niveau - Le niveau, entre 0 et 1.
 * @returns {number} La forme, entre 0 et 1.
 */
export const voiceLevelShape = (niveau) => {
  'worklet';

  const borne = Math.min(1, Math.max(0, (Number(niveau) - 0.02) / 0.98));
  return borne ** 0.7;
};

/**
 * La hauteur d'une barre : `3 + 21 · clamp((v − 0,02) / 0,98, 0, 1)^0,7`.
 * @param {number} niveau - Le niveau, entre 0 et 1.
 * @returns {number} La hauteur, en pixels (3 → 24).
 */
export const voiceBarHeight = (niveau) => {
  'worklet';

  return VOICE_BAR_MIN + ((VOICE_BAR_MAX - VOICE_BAR_MIN) * voiceLevelShape(niveau));
};

/**
 * Traduit ce que rend le micro en un niveau entre 0 et 1.
 *
 * Le téléphone rend des décibels (−160 → 0) : la conversion est celle de la
 * maquette, `((dB + 50) / 44)^1,4`. Quelques versions rendent déjà un rapport
 * (0 → 1) ou une amplitude : les deux restent comprises. Un micro muet (null)
 * rend 0 — l'onde continue de défiler, au plancher.
 * @param {unknown} metering - Le niveau rendu par le micro.
 * @returns {number} Le niveau, entre 0 et 1.
 */
export const meteringToLevel = (metering) => {
  if (metering === null || metering === undefined) return 0;
  const valeur = Number(metering);
  if (!Number.isFinite(valeur)) return 0;
  if (valeur <= 0) return clampNumber((valeur + 50) / 44, 0, 1) ** 1.4;
  if (valeur <= 1.2) return clampNumber(valeur, 0, 1);
  return clampNumber(valeur / 180, 0, 1);
};

/**
 * Réduit un vocal à `n` barres : le PIC de chaque tranche (pas la moyenne, les
 * syllabes restent visibles), normalisé sur le pic du vocal avec un plancher
 * à 0,2 (un chuchotement garde sa forme sans devenir un cri).
 * @param {number[]} niveaux - Les niveaux du vocal, entre 0 et 1.
 * @param {number} [n] - Le nombre de barres.
 * @returns {number[]} `n` valeurs entre 0 et 1.
 */
export const bucketPeaks = (niveaux, n = VOICE_BUBBLE_BARS) => {
  const source = Array.isArray(niveaux) ? niveaux : [];
  const total = source.length;
  const pics = [];
  for (let rang = 0; rang < n; rang += 1) {
    if (!total) {
      pics.push(0);
    } else {
      const debut = Math.floor((rang * total) / n);
      const fin = Math.max(debut + 1, Math.floor(((rang + 1) * total) / n));
      let pic = 0;
      for (let j = debut; j < fin && j < total; j += 1) pic = Math.max(pic, Number(source[j]) || 0);
      pics.push(pic);
    }
  }
  const sommet = Math.max(0.2, ...pics);
  return pics.map((pic) => pic / sommet);
};

/** L'ancienne échelle des ondes enregistrées avec le message (4 → 20). */
const HAUTEUR_STOCKEE_MIN = 4;
const HAUTEUR_STOCKEE_MAX = 20;

/**
 * L'onde à enregistrer avec le message.
 *
 * 🧭 POURQUOI L'ANCIENNE ÉCHELLE : les versions de l'app déjà installées
 * lisent `waveform` comme des hauteurs de 4 à 20 et n'en gardent que 32 ; le
 * serveur borne chaque valeur entre 0 et 40 et en garde 64
 * (`chat-message.ts`, `normalizeVoiceNoteComposition`). 31 pics sur 4 → 20
 * passent partout, sans rien changer côté serveur.
 * @param {number[]} niveaux - Tous les niveaux du vocal, entre 0 et 1.
 * @returns {number[]} 31 entiers entre 4 et 20 (vide si aucun niveau).
 */
export const levelsToStoredWaveform = (niveaux) => {
  if (!Array.isArray(niveaux) || niveaux.length === 0) return [];
  return bucketPeaks(niveaux).map((pic) => Math.round(
    HAUTEUR_STOCKEE_MIN + (pic * (HAUTEUR_STOCKEE_MAX - HAUTEUR_STOCKEE_MIN)),
  ));
};

/**
 * Relit une onde enregistrée en niveaux 0 → 1.
 * Les hauteurs 0 → 40 (toutes les versions de l'app) sont ramenées depuis
 * l'échelle 4 → 20 ; une très vieille onde en décibels est normalisée entre
 * son minimum et son maximum.
 * @param {unknown} onde - L'onde du message.
 * @returns {number[]} Les niveaux (vide si l'onde est absente ou illisible).
 */
export const storedWaveformToLevels = (onde) => {
  if (!Array.isArray(onde)) return [];
  const valeurs = onde
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter(Number.isFinite);
  if (valeurs.length === 0) return [];
  if (valeurs.every((v) => v >= 0 && v <= 40)) {
    return valeurs.map((v) => (
      (clampNumber(v, HAUTEUR_STOCKEE_MIN, HAUTEUR_STOCKEE_MAX) - HAUTEUR_STOCKEE_MIN)
      / (HAUTEUR_STOCKEE_MAX - HAUTEUR_STOCKEE_MIN)
    ));
  }
  const min = Math.min(...valeurs);
  const ecart = Math.max(...valeurs) - min;
  if (ecart < 0.6) return valeurs.map(() => 0);
  return valeurs.map((v) => (v - min) / ecart);
};

/**
 * L'axe du geste : décidé au premier franchissement du carré de 12 px, puis
 * figé jusqu'au relâché.
 * @param {number} dx - Le déplacement horizontal depuis l'appui.
 * @param {number} dy - Le déplacement vertical depuis l'appui.
 * @param {'x' | 'y' | null} axe - L'axe déjà choisi, s'il y en a un.
 * @returns {'x' | 'y' | null} L'axe.
 */
export const resolveGestureAxis = (dx, dy, axe) => {
  'worklet';

  if (axe) return axe;
  if (Math.abs(dx) > VOICE_AXIS_LOCK_PX && Math.abs(dx) >= Math.abs(dy)) return 'x';
  if (Math.abs(dy) > VOICE_AXIS_LOCK_PX) return 'y';
  return null;
};

/**
 * Une prise trop courte pour être un message.
 * @param {number} dureeMs - La durée enregistrée.
 * @returns {boolean} true si elle doit être jetée.
 */
export const isTakeTooShort = (dureeMs) => (Number(dureeMs) || 0) < VOICE_MIN_TAKE_MS;

/**
 * Le temps affiché : m:ss (0:02, 1:01, 5:00), jamais 00:02.
 * @param {unknown} dureeMs - La durée, en millisecondes.
 * @returns {string} Le libellé.
 */
export const formatVoiceClock = (dureeMs) => {
  const secondes = Math.max(0, Math.floor((Number(dureeMs) || 0) / 1000));
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;
};

/**
 * La vitesse affichée : 1×, 1,5×, 2×.
 * @param {number} vitesse - La vitesse de lecture.
 * @param {string} [separateur] - Le séparateur décimal de la langue.
 * @returns {string} Le libellé.
 */
export const formatVoiceSpeed = (vitesse, separateur = ',') => (
  `${String(vitesse).replace('.', separateur)}×`
);
