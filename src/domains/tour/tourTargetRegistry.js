/**
 * Registre des ancres du guide (TUTOE, pack design_handoff_tutoriels §3).
 * Chaque `TourTarget` monté y dépose sa fonction de mesure ; la couche du guide
 * ne mesure QUE les cibles de l'étape courante. Module plutôt que contexte :
 * une ancre qui apparaît ne doit pas refaire le rendu de toute l'app.
 * @typedef {{ height: number; width: number; x: number; y: number }} TourRect
 * @typedef {(done: (rect: TourRect | null) => void) => void} TourMeasure
 */

/** @type {Map<string, { clipTo?: string; measure: TourMeasure }>} */
const targets = new Map();
/** @type {Set<() => void>} */
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener());
};

/**
 * Dépose la mesure d’une ancre.
 * @param {string} id
 * @param {TourMeasure} measure
 * @param {{ clipTo?: string }} [options] - `clipTo` : ancre de la zone visible
 *   qui la contient (ex. un ScrollView) ; la mesure y est coupée.
 * @returns {() => void} désinscription (ne retire que SA mesure)
 */
export const registerTourTarget = (id, measure, options = {}) => {
  const entry = { clipTo: options.clipTo, measure };
  targets.set(id, entry);
  notify();
  return () => {
    if (targets.get(id) === entry) {
      targets.delete(id);
      notify();
    }
  };
};

/**
 * Une ancre a bougé (onLayout) : la couche re-mesure.
 * @returns {void}
 */
export const notifyTourTargetLayout = () => notify();

/**
 * Mesure brute d'une ancre montée (null si absente ou vide).
 * @param {string | undefined} id
 * @returns {Promise<TourRect | null>}
 */
const measureRaw = (id) => new Promise((resolve) => {
  const entry = id ? targets.get(id) : null;
  if (!entry) {
    resolve(null);
    return;
  }
  try {
    entry.measure((rect) => resolve(rect && rect.width > 0 && rect.height > 0 ? rect : null));
  } catch (error) {
    resolve(null);
  }
});

/**
 * Intersection de deux rectangles (null s'ils ne se touchent pas).
 * @param {TourRect} rect
 * @param {TourRect} clip
 * @returns {TourRect | null}
 */
const intersect = (rect, clip) => {
  const x = Math.max(rect.x, clip.x);
  const y = Math.max(rect.y, clip.y);
  const width = Math.min(rect.x + rect.width, clip.x + clip.width) - x;
  const height = Math.min(rect.y + rect.height, clip.y + clip.height) - y;
  return width > 0 && height > 0 ? {
    height, width, x, y,
  } : null;
};

/**
 * Mesure une ancre montée (null si absente ou vide), coupée à la zone visible
 * de son conteneur `clipTo` quand il est monté.
 * @param {string} id
 * @returns {Promise<TourRect | null>}
 */
export const measureTourTarget = async (id) => {
  const rect = /** @type {TourRect | null} */ (await measureRaw(id));
  const clip = rect ? /** @type {TourRect | null} */ (await measureRaw(targets.get(id)?.clipTo))
    : null;
  return rect && clip ? intersect(rect, clip) : rect;
};

/**
 * Prévient quand une ancre apparaît, part ou bouge.
 * @param {() => void} listener
 * @returns {() => void}
 */
export const subscribeToTourTargets = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetTourTargetsForTests = () => {
  targets.clear();
  listeners.clear();
};
