import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import useAuth from '@/domains/auth/useAuth';
import {
  applyOptimisticPollVote,
  getPollTotalVotes,
  getPollVoters,
} from '@/domains/messaging/pollUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import { BREAKPOINTS } from '@/responsive';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueriesCompat';
import useTheme from '@/theme/themeContext';
import getImageUrl from '@/utils/imageUrl';

const flattenMessages = (pages) => {
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
};

const getMessageId = (message) => String(message?.documentId || message?.id || '').trim();

const toDisplayDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getDisplayName = (user) => {
  const firstname = String(user?.firstname || '').trim();
  const lastname = String(user?.lastname || '').trim();
  return `${firstname} ${lastname}`.trim() || String(user?.username || user?.email || 'Membre').trim() || 'Membre';
};

const getInitials = (value) => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '')
  .join('');

function PollDetails({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { userData } = useAuth();
  const { Colors } = useTheme();
  const { chatId = '', messageId = '', poll: initialPoll = null } = route?.params || {};
  const { votePoll } = useMessaging(chatId);
  const { data: chatData } = useGetChatById(chatId);
  const { data: messagesPages, isLoading } = useGetChatMessages({ chatId });
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const pollMessage = useMemo(() => {
    const messages = flattenMessages(messagesPages?.pages);
    if (!messageId) return null;
    return messages.find((message) => (
      getMessageId(message) === String(messageId)
      && message?.composition?.type === 'poll'
    )) || null;
  }, [messageId, messagesPages?.pages]);

  const effectiveMessageId = String(pollMessage?.documentId || pollMessage?.id || messageId || '').trim();
  const poll = useMemo(() => {
    if (pollMessage?.composition?.type === 'poll') return pollMessage.composition;
    if (initialPoll?.type === 'poll') return initialPoll;
    return null;
  }, [initialPoll, pollMessage?.composition]);

  const voterDirectory = useMemo(() => {
    const map = new Map();

    const registerUser = (user) => {
      const userId = String(user?.documentId || user?.id || '').trim();
      if (!userId) return;
      map.set(userId, {
        avatarUrl: getImageUrl(user?.avatar?.url || ''),
        displayName: getDisplayName(user),
      });
    };

    registerUser(userData);
    if (Array.isArray(chatData?.participants)) {
      chatData.participants.forEach(registerUser);
    }
    flattenMessages(messagesPages?.pages).forEach((message) => registerUser(message?.sender));
    return map;
  }, [chatData?.participants, messagesPages?.pages, userData]);

  const resolveVoterProfile = useCallback((voterId) => {
    return voterDirectory.get(String(voterId || '').trim()) || {
      avatarUrl: '',
      displayName: t('conversation.poll.common.member', 'Membre'),
    };
  }, [t, voterDirectory]);

  const totalVotes = useMemo(
    () => getPollTotalVotes(Array.isArray(poll?.options) ? poll.options : []),
    [poll?.options],
  );

  const optionSections = useMemo(() => {
    if (!Array.isArray(poll?.options)) return [];
    return poll.options.map((option, index) => ({
      count: getPollVoters(option).length,
      id: String(option?.id || `option-${index}`),
      isSelected: getPollVoters(option).includes(String(userData?.documentId || '').trim()),
      label: String(
        option?.label
          || t('conversation.poll.form.optionPlaceholder', {
            defaultValue: 'Option {{index}}',
            index: index + 1,
          }),
      ),
      voters: getPollVoters(option).map((voterId) => ({
        id: voterId,
        ...resolveVoterProfile(voterId),
      })),
    }));
  }, [poll?.options, resolveVoterProfile, t, userData?.documentId]);

  const handleVote = useCallback(async (optionId) => {
    const currentUserId = String(userData?.documentId || '').trim();
    if (!currentUserId || !poll || poll.type !== 'poll' || !optionId || !effectiveMessageId) return;

    const optimistic = applyOptimisticPollVote({
      currentUserId,
      optionId,
      poll,
    });

    if (!optimistic.changed) return;

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (oldData) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.map((message) => {
              if (getMessageId(message) !== effectiveMessageId) return message;
              return {
                ...message,
                composition: optimistic.nextComposition,
              };
            })
            : [],
        })),
      };
    });

    try {
      setIsSubmittingVote(true);
      await votePoll(effectiveMessageId, optionId);
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      window.alert(error?.message || 'Impossible de sauvegarder ce vote.');
    } finally {
      setIsSubmittingVote(false);
    }
  }, [chatId, effectiveMessageId, poll, queryClient, userData?.documentId, votePoll]);

  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';
  const borderColor = 'rgba(255,255,255,0.08)';
  const panelBackground = 'rgba(6, 19, 29, 0.78)';
  const cardBackground = 'rgba(8, 26, 39, 0.9)';

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="wide"
      responsivePadding
      style={{ paddingBottom: 32 }}
    >
      <div style={{ color: textColor, display: 'grid', gap: 24 }}>
        <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 28, padding: isTablet ? 28 : 20 }}>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Messagerie
              </span>
              <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 34 : 28, margin: 0 }}>
                Detail du sondage
              </h1>
              <p style={{ color: mutedTextColor, margin: 0, maxWidth: 720 }}>
                Consulte les résultats, vote ou modifie ton choix directement depuis le web.
              </p>
            </div>
            <button
              onClick={() => navigation.goBack()}
              style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '10px 14px' }}
              type="button"
            >
              Retour
            </button>
          </div>

          {isLoading && !poll ? (
            <div style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 20, color: mutedTextColor, padding: 20 }}>
              Chargement du sondage…
            </div>
          ) : null}

          {!poll ? (
            <div style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 20, display: 'grid', gap: 8, padding: 20 }}>
              <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>
                Sondage introuvable
              </strong>
              <p style={{ color: mutedTextColor, margin: 0 }}>
                Ce sondage est introuvable ou a été supprimé.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 18, gridTemplateColumns: isDesktop ? 'minmax(0, 1.2fr) 360px' : '1fr' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <section style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 22, display: 'grid', gap: 12, padding: 20 }}>
                  <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Question
                  </span>
                  <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 28, margin: 0 }}>
                    {String(poll?.question || 'Sondage')}
                  </h2>
                  <p style={{ color: mutedTextColor, margin: 0 }}>
                    {poll?.isAnonymous
                      ? 'Votes anonymes'
                      : 'Votes visibles pour tous les participants'}
                    {' • '}
                    {poll?.allowMultipleVotes
                      ? 'Votes multiples autorises'
                      : 'Un seul choix par participant'}
                  </p>
                </section>

                <div style={{ display: 'grid', gap: 14 }}>
                  {optionSections.map((section) => (
                    <section key={section.id} style={{ background: cardBackground, border: `1px solid ${section.isSelected ? accentColor : borderColor}`, borderRadius: 22, display: 'grid', gap: 12, padding: 18 }}>
                      <div style={{ alignItems: 'center', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18 }}>
                            {section.label}
                          </strong>
                          <span style={{ color: mutedTextColor, fontSize: 13 }}>
                            {section.count}
                            {' '}
                            vote{section.count > 1 ? 's' : ''}
                          </span>
                        </div>
                        <button
                          disabled={isSubmittingVote}
                          onClick={() => handleVote(section.id)}
                          style={{
                            background: section.isSelected ? 'rgba(1,179,244,0.14)' : accentColor,
                            border: section.isSelected ? `1px solid ${accentColor}` : 0,
                            borderRadius: 999,
                            color: section.isSelected ? textColor : '#04131d',
                            cursor: isSubmittingVote ? 'not-allowed' : 'pointer',
                            fontFamily: 'Montserrat-Bold, sans-serif',
                            padding: '10px 14px',
                          }}
                          type="button"
                        >
                          {section.isSelected ? 'Vote enregistre' : 'Voter'}
                        </button>
                      </div>

                      {!poll?.isAnonymous ? (
                        section.voters.length > 0 ? (
                          <div style={{ display: 'grid', gap: 10 }}>
                            {section.voters.map((voter) => (
                              <div key={`${section.id}-${voter.id}`} style={{ alignItems: 'center', display: 'flex', gap: 12 }}>
                                {voter.avatarUrl ? (
                                  <img
                                    alt={voter.displayName}
                                    src={voter.avatarUrl}
                                    style={{ borderRadius: '50%', height: 34, objectFit: 'cover', width: 34 }}
                                  />
                                ) : (
                                  <div style={{ alignItems: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '50%', display: 'flex', height: 34, justifyContent: 'center', width: 34 }}>
                                    <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 12 }}>
                                      {getInitials(voter.displayName)}
                                    </span>
                                  </div>
                                )}
                                <span>{voter.displayName}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: mutedTextColor, fontSize: 13 }}>Aucun vote pour cette option.</span>
                        )
                      ) : (
                        <span style={{ color: mutedTextColor, fontSize: 13 }}>
                          Ce sondage est anonyme, la liste des votants n’est pas affichée.
                        </span>
                      )}
                    </section>
                  ))}
                </div>
              </div>

              <aside style={{ alignSelf: 'start', background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 20, position: isDesktop ? 'sticky' : 'relative', top: isDesktop ? 24 : 'auto' }}>
                <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Informations
                </span>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <span style={{ color: mutedTextColor, fontSize: 12 }}>Creé par</span>
                    <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>
                      {poll?.createdBy ? (resolveVoterProfile(String(poll.createdBy)).displayName) : 'Membre'}
                    </strong>
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <span style={{ color: mutedTextColor, fontSize: 12 }}>Date</span>
                    <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>{toDisplayDate(poll?.createdAt)}</strong>
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <span style={{ color: mutedTextColor, fontSize: 12 }}>Total votes</span>
                    <strong style={{ color: accentColor, fontFamily: 'Montserrat-Black, sans-serif', fontSize: 30 }}>{totalVotes}</strong>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </section>
      </div>
    </ScreenContainer>
  );
}

export default PollDetails;
