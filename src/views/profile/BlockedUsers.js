// @ts-nocheck
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useGetMyBlockedUsers,
  useUnblockUser,
} from '@/services/userBlock/userBlockQueries';

/**
 * PERSONNES BLOQUEES — la porte de sortie (K3).
 *
 * Apple 1.2 et Google Play n'exigent pas seulement de pouvoir BLOQUER : il faut
 * aussi pouvoir DEBLOQUER, et le retrouver sans chercher. C'est le seul endroit
 * de l'app ou l'on voit la liste entiere.
 *
 * ⚠️ Le serveur ne rend QUE mes blocages (`GET /user-blocks/mine`) : il n'existe
 * aucune route qui listerait les blocages de quelqu'un d'autre.
 * @param {object} props - Les props de l'ecran.
 * @returns {import('react').ReactElement} L'ecran.
 */
function BlockedUsers() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const {
    data: blockedRows,
    error: blockedError,
    isLoading: isLoadingBlockedRows,
  } = useGetMyBlockedUsers();
  const { isPending: isUnblocking, mutate: unblockUser } = useUnblockUser();

  const rows = Array.isArray(blockedRows) ? blockedRows : [];

  const handleUnblock = useCallback((userId) => {
    if (!userId) return;
    unblockUser(userId);
  }, [unblockUser]);

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <View style={[Alignments.alignCenter, { gap: 8 }]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { letterSpacing: 1 }]}>
          {t('userBlock.screen.title', 'Personnes bloquées').toUpperCase()}
        </Text>
        <View style={{ backgroundColor: Colors.neutral00, height: 2, width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'userBlock.screen.hint',
            'Une personne bloquée ne peut plus t’écrire, et tu ne vois plus ses messages.',
          )}
        </Text>

        <WithDataWrapper error={blockedError?.message} isLoading={isLoadingBlockedRows}>
          {rows.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[12]]}>
              {t('userBlock.screen.empty', 'Tu n’as bloqué personne.')}
            </Text>
          ) : (
            rows.map((row) => {
              const blockedUser = row?.user || {};
              const blockedUserId = String(blockedUser?.documentId || '').trim();
              const displayName = `${blockedUser?.firstname || ''} ${blockedUser?.lastname || ''}`.trim()
                || t('common.user', 'Utilisateur');

              return (
                <View
                  key={row?.documentId || blockedUserId}
                  style={[
                    ApplicationStyle.card,
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.padding[12],
                    {
                      backgroundColor: `${Colors.primary700}73`,
                      borderColor: `${Colors.primary500}80`,
                      gap: 12,
                    },
                  ]}
                >
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={blockedUser?.avatar?.url}
                    name={displayName}
                    size={40}
                  />
                  <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                    {displayName}
                  </Text>
                  <Button
                    disabled={isUnblocking}
                    onPress={() => handleUnblock(blockedUserId)}
                    size="sm"
                    title={t('userBlock.screen.unblock', 'Débloquer')}
                    variant="SecondaryLight"
                  />
                </View>
              );
            })
          )}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default BlockedUsers;
