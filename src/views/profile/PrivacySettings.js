// @ts-nocheck
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { updateMe } from '@/services/auth/authService';

/**
 * CONFIDENTIALITE — CARTECODE Q1 C (registre des mineurs ligne 46, Adel 26/10).
 *
 * « Compte privé » et « Ouvert au recrutement » sont deux choix différents : le second reste
 * dans le profil (`isLookingForClub`), le premier vit ici et écrit `isProfileVisible`, un champ
 * que le serveur applique déjà (profil introuvable pour les autres, hors des recherches et des
 * suggestions d'invitation). Sur la carte : code QR neutre, carte jamais montrée sur le profil.
 * Absent = public : seul un `false` enregistré par le titulaire rend le compte privé.
 * @returns {import('react').ReactElement} L'écran.
 */
function PrivacySettings() {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const { getAuthTokens, userData } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateMe,
    onError: () => {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('profile.updateError'),
      );
    },
    onSuccess: async (updatedUser) => {
      // Même motif que SelfProfileUnified : la réponse du PUT est le profil à jour.
      const authToken = getAuthTokens?.()?.token || 'no-token';
      queryClient.setQueryData(
        ['get-me', authToken],
        (previous) => (previous ? { ...previous, ...updatedUser } : updatedUser),
      );
      await queryClient.invalidateQueries({
        predicate: (query) => (
          Array.isArray(query.queryKey) && query.queryKey[0] === 'app-bootstrap'
        ),
      });
    },
  });

  // Pendant l'enregistrement, l'interrupteur montre déjà la valeur demandée.
  const visible = mutation.isPending
    ? mutation.variables?.isProfileVisible
    : userData?.isProfileVisible;
  const isPrivate = visible === false;

  return (
    <ScreenContainer bottomInsetMode="screen">
      <ScrollView contentContainerStyle={[Spaces.gap[16], Spaces.paddingVertical[16]]}>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('profile.privacy.title', 'Confidentialité')}
        </Text>
        <View style={[styles.row, { borderColor: Colors.neutral700 }]}>
          <View style={styles.texts}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('profile.privacy.privateLabel', 'Compte privé')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('profile.privacy.privateHelper')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('profile.privacy.privateLabel', 'Compte privé')}
            disabled={mutation.isPending}
            onValueChange={(next) => mutation.mutate({ isProfileVisible: !next })}
            trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
            value={isPrivate}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  texts: { flex: 1, gap: 4 },
});

export default PrivacySettings;
