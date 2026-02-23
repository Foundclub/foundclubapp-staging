export const isTutorialDebugEnabled = () => (
  __DEV__
  // eslint-disable-next-line no-underscore-dangle
  && global.__FC_TUTORIAL_DEBUG__ === true
);

export const tutorialDebugLog = (...args) => {
  if (!isTutorialDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[tutorial-debug]', ...args);
};
