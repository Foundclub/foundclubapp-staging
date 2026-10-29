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
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: withAlpha(Colors.chatSheet, 0.97),
        borderColor: withAlpha(Colors.primary500, 0.35),
        borderRadius: 999,
        borderWidth: 1,
        columnGap: 4,
        flexDirection: 'row',
        marginHorizontal: 16,
        paddingLeft: 14,
        paddingVertical: 4,
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        hitSlop={8}
        onPress={tour.resumeTour}
        style={{ flexShrink: 1, justifyContent: 'center', minHeight: 36 }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          {/* L1 GUIDE-ATTENTE : une étape d'attente dit ce qu'elle attend. */}
          {tour.currentStep?.pausedLabel || t('tourGuide.resume', 'Reprendre le tour')}
        </Text>
        <View style={{ columnGap: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
          {where ? <Text style={[Fonts.p4Bold, { color: Colors.neutral300 }]}>{where}</Text> : null}
          {where && tour.currentMission?.title ? (
            <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300, flexShrink: 1 }]}>
              {tour.currentMission.title}
            </Text>
          ) : null}
          <Text style={[Fonts.p4Bold, { color: Colors.neutral300 }]}>{`${tour.gauge || 0} %`}</Text>
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
        <SvgIcon color={Colors.neutral400} height={12} name="close" width={12} />
      </TouchableOpacity>
    </View>
  );
}

export default TourResumePill;
