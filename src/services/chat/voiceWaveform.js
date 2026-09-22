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
