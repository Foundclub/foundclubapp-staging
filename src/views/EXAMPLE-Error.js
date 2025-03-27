import {
  Image, Text, View,
  NativeModules,
} from 'react-native';
import { useTranslation } from 'react-i18next';
// hooks
import useTheme from '../theme/themeContext';
// components
import Button from '../components/atoms/EXAMPLE-button/EXAMPLE-Button';

/**
 * HomeScreen component.
 * @returns {React.ReactElement} HomeScreen component.
 */
function ErrorScreen() {
  const {
    Alignments, Fonts, Images, ApplicationStyle, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  // style
  /**
   * @type {import('react-native').ImageStyle}
   */
  const imageStyle = {
    width: 130,
    height: 130,
    resizeMode: 'contain',
  };

  // handlers
  const handleReloadApp = () => {
    // This will force a reload of the entire JS bundle
    NativeModules.DevSettings.reload();
  };

  return (
    <View
      style={[
        Alignments.fill,
        ApplicationStyle.backgroundColor.neutral252,
        Spaces.padding[24],
        Alignments.justifyCenter,
        Alignments.alignCenter]}
    >
      <Image
        source={Images.logo}
        style={imageStyle}
      />
      <View style={[Alignments.justifyCenter, Alignments.alignCenter, Spaces.gap[12]]}>
        <Text style={[Fonts.h2, Fonts.bold, Fonts.neutralF4F]}>
          {t('errorPage.title').toUpperCase()}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutralF4F]}>
          {t('errorPage.subtitle')}
        </Text>
      </View>
      <View
        style={[
          Alignments.fullWidth,
          Spaces.padding[24],
        ]}
      >
        <Button
          variant="PrimaryLight"
          onPress={handleReloadApp}
          title={t('errorPage.action')}
          style={Alignments.fullWidth}
        />
      </View>
    </View>
  );
}

export default ErrorScreen;
