import { useMemo, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';

import useMarqueeLoop, { getActiveMarqueeCount } from '@/hooks/useMarqueeLoop';

// Pied sponsors du handoff « Cartes Rechercher » (section 4a) : une seule
// ligne défilante, ~4 s par logo, contenu dupliqué pour une boucle continue,
// fondus de 18 px aux bords, masqué sans sponsor.
const MS_PER_LOGO = 4000;
const MIN_LOOP_ITEMS = 4;
const FADE_WIDTH = 18;
const TILE_SIZE = 22;

// Le registre des boucles réellement actives — la preuve mesurable de la
// contrainte de performance — vit désormais dans la mécanique partagée
// (U01) : une carte hors écran, un écran non focus, une app en arrière-plan
// ou la prop `paused` ne doivent entretenir AUCUNE animation. Ce re-export
// garde le point d'observation là où ses témoins le cherchent.
export { getActiveMarqueeCount };

/**
 * Nom affichable d'un sponsor.
 * @param {any} sponsor - Sponsor du club.
 * @returns {string} - Nom du sponsor, vide si inconnu.
 */
const getSponsorLabel = (sponsor) => sponsor?.title || sponsor?.name || '';

/**
 * Ligne de sponsors défilante partagée par les cartes événement / club.
 * @param {object} props
 * @param {string} [props.fadeColor] - Couleur de fond de la carte pour les fondus latéraux.
 * @param {boolean} [props.paused] - Force la suspension (carte connue comme hors écran).
 * @param {Array<{
 *   documentId?: string, id?: number, link?: string,
 *   logo?: { url?: string }, name?: string, title?: string,
 * }>} [props.sponsors]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @returns {import('react').ReactElement | null}
 */
function SponsorMarquee({
  fadeColor,
  paused = false,
  sponsors,
  style,
}) {
  const { Colors } = useTheme();
  const [copyWidth, setCopyWidth] = useState(0);

  const items = useMemo(() => {
    const list = (sponsors || []).filter(Boolean);
    if (!list.length) return [];
    // Liste répétée jusqu'à >= 4 éléments (spec 4a) pour que la moitié
    // dupliquée couvre toujours la largeur de la carte. La clé est
    // précalculée : le même sponsor revient plusieurs fois, seule sa
    // position dans la boucle le distingue.
    const loop = [];
    while (loop.length < MIN_LOOP_ITEMS) {
      list.forEach((sponsor) => {
        loop.push({
          key: `${sponsor.documentId || sponsor.id || 'sponsor'}-${loop.length}`,
          sponsor,
        });
      });
    }
    return loop;
  }, [sponsors]);

  const { translateX } = useMarqueeLoop({
    distance: copyWidth,
    durationMs: items.length * MS_PER_LOGO,
    enabled: items.length > 0 && !paused,
  });

  if (!items.length) return null;

  const resolvedFadeColor = fadeColor || Colors.primary900;
  const separatorColor = withAlpha(Colors.neutral00, 0.12);

  return (
    <View style={[styles.container, { borderTopColor: separatorColor }, style]}>
      <View style={styles.viewport}>
        <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
          {[0, 1].map((copyIndex) => (
            <View
              key={copyIndex}
              onLayout={copyIndex === 0
                ? (event) => setCopyWidth(event?.nativeEvent?.layout?.width || 0)
                : undefined}
              style={styles.copyRow}
            >
              {items.map(({ key, sponsor }) => (
                <View
                  key={`${copyIndex}-${key}`}
                  style={styles.item}
                >
                  <SponsorLogoTile
                    borderRadius={TILE_SIZE / 2}
                    height={TILE_SIZE}
                    imageUrl={sponsor.logo?.url}
                    link={sponsor.link}
                    showTitle={false}
                    title={getSponsorLabel(sponsor) || 'Sponsor'}
                    width={TILE_SIZE}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.name, { color: Colors.neutral200 }]}
                  >
                    {getSponsorLabel(sponsor)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </Animated.View>
        <LinearGradient
          colors={[withAlpha(resolvedFadeColor, 0.92), withAlpha(resolvedFadeColor, 0)]}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={[styles.fade, styles.fadeLeft]}
        />
        <LinearGradient
          colors={[withAlpha(resolvedFadeColor, 0), withAlpha(resolvedFadeColor, 0.92)]}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={[styles.fade, styles.fadeRight]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  copyRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  fade: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: FADE_WIDTH,
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingRight: 14,
  },
  name: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10.5,
    fontWeight: '700',
  },
  row: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  viewport: {
    overflow: 'hidden',
  },
});

export default SponsorMarquee;
