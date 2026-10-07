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

// SECU-SONDAGE-ANONYME (07/10) — MON CHOIX DANS UN SONDAGE ANONYME. Décision d'Adel « anonyme A » :
// le serveur ne met plus les votants d'un sondage anonyme dans sa composition (elle part à tout le
// fil), il n'y laisse que les COMPTEURS. Mon choix m'arrive à moi seul (`myOptionIds`, réponse de
// mon vote et GET /poll-voters). L'app le POSE dans la composition qu'elle garde en cache, sous la
// forme que les écrans lisent déjà : `voters: [moi]` sur mes options. Rien d'autre ne change.

/**
 * Les options que je coche, d'après la composition.
 * @param {any} poll La composition du sondage.
 * @param {string} currentUserId Mon identifiant.
 * @returns {string[]} Mes options, dans l'ordre du sondage.
 */
export const getMyPollOptionIds = (poll, currentUserId) => {
  const me = String(currentUserId || '').trim();
  if (!me || !Array.isArray(poll?.options)) return [];
  return poll.options
    .filter((/** @type {any} */ option) => getPollVoters(option).includes(me))
    .map((/** @type {any} */ option) => String(option?.id || ''))
    .filter(Boolean);
};

/**
 * Un sondage anonyme dont la composition ne nomme personne : celle du serveur neuf. (Un serveur
 * ancien y laissait les votants : dans ce cas, c'est lui qui fait foi et l'app n'y touche pas.)
 * @param {any} poll La composition du sondage.
 * @returns {boolean} Vrai s'il faut demander mon choix à part.
 */
export const isAnonymousPollNamingNoOne = (poll) => (
  poll?.type === 'poll'
  && Boolean(poll?.isAnonymous)
  && Array.isArray(poll?.options)
  && poll.options.every((/** @type {any} */ option) => getPollVoters(option).length === 0)
);

/**
 * Pose MON choix dans un sondage anonyme : `voters: [moi]` sur mes options, `[]` ailleurs ; les
 * compteurs du serveur ne bougent pas. Rien à poser (choix inconnu, sondage visible, pas un
 * sondage) ⇒ la composition revient telle quelle ; déjà posé ⇒ la MÊME composition revient (aucun
 * redessin pour rien).
 * @param {any} poll La composition du sondage.
 * @param {string[] | null | undefined} myOptionIds Mon choix, tel que le serveur me l'a rendu.
 * @param {string} currentUserId Mon identifiant.
 * @returns {any} La composition, avec mon choix.
 */
export const withMyAnonymousPollVotes = (poll, myOptionIds, currentUserId) => {
  const me = String(currentUserId || '').trim();
  if (poll?.type !== 'poll' || !poll?.isAnonymous || !me) return poll;
  if (!Array.isArray(myOptionIds)) return poll;
  const options = Array.isArray(poll.options) ? poll.options : [];
  const mine = new Set(myOptionIds.map((value) => String(value || '').trim()).filter(Boolean));
  const voters = (/** @type {any} */ option) => (mine.has(String(option?.id || '')) ? [me] : []);
  const unchanged = options.every((/** @type {any} */ option) => {
    const current = getPollVoters(option);
    const wanted = voters(option);
    return current.length === wanted.length
      && current.every((value, index) => value === wanted[index]);
  });
  if (unchanged) return poll;
  return {
    ...poll,
    options: options.map((/** @type {any} */ option) => ({ ...option, voters: voters(option) })),
  };
};

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

    // SECU-SONDAGE-ANONYME (07/10) — le compteur BOUGE de ma voix, il ne se recompte pas sur les
    // votants : un sondage anonyme du serveur ne nomme plus personne (`voters` ne porte que moi,
    // posé par l'app), son `voteCount` compte tout le monde. Pour un sondage visible, c'est le même
    // nombre que `nextVoters.length`.
    return {
      ...option,
      voteCount: Math.max(0, getPollVoteCount(option) + nextVoters.length - optionVoters.length),
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
