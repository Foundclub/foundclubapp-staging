import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { getClubInitials } from '@/domains/club/clubUseCase';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { getImageUrl } from '@/utils/imageUrl';

const LOGO_BACKGROUND = '#FFFFFF';

// Ratio largeur / hauteur de chaque logo déjà mesuré : une liste de clubs qui
// défile ne remesure pas le même fichier à chaque carte recyclée.
/** @type {Map<string, number>} */
const logoRatioCache = new Map();

/**
 * Mesure le ratio d'un logo (null tant qu'il est inconnu, ou si la mesure échoue).
 * @param {string} uri
 * @returns {number | null}
 */
const useLogoRatio = (uri) => {
  const [ratio, setRatio] = useState(() => (uri ? logoRatioCache.get(uri) ?? null : null));

  useEffect(() => {
    if (!uri) {
      setRatio(null);
      return undefined;
    }
    const cachedRatio = logoRatioCache.get(uri);
    if (cachedRatio) {
      setRatio(cachedRatio);
      return undefined;
    }

    let isMounted = true;
    setRatio(null);
    Image.getSize(
      uri,
      (width, height) => {
        if (!(width > 0 && height > 0)) return;
        logoRatioCache.set(uri, width / height);
        if (isMounted) setRatio(width / height);
      },
      () => {},
    );

    return () => {
      isMounted = false;
    };
  }, [uri]);

  return ratio;
};

/**
 * Met une couleur sous une forme comparable (sans espaces, en minuscules).
 * @param {unknown} color
 * @returns {string}
 */
const normalizeColor = (color) => (typeof color === 'string' ? color.replace(/\s/g, '').toLowerCase() : '');

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
  const logoRatio = useLogoRatio(resolvedLogoUrl ? getImageUrl(resolvedLogoUrl) || '' : '');

  if (resolvedLogoUrl) {
    // LOGO-CADRE (15/09) — le fond blanc est voulu (un écusson transparent
    // disparaîtrait sur le fond sombre), mais autour d'un logo OPAQUE tout ce
    // qui dépasse de l'image se voit comme un cadre blanc. Trois sources, toutes
    // retirées ici plutôt qu'écran par écran :
    //  1. la marge intérieure de 4 % de ProfileAvatar → 0, sauf si l'écran en
    //     demande une (pastilles cerclées des assistants) ;
    //  2. les bandes d'un logo non carré en « contain » → le cadre prend la forme
    //     du logo DANS la place prévue (size × size) : la mise en page ne bouge
    //     pas, le logo est au pire un peu plus étroit ;
    //  3. un trait de la couleur du fond (blanc sur blanc) → retiré.
    // Un écran qui donne au cadre une autre taille que size × size (fiche
    // d'équipe) a déjà choisi sa forme : il la garde.
    const frame = /** @type {import('react-native').ViewStyle} */ (
      StyleSheet.flatten([{ backgroundColor: LOGO_BACKGROUND }, logoStyle]) || {}
    );
    const boxWidth = typeof frame.width === 'number' ? frame.width : size;
    const boxHeight = typeof frame.height === 'number' ? frame.height : size;
    const effectiveInsetRatio = Number.isFinite(safeInsetRatio) ? safeInsetRatio : 0;
    const followsLogoShape = fitMode === 'contain'
      && !effectiveInsetRatio
      && boxWidth === size
      && boxHeight === size
      && Number.isFinite(logoRatio);
    let frameWidth = boxWidth;
    let frameHeight = boxHeight;
    if (followsLogoShape && logoRatio) {
      if (logoRatio > boxWidth / boxHeight) frameHeight = boxWidth / logoRatio;
      else frameWidth = boxHeight * logoRatio;
    }
    const hasBackgroundColoredBorder = typeof frame.borderWidth === 'number'
      && frame.borderWidth > 0
      && normalizeColor(frame.borderColor) !== ''
      && normalizeColor(frame.borderColor) === normalizeColor(frame.backgroundColor);

    return (
      <View style={{
        alignItems: 'center', height: boxHeight, justifyContent: 'center', width: boxWidth,
      }}
      >
        <ProfileAvatar
          enablePreview={false}
          fitMode={fitMode}
          imageStyle={[
            { backgroundColor: 'transparent' },
            imageStyle,
          ]}
          imageUrl={resolvedLogoUrl}
          safeInsetRatio={effectiveInsetRatio}
          shape="rounded"
          size={size}
          style={[
            { borderRadius: Math.round(size * 0.25) },
            frame,
            { height: frameHeight, width: frameWidth },
            hasBackgroundColoredBorder && { borderWidth: 0 },
          ]}
          variant="logo"
        />
      </View>
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
