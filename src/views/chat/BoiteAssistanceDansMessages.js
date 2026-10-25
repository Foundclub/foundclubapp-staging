import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { ASSISTANCE_CHAT_TYPE } from '@/domains/messaging/assistance';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import LigneBoiteAssistance, { nomDuTitulaire } from '@/views/chat/LigneBoiteAssistance';

import { RouteNames } from '@/navigation/routeNames';

import { useBoiteAssistance } from '@/services/chat/assistanceQueries';

// Les premières de la boîte (non lues, puis en attente, puis récentes : l'ordre du serveur).
const LIGNES_MAX = 5;

/**
 * SUPADM (recette iPhone d'Adel du 23/10, point 2) — LA BOÎTE DE L'ASSISTANCE DANS L'ONGLET
 * MESSAGES DU SUPER-ADMIN.
 *
 * Un super-admin n'est jamais participant d'une conversation d'assistance (MSGSUP, boîte
 * commune) : l'onglet Messages, qui liste SES conversations, ne la montrait donc jamais ; il
 * fallait passer par Administration → Assistance. Les 5 premières conversations de la boîte se
 * lisent désormais en tête de Messages, avec la ligne de la console ; un lien ouvre la boîte
 * entière au-delà. Relue à chaque retour sur l'onglet (le super-admin n'est dans aucune salle :
 * aucun message ne lui arrive en direct).
 * À monter pour un super-admin SEUL : la lecture est réservée (route de la console).
 * @param {{ navigation: any, style?: any }} props - La navigation, la marge de l'appelant.
 * @returns {import('react').ReactElement | null} La section, ou rien tant que la boîte est vide.
 */
function BoiteAssistanceDansMessages({ navigation, style = null }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { data, refetch } = useBoiteAssistance();
  useFocusEffect(useCallback(() => {
    refetch?.();
  }, [refetch]));

  const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
  if (!conversations.length) return null;

  const ouvrir = (/** @type {any} */ conversation) => navigation.navigate(RouteNames.Conversation, {
    chatId: conversation.documentId,
    chatType: ASSISTANCE_CHAT_TYPE,
    title: nomDuTitulaire(conversation, t),
  });

  return (
    <View style={style} testID="messages-boite-assistance">
      <Text style={[styles.titre, { color: withAlpha(Colors.neutral00, 0.6) }]}>
        {t('assistance.messages.titre', 'Boîte de l’assistance')}
      </Text>
      {conversations.slice(0, LIGNES_MAX).map((/** @type {any} */ conversation) => (
        <LigneBoiteAssistance
          conversation={conversation}
          key={String(conversation?.documentId)}
          onPress={() => ouvrir(conversation)}
        />
      ))}
      {conversations.length > LIGNES_MAX ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.navigate(RouteNames.AdminStack, {
            screen: RouteNames.AdminAssistance,
          })}
          style={styles.tout}
          testID="messages-boite-assistance-tout"
        >
          <Text style={[styles.toutTexte, { color: Colors.primary500 }]}>
            {t('assistance.messages.tout', {
              count: conversations.length,
              defaultValue: 'Voir toute la boîte ({{count}})',
            })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titre: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 16,
    paddingTop: 12,
    textTransform: 'uppercase',
  },
  tout: {
    justifyContent: 'center',
    minHeight: 44,
  },
  toutTexte: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    lineHeight: 19,
  },
});

export default BoiteAssistanceDansMessages;
