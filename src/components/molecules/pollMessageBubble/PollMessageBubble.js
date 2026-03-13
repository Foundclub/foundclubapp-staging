import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

const styles = StyleSheet.create({
  badgePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  container: {
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 6,
    maxWidth: '90%',
    minWidth: 260,
    overflow: 'hidden',
    width: '100%',
  },
  detailsHint: {
    marginTop: 10,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  footerChip: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '84%',
    minWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionButton: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
    width: '100%',
  },
  optionFill: {
    bottom: 0,
    left: 0,
    opacity: 0.18,
    position: 'absolute',
    top: 0,
  },
  optionLabelRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    marginRight: 12,
  },
  optionMetaColumn: {
    alignItems: 'flex-end',
    minWidth: 68,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voterChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  voterChipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  votersChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  votersContainer: {
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
});

const getVoters = (option) => (Array.isArray(option?.voters)
  ? option.voters.filter((value) => typeof value === 'string' && value.length > 0)
  : []);

const getVoteCount = (option) => {
  const fallback = getVoters(option).length;
  return typeof option?.voteCount === 'number' ? option.voteCount : fallback;
};

/**
 * Bubble to display and vote on chat polls.
 * @param {object} props
 * @param {string} [props.currentUserId]
 * @param {boolean} [props.fullWidth]
 * @param {boolean} [props.isMe]
 * @param {() => void} [props.onOpenDetails]
 * @param {(optionId: string) => Promise<void> | void} [props.onVote]
 * @param {object | null | undefined} props.poll
 * @param {(voterId: string) => string} [props.resolveVoterName]
 * @param {boolean} [props.showSelectedBadge]
 * @param {boolean} [props.showVoterChips]
 * @returns {import('react').ReactElement | null}
 */
function PollMessageBubble({
  currentUserId = '',
  fullWidth = false,
  isMe = false,
  onOpenDetails,
  onVote,
  poll,
  resolveVoterName,
  showSelectedBadge = true,
  showVoterChips = false,
}) {
  const { Colors, Fonts } = useTheme();
  const [loadingOptionId, setLoadingOptionId] = useState('');

  if (!poll || poll.type !== 'poll') return null;

  const options = Array.isArray(poll.options) ? poll.options : [];
  if (options.length === 0) return null;

  const isAnonymousPoll = !!poll?.isAnonymous;
  const canOpenDetails = typeof onOpenDetails === 'function';
  const canVote = typeof onVote === 'function';
  const totalVotes = options.reduce((sum, option) => sum + getVoteCount(option), 0);

  const handleOptionPress = async (/** @type {string} */ optionId) => {
    if (!onVote || !optionId || loadingOptionId) return;
    setLoadingOptionId(optionId);
    try {
      await onVote(optionId);
    } finally {
      setLoadingOptionId('');
    }
  };

  const cardStyle = [
    styles.container,
    {
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      backgroundColor: 'rgba(20, 39, 52, 0.92)',
      borderColor: 'rgba(1, 179, 244, 0.34)',
      maxWidth: fullWidth ? '100%' : '90%',
      minWidth: fullWidth ? 0 : 260,
    },
  ];

  const modeLabel = poll.allowMultipleVotes ? 'multiple' : 'unique';
  const visibilityLabel = isAnonymousPoll ? 'anonyme' : 'visible';

  const cardContent = (
    <>
      <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
        <View style={[styles.headerRow, { marginBottom: 4 }]}>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            Sondage
          </Text>
          {isAnonymousPoll ? (
            <View
              style={{
                backgroundColor: 'rgba(1, 179, 244, 0.14)',
                borderColor: 'rgba(1, 179, 244, 0.42)',
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Sondage anonyme</Text>
            </View>
          ) : null}
        </View>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
          {poll.question || 'Question'}
        </Text>

        {options.map((option, index) => {
          const optionId = String(option?.id || `option-${index}`);
          const optionLabel = String(option?.label || `Option ${index + 1}`);
          const voters = getVoters(option);
          const voteCount = getVoteCount(option);
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = !!currentUserId && voters.includes(currentUserId);
          const voterEntries = isAnonymousPoll
            ? []
            : Array.from(new Set(voters))
              .map((voterId) => {
                if (typeof resolveVoterName === 'function') {
                  const voterName = resolveVoterName(voterId);
                  const label = typeof voterName === 'string' ? voterName.trim() : '';
                  return { label, voterId };
                }
                return { label: '', voterId };
              })
              .filter((value) => value.label.length > 0);
          const optionStyle = [
            styles.optionButton,
            {
              backgroundColor: isSelected
                ? 'rgba(1, 179, 244, 0.14)'
                : 'rgba(255,255,255,0.04)',
              borderColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.16)',
            },
          ];

          const optionBody = (
            <>
              <View
                style={[
                  styles.optionFill,
                  {
                    backgroundColor: Colors.primary500,
                    width: `${Math.max(percentage, voteCount > 0 ? 6 : 0)}%`,
                  },
                ]}
              />
              <View style={styles.optionRow}>
                <View style={styles.optionLabelRow}>
                  <Text
                    numberOfLines={2}
                    style={[Fonts.p2Bold, { color: Colors.neutral00, flexShrink: 1 }]}
                  >
                    {optionLabel}
                  </Text>
                  {showSelectedBadge && isSelected ? (
                    <View style={[styles.badgePill, { borderColor: Colors.primary500 }]}>
                      <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Votre vote</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.optionMetaColumn}>
                  <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                    {percentage}
                    %
                  </Text>
                  <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                    {voteCount}
                    {' '}
                    vote
                    {voteCount > 1 ? 's' : ''}
                  </Text>
                </View>
                {canVote && loadingOptionId === optionId ? (
                  <ActivityIndicator
                    color={Colors.primary500}
                    size="small"
                    style={{ marginLeft: 8 }}
                  />
                ) : null}
              </View>
              {!isAnonymousPoll && voterEntries.length > 0 ? (
                <View style={[styles.votersContainer, { borderTopColor: 'rgba(255,255,255,0.1)' }]}>
                  {showVoterChips ? (
                    <View style={styles.votersChipsRow}>
                      {voterEntries.slice(0, 6).map((entry) => (
                        <View
                          key={`${optionId}-voter-${entry.voterId}`}
                          style={styles.voterChip}
                        >
                          <Text
                            style={[Fonts.p4, styles.voterChipText, { color: Colors.neutral300 }]}
                          >
                            {entry.label}
                          </Text>
                        </View>
                      ))}
                      {voterEntries.length > 6 ? (
                        <View style={styles.voterChip}>
                          <Text
                            style={[
                              Fonts.p4Bold,
                              styles.voterChipText,
                              { color: Colors.primary500 },
                            ]}
                          >
                            +
                            {voterEntries.length - 6}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                      {voterEntries.map((entry) => entry.label).join(' | ')}
                    </Text>
                  )}
                </View>
              ) : null}
            </>
          );

          if (canVote) {
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                key={optionId}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  handleOptionPress(optionId);
                }}
                style={optionStyle}
              >
                {optionBody}
              </TouchableOpacity>
            );
          }

          return (
            <View key={optionId} style={optionStyle}>
              {optionBody}
            </View>
          );
        })}

        {canOpenDetails ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }, styles.detailsHint]}>
            Appuie sur une option pour voter, ou sur la carte pour les détails.
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={[styles.footerChip, { borderColor: 'rgba(255,255,255,0.14)' }]}>
          <Text
            numberOfLines={1}
            style={[Fonts.p4, { color: Colors.neutral300, textAlign: 'center' }]}
          >
            {totalVotes}
            {' '}
            vote
            {totalVotes > 1 ? 's' : ''}
            {' '}
            |
            {' '}
            mode
            {' '}
            {modeLabel}
            {' '}
            |
            {' '}
            {visibilityLabel}
          </Text>
        </View>
      </View>
    </>
  );

  if (canOpenDetails) {
    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onOpenDetails}
        style={cardStyle}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle}>
      {cardContent}
    </View>
  );
}

export default PollMessageBubble;
