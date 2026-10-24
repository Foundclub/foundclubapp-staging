import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { formatChatTimestamp } from '@/domains/messaging/messagingUseCases';
import { formatThreadUnreadBadge } from '@/domains/messaging/useUnreadMessages';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

const ESPACE_INSECABLE = ' ';

/**
 * Le nom du titulaire d'une conversation de la boîte, ou « Compte supprimé ».
 * @param {any} conversation - La conversation rendue par `GET /assistance/conversations`.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @returns {string} Le nom.
 */
export const nomDuTitulaire = (conversation, t) => {
  const titulaire = conversation?.titulaire || {};
  if (titulaire.supprime) return t('assistance.console.compteSupprime', 'Compte supprimé');
  const prenom = String(titulaire.firstname || '').trim();
  return `${prenom} ${String(titulaire.lastname || '').trim()}`.trim()
    || t('assistance.console.compteSupprime', 'Compte supprimé');
};

/**
 * MSG-SUPPORT (20/10/2026) — UNE CONVERSATION DE LA BOÎTE COMMUNE DE L'ASSISTANCE (super-admins) :
 * la photo et le nom du titulaire, l'heure, l'aperçu (« Assistance : » quand l'équipe a répondu en
 * dernier), la pastille des non-lus et « En attente de réponse ».
 * SUPADM (23/10) — sortie de la console (AdminAssistance) pour servir aussi l'onglet Messages.
 * @param {{ conversation: any, onPress: () => void }} props - La conversation, et l'appui.
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneBoiteAssistance({ conversation, onPress }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const id = String(conversation?.documentId || '');
  const nom = nomDuTitulaire(conversation, t);
  const nonLus = Number(conversation?.nonLus) || 0;
  const pastille = formatThreadUnreadBadge(nonLus);
  const dernier = conversation?.dernierMessage || {};
  const sourdine = withAlpha(Colors.neutral00, 0.58);
  const apercu = String(dernier.apercu || '');
  const nous = t('assistance.console.boite.nous', 'Assistance');
  // « Assistance : » — l'espace insécable avant les deux-points, à la française.
  const prefixe = dernier.deLAssistance ? `${nous}${ESPACE_INSECABLE}: ` : '';
  const etat = [
    nonLus > 0
      ? t('assistance.console.nonLus', { defaultValue: 'Non lus : {{nombre}}', nombre: pastille })
      : '',
    conversation?.enAttente ? t('assistance.console.boite.enAttente', 'En attente de réponse') : '',
  ].filter(Boolean).join(', ');
  return (
    <TouchableOpacity
      accessibilityHint={t(
        'assistance.console.boite.ouvrir',
        'Ouvre la conversation pour répondre',
      )}
      accessibilityLabel={[nom, etat, `${prefixe}${apercu}`].filter(Boolean).join(', ')}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.ligne}
      testID={`boite-assistance-ligne-${id}`}
    >
      <ProfileAvatar
        enablePreview={false}
        imageStyle={{ borderRadius: 52 }}
        imageUrl={conversation?.titulaire?.avatar?.url}
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
        {conversation?.enAttente ? (
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
}

const styles = StyleSheet.create({
  apercu: {
    flex: 1,
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 19,
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
  titre: {
    flex: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    lineHeight: 21,
  },
});

export default LigneBoiteAssistance;
