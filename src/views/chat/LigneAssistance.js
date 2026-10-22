import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { ASSISTANCE_CHAT_TYPE } from '@/domains/messaging/assistance';
import {
  formatChatTimestamp,
  getChatLastMessage,
  getChatMessagePreview,
} from '@/domains/messaging/messagingUseCases';
import { formatThreadUnreadBadge } from '@/domains/messaging/useUnreadMessages';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import AvatarDuFil from '@/views/chat/AvatarDuFil';
import useOuvrirLAssistance from '@/views/chat/useOuvrirLAssistance';

/**
 * MSG-SUPPORT (20/10/2026) — LA LIGNE ÉPINGLÉE « ASSISTANCE FOUNDCLUB », EN TÊTE DE MESSAGES.
 *
 * Pour tout le monde, même sans aucun message : son aperçu est le dernier message de la
 * conversation, sinon une invitation (« Une question ? Écris-nous. »). Le même dessin que les
 * autres lignes (avatar 52, titre 16, heure, aperçu 14, pastille cyan des non-lus), avec la
 * punaise d'une conversation épinglée. Un appui ouvre la conversation (créée à la première
 * ouverture : `useOuvrirLAssistance`).
 * @param {{ espaceVille?: boolean, fil?: any, meId?: string, navigation: any,
 *   onFilCree?: ((chatId: string) => void) | null, style?: any }} props
 *   L'espace de la Ville (vouvoiement), le fil s'il existe, mon identifiant, la navigation, la
 *   relecture de la liste quand la conversation vient de naître.
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneAssistance({
  espaceVille = false, fil = null, meId = '', navigation, onFilCree = null, style = null,
}) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { enCours, erreur, ouvrir } = useOuvrirLAssistance({
    espace: espaceVille ? 'ville' : null, fil, navigation, onCree: onFilCree,
  });
  const dernier = fil ? getChatLastMessage(fil) : null;
  const deMoi = Boolean(dernier && meId && dernier?.sender?.documentId === meId);
  const nonLus = Number(fil?.unreadCount) || 0;
  const pastille = formatThreadUnreadBadge(nonLus);
  const sourdine = withAlpha(Colors.neutral00, 0.58);
  const titre = t('assistance.titre', 'Assistance FoundClub');
  const invitation = espaceVille
    ? t('assistance.ligne.invitationVous', 'Une question ? Écrivez-nous.')
    : t('assistance.ligne.invitation', 'Une question ? Écris-nous.');
  const apercu = dernier ? getChatMessagePreview(dernier, t) : invitation;
  const titreEpingle = `${titre}, ${t('messaging.pinnedBadge', 'ÉPINGLÉ')}`;

  return (
    <View style={style}>
      <TouchableOpacity
        accessibilityHint={t(
          'assistance.ligne.indice',
          'Ouvre ta conversation avec l’équipe FoundClub',
        )}
        accessibilityLabel={nonLus > 0
          ? `${titreEpingle}, ${pastille} ${t('messaging.unread.badge', 'Non lu')}`
          : titreEpingle}
        accessibilityRole="button"
        accessibilityState={{ busy: enCours, disabled: enCours }}
        disabled={enCours}
        onPress={ouvrir}
        style={styles.ligne}
        testID="ligne-assistance"
      >
        <AvatarDuFil chat={fil || { type: ASSISTANCE_CHAT_TYPE }} size={52} />
        <View style={[styles.corps, { borderBottomColor: withAlpha(Colors.neutral00, 0.07) }]}>
          <View style={styles.rangee}>
            <Text numberOfLines={1} style={[styles.titre, { color: Colors.neutral00 }]}>
              {titre}
            </Text>
            {dernier ? (
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
            <View style={styles.apercu}>
              {deMoi ? <GlyphIcon color={sourdine} name="checkDouble" size={16} /> : null}
              <Text
                numberOfLines={1}
                style={[styles.apercuTexte, { color: sourdine }]}
                testID="ligne-assistance-apercu"
              >
                {apercu}
              </Text>
            </View>
            {enCours ? <ActivityIndicator color={Colors.primary500} size="small" /> : null}
            <GlyphIcon color={withAlpha(Colors.neutral00, 0.45)} name="thumbtack" size={15} />
            {nonLus > 0 ? (
              <View
                style={[styles.pastille, { backgroundColor: Colors.primary500 }]}
                testID="ligne-assistance-non-lus"
              >
                <Text style={[styles.pastilleTexte, { color: Colors.primary900 }]}>{pastille}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
      {erreur ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.erreur, { color: Colors.neutral00 }]}
          testID="ligne-assistance-erreur"
        >
          {espaceVille
            ? t(
              'assistance.ligne.erreurVous',
              'L’assistance ne s’ouvre pas. Réessayez dans un instant.',
            )
            : t(
              'assistance.ligne.erreur',
              'L’assistance ne s’ouvre pas. Réessaie dans un instant.',
            )}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  apercu: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  apercuTexte: {
    flexShrink: 1,
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  corps: {
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
  },
  erreur: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    lineHeight: 18,
    paddingBottom: 8,
    paddingLeft: 64,
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
    minHeight: 72,
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
  rangee: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  titre: {
    flex: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    lineHeight: 21,
  },
});

export default LigneAssistance;
