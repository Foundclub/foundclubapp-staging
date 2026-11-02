import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

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
 * FIN-GUIDE, point 5 (capture 5 d'Adel) : une carte de la largeur de la page, alignée sur les
 * cartes de l'accueil et posée sous son titre : la mission, sa jauge, et toute la carte reprend.
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

  // GUIDE-FINITIONS-2 n° 24 (captures 00 et 55) : la pastille dit la mission et la
  // jauge, et sa croix (12 pt) n'efface plus le guide d'un toucher sans demander.
  const position = tour.missionPosition;
  const where = position
    ? `${position.isBonus ? t('tourGuide.bonus', 'Bonus') : t('tourGuide.mission', 'Mission')} `
      + `${position.index}/${position.total}`
    : null;
  const gauge = tour.gauge || 0;
  const confirmQuit = () => Alert.alert(
    t('tourGuide.quitConfirm.title', 'Arrêter le guide ?'),
    t(
      'tourGuide.quitConfirm.message',
      'Ta progression sera effacée. Tu pourras le revoir depuis Mon compte › Guide entraîneur·e.',
    ),
    [
      { style: 'cancel', text: t('tourGuide.quitConfirm.cancel', 'Annuler') },
      {
        onPress: tour.exitTour, style: 'destructive', text: t('tourGuide.quit', 'Arrêter le guide'),
      },
    ],
  );

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary500, 0.08),
        borderColor: withAlpha(Colors.primary500, 0.35),
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
      }}
      testID="tour.resumePill"
    >
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={() => tour.resumeTour()}
          style={{
            alignItems: 'center',
            columnGap: 12,
            flex: 1,
            flexDirection: 'row',
            minHeight: 64,
            paddingLeft: 14,
            paddingVertical: 10,
          }}
          testID="tour.resumePill.resume"
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: withAlpha(Colors.primary500, 0.16),
              borderRadius: 12,
              height: 40,
              justifyContent: 'center',
              width: 40,
            }}
          >
            <SvgIcon color={Colors.primary500} height={18} name="flag" width={18} />
          </View>
          <View style={{ flex: 1, rowGap: 2 }}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {/* L1 GUIDE-ATTENTE : une étape d'attente dit ce qu'elle attend. */}
              {tour.currentStep?.pausedLabel || t('tourGuide.resume', 'Reprendre le tour')}
            </Text>
            {/* Le tout sur la même ligne : sur un petit écran, rien n'est coupé, elle passe à la suivante. */}
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              {[where, tour.currentMission?.title, `${gauge} %`].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={t('tourGuide.quit', 'Arrêter le guide')}
          accessibilityRole="button"
          onPress={confirmQuit}
          style={{
            alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44,
          }}
        >
          <SvgIcon color={Colors.neutral300} height={12} name="close" width={12} />
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), height: 3 }}>
        <View
          style={{ backgroundColor: Colors.primary500, height: 3, width: `${gauge}%` }}
          testID="tour.resumePill.gauge"
        />
      </View>
    </View>
  );
}

export default TourResumePill;
