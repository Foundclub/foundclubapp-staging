import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { useTour } from '@/context/useTour';

/**
 * Pastille « Reprendre le tour » du guide en pause (TUTOE-CALIBRAGE, 27/10).
 * Rendue DANS le flux de l'accueil, jamais par-dessus l'écran : la tournée du
 * 27/10 l'a vue couvrir « Déconnexion », passer devant la feuille « Changer de
 * compte » et rester sur l'écran de connexion. Dans le flux, elle ne couvre
 * rien et part avec l'accueil (déconnexion, ajout de compte).
 *
 * ponytail: seulement sur l'accueil (là où l'app s'ouvre, donc là où la reprise
 * après fermeture se fait) ; la relance reste aussi dans Mon compte › Aide.
 * Sortie : la poser dans d'autres écrans au même endroit du flux si la recette
 * le demande.
 * @returns {import('react').ReactElement | null}
 */
function TourResumePill() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const tour = useTour();

  if (!tour.isGuide || !tour.isTourActive || tour.tourStatus !== 'paused') return null;

  return (
    <View
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: withAlpha(Colors.chatSheet, 0.97),
        borderColor: withAlpha(Colors.primary500, 0.35),
        borderRadius: 999,
        borderWidth: 1,
        columnGap: 12,
        flexDirection: 'row',
        marginHorizontal: 16,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        hitSlop={8}
        onPress={tour.resumeTour}
        style={{ justifyContent: 'center', minHeight: 28 }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          {/* L1 GUIDE-ATTENTE : une étape d'attente dit ce qu'elle attend. */}
          {tour.currentStep?.pausedLabel || t('tourGuide.resume', 'Reprendre le tour')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel={t('tourGuide.quit', 'Arrêter le guide')}
        accessibilityRole="button"
        hitSlop={10}
        onPress={tour.exitTour}
      >
        <SvgIcon color={Colors.neutral400} height={12} name="close" width={12} />
      </TouchableOpacity>
    </View>
  );
}

export default TourResumePill;
