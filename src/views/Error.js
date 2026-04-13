import { useTranslation } from 'react-i18next';
import {
  Image, NativeModules, Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * Error screen component displayed when an unrecoverable app error occurs.
 * Provides information about the error and allows users to reload the app.
 * @param {{
 *  actionTitle?: string;
 *  details?: string;
 *  onReload?: () => void;
 *  subtitle?: string;
 *  title?: string;
 * }} props
 * @returns {import('react').ReactElement} Error screen component
 */
function ErrorScreen({
  actionTitle,
  details = '',
  onReload,
  subtitle,
  title,
} = {}) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  // style
  /**
   * @type {import('react-native').ImageStyle}
   */
  const imageStyle = {
    height: 33,
    resizeMode: 'contain',
    width: 270,
  };

  // handlers
  const handleReloadApp = () => {
    if (typeof onReload === 'function') {
      onReload();
      return;
    }

    // This will force a reload of the entire JS bundle
    if (typeof NativeModules?.DevSettings?.reload === 'function') {
      NativeModules.DevSettings.reload();
    }
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
          {(title || t('errorPage.title')).toUpperCase()}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {subtitle || t('errorPage.subtitle')}
        </Text>
        {details ? (
          <Text style={[Fonts.p3, Fonts.neutral00]}>
            {details}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          Alignments.fullWidth,
          Spaces.padding[24],
        ]}
      >
        <Button
          onPress={handleReloadApp}
          style={Alignments.fullWidth}
          title={actionTitle || t('errorPage.action')}
          variant="Primary"
        />
      </View>
    </View>
  );
}

export default ErrorScreen;
