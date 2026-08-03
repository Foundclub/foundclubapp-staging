// @ts-nocheck
/**
 * ShareCardModal — bottom sheet de partage de la carte de collection.
 * Destination repo : app/src/components/organisms/shareCardModal/ShareCardModal.js
 *
 * Calque sur ShareEventModal (memes primitives : BottomModal, dragHandle,
 * closeButton, Colors/Fonts, cartes de chat). Deux canaux :
 *  - Lien externe : bouton -> onExternalShare() (capture + SharePlatform.share
 *    est fait par l'ecran appelant, qui possede la ref view-shot).
 *  - Envoyer dans une conversation : liste useGetChats -> onSelectChat(chatId)
 *    (l'ecran capture, upload l'image et l'envoie en piece jointe).
 *
 * Presentational : aucun effet reseau/capture ici (comme ShareEventModal).
 */
import { FlashList } from '@shopify/flash-list';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
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

/**
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {Function} props.onClose
 * @param {Function} props.onSelectChat (chatId) => void : envoi dans la conversation
 * @param {Function} props.onExternalShare () => void : partage externe (share sheet)
 * @param {boolean} [props.isBusy] capture/upload en cours -> desactive les actions
 * @param {boolean} [props.canShare] garde-fou mineurs : false => actions verrouillees
 */
function ShareCardModal({
  canShare = true, isBusy = false, isVisible, onClose, onExternalShare, onSelectChat,
}) {
  const {
    Alignments, Colors, Fonts, Images,
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
      /** @type {any[]} */([]),
    ) : [];

    const priority = {
      club: 1, group: 2.5, multisport: 0, team: 2, whisper: 3,
    };

    const canWriteInChat = (chat) => {
      if (!chat || !userData) return false;
      if (chat.type === 'whisper' || chat.type === 'team' || chat.type === 'group') return true;
      if (chat.type === 'club') {
        return userData.role?.type === 'dirigeant' && userData.club?.documentId === chat.club?.documentId;
      }
      if (chat.type === 'multisport') {
        const admins = chat.multisportClub?.admins || [];
        return admins.some((admin) => admin.documentId === userData.documentId);
      }
      return false;
    };

    return chats.filter(canWriteInChat).sort((a, b) => {
      const pA = priority[a.type] ?? 99;
      const pB = priority[b.type] ?? 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [chatsData?.pages, userData]);

  const getChatTypeAccent = (type) => {
    switch (type) {
      case 'club': return Colors.primary200;
      case 'group': return Colors.success500;
      case 'multisport': return Colors.warning500;
      case 'team': return Colors.primary500;
      case 'whisper':
      default: return Colors.neutral300;
    }
  };

  const getChatTypeLabel = (type) => {
    switch (type) {
      case 'club': return t('playerCard.shareChatType.club', 'Club');
      case 'group': return t('playerCard.shareChatType.group', 'Groupe');
      case 'multisport': return t('playerCard.shareChatType.multisport', 'Omnisport');
      case 'team': return t('playerCard.shareChatType.team', 'Équipe');
      case 'whisper':
      default: return t('playerCard.shareChatType.whisper', 'Privé');
    }
  };

  const chatCount = allChats.length;
  const isScrollableChatList = isLoading || chatCount > 4;
  const modalSnapPoints = useMemo(() => {
    if (isLoading) return ['70%'];
    if (chatCount === 0) return ['62%'];
    if (chatCount === 1) return ['66%'];
    if (chatCount <= 3) return ['74%'];
    if (chatCount <= 6) return ['82%'];
    return ['88%'];
  }, [chatCount, isLoading]);

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
        const participant = chat.participants?.find((p) => p.documentId !== userData?.documentId)
          || chat.participants?.[0];
        return (
          <ProfileAvatar
            imageUrl={participant?.avatar?.url}
            name={[participant?.firstname, participant?.lastname].filter(Boolean).join(' ')}
            size={40}
          />
        );
      }
    }
  };

  const renderItem = ({ item: chat }) => {
    const chatTitle = getConversationName({
      chatClub: chat.club,
      chatGroupName: chat.groupName,
      chatMultisportClub: chat.multisportClub,
      chatParticipants: chat.participants,
      chatTeam: chat.team,
      chatType: chat.type,
      meId: userData?.documentId,
    });
    const accentColor = getChatTypeAccent(chat.type);
    const chatTypeLabel = getChatTypeLabel(chat.type);

    return (
      <TouchableOpacity
        accessibilityHint={t('playerCard.shareChatA11yHint', 'Envoyer ma carte dans cette conversation')}
        accessibilityLabel={`${chatTitle} - ${chatTypeLabel}`}
        disabled={isBusy || !canShare}
        onPress={() => onSelectChat(chat.documentId)}
        style={[
          styles.chatCard,
          {
            backgroundColor: Colors.primary900,
            borderColor: `${accentColor}66`,
            opacity: (isBusy || !canShare) ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.avatarSlot}>{renderAvatar(chat)}</View>
        <View style={styles.chatContent}>
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>{chatTitle}</Text>
          <View style={styles.chatMetaRow}>
            <View style={[styles.chatTypeChip, { backgroundColor: `${accentColor}16`, borderColor: `${accentColor}66` }]}>
              <Text style={[Fonts.captionBold, { color: accentColor }]}>{chatTypeLabel}</Text>
            </View>
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {t('playerCard.shareChatCardHint', 'Envoi direct FoundClub')}
            </Text>
          </View>
        </View>
        <View style={[styles.arrowBadge, { backgroundColor: `${accentColor}14` }]}>
          <Image source={Images.arrowRight} style={{ height: 18, tintColor: accentColor, width: 18 }} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={[styles.emptyStateCard, Alignments.alignCenter, { backgroundColor: Colors.primary900, borderColor: Colors.primary500 }]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { marginBottom: 6, textAlign: 'center' }]}>
        {t('playerCard.shareNoChat', 'Aucune conversation disponible.')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral300, { textAlign: 'center' }]}>
        {t('playerCard.shareNoChatHint', 'Rejoins ou crée une conversation pour envoyer ta carte ici.')}
      </Text>
    </View>
  );

  return (
    <BottomModal
      close={onClose}
      contentContainerStyle={isScrollableChatList ? [Alignments.fill] : undefined}
      isVisible={isVisible}
      scrollable={false}
      snapPoints={modalSnapPoints}
    >
      <View style={[styles.modalContent, isScrollableChatList ? Alignments.fill : null]}>
        <View style={styles.headerBlock}>
          <View style={[styles.dragHandle, { backgroundColor: `${Colors.primary500}66` }]} />
          <TouchableOpacity
            accessibilityLabel={t('playerCard.shareCloseA11y', 'Fermer le partage')}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.closeButton, { borderColor: `${Colors.primary500}66` }]}
          >
            <Image source={Images.close} style={[styles.closeIcon, { tintColor: Colors.primary200 }]} />
          </TouchableOpacity>
          <Text style={[Fonts.label, styles.headerEyebrow, { color: Colors.primary200 }]}>
            {t('playerCard.shareEyebrow', 'Diffusion')}
          </Text>
          <Text style={[Fonts.h3Bold, Fonts.neutral00, styles.headerTitle]}>
            {t('playerCard.shareTitle', 'Partager ma carte')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300, styles.headerSubtitle]}>
            {t('playerCard.shareSubtitle', 'Choisis un canal pour diffuser ta carte de collection.')}
          </Text>
        </View>

        {/* Partage externe */}
        <View style={[styles.externalShareCard, { backgroundColor: Colors.primary900, borderColor: `${Colors.primary500}55` }]}>
          <Text style={[Fonts.p3, Fonts.neutral300, styles.sectionEyebrow]}>
            {t('playerCard.shareOutsideLabel', 'Lien externe')}
          </Text>
          <Button
            disabled={isBusy || !canShare}
            icon="share"
            iconColor={Colors.primary200}
            isLoading={isBusy}
            onPress={onExternalShare}
            style={styles.externalShareButton}
            textStyle={{ color: Colors.primary200 }}
            title={isBusy
              ? t('playerCard.shareGenerating', 'Génération de l\'image…')
              : t('playerCard.shareViaOther', 'Partager via… (SMS, Mail, Enregistrer)')}
            variant="SecondaryLight"
          />
          <Text style={[Fonts.p4, Fonts.neutral300, styles.externalShareHint]}>
            {t('playerCard.shareOutsideHint', 'SMS, mail ou « Enregistrer l\'image »')}
          </Text>
        </View>

        <View style={styles.chatSectionHeader}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('playerCard.shareInChat', 'Envoyer dans une conversation')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300, styles.chatSectionHint]}>
            {t('playerCard.shareInChatHint', 'Ta carte est envoyée en image.')}
          </Text>
        </View>

        <WithDataWrapper
          error={error}
          isLoading={isLoading}
          wrapperStyle={isScrollableChatList ? [Alignments.fill] : undefined}
        >
          {isScrollableChatList ? (
            <FlashList
              contentContainerStyle={styles.chatListContent}
              data={allChats}
              estimatedItemSize={96}
              keyExtractor={(item) => item.documentId}
              ListEmptyComponent={renderEmptyState}
              renderItem={renderItem}
            />
          ) : (
            <View style={styles.chatListCompact}>
              {allChats.length === 0
                ? renderEmptyState()
                : allChats.map((chat) => (
                  <View key={chat.documentId}>{renderItem({ item: chat })}</View>
                ))}
            </View>
          )}
        </WithDataWrapper>
      </View>
    </BottomModal>
  );
}

const styles = StyleSheet.create({
  arrowBadge: {
    alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32,
  },
  avatarSlot: {
    alignItems: 'center', height: 44, justifyContent: 'center', marginRight: 14, width: 44,
  },
  chatCard: {
    alignItems: 'center', borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 14,
  },
  chatContent: { flex: 1 },
  chatListCompact: { paddingBottom: 12 },
  chatListContent: { paddingBottom: 12 },
  chatMetaRow: {
    alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8,
  },
  chatSectionHeader: { marginTop: 2, paddingHorizontal: 4 },
  chatSectionHint: { marginTop: 4 },
  chatTypeChip: {
    borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
  },
  closeButton: {
    alignItems: 'center', borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', position: 'absolute', right: 0, top: 0, width: 36,
  },
  closeIcon: { height: 16, width: 16 },
  dragHandle: {
    borderRadius: 999, height: 4, marginBottom: 12, width: 44,
  },
  emptyStateCard: {
    borderRadius: 20, borderWidth: 1, marginTop: 8, paddingHorizontal: 16, paddingVertical: 24,
  },
  externalShareButton: { width: '100%' },
  externalShareCard: { borderRadius: 22, borderWidth: 1, padding: 16 },
  externalShareHint: { marginTop: 10, textAlign: 'center' },
  headerBlock: {
    alignItems: 'center', gap: 6, minHeight: 116, paddingHorizontal: 42, paddingTop: 4, position: 'relative',
  },
  headerEyebrow: { letterSpacing: 1, textTransform: 'uppercase' },
  headerSubtitle: { maxWidth: 280, textAlign: 'center' },
  headerTitle: { textAlign: 'center' },
  modalContent: { gap: 18, paddingBottom: 12 },
  sectionEyebrow: { marginBottom: 12, textAlign: 'center' },
});

export default ShareCardModal;
