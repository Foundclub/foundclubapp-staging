import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ASSISTANCE_CHAT_TYPE } from '@/domains/messaging/assistance';
import { formatChatTimestamp } from '@/domains/messaging/messagingUseCases';
import { formatThreadUnreadBadge } from '@/domains/messaging/useUnreadMessages';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useBoiteAssistance } from '@/services/chat/assistanceQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const ESPACE_INSECABLE = '\u00A0';

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

  const nomDuTitulaire = (/** @type {any} */ conversation) => {
    const titulaire = conversation?.titulaire || {};
    if (titulaire.supprime) return t('assistance.console.compteSupprime', 'Compte supprimé');
    const prenom = String(titulaire.firstname || '').trim();
    return `${prenom} ${String(titulaire.lastname || '').trim()}`.trim()
      || t('assistance.console.compteSupprime', 'Compte supprimé');
  };

  const ouvrir = (/** @type {any} */ conversation) => {
    navigation.navigate(/** @type {never} */ (RouteNames.Conversation), /** @type {never} */ ({
      chatId: conversation.documentId,
      chatType: ASSISTANCE_CHAT_TYPE,
      title: nomDuTitulaire(conversation),
    }));
  };

  const renderItem = ({ item }) => {
    const id = String(item?.documentId || '');
    const nom = nomDuTitulaire(item);
    const nonLus = Number(item?.nonLus) || 0;
    const pastille = formatThreadUnreadBadge(nonLus);
    const dernier = item?.dernierMessage || {};
    const sourdine = withAlpha(Colors.neutral00, 0.58);
    const apercu = String(dernier.apercu || '');
    const nous = t('assistance.console.boite.nous', 'Assistance');
    // « Assistance : » — l'espace insécable avant les deux-points, à la française.
    const prefixe = dernier.deLAssistance ? `${nous}${ESPACE_INSECABLE}: ` : '';
    const etat = [
      nonLus > 0
        ? t('assistance.console.nonLus', { defaultValue: 'Non lus : {{nombre}}', nombre: pastille })
        : '',
      item?.enAttente ? t('assistance.console.boite.enAttente', 'En attente de réponse') : '',
    ].filter(Boolean).join(', ');
    return (
      <TouchableOpacity
        accessibilityHint={t(
          'assistance.console.boite.ouvrir',
          'Ouvre la conversation pour répondre',
        )}
        accessibilityLabel={[nom, etat, `${prefixe}${apercu}`].filter(Boolean).join(', ')}
        accessibilityRole="button"
        onPress={() => ouvrir(item)}
        style={styles.ligne}
        testID={`boite-assistance-ligne-${id}`}
      >
        <ProfileAvatar
          enablePreview={false}
          imageStyle={{ borderRadius: 52 }}
          imageUrl={item?.titulaire?.avatar?.url}
          name={nom}
          size={52}
        />
        <View style={[styles.corps, { borderBottomColor: withAlpha(Colors.neutral00, 0.07) }]}>
          <View style={styles.rangee}>
            <Text numberOfLines={1} style={[styles.titre, { color: Colors.neutral00 }]}>{nom}</Text>
            {dernier.createdAt ? (
              <Text
                style={[
                  styles.heure,
                  nonLus > 0
                    ? { color: Colors.primary500, fontFamily: 'Montserrat-Bold' }
                    : { color: withAlpha(Colors.neutral00, 0.5) },
                ]}
              >
                {formatChatTimestamp(dernier.createdAt)}
              </Text>
            ) : null}
          </View>
          <View style={styles.rangee}>
            <Text numberOfLines={1} style={[styles.apercu, { color: sourdine }]}>
              {prefixe}
              {apercu}
            </Text>
            {nonLus > 0 ? (
              <View
                style={[styles.pastille, { backgroundColor: Colors.primary500 }]}
                testID={`boite-assistance-non-lus-${id}`}
              >
                <Text style={[styles.pastilleTexte, { color: Colors.primary900 }]}>{pastille}</Text>
              </View>
            ) : null}
          </View>
          {item?.enAttente ? (
            <View
              style={[styles.puce, { backgroundColor: withAlpha(Colors.warning500, 0.16) }]}
              testID={`boite-assistance-en-attente-${id}`}
            >
              <Text style={[styles.puceTexte, { color: Colors.warning500 }]}>
                {t('assistance.console.boite.enAttente', 'En attente de réponse')}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bgImage="bg2" title={t('assistance.console.titre', 'Assistance')}>
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
  apercu: {
    flex: 1,
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  compteurs: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    lineHeight: 20,
  },
  corps: {
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 4,
  },
  entete: {
    gap: 8,
    paddingBottom: 12,
    paddingTop: 16,
  },
  heure: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12.5,
    lineHeight: 17,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingVertical: 8,
  },
  pastille: {
    alignItems: 'center',
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
  },
  pastilleTexte: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    lineHeight: 14,
  },
  puce: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  puceTexte: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    lineHeight: 16,
  },
  rangee: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sousTitre: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  titre: {
    flex: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    lineHeight: 21,
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
