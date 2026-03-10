import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * @param {object} props
 * @param {any} props.team
 * @param {() => void} props.onPress
 * @param {boolean} [props.isSelected]
 * @param {boolean} [props.showSelectionIndicator]
 * @returns {import('react').ReactElement}
 */
function EventWizardTeamCard({
  isSelected = false,
  onPress,
  showSelectionIndicator = false,
  team,
}) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();
  const { width } = useWindowDimensions();
  const isCompactScreen = width <= 375;

  const sportLabel = team?.activities?.[0]?.name || team?.sport;
  const cardPadding = isCompactScreen ? 14 : 18;
  const sectionLabel = team?.section?.name;
  const categoryLabel = team?.category?.name || team?.category;
  const levelLabel = team?.level?.name || team?.level;
  const metaItems = [
    { label: t('teamList.fields.section', 'Section'), value: sectionLabel },
    { label: t('teamList.fields.category', 'Categorie'), value: categoryLabel },
    { label: t('teamList.fields.level', 'Niveau'), value: levelLabel },
    {
      label: t('teamList.fields.members', 'Membres'),
      value: (() => {
        const ids = new Set();
        const collect = (list = []) => {
          list.forEach((member) => {
            if (!member) return;
            const memberId = member.documentId || member.id || member.phoneNumber;
            if (memberId) ids.add(String(memberId));
          });
        };
        collect(team?.players);
        collect(team?.trainers);
        collect(team?.members);
        if (ids.size > 0) return String(ids.size);
        return String(Number(team?.players?.length || 0) + Number(team?.trainers?.length || 0));
      })(),
    },
  ].filter((meta) => String(meta?.value || '').trim().length > 0);

  const allSponsors = Array.isArray(team?.club?.sponsor) ? team.club.sponsor.filter(Boolean) : [];
  const sponsors = allSponsors.slice(0, 2);

  const identityAvatar = team?.club?.logo?.url ? (
    <ProfileAvatar
      imageUrl={team.club.logo.url}
      size={60}
      style={[
        ApplicationStyle.borderWidth1,
        ApplicationStyle.borderColor.primary500,
        { borderRadius: 60 },
      ]}
    />
  ) : (
    <TeamShield
      initials={getClubInitials(team?.name || '')}
      isSmall
    />
  );

  return (
    <View style={{ position: 'relative' }}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        style={[
          Spaces.marginVertical[12],
          { borderRadius: 24 },
        ]}
      >
        <View
          style={{
            backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.16)' : Colors.primary700,
            borderColor: Colors.primary500,
            borderRadius: 24,
            borderWidth: isSelected ? 1.5 : 1,
            justifyContent: 'center',
            minHeight: isCompactScreen ? 138 : 150,
            padding: cardPadding,
          }}
        >
          <View
            style={[
              Alignments.fullWidth,
              Alignments.row,
              Alignments.alignCenter,
              Alignments.justifySpaceBetween,
              Spaces.gap[8],
            ]}
          >
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[8],
                { flex: 1, paddingRight: 8 },
              ]}
            >
              <View>{identityAvatar}</View>
              <View style={[Alignments.fill]}>
                <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
                  {team?.name || '-'}
                </Text>
              </View>
            </View>

            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              {sportLabel ? (
                <Tag
                  style={{
                    backgroundColor: `${Colors.primary500}14`,
                    borderColor: Colors.primary500,
                    maxWidth: isCompactScreen ? 96 : 128,
                  }}
                  text={sportLabel}
                  textStyle={Fonts.p3Bold}
                />
              ) : null}
              {showSelectionIndicator ? (
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                    borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.42)',
                    borderRadius: 12,
                    borderWidth: 1.5,
                    height: 24,
                    justifyContent: 'center',
                    width: 24,
                  }}
                >
                  {isSelected ? (
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>OK</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={[
              Alignments.fullWidth,
              Spaces.marginTop[12],
              Spaces.marginBottom[12],
              ApplicationStyle.separator,
              { backgroundColor: `${Colors.primary500}40` },
            ]}
          />

          {metaItems.length > 0 || sponsors.length > 0 ? (
            <View style={[Alignments.fullWidth, Alignments.row, Alignments.wrap, Spaces.gap[10]]}>
              {sponsors.length > 0 ? (
                <View style={[Alignments.fullWidth, Spaces.marginBottom[12], Spaces.gap[8]]}>
                  <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                    {sponsors.map((sponsor) => (
                      <View
                        key={sponsor?.documentId || sponsor?.id || sponsor?.link || sponsor?.title}
                        style={{ minWidth: isCompactScreen ? 128 : 144, width: '47%' }}
                      >
                        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                          <SponsorLogoTile
                            height={24}
                            imageUrl={sponsor?.logo?.url}
                            link={sponsor?.link}
                            showTitle={false}
                            width={40}
                          />
                          <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral100, Alignments.fill]}>
                            {sponsor?.title || sponsor?.name}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  {allSponsors.length > sponsors.length ? (
                    <Text style={[Fonts.p3Bold, Fonts.primary100]}>
                      {`+${allSponsors.length - sponsors.length}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {metaItems.map((meta) => (
                <View
                  key={`${team?.documentId || team?.id || team?.name}-${meta.label}`}
                  style={{ minWidth: isCompactScreen ? 128 : 144, width: '47%' }}
                >
                  <Text style={[Fonts.p3, Fonts.neutral300]}>{meta.label}</Text>
                  <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {meta.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {team?.club?.name || '-'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default EventWizardTeamCard;
