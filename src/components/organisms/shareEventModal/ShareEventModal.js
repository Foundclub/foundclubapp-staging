import { FlashList } from '@shopify/flash-list';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Share, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import { useGetChats } from '@/services/chat/chatQueries';

/**
 * Modal to select a chat to share an event
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {Function} props.onClose
 * @param {Function} props.onSelectChat - Callback (chatId) => void
 * @param {import('@/domains/event/types').FCEvent} [props.event] - The event to share (for native share)
 * @returns {import('react').ReactElement}
 */
function ShareEventModal({
  event, isVisible, onClose, onSelectChat,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { allMyTeams, userData } = useAuth();
  const { getClubInitials } = useClub();
  const { getConversationName } = useMessaging();

  const {
    data: chatsData,
    error,
    isLoading,
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
      club: 1,
      multisport: 0,
      team: 2,
      whisper: 3,
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
        return admins.some((admin) => admin.documentId === userData.documentId);
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
          return <ProfileAvatar enablePreview={false} imageUrl={chat.club.logo.url} size={40} />;
        }
        return <TeamShield initials={getClubInitials(chat?.club?.name || '')} isNeutral isSmall />;
      case 'multisport':
        if (chat?.multisportClub?.logo?.url) {
          return <ProfileAvatar enablePreview={false} imageUrl={chat.multisportClub.logo.url} size={40} />;
        }
        return <TeamShield initials={getClubInitials(chat?.multisportClub?.name || '')} isNeutral isSmall />;
      case 'team':
        if (chat?.team?.logo?.url) {
          return <ProfileAvatar enablePreview={false} imageUrl={chat.team.logo.url} size={40} />;
        }
        return <TeamShield initials={getClubInitials(chat?.team?.name || '')} isSmall />;
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
        { borderBottomColor: Colors.neutral800, borderBottomWidth: 1 }, // Darker separator
      ]}
    >
      <View style={{
        alignItems: 'center', height: 40, justifyContent: 'center', marginRight: 12, width: 40,
      }}
      >
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
      <Image source={Images.arrowRight} style={{ height: 20, tintColor: Colors.neutral500, width: 20 }} />
    </TouchableOpacity>
  );

  return (
    <BottomModal
      close={onClose}
      headerComponent={(
        <Text style={[Fonts.h3, Fonts.neutral00, { textAlign: 'center' }, Spaces.paddingTop[24]]}>
          {t('event.shareTitle', 'Partager l\'événement')}
        </Text>
      )}
      height="80%"
      isVisible={isVisible}
    >
      <View style={[Alignments.fill, Spaces.gap[16]]}>
        {/* Native Share Option */}
        <View style={[Spaces.paddingHorizontal[16]]}>
          <Button
            icon="share"
            onPress={handleNativeShare}
            style={{ backgroundColor: Colors.neutral800 }}
            textStyle={{ color: Colors.neutral00 }}
            title={t('event.shareViaOther', 'Partager via... (SMS, Mail)')}
            variant="Secondary"
          />
        </View>

        <View style={[Spaces.paddingHorizontal[16], Spaces.marginTop[8]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            {t('event.shareInChat', 'Partager dans une conversation')}
          </Text>
        </View>

        {/* List */}
        <WithDataWrapper error={error?.message} isLoading={isLoading} wrapperStyle={[Alignments.fill]}>
          <FlashList
            contentContainerStyle={[Spaces.paddingBottom[24]]}
            data={allChats}
            estimatedItemSize={64}
            keyExtractor={(item) => item.documentId}
            renderItem={renderItem}
          />
        </WithDataWrapper>
      </View>
    </BottomModal>
  );
}

export default ShareEventModal;
