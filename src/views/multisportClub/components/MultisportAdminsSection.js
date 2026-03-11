import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ documentId?: string; firstname?: string; lastname?: string; avatar?: ImageAsset }} CMAdmin
 */

/**
 * @param {{
 *  admins: CMAdmin[];
 *  onAdminPress?: (admin: CMAdmin) => void;
 * }} props
 */
function MultisportAdminsSection({ admins, onAdminPress }) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('multisport.titles.admins', 'Dirigeants omnisport')}
      </Text>

      {admins.length === 0 ? (
        <View
          style={[
            ApplicationStyle.borderRadius12,
            ApplicationStyle.backgroundColor.primary700,
            Spaces.padding[16],
          ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('multisport.empty.admins', 'Aucun dirigeant rattache.')}
          </Text>
        </View>
      ) : (
        admins.map((admin) => (
          <TouchableOpacity
            accessibilityHint={t('multisport.accessibility.openAdminHint', 'Ouvrir le profil du dirigeant')}
            accessibilityLabel={`${admin.firstname || ''} ${admin.lastname || ''}`.trim()}
            accessibilityRole="button"
            key={admin.documentId || `${admin.firstname || ''}-${admin.lastname || ''}`}
            onPress={() => onAdminPress?.(admin)}
            style={[
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.primary500,
              Alignments.row,
              Alignments.alignCenter,
              Spaces.padding[12],
              Spaces.gap[12],
            ]}
          >
            <ProfileAvatar
              imageStyle={{ borderRadius: 20 }}
              imageUrl={admin.avatar?.url ? getImageUrl(admin.avatar.url) : undefined}
              size={40}
              style={{ borderRadius: 20 }}
            />
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
              {`${admin.firstname || ''} ${admin.lastname || ''}`.trim()}
            </Text>
            <Image
              source={Images.arrowRight}
              style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral00]}
            />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

export default MultisportAdminsSection;
