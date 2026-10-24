import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ASSISTANCE_CHAT_TYPE } from '@/domains/messaging/assistance';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';
import LigneBoiteAssistance, { nomDuTitulaire } from '@/views/chat/LigneBoiteAssistance';

import { RouteNames } from '@/navigation/routeNames';

import { useBoiteAssistance } from '@/services/chat/assistanceQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * MSG-SUPPORT (20/10/2026) — LA BOÎTE « ASSISTANCE » DE LA CONSOLE (super-admins).
 *
 * La boîte COMMUNE (décision d'Adel « A ») : toutes les conversations d'assistance qui ont au
 * moins un message, les NON LUES d'abord (pastille cyan), puis celles qui attendent une réponse
 * (« En attente de réponse »), puis les plus récentes. Un appui ouvre la conversation ordinaire :
 * on y répond au nom d'« Assistance FoundClub », et la console voit qui de l'équipe a écrit
 * chaque réponse. Relue à chaque retour sur l'écran.
 * @returns {import('react').ReactElement} La boîte.
 */
function AdminAssistance() {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const {
    data, error, isFetching, isLoading, refetch,
  } = useBoiteAssistance();
  useFocusEffect(useCallback(() => {
    refetch?.();
  }, [refetch]));

  const conversations = useMemo(
    () => (Array.isArray(data?.conversations) ? data.conversations : []),
    [data?.conversations],
  );

  if (isLoading && !conversations.length) {
    return (
      <AdminStateView
        description={t(
          'assistance.console.boite.chargement',
          'Nous récupérons les messages des utilisateurs.',
        )}
        isLoading
        title={t('assistance.console.titre', 'Assistance')}
      />
    );
  }

  if (error && !conversations.length) {
    return (
      <AdminStateView
        actionLabel={t('adminReports.states.retry', 'Réessayer')}
        description={getErrorMessage(error, 'generic') || t(
          'assistance.console.boite.erreur',
          'La boîte de l’assistance ne se charge pas.',
        )}
        onAction={refetch}
        title={t('adminReports.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  const ouvrir = (/** @type {any} */ conversation) => {
    navigation.navigate(/** @type {never} */ (RouteNames.Conversation), /** @type {never} */ ({
      chatId: conversation.documentId,
      chatType: ASSISTANCE_CHAT_TYPE,
      title: nomDuTitulaire(conversation, t),
    }));
  };

  /**
   * Une conversation de la boîte (SUPADM, 23/10 : la ligne est partagée avec l'onglet Messages).
   * @param {{ item: any }} ligne - La conversation rendue par le serveur.
   * @returns {import('react').ReactElement} La ligne.
   */
  const renderItem = ({ item }) => (
    <LigneBoiteAssistance conversation={item} onPress={() => ouvrir(item)} />
  );

  return (
    <ScreenContainer bgImage="bg2">
      <FlatList
        contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16 }}
        data={conversations}
        keyExtractor={(item, index) => String(item?.documentId || index)}
        ListEmptyComponent={(
          <Text
            style={[styles.vide, { color: withAlpha(Colors.neutral00, 0.7) }]}
            testID="boite-assistance-vide"
          >
            {t('assistance.console.boite.vide', 'Aucune conversation pour le moment.')}
          </Text>
        )}
        ListHeaderComponent={(
          <View style={styles.entete} testID="boite-assistance">
            <Text style={[styles.sousTitre, { color: withAlpha(Colors.neutral00, 0.75) }]}>
              {t(
                'assistance.console.boite.sousTitre',
                'Boîte commune : chaque réponse part signée « Assistance FoundClub ».',
              )}
            </Text>
            <Text
              style={[styles.compteurs, { color: Colors.neutral00 }]}
              testID="boite-assistance-compteurs"
            >
              {t('assistance.console.boite.compteurs', {
                defaultValue: 'Non lus : {{nonLus}} · En attente de réponse : {{enAttente}}',
                enAttente: Number(data?.enAttenteTotal) || 0,
                nonLus: Number(data?.nonLusTotal) || 0,
              })}
            </Text>
          </View>
        )}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={Boolean(isFetching && !isLoading)}
            tintColor={Colors.primary500}
          />
        )}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  compteurs: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    lineHeight: 20,
  },
  entete: {
    gap: 8,
    paddingBottom: 12,
    paddingTop: 16,
  },
  sousTitre: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  vide: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 24,
    textAlign: 'center',
  },
});

export default AdminAssistance;
