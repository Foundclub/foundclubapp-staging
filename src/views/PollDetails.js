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
import annuaireDesMembres from '@/domains/messaging/annuaireDesMembres';
import {
  applyOptimisticPollVote,
  getPollTotalVotes,
  getPollVoteCount,
  getPollVoters,
} from '@/domains/messaging/pollUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import usePollVoterProfiles from '@/domains/messaging/usePollVoterProfiles';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import PollMessageBubble from '@/components/molecules/pollMessageBubble/PollMessageBubble';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueriesCompat';

// 🎨 MSG1A (§3.4) — les mesures du pack (SPECS.md §3, « Detail du sondage »).
const styles = StyleSheet.create({
  aide: {
    marginBottom: 4,
    marginTop: 8,
  },
  aucunVote: {
    paddingBottom: 10,
    paddingTop: 2,
  },
  barre: {
    borderRadius: 3,
    height: 6,
    marginBottom: 8,
    marginTop: 10,
    overflow: 'hidden',
  },
  boutonRetour: {
    alignItems: 'center',
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    marginLeft: 0,
    padding: 0,
    width: 40,
  },
  capitales: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  carte: {
    borderRadius: 16,
    marginTop: 12,
    padding: 16,
  },
  carteDOption: {
    borderRadius: 16,
    marginTop: 12,
    paddingBottom: 6,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  carteInfos: {
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  compteDOption: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 13.5,
    lineHeight: 18,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  etiquette: {
    borderRadius: 999,
    fontFamily: 'Montserrat-Bold',
    fontSize: 12.5,
    lineHeight: 17,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  etiquettes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    marginTop: 12,
  },
  flecheRetour: {
    height: 20,
    width: 20,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 62,
    paddingBottom: 11,
    paddingHorizontal: 12,
  },
  infoLibelle: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14.5,
    lineHeight: 20,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
  },
  infoValeur: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14.5,
    lineHeight: 20,
  },
  libelleDOption: {
    flex: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    lineHeight: 21,
  },
  nomDuVotant: {
    flex: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    lineHeight: 20,
  },
  optionSectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  pollWrapper: {
    marginTop: 4,
  },
  question: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 20,
    lineHeight: 26,
  },
  titreDeLEnTete: {
    flex: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    lineHeight: 20,
  },
  titreDeSection: {
    marginBottom: 8,
    marginHorizontal: 4,
    marginTop: 24,
  },
  voterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 52,
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
  const pollVoterProfiles = usePollVoterProfiles(effectiveMessageId, poll);

  const voterDirectory = useMemo(() => {
    /** @type {Map<string, { avatarUrl: string; displayName: string; firstname: string; lastname: string }>} */
    const directory = new Map();
    // T19-RESTES — la règle commune : le nom le plus frais l'emporte (votants lus au serveur,
    // participants, mon compte, puis les messages du plus récent au plus ancien). Avant, le nom
    // figé dans le PLUS VIEUX message gagnait (« Créé par mouri nio »).
    annuaireDesMembres({
      messages: (Array.isArray(messagesPages?.pages) ? messagesPages.pages : [])
        .flatMap((page) => (Array.isArray(page?.data) ? page.data : [])),
      participants: chatData?.participants,
      userData,
      votants: pollVoterProfiles,
    }).forEach((user, userId) => {
      const firstname = String(user?.firstname || '').trim();
      const lastname = String(user?.lastname || '').trim();
      const fallbackName = String(user?.username || user?.email || '').trim();
      directory.set(userId, {
        avatarUrl: String(user?.avatar?.url || '').trim(),
        displayName: `${firstname} ${lastname}`.trim() || fallbackName
          || t('pollDetails.member', 'Membre'),
        firstname,
        lastname,
      });
    });
    return directory;
  }, [chatData?.participants, messagesPages?.pages, pollVoterProfiles, userData, t]);

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
    return parsed.toLocaleString(localeDesFormats(), {
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

  // 🎨 MSG1A (§3.4) — le detail du pack (SPECS.md §3) : la question en grand, ses reglages en
  // etiquettes, une carte par option (compte en cyan pour la plus votee, barre, votants), puis
  // les informations. Le vote depuis la carte du haut reste possible, comme avant.
  const comptesParOption = (Array.isArray(poll?.options) ? poll.options : [])
    .map((/** @type {any} */ option) => getPollVoteCount(option));
  const maximumDeVotes = Math.max(1, ...comptesParOption);
  const etiquettes = [
    poll?.allowMultipleVotes
      ? t('conversation.poll.details.multipleAllowed', 'Votes multiples autorisés')
      : t('conversation.poll.details.singleChoice', 'Un seul choix par participant'),
  ].concat(
    poll?.isAnonymous ? [t('conversation.poll.details.anonymousVotes', 'Votes anonymes')] : [],
  );
  const capitales = [styles.capitales, { color: withAlpha(Colors.neutral00, 0.6) }];

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images.bg2}
      style={[Alignments.fill, { backgroundColor: Colors.chatBackground }]}
    >
      {shouldAvoidDeprecatedSystemBarColors ? (
        <StatusBar barStyle="light-content" translucent />
      ) : (
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      )}

      <View
        style={[
          styles.header,
          {
            backgroundColor: Colors.chatBar,
            borderBottomColor: withAlpha(Colors.neutral00, 0.06),
            paddingTop: top + 10,
          },
        ]}
      >
        <HeaderBackButton
          iconStyle={styles.flecheRetour}
          onPress={() => navigation.goBack()}
          style={styles.boutonRetour}
          withDefaultMargin={false}
        />
        <Text
          accessibilityRole="header"
          style={[styles.titreDeLEnTete, { color: Colors.neutral00 }]}
        >
          {t('conversation.poll.details.title', 'Detail du sondage')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {isMessagesLoading && !poll ? (
          <View style={[Alignments.alignCenter, Spaces.marginTop[24]]}>
            <ActivityIndicator color={Colors.primary500} size="large" />
          </View>
        ) : null}

        {!poll ? (
          <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
              {t(
                'conversation.poll.details.notFound',
                'Ce sondage est introuvable ou a été supprimé.',
              )}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.question, { color: Colors.neutral00 }]}>
              {poll.question || t('conversation.poll.bubble.questionFallback', 'Question')}
            </Text>
            <View style={styles.etiquettes}>
              {etiquettes.map((etiquette) => (
                <Text
                  key={etiquette}
                  style={[
                    styles.etiquette,
                    {
                      backgroundColor: withAlpha(Colors.primary500, 0.14),
                      color: Colors.primary500,
                    },
                  ]}
                >
                  {etiquette}
                </Text>
              ))}
            </View>

            <View style={styles.pollWrapper}>
              <PollMessageBubble
                currentUserId={userData?.documentId || ''}
                fullWidth
                isMe={false}
                onVote={isSubmittingVote ? undefined : handleVote}
                poll={poll}
                resolveVoterName={resolveVoterName}
              />
            </View>
            <Text style={[Fonts.p4, styles.aide, { color: withAlpha(Colors.neutral00, 0.6) }]}>
              {t(
                'conversation.poll.details.voteHint',
                'Sélectionne une option pour voter ou modifier ton vote. '
                  + 'Appuie à nouveau dessus pour retirer ton vote. '
                  + 'Le detail des votants s\'affiche quand le sondage n\'est pas anonyme.',
              )}
            </Text>

            {optionVoterSections.map((/** @type {any} */ section, /** @type {number} */ rang) => {
              const compte = comptesParOption[rang] ?? section.voters.length;
              const enTete = compte === maximumDeVotes && compte > 0;
              return (
                <View
                  key={section.optionId}
                  style={[styles.carteDOption, { backgroundColor: Colors.primary700 }]}
                  testID={`detail-sondage-option-${section.optionId}`}
                >
                  <View style={styles.optionSectionHeader}>
                    <Text style={[styles.libelleDOption, { color: Colors.neutral00 }]}>
                      {section.optionLabel}
                    </Text>
                    <Text
                      style={[
                        styles.compteDOption,
                        { color: enTete ? Colors.primary500 : withAlpha(Colors.neutral00, 0.7) },
                      ]}
                    >
                      {t('conversation.poll.bubble.votes', {
                        count: compte,
                        defaultValue_one: '{{count}} vote',
                        defaultValue_other: '{{count}} votes',
                      })}
                    </Text>
                  </View>
                  <View
                    style={[styles.barre, { backgroundColor: withAlpha(Colors.neutral00, 0.14) }]}
                  >
                    <View
                      style={{
                        backgroundColor: Colors.primary500,
                        height: '100%',
                        width: `${(compte / maximumDeVotes) * 100}%`,
                      }}
                    />
                  </View>

                  {/* Un sondage anonyme ne montre personne. */}
                  {poll?.isAnonymous ? <View style={{ height: 6 }} /> : null}
                  {!poll?.isAnonymous && section.voters.length === 0 ? (
                    <Text
                      style={[
                        Fonts.p3,
                        styles.aucunVote,
                        { color: withAlpha(Colors.neutral00, 0.55) },
                      ]}
                    >
                      {t('conversation.poll.details.noVotes', 'Aucun vote pour cette option.')}
                    </Text>
                  ) : null}
                  {!poll?.isAnonymous ? section.voters.map((
                    /** @type {any} */ voter,
                    /** @type {number} */ index,
                  ) => {
                    const fullName = `${voter.firstname} ${voter.lastname}`.trim();
                    const displayLabel = fullName
                      || voter.displayName
                      || t('conversation.poll.common.member', 'Membre');

                    return (
                      <View
                        key={`${section.optionId}-${voter.voterId}`}
                        style={[
                          styles.voterRow,
                          index > 0
                            ? {
                              borderTopColor: withAlpha(Colors.neutral00, 0.06),
                              borderTopWidth: 1,
                            }
                            : null,
                        ]}
                      >
                        <ProfileAvatar
                          enablePreview={false}
                          imageUrl={voter.avatarUrl}
                          name={displayLabel}
                          size={36}
                          style={{ borderRadius: 18 }}
                        />
                        <Text style={[styles.nomDuVotant, { color: Colors.neutral00 }]}>
                          {displayLabel}
                        </Text>
                      </View>
                    );
                  }) : null}
                </View>
              );
            })}

            <Text style={[capitales, styles.titreDeSection]}>
              {t('conversation.poll.details.infoTitle', 'Informations du sondage')}
            </Text>
            <View style={[styles.carteInfos, { backgroundColor: Colors.primary700 }]}>
              {[
                [t('conversation.poll.details.createdBy', 'Crée par'), createdByName],
                [t('conversation.poll.details.date', 'Date'), createdAtLabel],
                [t('conversation.poll.details.voteCount', 'Nombre de votes'), String(totalVotes)],
              ].map(([libelle, valeur], index) => (
                <View
                  key={libelle}
                  style={[
                    styles.infoRow,
                    index > 0
                      ? { borderTopColor: withAlpha(Colors.neutral00, 0.06), borderTopWidth: 1 }
                      : null,
                  ]}
                >
                  <Text style={[styles.infoLibelle, { color: withAlpha(Colors.neutral00, 0.7) }]}>
                    {libelle}
                  </Text>
                  <Text style={[styles.infoValeur, { color: Colors.neutral00 }]}>{valeur}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

export default PollDetails;
