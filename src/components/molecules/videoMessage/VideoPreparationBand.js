import { ActivityIndicator, Text, View } from 'react-native';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * VIDEO-RAME (03/11, choix d'Adel « 6- b et C ») — CE QUE FAIT LE TÉLÉPHONE PENDANT QU'ON ATTEND.
 * Une roue muette pendant des minutes fait croire à une panne et pousse à relancer une autre
 * vidéo : le bandeau dit où ça en est et permet d'arrêter. Sans pourcentage (`null`), le téléphone
 * récupère encore le fichier choisi dans la galerie : on ne sait pas encore si c'est une vidéo.
 * @param {object} props
 * @param {() => void} props.onCancel
 * @param {number | null} props.pourcent
 * @returns {import('react').ReactElement}
 */
function VideoPreparationBand({ onCancel, pourcent }) {
  const { Colors, Fonts } = useTheme();
  const texte = pourcent === null
    ? i18n.t('conversation.video.preparingFile', 'Préparation du fichier…')
    : i18n.t('conversation.video.preparing', {
      defaultValue: 'Préparation de la vidéo… {{pourcent}} %',
      pourcent,
    });

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        alignItems: 'center',
        backgroundColor: Colors.primary800,
        borderColor: Colors.primary700,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        padding: 8,
      }}
      testID="video-preparation-band"
    >
      <ActivityIndicator color={Colors.neutral00} size="small" />
      <Text style={[Fonts.p3Bold, { color: Colors.neutral00, flex: 1 }]}>{texte}</Text>
      <Button
        onPress={onCancel}
        size="sm"
        title={i18n.t('common.cancel', 'Annuler')}
        variant="SecondaryLight"
      />
    </View>
  );
}

export default VideoPreparationBand;
