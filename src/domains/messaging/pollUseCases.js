const normalizePollTimestamp = (rawValue) => {
  if (rawValue instanceof Date) return rawValue.getTime();
  const parsedValue = Number(rawValue);
  if (Number.isFinite(parsedValue) && parsedValue > 0) return parsedValue;
  return Date.now();
};

const toPollIdSuffix = () => Math.random().toString(36).slice(2, 7);

const normalizePollOptionLabel = (value) => String(value || '').trim();

/**
 * Returns a sanitized, unique list of voter ids for a poll option.
 * @param {any} option
 * @returns {string[]}
 */
export const getPollVoters = (option) => {
  if (!Array.isArray(option?.voters)) return [];

  return Array.from(
    new Set(
      option.voters
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
};

/**
 * Returns the vote count for a poll option.
 * @param {any} option
 * @returns {number}
 */
export const getPollVoteCount = (option) => {
  const explicitCount = Number(option?.voteCount);
  if (Number.isFinite(explicitCount) && explicitCount >= 0) {
    return explicitCount;
  }

  return getPollVoters(option).length;
};

/**
 * Returns the total vote count for a poll.
 * @param {any[] | null | undefined} options
 * @returns {number}
 */
export const getPollTotalVotes = (options) => (
  Array.isArray(options)
    ? options.reduce((sum, option) => sum + getPollVoteCount(option), 0)
    : 0
);

/**
 * Creates a poll composition payload suitable for chat messages.
 * @param {object} params
 * @param {boolean} params.allowMultipleVotes
 * @param {string} [params.createdBy]
 * @param {boolean} params.isAnonymous
 * @param {number | Date} [params.now]
 * @param {string[]} params.options
 * @param {string} params.question
 * @returns {object}
 */
export const createPollComposition = ({
  allowMultipleVotes,
  createdBy,
  isAnonymous,
  now,
  options,
  question,
}) => {
  const timestamp = normalizePollTimestamp(now);
  const normalizedOptions = (Array.isArray(options) ? options : [])
    .map((value) => normalizePollOptionLabel(value))
    .filter(Boolean);

  return {
    allowMultipleVotes: !!allowMultipleVotes,
    createdAt: new Date(timestamp).toISOString(),
    createdBy: String(createdBy || ''),
    isAnonymous: !!isAnonymous,
    options: normalizedOptions.map((label, index) => ({
      id: `poll-option-${timestamp}-${index}-${toPollIdSuffix()}`,
      label,
      voteCount: 0,
      voters: [],
    })),
    pollId: `poll-${timestamp}-${toPollIdSuffix()}`,
    question: String(question || '').trim(),
    type: 'poll',
  };
};

/**
 * Applies a local optimistic vote update on a poll composition.
 * @param {object} params
 * @param {string} params.currentUserId
 * @param {string} params.optionId
 * @param {any} params.poll
 * @returns {{ changed: boolean; nextComposition: any }}
 */
export const applyOptimisticPollVote = ({
  currentUserId,
  optionId,
  poll,
}) => {
  const normalizedUserId = String(currentUserId || '').trim();
  const targetOptionId = String(optionId || '').trim();

  if (!poll || poll?.type !== 'poll' || !normalizedUserId || !targetOptionId) {
    return { changed: false, nextComposition: poll };
  }

  const options = Array.isArray(poll?.options) ? poll.options : [];
  if (options.length === 0) {
    return { changed: false, nextComposition: poll };
  }

  let changed = false;

  const nextOptions = options.map((option) => {
    const optionVoters = getPollVoters(option);
    const isTargetOption = String(option?.id || '') === targetOptionId;
    const hasCurrentUser = optionVoters.includes(normalizedUserId);
    let nextVoters = optionVoters;

    if (poll.allowMultipleVotes) {
      if (isTargetOption) {
        nextVoters = hasCurrentUser
          ? optionVoters.filter((value) => value !== normalizedUserId)
          : [...optionVoters, normalizedUserId];
      }
    } else if (isTargetOption) {
      nextVoters = hasCurrentUser
        ? optionVoters.filter((value) => value !== normalizedUserId)
        : [...optionVoters, normalizedUserId];
    } else if (!isTargetOption && hasCurrentUser) {
      nextVoters = optionVoters.filter((value) => value !== normalizedUserId);
    }

    if (nextVoters.length !== optionVoters.length) {
      changed = true;
    }

    return {
      ...option,
      voteCount: nextVoters.length,
      voters: nextVoters,
    };
  });

  if (!changed) {
    return { changed: false, nextComposition: poll };
  }

  return {
    changed: true,
    nextComposition: {
      ...poll,
      options: nextOptions,
      updatedAt: new Date().toISOString(),
    },
  };
};
