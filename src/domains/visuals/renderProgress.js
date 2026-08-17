/**
 * app/src/domains/visuals/renderProgress.js
 *
 * COMBIEN DE TEMPS DURE LA FABRICATION D'UNE AFFICHE — et ce que l'écran a le
 * droit d'en montrer.
 *
 * S07 (2026-08-16), demande d'Adel : « pendant qu'une affiche se fabrique,
 * l'écran ne dit pas combien de temps il reste ». Une attente muette ressemble à
 * une panne : c'est ce qui pousse à appuyer une deuxième fois.
 *
 * ⚠️ CE FICHIER NE MESURE RIEN À L'EXÉCUTION. Il porte une ESTIMATION, et
 * l'écran le dit (« environ »). Les chiffres viennent de la mesure du 2026-08-07
 * consignée dans `useEventShowcase.js` (rejeu de
 * `admin/src/api/visual-asset/services/visual-renderer.ts`, format `post`,
 * Chromium déjà chaud) :
 *   composer le HTML 3-5 ms · ouvrir la page 40-95 ms · charger la page ~990 ms
 *   · **la capture 540 à 1 300 ms** ⇒ **1,6 à 2,3 s**, puis **0,5 à 1,7 Mo** à
 *   rapatrier.
 *
 * ⇒ Seule LA CAPTURE dépend du format : elle suit le nombre de pixels rendus
 * (`visual-renderer.ts:106`, `deviceScaleFactor = RASTER_SCALE = 2`).
 *   · `post`  1080×1350 ×2 = 5,8 Mpx — LA RÉFÉRENCE MESURÉE.
 *   · `story` 1080×1920 ×2 = 8,3 Mpx ⇒ capture ×1,42 ⇒ ~1,8 à 2,9 s de serveur,
 *     et un fichier d'autant plus lourd à rapatrier.
 *   · `a4`    1240×1754 ×1 = 2,2 Mpx, mais chaîne PDF (`page.pdf`) et non
 *     capture d'écran : **SUPPOSÉ, jamais mesuré** — aligné sur `post` avec une
 *     marge.
 * S'y ajoute LE TRANSPORT, qui dépend du réseau du téléphone et que personne ne
 * peut prédire : on provisionne ~1,2 s par affiche (≈ 1 Mo en 4G correcte).
 *
 * 🚫 CE QUI EST INTERDIT ICI, et pourquoi les deux garde-fous existent :
 *   · la barre ne doit JAMAIS atteindre le bout avant que l'affiche existe
 *     (`PROGRESS_CAP`) — une barre pleine devant un écran vide est un mensonge ;
 *   · le temps restant ne doit JAMAIS valoir 0 (`remainingSeconds` vaut `null`
 *     dès le dépassement) — un compteur figé sur « 0 s » transforme une attente
 *     normale en panne apparente.
 */

/**
 * Ce qu'on annonce, format par format. Somme du serveur (mesuré, borne haute) et
 * du transport (provisionné). Annoncer la borne HAUTE est volontaire : finir en
 * avance ne coûte rien, finir en retard casse la confiance.
 */
export const RENDER_ESTIMATE_MS = {
  /** SUPPOSÉ (chaîne PDF jamais mesurée) : `post` + une marge. */
  a4: 4000,
  /** 2,3 s de serveur mesurées + 1,2 s de transport provisionnées. */
  post: 3500,
  /** 2,9 s de serveur déduites de la capture ×1,42 + 1,6 s de transport. */
  story: 4500,
};

/** Format inconnu (ajouté au serveur sans passer ici) : on reste sur la référence. */
export const DEFAULT_RENDER_ESTIMATE_MS = RENDER_ESTIMATE_MS.post;

/**
 * Le bout de la barre est RÉSERVÉ à l'affiche qui existe. Tant qu'elle n'est pas
 * là, la barre s'arrête ici — c'est ce qui l'empêche de mentir.
 */
export const PROGRESS_CAP = 0.92;

/**
 * Estimation annoncée pour un format de rendu.
 * @param {string} [format] - Clé de `VISUAL_FORMATS` (post / story / a4).
 * @returns {number} Millisecondes.
 */
export const getRenderEstimateMs = (format) => RENDER_ESTIMATE_MS[format]
  || DEFAULT_RENDER_ESTIMATE_MS;

/**
 * Ce que l'écran affiche à un instant donné d'une fabrication.
 * @param {object} params
 * @param {number} params.elapsedMs - Temps écoulé depuis le début de l'attente.
 * @param {string} [params.format] - Format demandé au serveur.
 * @returns {{
 *   estimateMs: number,
 *   overrun: boolean,
 *   ratio: number,
 *   remainingSeconds: number|null,
 * }} `ratio` ne dépasse jamais `PROGRESS_CAP` ; `remainingSeconds` vaut `null`
 *   au-delà de l'estimation (l'écran change alors de phrase) et jamais 0.
 */
export const getRenderProgress = ({ elapsedMs, format }) => {
  const estimateMs = getRenderEstimateMs(format);
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const overrun = elapsed >= estimateMs;

  return {
    estimateMs,
    overrun,
    ratio: overrun ? PROGRESS_CAP : (elapsed / estimateMs) * PROGRESS_CAP,
    // Plancher à 1 : la dernière seconde s'annonce « encore 1 s », jamais « 0 s ».
    remainingSeconds: overrun ? null : Math.max(1, Math.ceil((estimateMs - elapsed) / 1000)),
  };
};
