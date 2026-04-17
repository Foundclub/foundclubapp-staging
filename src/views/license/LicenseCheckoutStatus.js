import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function LicenseCheckoutStatus({ navigation, route }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const provider = route?.params?.provider || 'paiement';
  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <View style={Spaces.gap[24]}>
        <View style={[ApplicationStyle.card, Spaces.gap[12], {
          backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55`, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 22,
        }]}
        >
          <Text style={[Fonts.h2, Fonts.neutral00]}>Paiement ouvert</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Le paiement
            {' '}
            {provider}
            {' '}
            s est ouvert dans une page securisee. Si tu viens de payer, le statut sera mis a jour
            automatiquement ou apres validation du club.
          </Text>
        </View>
        <Button onPress={() => navigation.navigate(RouteNames.MyLicense)} title="Retour a ma cotisation" />
      </View>
    </ScreenContainer>
  );
}

export default LicenseCheckoutStatus;
