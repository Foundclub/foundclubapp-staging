/**
 * Registre des ancres du guide (TUTOE, pack design_handoff_tutoriels §3).
 * Chaque `TourTarget` monté y dépose sa fonction de mesure ; la couche du guide
 * ne mesure QUE les cibles de l'étape courante. Module plutôt que contexte :
 * une ancre qui apparaît ne doit pas refaire le rendu de toute l'app.
 * @typedef {{ height: number; width: number; x: number; y: number }} TourRect
 * @typedef {(done: (rect: TourRect | null) => void) => void} TourMeasure
 */

// Plusieurs écrans d'une pile peuvent porter le même id (« Suivant » d'un
// tunnel) : chaque ancre garde sa propre entrée, et la mesure prend la plus
// récente des ancres actives (son écran a le focus, lu au moment de mesurer).
/**
 * @typedef {{ clipTo?: string; inSheet?: boolean; isActive?: () => boolean;
 *   measure: TourMeasure; reveal?: (options?: any) => void }} TourEntry
 */
/** @type {Map<string, TourEntry[]>} */
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
 * @param {{ clipTo?: string; inSheet?: boolean; isActive?: () => boolean }} [options] -
 *   `clipTo` : ancre de la zone visible qui la contient (ex. un ScrollView) ; la mesure y
 *   est coupée. `isActive` : l'ancre compte-t-elle en ce moment (focus) ?
 *   `inSheet` : l'ancre vit dans une feuille du bas (BottomModal), au-dessus de l'écran.
 * @returns {() => void} désinscription (ne retire que SA mesure)
 */
export const registerTourTarget = (id, measure, options = {}) => {
  /** @type {TourEntry} */
  const entry = {
    clipTo: options.clipTo,
    inSheet: options.inSheet,
    isActive: options.isActive,
    measure,
    reveal: options.reveal,
  };
  targets.set(id, [...(targets.get(id) || []), entry]);
  notify();
  return () => {
    const rest = (targets.get(id) || []).filter((candidate) => candidate !== entry);
    if (rest.length) targets.set(id, rest);
    else targets.delete(id);
    notify();
  };
};

/**
 * L'ancre qui compte pour cet id : la plus récente des actives.
 * @param {string | undefined} id
 * @returns {TourEntry | null}
 */
const activeEntry = (id) => {
  const entries = id ? targets.get(id) || [] : [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry.isActive || entry.isActive()) return entry;
  }
  return null;
};

/**
 * Une ancre a bougé (onLayout) : la couche re-mesure.
 * @returns {void}
 */
export const notifyTourTargetLayout = () => notify();

// GUIDE-D-CORR-2 (décision d'Adel, 08/11) : les zones qui défilent des écrans du guide
// (`useTourScroller`). La couche y fait défiler l'écran jusqu'à la cible de l'étape.
/**
 * @typedef {{ isActive?: () => boolean; measure: TourMeasure;
 *   scrollBy: (dy: number) => void }} TourScroller
 */
/** @type {TourScroller[]} */
const scrollers = [];

/**
 * Dépose une zone qui défile (ScrollView, FlatList) d'un écran du guide.
 * @param {TourScroller} scroller
 * @returns {() => void} désinscription
 */
export const registerTourScroller = (scroller) => {
  scrollers.push(scroller);
  return () => {
    const index = scrollers.indexOf(scroller);
    if (index !== -1) scrollers.splice(index, 1);
  };
};

/**
 * La zone qui défile de l'écran affiché : la plus récente des actives (focus).
 * @returns {TourScroller | null}
 */
export const getActiveTourScroller = () => {
  for (let index = scrollers.length - 1; index >= 0; index -= 1) {
    const scroller = scrollers[index];
    if (!scroller.isActive || scroller.isActive()) return scroller;
  }
  return null;
};

/**
 * Mesure brute d'une ancre montée (null si absente ou vide).
 * @param {string | undefined} id
 * @returns {Promise<TourRect | null>}
 */
const measureRaw = (id) => new Promise((resolve) => {
  const entry = activeEntry(id);
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
 * Mesure d'une ancre sans la couper à sa zone visible : où elle est dans l'écran, même hors cadre
 * (le défilement automatique la ramène).
 * @param {string} id
 * @returns {Promise<TourRect | null>}
 */
export const measureTourTargetRaw = (id) => measureRaw(id);

/**
 * Mesure une ancre montée (null si absente ou vide), coupée à la zone visible
 * de son conteneur `clipTo` quand il est monté.
 * @param {string} id
 * @returns {Promise<TourRect | null>}
 */
export const measureTourTarget = async (id) => {
  const rect = /** @type {TourRect | null} */ (await measureRaw(id));
  const clip = rect ? /** @type {TourRect | null} */ (await measureRaw(activeEntry(id)?.clipTo))
    : null;
  return rect && clip ? intersect(rect, clip) : rect;
};

/**
 * GUIDE-STORES : de quel côté de sa zone visible une ancre est sortie. La mesure coupée ne le dit
 * pas (null, ou la lamelle restante), et le guide doit donner le sens du défilement.
 * @param {string} id
 * @returns {Promise<'above' | 'below' | null>} Le côté ; null si elle est entière ou sans zone.
 */
export const measureTourTargetClipSide = async (id) => {
  const clipTo = activeEntry(id)?.clipTo;
  if (!clipTo) return null;
  const rect = /** @type {TourRect | null} */ (await measureRaw(id));
  const clip = /** @type {TourRect | null} */ (await measureRaw(clipTo));
  if (!rect || !clip) return null;
  if (rect.y < clip.y) return 'above';
  return rect.y + rect.height > clip.y + clip.height ? 'below' : null;
};

/**
 * GUIDES-SITE (09/11) : sur le site, l'ancre sait se ramener elle-même à l'écran
 * (`scrollIntoView` du navigateur, qui fait défiler la page et tous ses conteneurs).
 * @param {string} id
 * @param {{ block?: string; marginBottom?: number; marginTop?: number }} [options] - Bord visé
 *   (`center`, `start`, `nearest`) et marges à garder (en-tête, barre d'onglets).
 * @returns {boolean} Vrai si l'ancre a été ramenée.
 */
export const revealTourTarget = (id, options) => {
  const reveal = activeEntry(id)?.reveal;
  if (!reveal) return false;
  try {
    reveal(options);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * L'ancre sait-elle se ramener à l'écran (site) ?
 * @param {string} id
 * @returns {boolean}
 */
export const canRevealTourTarget = (id) => Boolean(activeEntry(id)?.reveal);

/**
 * GUIDE-D-CORR TG-01/TG-02 : l'ancre vit-elle dans une feuille du bas ? Une feuille ouverte
 * pendant le guide passe sous sa couche ; le guide ne se retire pas si sa cible y est.
 * @param {string} id
 * @returns {boolean}
 */
export const isTourTargetInSheet = (id) => Boolean(activeEntry(id)?.inSheet);

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

// Garde du bouton d'une bulle : l'écran dit si son champ est rempli (la saisie vit dans son
// formulaire, le guide ne la lit pas).
/** @type {Map<string, boolean>} */
const fields = new Map();

/**
 * Un écran dit si un champ suivi par le guide est valide.
 * @param {string} id - Champ (`nextRequires.field` de l'étape).
 * @param {boolean} isValid - Rempli et valide ?
 * @returns {void}
 */
export const reportTourField = (id, isValid) => { fields.set(id, Boolean(isValid)); };

/**
 * L'écran a-t-il dit ce champ valide ? Sans nouvelle de lui, non.
 * @param {string} id - Champ.
 * @returns {boolean} Valide ?
 */
export const isTourFieldValid = (id) => fields.get(id) === true;

export const resetTourTargetsForTests = () => {
  scrollers.length = 0;
  fields.clear();
  targets.clear();
  listeners.clear();
};
