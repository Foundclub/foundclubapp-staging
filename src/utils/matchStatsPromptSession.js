const dismissedPromptKeys = new Set();

const normalizePromptKey = (value) => String(value || '').trim();

export const isMatchStatsPromptDismissedForSession = (promptKey) => {
  const normalizedPromptKey = normalizePromptKey(promptKey);
  if (!normalizedPromptKey) return false;
  return dismissedPromptKeys.has(normalizedPromptKey);
};

export const dismissMatchStatsPromptForSession = (promptKey) => {
  const normalizedPromptKey = normalizePromptKey(promptKey);
  if (!normalizedPromptKey) return;
  dismissedPromptKeys.add(normalizedPromptKey);
};

export const clearDismissedMatchStatsPromptForSession = (promptKey) => {
  const normalizedPromptKey = normalizePromptKey(promptKey);
  if (!normalizedPromptKey) return;
  dismissedPromptKeys.delete(normalizedPromptKey);
};
