import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

// VOCAL — LA BULLE D'AIDE « Maintiens pour enregistrer » (maquette, M1).
//
// Un simple toucher sur le micro, ou une prise de moins de 0,8 s : la bulle
// sort 8 px au-dessus de la rangée, calée à droite, sa pointe sur le micro, et
// reste 2 s. L'opacité est pilotée par la zone vocale ; le léger glissement
// (4 px → 0) en découle, à l'entrée comme à la sortie.
// VOCAL2 : la même bulle dit aussi pourquoi une prise s'est arrêtée à 10:00.

/**
 * La bulle d'aide.
 * @param {{ texte?: string, visibilite: { value: number } }} props - Le texte
 *   ('' : « Maintiens pour enregistrer ») et l'opacité, 0 → 1.
 * @returns {import('react').ReactElement} La bulle.
 */
function VoiceHoldTip({ texte = '', visibilite }) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const style = useAnimatedStyle(() => ({
    opacity: visibilite.value,
    transform: [{ translateY: 4 * (1 - visibilite.value) }],
  }));

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.bulle, {
        backgroundColor: Colors.primary700,
        shadowColor: Colors.neutral900,
      }, style]}
      testID="voice-hold-tip"
    >
      <Text style={{
        ...Fonts.p3Bold, color: Colors.neutral00, fontSize: 13, lineHeight: 18,
      }}
      >
        {texte || t('voiceComposer.holdTip', 'Maintiens pour enregistrer')}
      </Text>
      <View style={[styles.pointe, { backgroundColor: Colors.primary700 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bulle: {
    borderRadius: 12,
    bottom: 44 + 8,
    elevation: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 0,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  // La pointe : un carré de 10 tourné de 45°, centré sur le micro (22 du bord).
  pointe: {
    bottom: -4,
    height: 10,
    position: 'absolute',
    right: 17,
    transform: [{ rotate: '45deg' }],
    width: 10,
  },
});

export default memo(VoiceHoldTip);
