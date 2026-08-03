import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import {
  applyOptimisticPollVote,
  getPollTotalVotes,
  getPollVoters,
} from '@/domains/messaging/pollUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import PollMessageBubble from '@/components/molecules/pollMessageBubble/PollMessageBubble';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueriesCompat';

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(20, 39, 52, 0.78)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoDivider: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 1,
    marginVertical: 10,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionSectionCard: {
    backgroundColor: 'rgba(20, 39, 52, 0.78)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pollWrapper: {
    marginTop: 4,
  },
  sectionHintCard: {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.28)',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  voterRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingVertical: 8,
  },
  votersSectionTitle: {
    marginBottom: 8,
    marginTop: 14,
  },
});

/**
 * Poll details screen.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function PollDetails({ navigation, route }) {
  const { t } = useTranslation();
  const { chatId = '', messageId = '', poll: initialPoll = null } = route.params || {};
  const { userData } = useAuth();
  const { votePoll } = useMessaging(chatId);
  const queryClient = useQueryClient();
  const { bottom, top } = useSafeAreaInsets();
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const shouldAvoidDeprecatedSystemBarColors = Platform.OS === 'android'
    && typeof Platform.Version === 'number'
    && Platform.Version >= 35;

  const { data: chatData } = useGetChatById(chatId);
  const {
    data: messagesPages,
    isLoading: isMessagesLoading,
  } = useGetChatMessages({ chatId });

  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const pollMessage = useMemo(() => {
    if (!Array.isArray(messagesPages?.pages) || !messageId) return null;
    const targetId = String(messageId);
    return messagesPages.pages
      .flatMap((page) => (Array.isArray(page?.data) ? page.data : []))
      .find((message) => {
        const currentId = String(message?.documentId || message?.id || '');
        return currentId === targetId && message?.composition?.type === 'poll';
      }) || null;
  }, [messageId, messagesPages?.pages]);

  const effectiveMessageId = String(
    pollMessage?.documentId || pollMessage?.id || messageId || '',
  );
  const poll = useMemo(() => {
    if (pollMessage?.composition?.type === 'poll') return pollMessage.composition;
    if (initialPoll?.type === 'poll') return initialPoll;
    return null;
  }, [initialPoll, pollMessage?.composition]);

  const voterDirectory = useMemo(() => {
    /** @type {Map<string, { avatarUrl: string; displayName: string; firstname: string; lastname: string }>} */
    const directory = new Map();

    const registerUser = (/** @type {any} */ user) => {
      const userId = user?.documentId || user?.id;
      if (!userId) return;
      const firstname = (user?.firstname || '').trim();
      const lastname = (user?.lastname || '').trim();
      const fullName = `${firstname} ${lastname}`.trim();
      const fallbackName = (user?.username || user?.email || '').trim();
      const previous = directory.get(String(userId));
      directory.set(String(userId), {
        avatarUrl: String(user?.avatar?.url || previous?.avatarUrl || '').trim(),
        displayName: fullName || fallbackName || previous?.displayName || 'Membre',
        firstname: firstname || previous?.firstname || '',
        lastname: lastname || previous?.lastname || '',
      });
    };

    registerUser(userData);

    if (Array.isArray(chatData?.participants)) {
      chatData.participants.forEach((participant) => registerUser(participant));
    }

    if (Array.isArray(messagesPages?.pages)) {
      messagesPages.pages.forEach((page) => {
        if (!Array.isArray(page?.data)) return;
        page.data.forEach((message) => registerUser(message?.sender));
      });
    }

    return directory;
  }, [chatData?.participants, messagesPages?.pages, userData]);

  const resolveVoterName = (/** @type {string} */ voterId) => {
    if (!voterId) return t('conversation.poll.common.member', 'Membre');
    const profile = voterDirectory.get(String(voterId));
    if (!profile) return t('conversation.poll.common.member', 'Membre');
    return profile.displayName || t('conversation.poll.common.member', 'Membre');
  };

  const optionVoterSections = useMemo(() => {
    const options = Array.isArray(poll?.options) ? poll.options : [];
    if (options.length === 0) return [];

    const resolveVoterProfile = (/** @type {string} */ voterId) => {
      const profile = voterDirectory.get(String(voterId));
      if (!profile) {
        return {
          avatarUrl: '',
          displayName: t('conversation.poll.common.member', 'Membre'),
          firstname: '',
          lastname: '',
        };
      }

      return profile;
    };

    return options.map((option, index) => {
      const optionId = String(option?.id || `option-${index}`);
      const optionLabel = String(
        option?.label || t('conversation.poll.form.optionPlaceholder', {
          defaultValue: 'Option {{index}}',
          index: index + 1,
        }),
      );
      const voters = getPollVoters(option).map((voterId) => ({
        voterId,
        ...resolveVoterProfile(voterId),
      }));

      return {
        optionId,
        optionLabel,
        voters,
      };
    });
  }, [poll?.options, t, voterDirectory]);

  const createdByName = poll?.createdBy
    ? resolveVoterName(String(poll.createdBy))
    : t('conversation.poll.common.member', 'Membre');
  const createdAtLabel = useMemo(() => {
    if (!poll?.createdAt) return '--';
    const parsed = new Date(poll.createdAt);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, [poll?.createdAt]);

  const handleVote = async (/** @type {string} */ optionId) => {
    const currentUserId = userData?.documentId || '';
    if (!chatId || !optionId || !poll || poll.type !== 'poll' || !currentUserId) return;

    if (!effectiveMessageId || String(effectiveMessageId).startsWith('temp-')) {
      Alert.alert(
        t('conversation.poll.details.syncTitle', 'Information'),
        t(
          'conversation.poll.details.syncInProgress',
          'Le sondage est en cours de synchronisation.',
        ),
      );
      return;
    }

    const { changed, nextComposition } = applyOptimisticPollVote({
      currentUserId,
      optionId,
      poll,
    });

    if (!changed) return;

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {any} */ page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.map((/** @type {any} */ message) => {
              const currentId = String(message?.documentId || message?.id || '');
              if (currentId !== String(effectiveMessageId)) return message;
              return { ...message, composition: nextComposition };
            })
            : [],
        })),
      };
    });

    try {
      setIsSubmittingVote(true);
      await votePoll(String(effectiveMessageId), optionId);
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      Alert.alert(
        t('common.error', 'Erreur'),
        t('conversation.poll.errors.voteSave', 'Impossible de sauvegarder ce vote.'),
      );
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const totalVotes = useMemo(
    () => getPollTotalVotes(Array.isArray(poll?.options) ? poll.options : []),
    [poll?.options],
  );

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images.bg2}
      style={[Alignments.fill]}
    >
      {shouldAvoidDeprecatedSystemBarColors ? (
        <StatusBar barStyle="light-content" translucent />
      ) : (
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      )}

      <View style={[styles.header, { paddingTop: top + 10 }]}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 0 }}
          withDefaultMargin={false}
        />
        <View style={styles.headerContent}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
            {t('conversation.poll.details.title', 'Detail du sondage')}
          </Text>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {poll?.isAnonymous
              ? t('conversation.poll.details.anonymousVotes', 'Votes anonymes')
              : t('conversation.poll.details.visibleVotes', 'Votes visibles')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }, styles.sectionTitle]}>
          {t('conversation.poll.details.infoTitle', 'Informations du sondage')}
        </Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('conversation.poll.details.createdBy', 'Crée par')}
            </Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{createdByName}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('conversation.poll.details.date', 'Date')}
            </Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{createdAtLabel}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('conversation.poll.details.voteCount', 'Nombre de votes')}
            </Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{totalVotes}</Text>
          </View>
        </View>
        <View style={styles.sectionHintCard}>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t(
              'conversation.poll.details.voteHint',
              'Sélectionne une option pour voter ou modifier ton vote. '
                + 'Appuie à nouveau dessus pour retirer ton vote. '
                + 'Le detail des votants s\'affiche quand le sondage n\'est pas anonyme.',
            )}
          </Text>
        </View>

        {isMessagesLoading && !poll ? (
          <View style={[Alignments.alignCenter, Spaces.marginTop[24]]}>
            <ActivityIndicator color={Colors.primary500} size="large" />
          </View>
        ) : null}

        {!poll ? (
          <View
            style={[
              Spaces.padding[16],
              {
                backgroundColor: 'rgba(20, 39, 52, 0.7)',
                borderColor: 'rgba(255,255,255,0.12)',
                borderRadius: 12,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
              {t(
                'conversation.poll.details.notFound',
                'Ce sondage est introuvable ou a été supprimé.',
              )}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.pollWrapper}>
              <PollMessageBubble
                currentUserId={userData?.documentId || ''}
                fullWidth
                isMe={false}
                onVote={isSubmittingVote ? undefined : handleVote}
                poll={poll}
                resolveVoterName={resolveVoterName}
                showSelectedBadge
                showVoterChips
              />
            </View>

            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }, styles.votersSectionTitle]}>
              {t('conversation.poll.details.votesByOption', 'Votes par option')}
            </Text>
            {poll?.isAnonymous ? (
              <View style={styles.sectionHintCard}>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                  {t(
                    'conversation.poll.details.anonymousHint',
                    'Ce sondage est anonyme. Les votants ne sont pas affiches.',
                  )}
                </Text>
              </View>
            ) : optionVoterSections.map((section) => (
              <View key={section.optionId} style={styles.optionSectionCard}>
                <View style={styles.optionSectionHeader}>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1 }]}>
                    {section.optionLabel}
                  </Text>
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                    {section.voters.length}
                    {' '}
                    {t('conversation.poll.common.vote', 'vote')}
                    {section.voters.length > 1 ? 's' : ''}
                  </Text>
                </View>

                {section.voters.length === 0 ? (
                  <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                    {t('conversation.poll.details.noVotes', 'Aucun vote pour cette option.')}
                  </Text>
                ) : section.voters.map((voter) => {
                  const fullName = `${voter.firstname} ${voter.lastname}`.trim();
                  const displayLabel = fullName
                    || voter.displayName
                    || t('conversation.poll.common.member', 'Membre');

                  return (
                    <View key={`${section.optionId}-${voter.voterId}`} style={styles.voterRow}>
                      <ProfileAvatar
                        enablePreview={false}
                        imageUrl={voter.avatarUrl}
                        name={displayLabel}
                        size={34}
                        style={{ borderRadius: 17 }}
                      />
                      <Text style={[Fonts.p3Bold, { color: Colors.neutral00, marginLeft: 10 }]}>
                        {displayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

export default PollDetails;
