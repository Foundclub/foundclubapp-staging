import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { HEURE } from './typographieDuFil';

/**
 * L'heure d'un message, a la facon de la langue (14:32).
 * @param {unknown} creeLe - La date du message.
 * @returns {string} L'heure, ou rien.
 */
export const heureDuMessage = (creeLe) => {
  const date = creeLe instanceof Date ? creeLe : new Date(String(creeLe ?? ''));
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * L'etat d'envoi d'un de MES messages, lu sur le message GiftedChat.
 * La regle est celle du fil d'avant MSG1A, inchangee : `failed`, `pending`, puis
 * `readBy` non vide = lu.
 * @param {any} message - Le message.
 * @returns {'echec' | 'enCours' | 'envoye' | 'lu'} L'etat.
 */
export const etatDEnvoi = (message) => {
  if (message?.failed) return 'echec';
  if (message?.pending) return 'enCours';
  if (Array.isArray(message?.readBy) && message.readBy.length > 0) return 'lu';
  return 'envoye';
};

/**
 * MSG1A — L'HEURE ET LES COCHES, DANS LA BULLE (SPECS.md §1).
 *
 * Heure 11 + `checkDouble` 15 sur mes messages : coches pales = envoye, blanches = lu
 * (la logique d'avant, couleurs du pack). Sur une photo, tout passe en blanc.
 * @param {object} props
 * @param {boolean} [props.estAMoi] - Mon message : on montre l'etat d'envoi.
 * @param {'echec' | 'enCours' | 'envoye' | 'lu'} [props.etat] - L'etat d'envoi.
 * @param {string} props.heure - L'heure deja formatee.
 * @param {boolean} [props.surImage] - Pose sur une photo (blanc).
 * @returns {import('react').ReactElement} L'heure et les coches.
 */
function MetaDuMessage({
  estAMoi = false, etat = 'envoye', heure, surImage = false,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();

  let couleurDeLHeure = withAlpha(Colors.neutral00, estAMoi ? 0.72 : 0.62);
  if (surImage) couleurDeLHeure = Colors.neutral00;
  const couleurDesCoches = etat === 'lu' || surImage
    ? Colors.neutral00
    : withAlpha(Colors.neutral00, 0.5);

  const libelles = {
    echec: t('conversation.meta.failed', 'Non envoyé'),
    enCours: t('conversation.meta.sending', 'Envoi en cours'),
    envoye: t('conversation.meta.sent', 'Envoyé'),
    lu: t('conversation.meta.read', 'Lu'),
  };

  let marque = null;
  if (estAMoi && etat === 'echec') {
    marque = <Text style={[HEURE, styles.echec, { color: Colors.chatDanger }]}>!</Text>;
  } else if (estAMoi && etat === 'enCours') {
    marque = <GlyphIcon color={couleurDesCoches} name="clock" size={13} />;
  } else if (estAMoi) {
    marque = <GlyphIcon color={couleurDesCoches} name="checkDouble" size={15} />;
  }

  return (
    <View
      accessibilityLabel={estAMoi ? `${heure}, ${libelles[etat]}` : heure}
      accessible
      style={styles.ligne}
      testID="meta-du-message"
    >
      <Text style={[HEURE, { color: couleurDeLHeure }]}>{heure}</Text>
      {marque}
    </View>
  );
}

const styles = StyleSheet.create({
  echec: {
    fontFamily: 'Montserrat-Bold',
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
});

export default MetaDuMessage;
