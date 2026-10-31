// CORR-COLLECTIVITES 94 (31/10/2026, décision d'Adel A) — « La Ville est prévenue : la place se
// libère. », après l'annulation d'une séance sur une installation de la Ville. Sur le site, c'était
// une boîte grise du navigateur (window.alert) ; c'est la fenêtre de l'app, comme les autres
// confirmations (BottomModal en dialogue).
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * La fenêtre « C'est annulé · La Ville est prévenue ».
 * @param {{ message: string | null, onClose: () => void }} props - La phrase (rien si null) et la
 * fermeture.
 * @returns {JSX.Element} La fenêtre.
 */
function VillePrevenueDialog({ message, onClose }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  return (
    <BottomModal close={onClose} isVisible={Boolean(message)} webPresentation="dialog">
      {message ? (
        <View
          accessibilityRole="alert"
          style={[Spaces.paddingTop[12], Spaces.paddingBottom[16], { gap: 16 }]}
          testID="ville-prevenue"
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('useEventMutations.villePrevenue.titre', 'C’est annulé')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{message}</Text>
          <Button onPress={onClose} testID="ville-prevenue-ok" title={t('common.ok', 'OK')} />
        </View>
      ) : null}
    </BottomModal>
  );
}

export default VillePrevenueDialog;
