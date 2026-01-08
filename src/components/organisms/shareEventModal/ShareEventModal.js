import { FlashList } from '@shopify/flash-list';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Share, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import { useGetChats } from '@/services/chat/chatQueries';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Button from '@/components/atoms/button/Button';

/**
 * Modal to select a chat to share an event
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {Function} props.onClose
 * @param {Function} props.onSelectChat - Callback (chatId) => void
 * @param {import('@/domains/event/types').FCEvent} [props.event] - The event to share (for native share)
 * @returns {import('react').ReactElement}
 */
const ShareEventModal = ({ isVisible, onClose, onSelectChat, event }) => {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData, allMyTeams } = useAuth();
  const { getClubInitials } = useClub();
  const { getConversationName } = useMessaging();

  const {
    data: chatsData,
    isLoading,
    error,
  } = useGetChats({
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: allMyTeams?.map((team) => team.documentId || ''),
    pageSize: 50,
  });

  const allChats = useMemo(() => {
    const chats = chatsData?.pages ? chatsData?.pages?.reduce(
      (acc, page) => acc.concat(page.data || []),
      /** @type {Chat[]} */([]),
    ) : [];

    const priority = {
        'multisport': 0,
        'club': 1,
        'team': 2,
        'whisper': 3
    };
    
    const canWriteInChat = (chat) => {
        if (!chat || !userData) return false;
        
        // Whisper and Team chats: All participants can write
        if (chat.type === 'whisper' || chat.type === 'team') return true;

        // Club Chat: Only Club Admins can write
        if (chat.type === 'club') {
           // Check if user is admin of this club
           // Note: chat.club is the club object of the chat
           // userData.role?.type should be checked against 'dirigeant'
           // And ensure it's the SAME club
           return userData.role?.type === 'dirigeant' && userData.club?.documentId === chat.club?.documentId;
        }

        // Multisport Chat: Only Multisport Admins can write
        if (chat.type === 'multisport') {
           // Check if user is in admins list of multisport club
           const admins = chat.multisportClub?.admins || [];
           return admins.some(admin => admin.documentId === userData.documentId);
        }

        return false;
    };
    
    // Filter chats where user can write
    const writableChats = chats.filter(canWriteInChat);

    return writableChats.sort((a, b) => {
        const pA = priority[a.type] ?? 99;
        const pB = priority[b.type] ?? 99;
        if (pA !== pB) return pA - pB;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [chatsData?.pages, userData]);

  const handleNativeShare = async () => {
    if (!event) return;
    try {
      const message = `${t('event.shareMessage', 'Découvrez cet événement :')} ${event.title}\n${event.description || ''}`;
      await Share.share({
        message,
        title: event.title,
        // url: `foundclub://event/${event.documentId}` // Optional deep link
      });
    } catch (err) {
      console.error(err);
    }
  };

  const renderAvatar = (chat) => {
    switch (chat.type) {
      case 'club':
        if (chat?.club?.logo?.url) {
            return <ProfileAvatar imageUrl={chat.club.logo.url} size={40} enablePreview={false} />;
        }
        return <TeamShield initials={getClubInitials(chat?.club?.name || '')} isNeutral isSmall />;
      case 'team':
        if (chat?.team?.logo?.url) {
            return <ProfileAvatar imageUrl={chat.team.logo.url} size={40} enablePreview={false} />;
        }
        return <TeamShield initials={getClubInitials(chat?.team?.name || '')} isSmall />;
      case 'multisport':
        if (chat?.multisportClub?.logo?.url) {
            return <ProfileAvatar imageUrl={chat.multisportClub.logo.url} size={40} enablePreview={false} />;
        }
        return <TeamShield initials={getClubInitials(chat?.multisportClub?.name || '')} isNeutral isSmall />;
      case 'whisper':
      default: {
        const participant = chat.participants?.find((p) => p.documentId !== userData?.documentId) || chat.participants?.[0];
        return <ProfileAvatar imageUrl={participant?.avatar?.url} size={40} />;
      }
    }
  };

  const renderItem = ({ item: chat }) => (
    <TouchableOpacity
      onPress={() => onSelectChat(chat.documentId)}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.paddingVertical[12],
        Spaces.paddingHorizontal[16],
        { borderBottomWidth: 1, borderBottomColor: Colors.neutral800 }, // Darker separator
      ]}
    >
      <View style={{ width: 40, height: 40, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
        {renderAvatar(chat)}
      </View>
      <Text style={[Fonts.p2Bold, Fonts.neutral00, Alignments.fill]}>
        {getConversationName({
          chatClub: chat.club,
          chatMultisportClub: chat.multisportClub,
          chatParticipants: chat.participants,
          chatTeam: chat.team,
          chatType: chat.type,
          meId: userData?.documentId,
        })}
      </Text>
      <Image source={Images.arrowRight} style={{ width: 20, height: 20, tintColor: Colors.neutral500 }} />
    </TouchableOpacity>
  );

  return (
    <BottomModal
      isVisible={isVisible}
      close={onClose}
      height="80%"
      headerComponent={(
        <Text style={[Fonts.h3, Fonts.neutral00, { textAlign: 'center' }, Spaces.paddingTop[24]]}>
            {t('event.shareTitle', 'Partager l\'événement')}
        </Text>
      )}
    >
        <View style={[Alignments.fill, Spaces.gap[16]]}>
            {/* Native Share Option */}
            <View style={[Spaces.paddingHorizontal[16]]}>
                <Button
                    onPress={handleNativeShare}
                    title={t('event.shareViaOther', 'Partager via... (SMS, Mail)')}
                    variant="Secondary"
                    style={{ backgroundColor: Colors.neutral800 }}
                    textStyle={{ color: Colors.neutral00 }}
                    icon="share"
                />
            </View>

            <View style={[Spaces.paddingHorizontal[16], Spaces.marginTop[8]]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>
                    {t('event.shareInChat', 'Partager dans une conversation')}
                </Text>
            </View>

            {/* List */}
            <WithDataWrapper isLoading={isLoading} error={error?.message} wrapperStyle={[Alignments.fill]}>
                <FlashList
                    data={allChats}
                    renderItem={renderItem}
                    estimatedItemSize={64}
                    keyExtractor={(item) => item.documentId}
                    contentContainerStyle={[Spaces.paddingBottom[24]]}
                />
            </WithDataWrapper>
        </View>
    </BottomModal>
  );
};

export default ShareEventModal;
