// MSGLIVE — LA CONVERSION « NIVEAU SONORE → HAUTEUR DE BARRE », en un seul
// exemplaire.
//
// Ce calcul vivait dans `Conversation.js`, au milieu de 7 400 lignes, et QUATRE
// endroits s'en servaient déjà : les barres vivantes pendant l'enregistrement,
// le brouillon qu'on relit avant d'envoyer, la forme d'onde qu'on garde à
// l'arrêt, et le repli quand le micro ne sait pas donner de niveau. Il sort ici
// tel quel — même code, mêmes bornes — le jour où les barres vivantes sont
// devenues un composant à part. Deux exemplaires du même calcul, c'est un des
// deux qu'on oublie de corriger.

/** Le nombre de barres qu'on garde en mémoire (l'historique du vocal). */
export const VOICE_WAVEFORM_MAX_BARS = 32;
/** Le nombre de barres réellement affichées à l'écran. */
export const VOICE_WAVEFORM_VISIBLE_BARS = 20;
/** La barre la plus basse : même dans le silence, on voit qu'il se passe quelque chose. */
export const VOICE_BAR_MIN_HEIGHT = 4;
/** La barre la plus haute. */
export const VOICE_BAR_MAX_HEIGHT = 20;

/**
 * Borne une valeur entre un minimum et un maximum.
 * @param {number} value - La valeur.
 * @param {number} min - Le minimum.
 * @param {number} max - Le maximum.
 * @returns {number} La valeur bornée.
 */
export const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Traduit un niveau sonore en hauteur de barre.
 *
 * Le micro ne parle pas la même langue partout : iOS et Android rendent des
 * décibels négatifs (−160 à 0), certaines versions rendent un rapport entre 0
 * et 1, d'autres une valeur jusqu'à 220. Les trois cas sont traités, et une
 * valeur déjà convertie (entre 4 et 36) est reconnue et rendue telle quelle —
 * c'est ce qui permet de relire un brouillon sans re-convertir ses hauteurs.
 *
 * Quand le micro ne sait rien dire du niveau, on ne fige pas l'affichage : une
 * onde régulière remplace la mesure, pour que l'écran montre au moins que
 * l'enregistrement tourne.
 * @param {unknown} metering - Le niveau rendu par le micro, ou null.
 * @param {number} [durationMs] - La durée écoulée, pour le repli animé.
 * @param {number} [index] - Le rang de la barre, pour décaler le repli.
 * @returns {number} La hauteur de la barre, en pixels.
 */
export const toVoiceWaveBarHeight = (metering, durationMs = 0, index = 0) => {
  const parsedMetering = Number(metering);
  if (Number.isFinite(parsedMetering)) {
    // Already-rendered heights from previous drafts/messages.
    if (parsedMetering >= 4 && parsedMetering <= 36) {
      return clampNumber(Math.round(parsedMetering), VOICE_BAR_MIN_HEIGHT, VOICE_BAR_MAX_HEIGHT);
    }
    let ratio = 0;
    // Most metering values are in dB scale (e.g. -160 to 0).
    if (parsedMetering <= 10 && parsedMetering >= -200) {
      ratio = (parsedMetering + 120) / 120;
    } else if (parsedMetering >= 0 && parsedMetering <= 1.2) {
      ratio = parsedMetering;
    } else if (parsedMetering > 1.2 && parsedMetering <= 220) {
      ratio = parsedMetering / 180;
    }
    ratio = clampNumber(ratio, 0, 1);
    return Math.round(4 + (ratio * 16));
  }

  // Fallback animation when metering is unavailable on the platform/build.
  const phase = ((Number(durationMs) || 0) / 180) + (index * 0.8);
  const value = (Math.sin(phase) + 1) / 2;
  return Math.round(5 + (value * 13));
};

export default toVoiceWaveBarHeight;

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
// ponytail: la maquette propose 5:00 (question 5, posée à Adel le 23/09).
// Consigne du lot en attendant : GARDER LA LIMITE ACTUELLE. Il n'y en avait
// aucune à l'enregistrement ; la seule était l'envoi, refusé au-delà de 20 Mo
// (`MAX_ATTACHMENT_BYTES.audio`, Conversation.js), soit ≈ 21:50 à 128 kbit/s.
// 20:00 reste sous ce plafond : rien de ce qui partait hier n'est refusé, et
// ce qui échouait à l'envoi s'arrête désormais tout seul en réécoute.
// Sortie : remplacer par la valeur qu'Adel tranchera.
/** Au-delà, l'enregistrement s'arrête tout seul et passe en réécoute. */
export const VOICE_MAX_TAKE_MS = 20 * 60 * 1000;

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
