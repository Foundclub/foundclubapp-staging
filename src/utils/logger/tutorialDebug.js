export const isTutorialDebugEnabled = () => (
  __DEV__
  // eslint-disable-next-line no-underscore-dangle
  && global.__FC_TUTORIAL_DEBUG__ === true
);

const getTutorialDebugHost = () => {
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  return null;
};

const DEFAULT_TUTORIAL_DEBUG_STATE = {
  currentStepId: null,
  currentStepIndex: 0,
  currentStepLayout: null,
  isStepReady: false,
  isTransitioning: false,
  lastAdvanceFromStepId: null,
  lastAdvancePhase: null,
  lastAdvanceToStepId: null,
  lastFailureReason: null,
  lastRequestedFallbackSection: null,
  lastRequestedTargetId: null,
  lastResolvedStepId: null,
  lastResolvedTargetId: null,
  lastScrollMode: null,
  targetNodeFound: false,
  targetNodeSource: null,
  targetStepFound: false,
  windowScrollY: null,
};

const syncTutorialDebugAliases = (host, state) => {
  if (!host || !state) return;
  host.__FC_TUTORIAL_STATE__ = state;
  host.FC_TUTORIAL_STATE = state;
  host.fcTutorialState = state;
  host._FC_TUTORIAL_STATE_ = state;
  host._FC_Tutorial_STATE_ = state;
};

const ensureTutorialDebugState = () => {
  const host = getTutorialDebugHost();
  if (!host) return null;
  const nextState = {
    ...DEFAULT_TUTORIAL_DEBUG_STATE,
    ...(host.__FC_TUTORIAL_STATE__ || host.FC_TUTORIAL_STATE || host.fcTutorialState || {}),
  };
  syncTutorialDebugAliases(host, nextState);
  return host;
};

ensureTutorialDebugState();

export const tutorialDebugLog = (...args) => {
  if (!isTutorialDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[tutorial-debug]', ...args);
};

export const setTutorialDebugState = (partialState) => {
  const host = ensureTutorialDebugState();
  if (!host) return;
  const nextState = {
    ...DEFAULT_TUTORIAL_DEBUG_STATE,
    ...host.__FC_TUTORIAL_STATE__,
    ...(partialState || {}),
  };
  syncTutorialDebugAliases(host, nextState);
};
