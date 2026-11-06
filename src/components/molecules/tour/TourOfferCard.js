import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { getTourProfile } from '@/domains/tour/tourCatalog';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useTour } from '@/context/useTour';

/**
 * Proposition du guide à l'accueil (FIN-GUIDE2, Adel « 1- A », 02/11) : un coach qui ferme l'app
 * en pleine inscription ne repasse pas par « Bienvenue », seul écran qui lance le guide. Dans le
 * flux, comme `TourResumePill` : elle ne couvre rien et ne s'impose pas.
 * @returns {import('react').ReactElement | null} La carte, ou rien.
 */
function TourOfferCard() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const tour = useTour();

  if (!tour.isGuideOfferable) return null;

  const guideKey = tour.offerGuideKey || 'coach';

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary500, 0.08),
        borderColor: withAlpha(Colors.primary500, 0.35),
        borderRadius: 20,
        borderWidth: 1,
        padding: 14,
        rowGap: 10,
      }}
      testID="tour.offerCard"
    >
      <View style={{ rowGap: 2 }}>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
          {t('tourGuide.offer.title', 'Prends l’app en main avec le guide')}
        </Text>
        <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
          {t(
            /** @type {any} */ (getTourProfile(guideKey))?.offerMessageKey
              || 'tourGuide.offer.message',
            '4 missions, environ 2 min. Tu le retrouves aussi dans Mon compte › Guide '
            + 'entraîneur·e.',
          )}
        </Text>
      </View>
      <Button
        onPress={() => tour.startTour(guideKey)}
        title={t('tourGuide.offer.start', 'Lancer le guide')}
        variant="Primary"
      />
      <Button
        onPress={tour.declineGuideOffer}
        title={t('tourGuide.offer.decline', 'Ne plus me le proposer')}
        variant="Ghost"
      />
    </View>
  );
}

export default TourOfferCard;
