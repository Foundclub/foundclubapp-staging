import {
  Image, Text, View,
  NativeModules,
} from 'react-native';
import { useTranslation } from 'react-i18next';
// hooks
import useTheme from '../theme/themeContext';
// components
import Button from '../components/atoms/button/Button';

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
    width: 270,
    height: 33,
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
        ApplicationStyle.backgroundColor.primary900,
        Spaces.padding[24],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.alignCenter]}
    >
      <View />
      <Image
        source={Images.logo}
        style={imageStyle}
      />
      <View style={[Alignments.justifyCenter, Alignments.alignCenter, Spaces.gap[12]]}>
        <Text style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('errorPage.title').toUpperCase()}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral00]}>
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
          variant="Primary"
          onPress={handleReloadApp}
          title={t('errorPage.action')}
          style={Alignments.fullWidth}
        />
      </View>
    </View>
  );
}

export default ErrorScreen;
