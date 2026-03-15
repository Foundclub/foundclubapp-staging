import {
  applyOptimisticPollVote,
  createPollComposition,
  getPollTotalVotes,
  getPollVoteCount,
  getPollVoters,
} from './pollUseCases';

describe('pollUseCases', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPollComposition', () => {
    test('creates a normalized poll composition', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

      const poll = createPollComposition({
        allowMultipleVotes: true,
        createdBy: 'user-1',
        isAnonymous: true,
        now: 1700000000000,
        options: [' Oui ', 'Non', '  '],
        question: '  Quel choix ?  ',
      });

      expect(poll).toEqual({
        allowMultipleVotes: true,
        createdAt: '2023-11-14T22:13:20.000Z',
        createdBy: 'user-1',
        isAnonymous: true,
        options: [
          {
            id: 'poll-option-1700000000000-0-4fzzz',
            label: 'Oui',
            voteCount: 0,
            voters: [],
          },
          {
            id: 'poll-option-1700000000000-1-4fzzz',
            label: 'Non',
            voteCount: 0,
            voters: [],
          },
        ],
        pollId: 'poll-1700000000000-4fzzz',
        question: 'Quel choix ?',
        type: 'poll',
      });
    });
  });

  describe('getPollVoters', () => {
    test('returns unique, sanitized voter ids', () => {
      expect(getPollVoters({
        voters: ['user-1', ' user-1 ', '', null, 'user-2'],
      })).toEqual(['user-1', 'user-2']);
    });

    test('returns an empty array when voters are missing', () => {
      expect(getPollVoters({})).toEqual([]);
    });
  });

  describe('getPollVoteCount', () => {
    test('uses explicit voteCount when available', () => {
      expect(getPollVoteCount({ voteCount: 4, voters: ['user-1'] })).toBe(4);
    });

    test('falls back to sanitized voter count', () => {
      expect(getPollVoteCount({ voters: ['user-1', ' user-1 ', 'user-2'] })).toBe(2);
    });
  });

  describe('getPollTotalVotes', () => {
    test('sums vote counts across options', () => {
      expect(getPollTotalVotes([
        { voteCount: 2, voters: ['user-1'] },
        { voters: ['user-2', 'user-3'] },
      ])).toBe(4);
    });

    test('returns 0 when options are missing', () => {
      expect(getPollTotalVotes(null)).toBe(0);
    });
  });

  describe('applyOptimisticPollVote', () => {
    const basePoll = {
      allowMultipleVotes: false,
      isAnonymous: false,
      options: [
        {
          id: 'opt-1',
          label: 'Oui',
          voteCount: 1,
          voters: ['user-1'],
        },
        {
          id: 'opt-2',
          label: 'Non',
          voteCount: 0,
          voters: [],
        },
      ],
      pollId: 'poll-1',
      question: 'Question',
      type: 'poll',
    };

    test('replaces the previous selection for single-vote polls', () => {
      const result = applyOptimisticPollVote({
        currentUserId: 'user-1',
        optionId: 'opt-2',
        poll: basePoll,
      });

      expect(result.changed).toBe(true);
      expect(result.nextComposition.options).toEqual([
        {
          id: 'opt-1',
          label: 'Oui',
          voteCount: 0,
          voters: [],
        },
        {
          id: 'opt-2',
          label: 'Non',
          voteCount: 1,
          voters: ['user-1'],
        },
      ]);
      expect(result.nextComposition.updatedAt).toEqual(expect.any(String));
    });

    test('returns no-op when the same single-vote option is selected', () => {
      const result = applyOptimisticPollVote({
        currentUserId: 'user-1',
        optionId: 'opt-1',
        poll: basePoll,
      });

      expect(result).toEqual({
        changed: false,
        nextComposition: basePoll,
      });
    });

    test('adds multiple votes without duplicates for multi-vote polls', () => {
      const result = applyOptimisticPollVote({
        currentUserId: 'user-1',
        optionId: 'opt-2',
        poll: {
          ...basePoll,
          allowMultipleVotes: true,
          options: [
            {
              id: 'opt-1',
              label: 'Oui',
              voteCount: 1,
              voters: ['user-1', 'user-1'],
            },
            {
              id: 'opt-2',
              label: 'Non',
              voteCount: 0,
              voters: [],
            },
          ],
        },
      });

      expect(result.changed).toBe(true);
      expect(result.nextComposition.options).toEqual([
        {
          id: 'opt-1',
          label: 'Oui',
          voteCount: 1,
          voters: ['user-1'],
        },
        {
          id: 'opt-2',
          label: 'Non',
          voteCount: 1,
          voters: ['user-1'],
        },
      ]);
    });

    test('returns no-op when nothing changes', () => {
      const result = applyOptimisticPollVote({
        currentUserId: '',
        optionId: 'opt-2',
        poll: basePoll,
      });

      expect(result).toEqual({
        changed: false,
        nextComposition: basePoll,
      });
    });
  });
});
