import { FlashList } from '@shopify/flash-list';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import { useGetChats } from '@/services/chat/chatQueriesCompat';
import { share } from '@/platform/share';

/**
 * @typedef {object} CompositionData
 * @property {string} eventId
 * @property {string} [eventDate]
 * @property {string} [eventName]
 * @property {string} [sport]
 * @property {string} [sportContext]
 * @property {Array<{playerId: string, positionX: number, positionY: number}>} [placements]
 * @property {Array<any>} [manualPlayers]
 */

/**
 * Modal to select a chat to share a composition
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {Function} props.onClose
 * @param {Function} props.onSelectChat - Callback (chatId) => void
 * @param {CompositionData} [props.composition] - The composition to share
 * @param {import('@/domains/event/types').FCEvent} [props.event] - The event for context
 * @returns {import('react').ReactElement}
 */
function ShareCompositionModal({
  composition, event, isVisible, onClose, onSelectChat,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { allMyTeams, userData } = useAuth();
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
      group: 2.5,
      multisport: 0,
      team: 2,
      whisper: 3,
    };

    const canWriteInChat = (chat) => {
      if (!chat || !userData) return false;

      // Whisper and Team chats: All participants can write
      if (chat.type === 'whisper' || chat.type === 'team' || chat.type === 'group') return true;

      // Club Chat: Only Club Admins can write
      if (chat.type === 'club') {
        return userData.role?.type === 'dirigeant' && userData.club?.documentId === chat.club?.documentId;
      }

      // Multisport Chat: Only Multisport Admins can write
      if (chat.type === 'multisport') {
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
    if (!composition || !event) return;
    try {
      // Build player list
      const placements = composition.placements || [];
      const players = event?.team?.players || [];
      const manualPlayers = composition.manualPlayers || [];

      const findName = (id) => {
        const p = players.find((u) => u.documentId === id || u.id === id);
        if (p) return `${p.firstname} ${p.lastname}`;
        const mp = manualPlayers.find((u) => u.id === id || u.documentId === id);
        if (mp) return `${mp.firstname} ${mp.lastname}`;
        return 'Joueur';
      };

      const starters = placements.map((pl) => findName(pl.playerId)).join('\n- ');
      const playerCount = placements.length;

      const message = `📋 Composition d'équipe\n\n⚽ Titulaires (${playerCount}):\n- ${starters}\n\nRetrouve le détail sur FoundClub !`;

      await share({
        message,
        title: `Composition ${event?.subject || 'Match'}`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const renderAvatar = (chat) => {
    switch (chat.type) {
      case 'club':
        return <ClubLogoMark club={chat?.club} isNeutral size={40} />;
      case 'multisport':
        return <ClubLogoMark club={chat?.multisportClub} isNeutral size={40} />;
      case 'team':
        return (
          <ClubLogoMark
            club={chat?.team}
            name={chat?.team?.club?.name || chat?.team?.name}
            size={40}
          />
        );
      case 'group':
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
        { borderBottomColor: Colors.neutral800, borderBottomWidth: 1 },
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
          chatGroupName: chat.groupName,
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
          {t('composition.shareTitle', 'Partager la composition')}
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
        <WithDataWrapper error={error} isLoading={isLoading} wrapperStyle={[Alignments.fill]}>
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

export default ShareCompositionModal;
