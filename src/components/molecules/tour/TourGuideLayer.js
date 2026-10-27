import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs, Mask, Rect,
} from 'react-native-svg';

import { measureTourTarget, subscribeToTourTargets } from '@/domains/tour/tourTargetRegistry';
import { useAppContext } from '@/store/appContext';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import TourFullScreen from '@/components/molecules/tour/TourFullScreen';
import {
  clipAboveDock,
  computeBlockers,
  isOnScreen,
  placeBubble,
  stableHeight,
  toAbsoluteStyle,
  toCutout,
  toLayerFrame,
} from '@/components/molecules/tour/tourGuideGeometry';

import { useTour } from '@/context/useTour';
import useReduceMotion from '@/hooks/useReduceMotion';

/**
 * Couche du guide à missions (TUTOE, pack `04_COUCHE_VISUELLE.md`) : voile et
 * découpes des cibles, cadre pulsé, bulle, jauge (HUD), bandeau de récompense,
 * écrans plein cadre. Montée une fois, à côté de `TourBanner`, qui garde les
 * tours v2 (joueur, dirigeant). La pastille « Reprendre » vit dans le flux de
 * l'accueil (`TourResumePill`), jamais par-dessus l'écran.
 *
 * Repère (TUTOE-CALIBRAGE) : cibles ET couche mesurées par `measureInWindow`,
 * cibles ramenées dans le repère de la couche (`toLayerFrame`) ; taille de la
 * couche prise sur sa propre mise en page. Aucun décalage par écran.
 *
 * Une étape dont aucune cible n'est montée (écran pas encore ancré, feuille
 * native) n'a ni voile ni blocage : la bulle se place en haut et l'écran reste
 * libre. C'est le repli sûr, jamais un écran bloqué.
 *
 * ponytail: les cibles sont re-mesurées toutes les 400 ms pendant une étape
 * (défilement, animations) au lieu d'un suivi fin ; découpes non animées entre
 * deux étapes ; HUD sans flou. Sortie : brancher les re-mesures sur le
 * défilement des écrans ancrés si la recette le demande.
 * @returns {import('react').ReactElement | null}
 */

const CUTOUT_RADIUS = 16;
const MEASURE_INTERVAL_MS = 400;
// Boutons ancrés de la barre d'onglets flottante : leur boîte englobante dit
// où est la barre (elle recouvre le contenu), quand elle est à l'écran.
const DOCK_IDS = ['dock.home', 'dock.planning', 'dock.teams'];

/**
 * Variante de l'étape dont la 1ʳᵉ cible est montée (ex. feuille de choix ouverte).
 * @param {any} step - Étape.
 * @param {Record<string, any>} rects - Mesures par id.
 * @param {number} windowHeight - Hauteur de la fenêtre (feuille fermée = hors écran).
 * Une feuille ou un formulaire ouvert par-dessus l'étape (`subGuides`, ex.
 * « Répéter ») passe avant : ses bulles se suivent avec « Suivant ».
 * @returns {{ sub?: any; targets: string[]; text: string }} Cibles et texte retenus.
 */
const resolveVariant = (step, rects, windowHeight) => {
  const sub = (step?.subGuides || []).find((/** @type {any} */ guide) => {
    const rect = rects[guide.anchor];
    return Boolean(rect) && rect.y < windowHeight && rect.y + rect.height > 0;
  });
  if (sub) return { sub, targets: [], text: '' };
  const variant = (step?.variants || [])
    .find((/** @type {any} */ candidate) => rects[candidate.targets?.[0]]);
  if (variant) return { targets: variant.targets, text: variant.text };
  // Repli : aucune cible de l'étape à l'écran (ex. « équipe déjà là » vue de
  // l'accueil) ⇒ on montre le chemin (l'onglet) au lieu d'une bulle sans voile.
  const fallback = step?.fallback;
  const hasOwnTarget = (step?.targets || []).some((/** @type {string} */ id) => rects[id]);
  if (!hasOwnTarget && fallback && rects[fallback.targets?.[0]]) {
    return { targets: fallback.targets, text: fallback.text };
  }
  return { targets: step?.targets || [], text: step?.text || '' };
};

/**
 * Origine de la couche dans le repère de `measureInWindow` (null si démontée).
 * @param {any} node - Vue racine de la couche.
 * @returns {Promise<{ x: number; y: number } | null>} Origine.
 */
const measureLayerOrigin = (node) => new Promise((resolve) => {
  if (!node?.measureInWindow) {
    resolve(null);
    return;
  }
  node.measureInWindow((/** @type {number} */ x, /** @type {number} */ y) => resolve({ x, y }));
});

/**
 * Arrondi au dixième pour le journal de calibrage.
 * @param {{ height: number; width: number; x: number; y: number }} rect - Rectangle.
 * @returns {number[]} [x, y, largeur, hauteur].
 */
const roundRect = (rect) => [rect.x, rect.y, rect.width, rect.height]
  .map((value) => Math.round(value * 10) / 10);

/**
 * Couche du guide, montée une fois au-dessus du navigateur.
 * @returns {import('react').ReactElement | null}
 */
function TourGuideLayer() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const [layerSize, setLayerSize] = useState(
    /** @type {{ height: number; width: number } | null} */ (null),
  );
  const height = layerSize?.height || windowSize.height;
  const width = layerSize?.width || windowSize.width;
  const layerRef = useRef(/** @type {any} */ (null));
  const originRef = useRef({ x: 0, y: 0 });
  const reduceMotion = useReduceMotion();
  const tour = useTour();
  // Monté hors du navigateur : sans ce garde, voile et bulle restaient sur
  // l'écran de connexion (« Ajouter un compte », tournée du 27/10).
  const [{ auth, isAddingAccount }] = useAppContext();
  const isPrivateMode = Boolean(auth?.token) && !isAddingAccount;
  const {
    currentMission,
    currentStep,
    gauge,
    isGuide,
    isLockedStep,
    isTourActive,
    missionPosition,
    reward,
    tourStatus,
  } = tour;

  const [rects, setRects] = useState(/** @type {Record<string, any>} */ ({}));
  const [bubbleHeight, setBubbleHeight] = useState(110);
  const [subIndex, setSubIndex] = useState(0);
  const [sheetIndex, setSheetIndex] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;

  const isStepVisible = Boolean(isPrivateMode && isGuide && isTourActive
    && tourStatus === 'active' && currentStep && !currentStep.kind);
  const allTargetIds = isStepVisible
    ? [...new Set([
      ...(currentStep.fallback?.targets || []),
      ...(currentStep.subGuides || []).flatMap((/** @type {any} */ guide) => [
        guide.anchor,
        ...guide.bubbles.map((/** @type {any[]} */ bubble) => bubble[0]),
      ]),
      ...(currentStep.targets || []),
      ...(currentStep.variants || []).flatMap((/** @type {any} */ v) => v.targets || []),
      ...DOCK_IDS,
    ])]
    : [];
  const targetKey = allTargetIds.join('|');

  // Mesure des cibles de l'étape : à l'entrée, à chaque ancre qui bouge, et
  // régulièrement (défilement).
  useEffect(() => {
    setSubIndex(0);
    if (!targetKey) {
      setRects({});
      return undefined;
    }
    let cancelled = false;
    const ids = targetKey.split('|');
    const measureAll = () => {
      Promise.all([
        measureLayerOrigin(layerRef.current),
        ...ids.map(measureTourTarget),
      ]).then(([origin, ...measured]) => {
        // Couche pas encore montée : origine inconnue, on attend la mesure suivante.
        if (cancelled || !origin) return;
        originRef.current = origin;
        const next = Object.fromEntries(ids.map((id, index) => [
          id,
          toLayerFrame(/** @type {any} */ (measured[index]), origin),
        ]));
        setRects((previous) => (
          JSON.stringify(previous) === JSON.stringify(next) ? previous : next
        ));
      });
    };
    measureAll();
    const unsubscribe = subscribeToTourTargets(measureAll);
    const timer = setInterval(measureAll, MEASURE_INTERVAL_MS);
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, [targetKey, currentStep?.id]);

  const resolved = resolveVariant(currentStep, rects, height);
  const sheetGuide = resolved.sub || null;
  const sheetAnchor = sheetGuide?.anchor || null;
  // La feuille s'ouvre ou se ferme : ses bulles repartent de la première.
  useEffect(() => { setSheetIndex(0); }, [sheetAnchor]);
  const sheetBubble = sheetGuide
    ? sheetGuide.bubbles[Math.min(sheetIndex, sheetGuide.bubbles.length - 1)]
    : null;
  const variant = sheetBubble
    ? { targets: [sheetBubble[0]], text: sheetBubble[1]() }
    : resolved;
  const bubbleTexts = !sheetGuide && Array.isArray(currentStep?.bubbles)
    ? currentStep.bubbles
    : null;
  const text = bubbleTexts
    ? bubbleTexts[Math.min(subIndex, bubbleTexts.length - 1)]()
    : variant.text;

  // Annonce au lecteur d'écran, et apparition (fondu + 6 pt) à chaque bulle.
  useEffect(() => {
    if (!isStepVisible || !text) return;
    AccessibilityInfo.announceForAccessibility?.(text);
    appear.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      Animated.timing(appear, { duration: 350, toValue: 1, useNativeDriver: true }).start();
    }
  }, [appear, isStepVisible, reduceMotion, text]);

  useEffect(() => {
    if (!isStepVisible || reduceMotion) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.timing(pulse, {
      duration: 1600, toValue: 1, useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [isStepVisible, pulse, reduceMotion]);

  const dockRects = DOCK_IDS.map((id) => rects[id]).filter(Boolean);
  const dock = dockRects.length ? {
    height: 1,
    width: 1,
    x: 0,
    y: Math.min(...dockRects.map((rect) => rect.y)),
  } : null;
  /** @type {Record<string, any>} */
  const visibleRects = Object.fromEntries(variant.targets.map((id) => [
    id,
    rects[id] && !DOCK_IDS.includes(id) ? clipAboveDock(rects[id], dock) : rects[id],
  ]));
  const measuredTargets = variant.targets
    .filter((id) => visibleRects[id] && isOnScreen(visibleRects[id], width, height));
  const cutouts = measuredTargets.map((id) => toCutout(visibleRects[id], width, height));
  const primary = cutouts[0] || null;
  // Feuille ouverte : rien n'est bloqué, la bulle reste en haut (la feuille est en bas).
  const withVeil = Boolean(primary) && currentStep?.veil !== false && !sheetGuide;
  const isTop = currentStep?.bubblePlacement === 'top' || !primary || Boolean(sheetGuide);
  const position = placeBubble({
    bubbleHeight, height, insetTop: insets.top, primary, top: isTop, width,
  });

  // Journal de calibrage (développement seulement) : une ligne par état de
  // l'étape, lue par `.local/outils/tutoe-calibrage.py` (cible, trou, bulle,
  // dans le repère de la couche, en points).
  const calibrationLine = __DEV__ && isStepVisible
    ? JSON.stringify({
      bubble: roundRect({
        height: bubbleHeight, width: position.width, x: position.left, y: position.top,
      }),
      layer: [width, height],
      origin: [originRef.current.x, originRef.current.y],
      step: currentStep.id,
      sub: sheetGuide ? `${sheetGuide.anchor}#${sheetIndex}` : null,
      targets: measuredTargets.map((id, index) => ({
        hole: roundRect(cutouts[index]), id, rect: roundRect(visibleRects[id]),
      })),
      veil: withVeil,
    })
    : '';
  useEffect(() => {
    // eslint-disable-next-line no-console
    if (calibrationLine) console.log(`[TUTOE-CALIB] ${calibrationLine}`);
  }, [calibrationLine]);
  const stepId = currentStep?.id || null;
  useEffect(() => {
    if (!__DEV__ || !isGuide) return;
    // eslint-disable-next-line no-console
    console.log(`[TUTOE-CALIB] ${JSON.stringify({ status: tourStatus, step: stepId })}`);
  }, [isGuide, stepId, tourStatus]);

  if (!isPrivateMode || !isGuide || !isTourActive) return null;

  // En pause : rien par-dessus l'écran (pastille dans l'accueil, TourResumePill).
  if (tourStatus === 'paused') return null;

  if (tourStatus === 'success' && reward) {
    return <RewardBanner insetTop={insets.top} reward={reward} title={currentMission?.title} />;
  }

  if (tourStatus === 'active' && currentStep?.kind) {
    return <TourFullScreen kind={currentStep.kind} />;
  }

  if (!isStepVisible) return null;

  const isBonus = Boolean(missionPosition?.isBonus);
  const missionWord = isBonus ? t('tourGuide.bonus', 'Bonus') : t('tourGuide.mission', 'Mission');
  const hasMoreSheetBubbles = Boolean(sheetGuide)
    && sheetIndex < sheetGuide.bubbles.length - 1;
  const hasMoreBubbles = hasMoreSheetBubbles
    || (Boolean(bubbleTexts) && subIndex < bubbleTexts.length - 1);
  const buttonLabel = hasMoreBubbles
    ? t('tourGuide.next', 'Suivant')
    : currentStep.nextLabel || null;
  const isCompact = isTop && !buttonLabel && !isBonus;
  const showHud = position.top > insets.top + 110
    && !cutouts.some((cutout) => cutout.y < insets.top + 110);
  const kicker = missionPosition
    ? `${missionWord} ${missionPosition.index}/${missionPosition.total}`
      + ` · ${currentMission?.title || ''}`
    : '';

  return (
    <View
      collapsable={false}
      onLayout={(event) => {
        const { height: layoutHeight, width: layoutWidth } = event.nativeEvent.layout;
        setLayerSize((previous) => (
          previous?.height === layoutHeight && previous?.width === layoutWidth
            ? previous
            : { height: layoutHeight, width: layoutWidth }
        ));
      }}
      pointerEvents="box-none"
      ref={layerRef}
      style={{
        bottom: 0, left: 0, position: 'absolute', right: 0, top: 0,
      }}
      testID="tour.layer"
    >
      {withVeil ? (
        <>
          <Svg
            height={height}
            pointerEvents="none"
            style={{
              left: 0,
              position: 'absolute',
              top: 0,
            }}
            width={width}
          >
            <Defs>
              <Mask
                height={height}
                id="tourVeil"
                maskUnits="userSpaceOnUse"
                width={width}
                x={0}
                y={0}
              >
                <Rect fill="white" height={height} width={width} x={0} y={0} />
                {cutouts.map((cutout, index) => (
                  <Rect
                    fill="black"
                    height={cutout.height}
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    rx={CUTOUT_RADIUS}
                    width={cutout.width}
                    x={cutout.x}
                    y={cutout.y}
                  />
                ))}
              </Mask>
            </Defs>
            <Rect
              fill={withAlpha(Colors.primary900, 0.72)}
              height={height}
              mask="url(#tourVeil)"
              width={width}
              x={0}
              y={0}
            />
          </Svg>
          {computeBlockers(cutouts, width, height).map((blocker) => (
            <Pressable
              accessible={false}
              key={`${blocker.x}-${blocker.y}`}
              onPress={() => {}}
              style={toAbsoluteStyle(blocker)}
              testID={__DEV__ ? 'tour.blocker' : undefined}
            />
          ))}
        </>
      ) : null}

      {cutouts.map((cutout, index) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          pointerEvents="none"
          style={{
            borderColor: index === 0 ? Colors.primary500 : withAlpha(Colors.primary500, 0.5),
            borderRadius: CUTOUT_RADIUS,
            borderWidth: 2,
            height: cutout.height,
            left: cutout.x,
            position: 'absolute',
            top: cutout.y,
            width: cutout.width,
          }}
          testID={__DEV__ ? `tour.hole.${index}` : undefined}
        >
          {index === 0 && !reduceMotion ? (
            <Animated.View
              style={{
                borderColor: Colors.primary500,
                borderRadius: CUTOUT_RADIUS + 4,
                borderWidth: 2,
                bottom: -2,
                left: -2,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                position: 'absolute',
                right: -2,
                top: -2,
                transform: [{
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1 + (16 / Math.max(cutout.width, 1))],
                  }),
                }],
              }}
            />
          ) : null}
        </View>
      ))}

      {showHud ? (
        <GuideHud
          gauge={gauge}
          insetTop={insets.top}
          isBonus={isBonus}
          missionPosition={missionPosition}
        />
      ) : null}

      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        onLayout={(event) => {
          const measured = event.nativeEvent.layout.height;
          setBubbleHeight((previous) => stableHeight(previous, measured));
        }}
        style={{
          backgroundColor: Colors.neutral50,
          borderRadius: 18,
          elevation: 12,
          left: position.left,
          opacity: appear,
          paddingHorizontal: 16,
          paddingVertical: 13,
          position: 'absolute',
          shadowColor: Colors.primary900,
          shadowOffset: { height: 14, width: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 17,
          top: position.top,
          transform: [{
            translateY: appear.interpolate({
              inputRange: [0, 1],
              outputRange: [6, 0],
            }),
          }],
          width: position.width,
        }}
        testID={__DEV__ ? 'tour.bubble' : undefined}
      >
        {position.arrow !== 'none' ? (
          <View
            style={{
              backgroundColor: Colors.neutral50,
              height: 14,
              left: position.arrowX,
              position: 'absolute',
              transform: [{ rotate: '45deg' }],
              width: 14,
              ...(position.arrow === 'down' ? { bottom: -7 } : { top: -7 }),
            }}
          />
        ) : null}
        <View style={{ alignItems: 'flex-start', columnGap: 8, flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            {kicker ? (
              <Text
                style={[Fonts.p4Bold, {
                  color: isBonus ? Colors.gold900 : Colors.primary600,
                  letterSpacing: 1,
                  marginBottom: 5,
                  textTransform: 'uppercase',
                }]}
              >
                {kicker}
              </Text>
            ) : null}
            <Text style={[Fonts.p2Bold, { color: Colors.primary900, lineHeight: 20 }]}>{text}</Text>
          </View>
          <TouchableOpacity
            accessibilityLabel={t('tourGuide.pause', 'Mettre le guide en pause')}
            accessibilityRole="button"
            hitSlop={12}
            onPress={tour.pauseTour}
          >
            <SvgIcon color={Colors.neutral600} height={11} name="close" width={11} />
          </TouchableOpacity>
        </View>
        {!isCompact ? (
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
            {isBonus ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={tour.skipMission}
                style={{ justifyContent: 'center', minHeight: 44 }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.neutral600 }]}>
                  {t('tourGuide.skipBonus', 'Passer ce bonus')}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[Fonts.p4Bold, { color: Colors.neutral600 }]}>
                {isLockedStep ? t('tourGuide.essential', 'Mission essentielle') : ''}
              </Text>
            )}
            {buttonLabel ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  if (hasMoreSheetBubbles) setSheetIndex((value) => value + 1);
                  else if (hasMoreBubbles) setSubIndex((value) => value + 1);
                  else tour.completeCurrentStep();
                }}
                style={{
                  backgroundColor: Colors.primary500,
                  borderRadius: 999,
                  height: 36,
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                }}
              >
                <Text style={[Fonts.p3Black, { color: Colors.primary900 }]}>{buttonLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * Jauge en haut (HUD) : « MISSION 2/4 », barre, « Équipe prête 50 % ».
 * @param {object} props - Propriétés.
 * @param {number} props.gauge - Jauge en %.
 * @param {number} props.insetTop - Encoche.
 * @param {boolean} props.isBonus - Bonus en cours.
 * @param {{ index: number; total: number } | null} props.missionPosition - Position.
 * @returns {import('react').ReactElement} HUD.
 */
function GuideHud({
  gauge, insetTop, isBonus, missionPosition,
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const accent = isBonus ? Colors.gold500 : Colors.primary500;
  const missionWord = isBonus ? t('tourGuide.bonus', 'Bonus') : t('tourGuide.mission', 'Mission');
  return (
    <View
      pointerEvents="none"
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.primary800, 0.92),
        borderColor: isBonus ? withAlpha(Colors.gold500, 0.4) : withAlpha(Colors.primary500, 0.35),
        borderRadius: 999,
        borderWidth: 1,
        columnGap: 10,
        flexDirection: 'row',
        left: 14,
        paddingBottom: 7,
        paddingLeft: 14,
        paddingRight: 8,
        paddingTop: 7,
        position: 'absolute',
        right: 14,
        top: insetTop + 6,
      }}
    >
      <Text style={[Fonts.p4Bold, { color: accent, letterSpacing: 1, textTransform: 'uppercase' }]}>
        {missionPosition
          ? `${missionWord} ${missionPosition.index}/${missionPosition.total}`
          : ''}
      </Text>
      <View
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.12),
          borderRadius: 999,
          flex: 1,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <View style={{ backgroundColor: Colors.primary500, height: 6, width: `${gauge}%` }} />
      </View>
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary500, 0.14),
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
        }}
      >
        <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
          {t('tourGuide.teamReady', 'Équipe prête {{gauge}} %', { gauge })}
        </Text>
      </View>
    </View>
  );
}

/**
 * Bandeau « Mission réussie » (1,7 s) : pastille ✓, libellé, jauge N → N+25 %.
 * @param {object} props - Propriétés.
 * @param {number} props.insetTop - Encoche.
 * @param {{ from: number; isBonus: boolean; to: number }} props.reward - Récompense.
 * @param {string | undefined} props.title - Libellé de la mission.
 * @returns {import('react').ReactElement} Bandeau.
 */
function RewardBanner({ insetTop, reward, title }) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(reward.from)).current;
  const label = reward.isBonus
    ? t('tourGuide.bonusDone', 'Bonus réussi · {{title}}', {
      title: title || '',
      ...SANS_ECHAPPEMENT,
    })
    : t('tourGuide.missionDone', 'Mission réussie · {{title}}', {
      title: title || '',
      ...SANS_ECHAPPEMENT,
    });
  const accent = reward.isBonus ? Colors.gold500 : Colors.success500;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(label);
    if (reduceMotion) {
      progress.setValue(reward.to);
      return;
    }
    Animated.timing(progress, {
      delay: 200, duration: 900, toValue: reward.to, useNativeDriver: false,
    }).start();
  }, [label, progress, reduceMotion, reward.to]);

  return (
    <View
      accessibilityRole="alert"
      pointerEvents="none"
      style={{
        backgroundColor: withAlpha(Colors.chatSheet, 0.97),
        borderColor: withAlpha(accent, 0.5),
        borderRadius: 18,
        borderWidth: 1,
        columnGap: 12,
        elevation: 10,
        flexDirection: 'row',
        left: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        position: 'absolute',
        right: 14,
        shadowColor: Colors.primary900,
        shadowOffset: { height: 12, width: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
        top: insetTop + 8,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: accent,
          borderRadius: 17,
          height: 34,
          justifyContent: 'center',
          width: 34,
        }}
      >
        <SvgIcon color={Colors.primary900} height={16} name="check" width={16} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[Fonts.p2Black, { color: Colors.neutral00 }]}>{label}</Text>
        {!reward.isBonus ? (
          <View style={{
            alignItems: 'center', columnGap: 8, flexDirection: 'row', marginTop: 6,
          }}
          >
            <View
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.12),
                borderRadius: 999,
                flex: 1,
                height: 6,
                overflow: 'hidden',
              }}
            >
              <Animated.View
                style={{
                  backgroundColor: Colors.success500,
                  height: 6,
                  width: progress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                }}
              />
            </View>
            <Text style={[Fonts.p3Black, { color: Colors.success500 }]}>{`${reward.to} %`}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default TourGuideLayer;
