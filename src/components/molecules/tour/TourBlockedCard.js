import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { useTour } from '@/context/useTour';

/**
 * Carte « Tu ne peux pas le faire maintenant » (GUIDE-RELANCE, bloquant n° 6 de
 * l'audit du 28/10) : l'écran a refusé le geste d'une mission essentielle
 * (quota, club partenaire, publication refusée). Elle dit pourquoi et offre une
 * sortie ; elle ne contourne jamais le refus. Posée en bas, sans voile : la
 * feuille de l'offre ou le message de l'écran restent lisibles et touchables.
 * @returns {import('react').ReactElement | null} Carte.
 */
function TourBlockedCard() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    blocked, currentMission, dismissBlocked, skipBlockedMission,
  } = useTour();
  const title = t('tourGuide.blocked.title', 'Tu ne peux pas le faire maintenant');

  useEffect(() => {
    if (!blocked?.reason) return;
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${blocked.reason}`);
  }, [blocked?.reason, title]);

  if (!blocked) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: Colors.neutral50,
        borderRadius: 18,
        bottom: Math.max(16, insets.bottom + 8),
        elevation: 12,
        left: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        position: 'absolute',
        right: 14,
        rowGap: 6,
        shadowColor: Colors.primary900,
        shadowOffset: { height: 14, width: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 17,
      }}
      testID={__DEV__ ? 'tour.blocked' : undefined}
    >
      {currentMission?.title ? (
        <Text style={[Fonts.p4Bold, {
          color: Colors.primary600, letterSpacing: 1, textTransform: 'uppercase',
        }]}
        >
          {currentMission.title}
        </Text>
      ) : null}
      <Text style={[Fonts.p2Bold, { color: Colors.primary900 }]}>{title}</Text>
      <Text style={[Fonts.p3, { color: Colors.neutral700 }]}>{blocked.reason}</Text>
      <View style={{
        alignItems: 'center', columnGap: 8, flexDirection: 'row', justifyContent: 'flex-end',
      }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          onPress={dismissBlocked}
          style={{ justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.neutral600 }]}>
            {t('tourGuide.blocked.stay', 'Rester')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={skipBlockedMission}
          style={{
            backgroundColor: Colors.primary500,
            borderRadius: 999,
            justifyContent: 'center',
            minHeight: 44,
            paddingHorizontal: 16,
          }}
          testID={__DEV__ ? 'tour.blocked.skip' : undefined}
        >
          <Text style={[Fonts.p3Black, { color: Colors.primary900 }]}>
            {t('tourGuide.blocked.skip', 'Passer cette mission')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default TourBlockedCard;
