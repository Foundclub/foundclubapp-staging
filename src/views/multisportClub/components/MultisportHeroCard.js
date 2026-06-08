import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ documentId?: string }} CMAdmin
 * @typedef {{
 *  documentId?: string;
 *  name?: string;
 *  logo?: ImageAsset;
 *  addressDetails?: string;
 *  phoneNumber?: string;
 *  email?: string;
 *  admins?: CMAdmin[];
 * }} CMMultisport
 */

/**
 * @param {{
 *  cm?: CMMultisport | null;
 *  canEdit?: boolean;
 *  getClubInitials?: (name: string) => string;
 *  onEditPress?: () => void;
 * }} props
 */
function MultisportHeroCard({
  canEdit = false,
  cm,
  onEditPress,
}) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.alignCenter,
        Spaces.gap[12],
        Spaces.paddingHorizontal[24],
        Spaces.paddingBottom[24],
        Spaces.paddingTop[16],
      ]}
    >
      <View
        style={[
          ApplicationStyle.borderRadius8,
          ApplicationStyle.backgroundColor.primary500,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[4],
          { left: 16, position: 'absolute', top: 16 },
        ]}
      >
        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
          {t('multisport.badge', 'OMNISPORT')}
        </Text>
      </View>

      {canEdit ? (
        <TouchableOpacity
          accessibilityLabel={t('multisport.accessibility.editClub', 'Modifier les informations du club')}
          accessibilityRole="button"
          onPress={onEditPress}
          style={[
            Alignments.absolute,
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[8],
            { right: 16, top: 16 },
          ]}
        >
          <Image
            source={Images.edit}
            style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary500]}
          />
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('common.actions.edit', 'Modifier')}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={[Spaces.marginTop[16]]}>
        <ClubLogoMark
          club={cm || undefined}
          logoStyle={[ApplicationStyle.backgroundColor.neutral00, { borderRadius: 20 }]}
          size={80}
        />
      </View>

      <View style={[Spaces.gap[4], Alignments.alignCenter]}>
        <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
          {cm?.name || '-'}
        </Text>
        {cm?.addressDetails ? (
          <Text style={[Fonts.p2, Fonts.primary100, Fonts.textCenter]}>
            {cm.addressDetails}
          </Text>
        ) : null}
      </View>

      <View style={[Spaces.gap[4], Alignments.alignCenter]}>
        {cm?.phoneNumber ? (
          <View style={[Alignments.row, Spaces.gap[4]]}>
            <Image
              source={Images.phone}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary100]}
            />
            <TouchableOpacity
              accessibilityLabel={t('multisport.accessibility.callPhone', 'Appeler le club')}
              accessibilityRole="button"
              onPress={() => Linking.openURL(`tel:${cm.phoneNumber}`)}
            >
              <Text style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}>
                {cm.phoneNumber}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {cm?.email ? (
          <View style={[Alignments.row, Spaces.gap[4]]}>
            <Image
              source={Images.envelope}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary100]}
            />
            <TouchableOpacity
              accessibilityLabel={t('multisport.accessibility.sendEmail', 'Envoyer un email au club')}
              accessibilityRole="button"
              onPress={() => Linking.openURL(`mailto:${cm.email}`)}
            >
              <Text style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}>
                {cm.email}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View
        style={[
          ApplicationStyle.separator,
          ApplicationStyle.backgroundColor.primary100,
          { marginTop: 4, opacity: 0.4, width: '100%' },
        ]}
      />

      <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
        {t('multisport.hero.summary', 'Vue globale du club multisport et de ses sections.')}
      </Text>
    </View>
  );
}

export default MultisportHeroCard;
