import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import PollMessageBubble from '@/components/molecules/pollMessageBubble/PollMessageBubble';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueries';

const getVoters = (option) => (Array.isArray(option?.voters)
  ? option.voters.filter((value) => typeof value === 'string' && value.length > 0)
  : []);

const getVoteCount = (option) => {
  const fallback = getVoters(option).length;
  return typeof option?.voteCount === 'number' ? option.voteCount : fallback;
};

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
});

/**
 * Poll details screen.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function PollDetails({ navigation, route }) {
  const { chatId = '', messageId = '', poll: initialPoll = null } = route.params || {};
  const { userData } = useAuth();
  const { updateMessage } = useMessaging(chatId);
  const queryClient = useQueryClient();
  const { bottom, top } = useSafeAreaInsets();
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

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

  const voterNameDirectory = useMemo(() => {
    /** @type {Map<string, string>} */
    const directory = new Map();

    const registerUser = (/** @type {any} */ user) => {
      const userId = user?.documentId || user?.id;
      if (!userId) return;
      const firstname = (user?.firstname || '').trim();
      const lastname = (user?.lastname || '').trim();
      const fullName = `${firstname} ${lastname}`.trim();
      const fallbackName = (user?.username || user?.email || '').trim();
      directory.set(String(userId), fullName || fallbackName || 'Membre');
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
    if (!voterId) return 'Membre';
    return voterNameDirectory.get(String(voterId)) || 'Membre';
  };

  const createdByName = poll?.createdBy
    ? resolveVoterName(String(poll.createdBy))
    : 'Membre';
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
      Alert.alert('Information', 'Le sondage est en cours de synchronisation.');
      return;
    }

    const options = Array.isArray(poll.options) ? poll.options : [];
    if (options.length === 0) return;

    const allowMultipleVotes = !!poll.allowMultipleVotes;
    const currentSelection = options
      .filter((option) => Array.isArray(option?.voters) && option.voters.includes(currentUserId))
      .map((option) => String(option.id));

    if (!allowMultipleVotes && currentSelection.length === 1 && currentSelection[0] === optionId) {
      return;
    }

    let hasChange = false;
    const nextOptions = options.map((option) => {
      const voters = getVoters(option);
      const isTarget = String(option.id) === optionId;
      const hasCurrentUser = voters.includes(currentUserId);
      let nextVoters = voters;

      if (allowMultipleVotes) {
        if (isTarget && !hasCurrentUser) {
          nextVoters = [...voters, currentUserId];
        } else if (isTarget && hasCurrentUser) {
          nextVoters = voters.filter((value) => value !== currentUserId);
        }
      } else if (isTarget && !hasCurrentUser) {
        nextVoters = [...voters, currentUserId];
      } else if (!isTarget && hasCurrentUser) {
        nextVoters = voters.filter((value) => value !== currentUserId);
      }

      if (nextVoters.length !== voters.length) {
        hasChange = true;
      }

      return {
        ...option,
        voteCount: nextVoters.length,
        voters: nextVoters,
      };
    });

    if (!hasChange) return;

    const nextComposition = {
      ...poll,
      options: nextOptions,
      updatedAt: new Date().toISOString(),
    };

    queryClient.setQueryData(['chat-messages', chatId], (/** @type {any} */ oldData) => {
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
      await updateMessage({
        data: { composition: nextComposition },
        messageId: String(effectiveMessageId),
      });
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      Alert.alert('Erreur', 'Impossible de sauvegarder ce vote.');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const totalVotes = useMemo(
    () => (Array.isArray(poll?.options)
      ? poll.options.reduce((sum, option) => sum + getVoteCount(option), 0)
      : 0),
    [poll?.options],
  );

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images.bg2}
      style={[Alignments.fill]}
    >
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      <View style={[styles.header, { paddingTop: top + 10 }]}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 0 }}
          withDefaultMargin={false}
        />
        <View style={styles.headerContent}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>Detail du sondage</Text>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {poll?.isAnonymous ? 'Votes anonymes' : 'Votes visibles'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }, styles.sectionTitle]}>
          Informations du sondage
        </Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Cree par</Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{createdByName}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Date</Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{createdAtLabel}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Nombre de votes</Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{totalVotes}</Text>
          </View>
        </View>
        <View style={styles.sectionHintCard}>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            Selectionne une option pour voter. Le detail des votants est affiche quand le sondage
            n est pas anonyme.
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
              Ce sondage est introuvable ou a ete supprime.
            </Text>
          </View>
        ) : (
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
        )}
      </ScrollView>
    </ImageBackground>
  );
}

export default PollDetails;
