import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ name?: string }} SectionActivity
 * @typedef {{
 *  documentId?: string;
 *  id?: string | number;
 *  name?: string;
 *  sport?: string;
 *  logoUrl?: string;
 *  logo?: ImageAsset;
 *  activites?: SectionActivity[];
 *  teams?: unknown[];
 *  stats?: { teams?: number; members?: number };
 * }} MultisportSection
 */

/**
 * @param {{
 *  sections: MultisportSection[];
 *  title: string;
 *  getClubInitials: (name: string) => string;
 *  canEdit?: boolean;
 *  onAddSection?: () => void;
 *  onDeleteSection?: (section: MultisportSection) => void;
 *  onSectionPress?: (section: MultisportSection) => void;
 * }} props
 */
function MultisportSectionsList({
  canEdit = false,
  getClubInitials,
  onAddSection,
  onDeleteSection,
  onSectionPress,
  sections,
  title,
}) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  /** @param {MultisportSection} section */
  const getSectionSport = (section) => section?.sport || section?.activites?.[0]?.name || '';
  /** @param {MultisportSection} section */
  const getTeamsCount = (section) => section?.stats?.teams || section?.teams?.length || 0;
  /** @param {MultisportSection} section */
  const getMembersCount = (section) => section?.stats?.members;
  /** @param {MultisportSection} section */
  const resolveLogoUrl = (section) => section?.logoUrl || section?.logo?.url;

  return (
    <View style={[Spaces.gap[12]]}>
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween, Alignments.fill, Spaces.gap[16]]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1, flexShrink: 1 }]}>
          {title}
          {` (${sections.length})`}
        </Text>
        {canEdit ? (
          <Button
            accessibilityLabel={t('multisport.accessibility.addSection', 'Ajouter une section')}
            icon="plus"
            isOption
            onPress={onAddSection}
            variant="Primary"
          />
        ) : null}
      </View>

      {sections.length === 0 ? (
        <View
          style={[
            ApplicationStyle.borderRadius12,
            ApplicationStyle.backgroundColor.primary700,
            Spaces.padding[16],
          ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('multisport.empty.sections', 'Aucune section disponible pour le moment.')}
          </Text>
        </View>
      ) : null}

      {sections.map((section) => {
        const teamsCount = getTeamsCount(section);
        const membersCount = getMembersCount(section);
        const sport = getSectionSport(section);
        const sectionId = section.documentId || section.id;
        const logoUrl = resolveLogoUrl(section);

        return (
          <TouchableOpacity
            accessibilityHint={t('multisport.accessibility.openSectionHint', 'Ouvrir le detail de la section')}
            accessibilityLabel={section?.name || ''}
            accessibilityRole="button"
            key={String(sectionId || section?.name || '')}
            onPress={() => onSectionPress?.(section)}
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
            {logoUrl ? (
              <ProfileAvatar
                imageUrl={logoUrl}
                shape="rounded"
                size={50}
                style={[ApplicationStyle.backgroundColor.neutral00, { borderRadius: 14 }]}
                variant="logo"
              />
            ) : (
              <TeamShield initials={getClubInitials(section?.name || '')} isSmall />
            )}

            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                {section?.name || '-'}
              </Text>
              {sport ? (
                <Text numberOfLines={1} style={[Fonts.p3, Fonts.primary500]}>
                  {sport}
                </Text>
              ) : null}
              <View style={[Alignments.row, Spaces.gap[12]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {teamsCount}
                  {' '}
                  {t('multisport.labels.teams', 'équipes')}
                </Text>
                {typeof membersCount === 'number' ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {membersCount}
                    {' '}
                    {t('multisport.labels.members', 'membres')}
                  </Text>
                ) : null}
              </View>
            </View>

            {onDeleteSection ? (
              <TouchableOpacity
                accessibilityLabel={t('multisport.accessibility.deleteSection', 'Supprimer la section')}
                accessibilityRole="button"
                hitSlop={{
                  bottom: 8, left: 8, right: 8, top: 8,
                }}
                onPress={() => onDeleteSection(section)}
                style={[Spaces.padding[8]]}
              >
                <Image
                  source={Images.trashAlt}
                  style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.error500]}
                />
              </TouchableOpacity>
            ) : null}

            <Image
              source={Images.arrowRight}
              style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral00]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default MultisportSectionsList;
