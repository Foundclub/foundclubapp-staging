import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import proprietesDeTitre from '@/utils/accessibilite/proprietesDeTitre';

/**
 * ECRAN18-ENTETE / ECRAN18-OMNI (06/10, décisions d'Adel `entete compact` et `omni A`) — la
 * ligne d'en-tête de la planche « Le club du dirigeant — ordinateur » (P5-club-ordi) : l'écusson,
 * « Gestion du club », le nom du club, ses sports ; à droite les actions et « Modifier » ; dessous,
 * ce qui ne doit pas se perdre (l'encart de la Ville d'un club simple).
 *
 * Posée sur ordinateur seulement, à la même bascule que la planche à 2 colonnes
 * (`ClubResultsBoard`), par le hub d'un club simple (`ClubDetails`) et par « Gestion du club »
 * d'un club omnisport (`CMDashboard`). Le téléphone garde sa grande carte.
 * @param {{
 *  actions?: import('react').ReactNode;
 *  badge?: string;
 *  children?: import('react').ReactNode;
 *  club?: any;
 *  editAccessibilityLabel?: string;
 *  onEdit?: () => void;
 *  subtitle?: string;
 *  title?: string;
 * }} props
 * @returns {import('react').ReactElement} La ligne d'en-tête.
 */
function ClubCompactHeader({
  actions = null,
  badge = '',
  children = null,
  club,
  editAccessibilityLabel,
  onEdit,
  subtitle = '',
  title = '',
}) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[Spaces.gap[12]]} testID="club-entete-compact">
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          {
            columnGap: 24,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 12,
          },
        ]}
      >
        <View style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[12],
          { flexShrink: 1 },
        ]}
        >
          <ClubLogoMark
            club={club}
            logoStyle={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              ApplicationStyle.backgroundColor.neutral00,
              { borderRadius: 16 },
            ]}
            size={60}
          />
          <View style={{ flexShrink: 1, gap: 4 }}>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Text style={[
                Fonts.p3Bold,
                Fonts.primary200,
                { letterSpacing: 0.4, textTransform: 'uppercase' },
              ]}
              >
                {t('clubDetails.compactHeader.kicker', 'Gestion du club')}
              </Text>
              {badge ? (
                <View style={[
                  ApplicationStyle.borderRadius8,
                  ApplicationStyle.backgroundColor.primary500,
                  Spaces.paddingHorizontal[8],
                ]}
                >
                  <Text style={[Fonts.p4Bold, Fonts.neutral00]}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...proprietesDeTitre(1)}
              style={[Fonts.h1Black, Fonts.neutral00]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={[Fonts.p2, Fonts.neutral200]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        {actions || onEdit ? (
          <View style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[16],
            { flexWrap: 'wrap' },
          ]}
          >
            {actions}
            {onEdit ? (
              <TouchableOpacity
                accessibilityLabel={editAccessibilityLabel}
                accessibilityRole="button"
                onPress={onEdit}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.gap[8],
                  { minHeight: 44 },
                ]}
              >
                <Image
                  source={Images.edit}
                  style={[
                    ApplicationStyle.icon20,
                    ApplicationStyle.tintColor.primary500,
                  ]}
                />
                <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                  {t('clubDetails.actions.editInfo', 'Modifier')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default ClubCompactHeader;
