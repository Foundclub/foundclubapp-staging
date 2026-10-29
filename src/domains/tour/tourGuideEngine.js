/**
 * Règles pures du guide à missions (TUTOE, pack design_handoff_tutoriels,
 * 01_ARCHITECTURE §1-§2). Le TourContext s'en sert pour les profils
 * `version: 3` ; les profils v2 (joueur, dirigeant) gardent leur moteur.
 * @typedef {{ goto?: string; key?: string; meta?: Record<string, any>; not?: string;
 *   type: 'action' | 'interaction' | 'route'; when?: (ctx: any) => boolean }} TourAdvance
 * @typedef {{ id: string; locked: boolean; gaugeStep: number; title: string;
 *   estimatedSeconds?: number }} TourMission
 * @typedef {{ advance: TourAdvance; index: number; completes: boolean } | null} TourMatch
 */

/**
 * Mission du profil par son id.
 * @param {any} profile
 * @param {string | null | undefined} missionId
 * @returns {TourMission | null}
 */
export const getMission = (profile, missionId) => (
  (profile?.missions || []).find((/** @type {any} */ mission) => mission.id === missionId) || null
);

/**
 * Étape disponible dans ce contexte (branche `when`) ?
 * @param {any} step
 * @param {any} ctx
 * @returns {boolean}
 */
export const isStepAvailable = (step, ctx) => {
  // GUIDE-RELANCE : la visite ne joue que ses étapes `review`, le vrai guide
  // jamais ; une mission refusée par l'écran (« blocked ») est sautée.
  if (Boolean(step?.review) !== Boolean(ctx?.review)) return false;
  if (ctx?.missionStatus?.[step?.missionId] === 'blocked') return false;
  return typeof step?.when === 'function' ? Boolean(step.when(ctx)) : Boolean(step);
};

/**
 * Prochaine étape disponible APRÈS `fromIndex` (les branches `when` sautées).
 * @param {any} profile
 * @param {number} fromIndex
 * @param {any} ctx
 * @returns {number} -1 s'il n'y en a plus
 */
export const nextAvailableIndex = (profile, fromIndex, ctx) => {
  const steps = profile?.steps || [];
  for (let index = fromIndex + 1; index < steps.length; index += 1) {
    if (isStepAvailable(steps[index], ctx)) return index;
  }
  return -1;
};

/**
 * Rang d’une étape par son id.
 * @param {any} profile
 * @param {string} stepId
 * @returns {number}
 */
export const indexOfStep = (profile, stepId) => (
  (profile?.steps || []).findIndex((/** @type {any} */ step) => step.id === stepId)
);

/**
 * Première étape de la mission qui suit celle de l'étape `fromIndex`.
 * @param {any} profile
 * @param {number} fromIndex
 * @param {any} ctx
 * @returns {number}
 */
export const firstIndexOfNextMission = (profile, fromIndex, ctx) => {
  const steps = profile?.steps || [];
  const missionId = steps[fromIndex]?.missionId;
  let index = nextAvailableIndex(profile, fromIndex, ctx);
  while (index !== -1 && missionId && steps[index].missionId === missionId) {
    index = nextAvailableIndex(profile, index, ctx);
  }
  return index;
};

/**
 * Sorties déclarées d’une étape, toujours en tableau.
 * @param {any} step
 * @returns {TourAdvance[]}
 */
const advancesOf = (step) => {
  if (!step?.advanceOn) return [];
  return Array.isArray(step.advanceOn) ? step.advanceOn : [step.advanceOn];
};

/**
 * Le signal correspond-il à cette sortie ? Une sortie `when` ne vaut que dans ce
 * contexte (GUIDE-FINITIONS-2 n° 2 : « Nouvelle équipe » pendant une attente).
 * @param {TourAdvance} advance
 * @param {{ key?: string; kind?: string; [meta: string]: any }} signal
 * @param {any} [ctx]
 * @returns {boolean}
 */
const advanceMatches = (advance, signal, ctx) => {
  if (advance.type !== signal?.kind) return false;
  if (typeof advance.when === 'function' && !advance.when(ctx)) return false;
  if (advance.not) return signal.key !== advance.not;
  if (advance.key !== signal.key) return false;
  return Object.entries(advance.meta || {})
    .every(([name, expected]) => signal[name] === expected);
};

/**
 * Le signal fait-il avancer l'étape courante ? Une sortie `goto` est un
 * aiguillage (branche), elle ne valide jamais la mission.
 * @param {any} profile
 * @param {number} stepIndex
 * @param {any} signal
 * @param {any} ctx
 * @returns {TourMatch}
 */
export const matchSignal = (profile, stepIndex, signal, ctx) => {
  const step = profile?.steps?.[stepIndex];
  const advance = advancesOf(step).find((candidate) => advanceMatches(candidate, signal, ctx));
  if (!advance) return null;
  if (advance.goto) {
    const index = indexOfStep(profile, advance.goto);
    return index === -1 ? null : { advance, completes: false, index };
  }
  return {
    advance,
    completes: Boolean(step.completesMission),
    index: nextAvailableIndex(profile, stepIndex, ctx),
  };
};

/**
 * À l'entrée d'une étape, la personne est peut-être DÉJÀ là où l'étape veut
 * l'emmener (ex. le tunnel la dépose directement sur la fiche de l'équipe) :
 * on applique alors tout de suite la sortie « route » correspondante.
 * @param {any} profile
 * @param {number} stepIndex
 * @param {string | null} currentRoute
 * @param {any} ctx
 * @returns {TourMatch}
 */
export const matchCurrentRoute = (profile, stepIndex, currentRoute, ctx) => {
  if (!currentRoute) return null;
  const step = profile?.steps?.[stepIndex];
  const routeAdvance = advancesOf(step).find((advance) => advance.type === 'route'
    && (advance.not ? advance.not !== currentRoute : advance.key === currentRoute));
  if (!routeAdvance) return null;
  return matchSignal(profile, stepIndex, { key: currentRoute, kind: 'route' }, ctx);
};

/**
 * Libellé « Mission 2/4 » / « Bonus 1/2 » de l'étape.
 * @param {any} profile
 * @param {string | null | undefined} missionId
 * @returns {{ index: number; isBonus: boolean; total: number } | null}
 */
export const missionPosition = (profile, missionId) => {
  const mission = getMission(profile, missionId);
  if (!mission) return null;
  const family = (profile.missions || [])
    .filter((/** @type {any} */ candidate) => candidate.locked === mission.locked);
  return {
    index: family.findIndex((/** @type {any} */ candidate) => candidate.id === missionId) + 1,
    isBonus: !mission.locked,
    total: family.length,
  };
};
