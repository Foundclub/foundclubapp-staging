/**
 * Registre des ancres du guide (TUTOE, pack design_handoff_tutoriels §3).
 * Chaque `TourTarget` monté y dépose sa fonction de mesure ; la couche du guide
 * ne mesure QUE les cibles de l'étape courante. Module plutôt que contexte :
 * une ancre qui apparaît ne doit pas refaire le rendu de toute l'app.
 * @typedef {{ height: number; width: number; x: number; y: number }} TourRect
 * @typedef {(done: (rect: TourRect | null) => void) => void} TourMeasure
 */

/** @type {Map<string, TourMeasure>} */
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
 * @returns {() => void} désinscription (ne retire que SA mesure)
 */
export const registerTourTarget = (id, measure) => {
  targets.set(id, measure);
  notify();
  return () => {
    if (targets.get(id) === measure) {
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
 * Mesure une ancre montée (null si absente ou vide).
 * @param {string} id
 * @returns {Promise<TourRect | null>}
 */
export const measureTourTarget = (id) => new Promise((resolve) => {
  const measure = targets.get(id);
  if (!measure) {
    resolve(null);
    return;
  }
  try {
    measure((rect) => resolve(rect && rect.width > 0 && rect.height > 0 ? rect : null));
  } catch (error) {
    resolve(null);
  }
});

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
