import { getClubInitials } from '@/domains/club/clubUseCase';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * Resolve the best available image URL from direct or nested club data.
 * @param {{ club?: any, logoUrl?: string }} params
 * @returns {string}
 */
const resolveLogoUrl = ({ club, logoUrl }) => (
  logoUrl
  || club?.logo?.url
  || club?.logoUrl
  || club?.club?.logo?.url
  || club?.club?.logoUrl
  || ''
);

/**
 * Resolve the display name used to generate shield initials.
 * @param {{ club?: any, name?: string }} params
 * @returns {string}
 */
const resolveClubName = ({ club, name }) => (
  name
  || club?.name
  || club?.club?.name
  || ''
);

/**
 * Displays the real club logo when present, otherwise the shared shield fallback.
 * @param {object} props
 * @param {object} [props.club]
 * @param {string} [props.logoUrl]
 * @param {string} [props.name]
 * @param {number} [props.size]
 * @param {boolean} [props.isGold]
 * @param {boolean} [props.isNeutral]
 * @param {object | object[]} [props.logoStyle]
 * @param {object | object[]} [props.shieldStyle]
 * @param {object | object[]} [props.imageStyle]
 * @param {'cover' | 'contain'} [props.fitMode]
 * @param {number} [props.safeInsetRatio]
 * @returns {import('react').ReactElement}
 */
function ClubLogoMark({
  club,
  fitMode = 'contain',
  imageStyle,
  isGold = false,
  isNeutral = false,
  logoStyle,
  logoUrl,
  name,
  safeInsetRatio,
  shieldStyle,
  size = 48,
}) {
  const resolvedLogoUrl = resolveLogoUrl({ club, logoUrl });
  const resolvedClubName = resolveClubName({ club, name });

  if (resolvedLogoUrl) {
    const borderRadius = Math.round(size * 0.25);

    return (
      <ProfileAvatar
        enablePreview={false}
        fitMode={fitMode}
        imageStyle={[
          { backgroundColor: 'transparent' },
          imageStyle,
        ]}
        imageUrl={resolvedLogoUrl}
        safeInsetRatio={safeInsetRatio}
        shape="rounded"
        size={size}
        style={[
          {
            backgroundColor: '#FFFFFF',
            borderRadius,
          },
          logoStyle,
        ]}
        variant="logo"
      />
    );
  }

  return (
    <TeamShield
      initials={getClubInitials(resolvedClubName) || resolvedClubName.slice(0, 2) || 'FC'}
      isGold={isGold}
      isNeutral={isNeutral}
      isSmall={size <= 60}
      size={size}
      style={shieldStyle}
    />
  );
}

export default ClubLogoMark;
