import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import PremiumBadge from '@/components/molecules/premiumBadge/PremiumBadge';

/**
 * @typedef {'default' | 'primary'} HomeCardEmphasis
 * @typedef {'default' | 'destructive'} HomeCardTone
 * @typedef {{ bottom?: number; height?: number; right?: number; width?: number }} HomeCardIllustrationPlacement
 */

const DEFAULT_ILLUSTRATION_PLACEMENT = {
  bottom: -26,
  height: 138,
  right: -20,
  width: 138,
};

// D59 ① — REPLI QUAND AUCUNE ILLUSTRATION N'EST FOURNIE.
//
// CE QUI ETAIT ICI : l'icone de la carte redessinee en geant (112 pt, opacite
// 0.12), le « repli fantome » decrit par PROMPT_ACCUEIL.md §2. Deux defauts
// mesures : (a) les icones sont des PNG de 96x96 px — les etirer a 112 pt les
// rend flous des le x2, jusqu'a 3,5x d'agrandissement sur un ecran x3 ; (b)
// AUCUNE carte du hub ne fournit d'illustration aujourd'hui, donc ce repli
// etait le rendu REEL des 30 cartes, pas un cas de secours.
//
// A LA PLACE : un halo de la couleur d'accent, centre exactement la ou
// l'illustration se poserait — deux disques concentriques dont l'alpha decroit,
// ce qui imite la retombee d'un degrade radial sans LinearGradient ni asset.
// Vectoriel par nature (aucun pixel a etirer), et purement issu du theme.
// Le mecanisme `illustration` est INTACT : le jour ou une image arrive, elle
// reprend sa place et le halo s'efface.
const FALLBACK_GLOW_CENTER = { bottom: 43, right: 49 };
const FALLBACK_GLOW_RINGS = [
  { alpha: 0.07, size: 148 },
  { alpha: 0.1, size: 88 },
];

/**
 * Home action card used by the HomeHub sections.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {() => void} props.onPress
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.hasAlert] - D72 : une action ATTEND la personne sur cette carte.
 *   Rend un point rouge sur le glyphe, sans chiffre. Facultative : omise, la carte est
 *   exactement celle d'avant le lot. ⛔ Jamais pour signaler une nouveaute, jamais sur un
 *   conteneur, une action de creation, un reglage ou la section Compte (pack accueil §Regles).
 * @param {number} [props.badgeCount] - D72 : compteur chiffre, `9+` au-dela de 9. Ne sert
 *   qu'a la carte « A traiter » du super admin. Partout ailleurs on utilise `hasAlert`.
 *   A zero ou absent, aucune pilule n'est rendue.
 * @param {keyof import('@/theme/types').AllImages} [props.icon]
 * @param {string} [props.accentColor]
 * @param {import('react-native').ImageSourcePropType} [props.illustration]
 * @param {HomeCardIllustrationPlacement} [props.illustrationPlacement]
 * @param {HomeCardEmphasis} [props.emphasis]
 * @param {HomeCardTone} [props.tone]
 * @param {boolean} [props.highlighted] - Surbrillance pulsée (étape du tour guidé)
 * @param {boolean} [props.locked] - Quota gratuit épuisé : la carte est grisée mais reste
 *   pressable, l'appui ouvrant la feuille de vente (L10-C, stratégie paywall §2.3).
 *   Ne jamais l'utiliser sans `premiumScope` : griser en silence est interdit.
 * @param {'club' | 'team'} [props.premiumScope] - Offre couvrant l'action (badge informatif, handoff 12)
 * @param {1 | 2} [props.subtitleLines]
 * @param {((node: any) => void) | { current: any }} [props.tutorialTargetRef]
 * @returns {import('react').ReactElement}
 */
function HomeActionCard({
  accentColor,
  badgeCount,
  disabled = false,
  emphasis = 'default',
  hasAlert = false,
  highlighted = false,
  icon = 'search',
  illustration,
  illustrationPlacement,
  locked = false,
  onPress,
  premiumScope,
  subtitle,
  subtitleLines = 2,
  title,
  tone = 'default',
  tutorialTargetRef,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const resolvedAccentColor = accentColor || Colors.primary500;
  const pulseOpacity = useRef(new Animated.Value(0.35)).current;

  // Anneau lumineux pulse quand le tour guide pointe cette carte.
  useEffect(() => {
    if (!highlighted) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseOpacity, { duration: 700, toValue: 1, useNativeDriver: true }),
      Animated.timing(pulseOpacity, { duration: 700, toValue: 0.35, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [highlighted, pulseOpacity]);
  let borderColor = `${resolvedAccentColor}47`;
  if (highlighted) {
    borderColor = resolvedAccentColor;
  }
  if (emphasis === 'primary') {
    borderColor = resolvedAccentColor;
  } else if (tone === 'destructive') {
    borderColor = `${resolvedAccentColor}61`;
  }
  const resolvedIllustrationPlacement = {
    ...DEFAULT_ILLUSTRATION_PLACEMENT,
    ...(illustrationPlacement || {}),
  };

  // D72 — la pilule chiffree s'arrete a « 9+ » (pack accueil, tache 1). Au-dela
  // elle s'elargirait et pousserait la pastille fleche hors de la carte.
  // ⚠️ La capture `04-accueil-superadmin.png` montre « 14 » : le texte du pack et
  // son image se contredisent. C'est le TEXTE qui est applique ici.
  let badgeLabel = null;
  if (typeof badgeCount === 'number' && badgeCount > 0) {
    badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);
  }

  return (
    <Pressable
      accessibilityHint={subtitle}
      accessibilityLabel={title}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ([
        {
          borderRadius: 16,
          width: '100%',
        },
        pressed && {
          opacity: 0.94,
        },
        disabled && {
          opacity: 0.5,
        },
        // Grisee mais vivante : `disabled` couperait l'appui, or c'est
        // justement l'appui qui ouvre la vente.
        !disabled && locked && {
          opacity: 0.55,
        },
      ])}
    >
      <View
        collapsable={false}
        ref={tutorialTargetRef}
        style={[
          ApplicationStyle.card,
          {
            backgroundColor: `${Colors.primary700}59`,
            borderColor,
            borderRadius: 16,
            borderWidth: 1,
            justifyContent: 'space-between',
            minHeight: 140,
            overflow: 'hidden',
            paddingHorizontal: 16,
            paddingVertical: 16,
          },
        ]}
      >
        {highlighted ? (
          <Animated.View
            pointerEvents="none"
            style={{
              borderColor: resolvedAccentColor,
              borderRadius: 16,
              borderWidth: 2.5,
              bottom: 0,
              left: 0,
              opacity: pulseOpacity,
              position: 'absolute',
              right: 0,
              top: 0,
              zIndex: 2,
            }}
          />
        ) : null}
        {illustration ? (
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            resizeMode="contain"
            source={illustration}
            style={{
              bottom: resolvedIllustrationPlacement.bottom,
              height: resolvedIllustrationPlacement.height,
              position: 'absolute',
              right: resolvedIllustrationPlacement.right,
              width: resolvedIllustrationPlacement.width,
            }}
          />
        ) : FALLBACK_GLOW_RINGS.map((ring) => (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            key={ring.size}
            pointerEvents="none"
            style={{
              backgroundColor: withAlpha(resolvedAccentColor, ring.alpha),
              borderRadius: ring.size / 2,
              bottom: FALLBACK_GLOW_CENTER.bottom - (ring.size / 2),
              height: ring.size,
              position: 'absolute',
              right: FALLBACK_GLOW_CENTER.right - (ring.size / 2),
              width: ring.size,
            }}
          />
        ))}

        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, { position: 'relative', zIndex: 1 }]}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}1F`,
              borderRadius: 12,
              height: 38,
              justifyContent: 'center',
              position: 'relative',
              width: 38,
            }}
          >
            <Image
              source={Images[icon]}
              style={{ height: 18, width: 18 }}
              tintColor={resolvedAccentColor}
            />
            {hasAlert ? (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{
                  backgroundColor: Colors.error500,
                  borderColor: Colors.primary700,
                  borderRadius: 5,
                  borderWidth: 1.5,
                  height: 10,
                  position: 'absolute',
                  right: -5,
                  top: -3,
                  width: 10,
                }}
              />
            ) : null}
          </View>
          {badgeLabel ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: Colors.error500,
                borderRadius: 12,
                height: 24,
                justifyContent: 'center',
                marginLeft: 'auto',
                marginRight: 8,
                minWidth: 24,
                paddingHorizontal: 7,
              }}
            >
              <Text style={[Fonts.small, Fonts.neutral00, { fontWeight: '900' }]}>{badgeLabel}</Text>
            </View>
          ) : null}
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}1A`,
              borderColor: `${resolvedAccentColor}66`,
              borderRadius: 10,
              borderWidth: 1,
              height: 26,
              justifyContent: 'center',
              width: 26,
            }}
          >
            <Image
              source={Images.arrowRight}
              style={{ height: 12, width: 12 }}
              tintColor={resolvedAccentColor}
            />
          </View>
        </View>

        <View style={[Spaces.marginTop[16], Spaces.gap[8], { position: 'relative', zIndex: 1 }]}>
          {premiumScope ? (
            <View style={[Alignments.row]}>
              <PremiumBadge scope={premiumScope} />
            </View>
          ) : null}
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { fontSize: 13.5, lineHeight: 20 }]}>{title}</Text>
          <Text
            numberOfLines={subtitleLines}
            style={[
              Fonts.small,
              Fonts.neutral200,
              subtitleLines === 2 && { minHeight: 32 },
            ]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default HomeActionCard;
