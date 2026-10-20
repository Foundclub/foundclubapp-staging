import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * LA PASTILLE « MODE COMPLEXE » — RESA-L5A2 (14/10/2026), planche RB état 4 : sur une notification
 * du complexe reçue dans la liste des notifications, même en mode joueur (« elle arrive quand
 * même »). La toucher ouvre l'espace du complexe, qui repasse en mode complexe.
 * @returns {import('react').ReactElement} La pastille.
 */
function PastilleModeComplexe() {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: withAlpha(Colors.primary500, 0.18),
        borderColor: withAlpha(Colors.primary500, 0.6),
        borderRadius: 999,
        borderWidth: 1,
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
      testID="pastille-mode-complexe"
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('complexeReservations.notifications.modeComplexe', 'Mode complexe')}
      </Text>
    </View>
  );
}

export default PastilleModeComplexe;
