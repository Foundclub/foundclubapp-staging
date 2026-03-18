import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';

/**
 * @typedef {{ title?: string; link?: string; logo?: { url?: string } }} CMSponsor
 */

/**
 * @param {{
 *  canEdit?: boolean;
 *  onAddSponsor?: () => void;
 *  sponsors: CMSponsor[];
 * }} props
 */
function MultisportSponsorsSection({
  canEdit = false,
  onAddSponsor,
  sponsors,
}) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  if (!canEdit && sponsors.length === 0) {
    return null;
  }

  return (
    <View style={[Spaces.gap[12]]}>
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('multisport.titles.partners', 'Partenaires')}
        </Text>
        {canEdit ? (
          <Button
            accessibilityLabel={t('multisport.accessibility.addSponsor', 'Ajouter un partenaire')}
            icon="plus"
            isOption
            onPress={onAddSponsor}
            variant="Primary"
          />
        ) : null}
      </View>

      {sponsors.length === 0 ? (
        <View style={[Spaces.paddingVertical[8]]}>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('multisport.empty.partners', 'Aucun partenaire ajout?.')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[Spaces.gap[16]]}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {sponsors.map((sponsor) => (
            <SponsorLogoTile
              height={55}
              imageUrl={sponsor.logo?.url}
              key={`${sponsor.link || ''}-${sponsor.title || ''}-${sponsor.logo?.url || ''}`}
              link={sponsor.link}
              title={sponsor.title}
              titleStyle={[Fonts.p2Bold, Fonts.neutral00, { marginTop: 4, textAlign: 'center' }]}
              width={110}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default MultisportSponsorsSection;
