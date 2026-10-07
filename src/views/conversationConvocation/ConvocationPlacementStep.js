import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';

import {
  getCompositionPlayerAvatarUrl,
  getCompositionPlayerInitials,
  getCompositionPlayerLabel,
  sanitizeCompositionText,
} from '@/utils/compositionPlayer';
import { fitTacticalFieldInBox } from '@/utils/tacticalField';

import {
  findPlacementAt,
  movePlacement,
  nudgePlacement,
  pointToPercent,
} from './convocationWizardUtils';

/** La pastille du pack : 36 de diametre, le prenom dessous (§5). */
const TOKEN_SIZE = 36;
const TOKEN_LABEL_WIDTH = 74;
/** Au-dela de ce trajet (en pixels), un toucher devient un glisser. */
const DRAG_THRESHOLD = 4;

const ACCESSIBLE_MOVES = ['up', 'down', 'left', 'right'];

// 📸 Adel, 07/10 ~17h30 : « sur le terrain de la convocation, c'est la PHOTO ; sinon, les
// initiales » (joueur sans photo, ou ajoute a la main). Le lecteur d'ecran dit le nom complet.
const TOKEN_SHOWS_PHOTO = true;

/**
 * Le prenom sous la pastille (le nom entier s'il n'y en a pas).
 * @param {any} player
 * @returns {string}
 */
const firstNameOf = (player) => sanitizeCompositionText(player?.firstname)
  || getCompositionPlayerLabel(player);

/**
 * MESSAGERIE-1C — ETAPE 3 « PLACEMENT » (pack messagerie §3.12, §5).
 *
 * Le terrain debout du sport (`RenderedTacticalField`, le meme que partout), une pastille par
 * titulaire (sa photo, ses initiales a defaut), GLISSEE librement (bornee de 5 a 95 %), et les
 * remplacants en puces ambrees dessous.
 *
 * ♿ Deplacer SANS glisser (prompt 1C) : toucher une pastille la choisit, toucher ensuite le
 * terrain l'y pose ; au lecteur d'ecran, chaque pastille porte les actions « Avancer »,
 * « Reculer », « Vers la gauche », « Vers la droite ».
 *
 * 🧭 Les gestes passent par les props de « repondeur » de la vue du terrain (pas de bibliotheque
 * de gestes) : elles marchent pareil sur le telephone et sur le site, et l'etape ne defile pas,
 * donc aucun defilement ne dispute le doigt a la pastille.
 * @param {object} props
 * @param {any[]} props.bench Les lignes convoquees au banc.
 * @param {(updater: (current: any[]) => any[]) => void} props.onMove
 * @param {any[]} props.pitch Les lignes convoquees sur le terrain.
 * @param {any[]} props.placements
 * @param {string} [props.sport]
 * @returns {import('react').ReactElement}
 */
function ConvocationPlacementStep({
  bench, onMove, pitch, placements, sport = '',
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const [box, setBox] = useState(/** @type {{ height: number, width: number } | null} */ (null));
  const [selectedId, setSelectedId] = useState('');
  const [draggingId, setDraggingId] = useState('');
  /** @type {import('react').MutableRefObject<any>} */
  const gesture = useRef(null);

  const field = fitTacticalFieldInBox(box, sport);
  const rowsById = new Map(pitch.map((row) => [row.id, row]));
  const shown = placements.filter((placement) => rowsById.has(String(placement?.playerId)));
  const selectedRow = selectedId ? rowsById.get(selectedId) : null;

  const locate = (/** @type {any} */ event) => ({
    pageX: Number(event?.nativeEvent?.pageX) || 0,
    pageY: Number(event?.nativeEvent?.pageY) || 0,
    x: Number(event?.nativeEvent?.locationX) || 0,
    y: Number(event?.nativeEvent?.locationY) || 0,
  });

  const handleGrant = (/** @type {any} */ event) => {
    if (!field) return;
    const point = locate(event);
    gesture.current = {
      ...point,
      hit: findPlacementAt({
        height: field.height, placements: shown, width: field.width, x: point.x, y: point.y,
      }),
      moved: false,
    };
  };

  const handleMove = (/** @type {any} */ event) => {
    const { current } = gesture;
    if (!field || !current?.hit) return;
    const point = locate(event);
    const dx = point.pageX - current.pageX;
    const dy = point.pageY - current.pageY;
    if (!current.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!current.moved) {
      current.moved = true;
      setDraggingId(current.hit);
      setSelectedId('');
    }
    const target = pointToPercent({
      height: field.height, width: field.width, x: current.x + dx, y: current.y + dy,
    });
    onMove((list) => movePlacement(list, current.hit, target.positionX, target.positionY));
  };

  const handleRelease = () => {
    const { current } = gesture;
    gesture.current = null;
    setDraggingId('');
    if (!field || !current || current.moved) return;
    if (current.hit) {
      setSelectedId(selectedId === current.hit ? '' : current.hit);
      return;
    }
    if (!selectedId) return;
    const target = pointToPercent({
      height: field.height, width: field.width, x: current.x, y: current.y,
    });
    onMove((list) => movePlacement(list, selectedId, target.positionX, target.positionY));
    setSelectedId('');
  };

  const handleTerminate = () => {
    gesture.current = null;
    setDraggingId('');
  };

  let hint = [
    t('conversationConvocation.placement.hint'),
    t('conversationConvocation.placement.a11yHint'),
  ].join(' ');
  if (selectedRow) {
    // Un nom (« N'Diaye ») ne doit pas sortir en « N&#39;Diaye » : FINITIONS3, sansEchappement.js.
    hint = t('conversationConvocation.placement.selectedHint', {
      name: getCompositionPlayerLabel(selectedRow.player),
      ...SANS_ECHAPPEMENT,
    });
  }

  return (
    <View style={styles.root} testID="convocation-step-placement">
      <View
        onLayout={(event) => {
          const { height, width } = event.nativeEvent.layout;
          setBox({ height, width });
        }}
        style={styles.fieldBox}
        testID="convocation-field-box"
      >
        {pitch.length === 0 ? (
          <Text style={[Fonts.p2, styles.empty, { color: Colors.neutral300 }]}>
            {t('conversationConvocation.placement.noStarter')}
          </Text>
        ) : null}
        {field && pitch.length > 0 ? (
          <View
            accessibilityHint={t('conversationConvocation.placement.a11yHint')}
            accessibilityLabel={t('conversationConvocation.placement.fieldLabel')}
            onMoveShouldSetResponder={() => Boolean(gesture.current)}
            onResponderGrant={handleGrant}
            onResponderMove={handleMove}
            onResponderRelease={handleRelease}
            onResponderTerminate={handleTerminate}
            onResponderTerminationRequest={() => false}
            onStartShouldSetResponder={() => true}
            style={[styles.field, { height: field.height, width: field.width }]}
            testID="convocation-field"
          >
            <RenderedTacticalField sport={sport} style={StyleSheet.absoluteFill}>
              {shown.map((placement) => {
                const playerId = String(placement.playerId);
                const row = rowsById.get(playerId);
                const name = getCompositionPlayerLabel(row?.player);
                const isActive = playerId === draggingId || playerId === selectedId;
                const left = ((Number(placement.positionX) || 0) / 100) * field.width;
                const top = ((Number(placement.positionY) || 0) / 100) * field.height;
                return (
                  <View
                    accessibilityActions={ACCESSIBLE_MOVES.map((action) => ({
                      label: t(`conversationConvocation.placement.actions.${action}`),
                      name: action,
                    }))}
                    accessibilityHint={t('conversationConvocation.placement.tokenHint')}
                    accessibilityLabel={t('conversationConvocation.placement.tokenLabel', {
                      name, ...SANS_ECHAPPEMENT,
                    })}
                    accessible
                    key={playerId}
                    onAccessibilityAction={(event) => onMove((list) => nudgePlacement(
                      list,
                      playerId,
                      event.nativeEvent.actionName,
                    ))}
                    pointerEvents="none"
                    style={[
                      styles.token,
                      {
                        left: left - (TOKEN_LABEL_WIDTH / 2),
                        top: top - (TOKEN_SIZE / 2),
                        zIndex: isActive ? 2 : 1,
                      },
                    ]}
                    testID={`convocation-token-${playerId}`}
                  >
                    <View
                      style={[
                        styles.tokenFace,
                        {
                          backgroundColor: Colors.primary500,
                          borderColor: isActive ? Colors.neutral00 : Colors.primary800,
                          transform: [{ scale: isActive ? 1.12 : 1 }],
                        },
                        playerId === draggingId
                          ? [styles.tokenLifted, { shadowColor: Colors.neutral900 }]
                          : null,
                      ]}
                    >
                      {TOKEN_SHOWS_PHOTO && getCompositionPlayerAvatarUrl(row?.player) ? (
                        <ProfileAvatar
                          enablePreview={false}
                          imageUrl={getCompositionPlayerAvatarUrl(row?.player)}
                          name={name}
                          size={TOKEN_SIZE - 4}
                        />
                      ) : (
                        <Text
                          style={[Fonts.p3Black, styles.initials, { color: Colors.primary900 }]}
                        >
                          {getCompositionPlayerInitials(row?.player)}
                        </Text>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        Fonts.p4Bold,
                        styles.tokenName,
                        {
                          color: Colors.neutral00,
                          textShadowColor: withAlpha(Colors.neutral900, 0.8),
                        },
                      ]}
                    >
                      {firstNameOf(row?.player)}
                    </Text>
                  </View>
                );
              })}
            </RenderedTacticalField>
          </View>
        ) : null}
      </View>

      {pitch.length > 0 ? (
        <Text
          style={[Fonts.p3, styles.hint, { color: withAlpha(Colors.neutral00, 0.6) }]}
          testID="convocation-placement-hint"
        >
          {hint}
        </Text>
      ) : null}

      {bench.length > 0 ? (
        <View style={styles.bench} testID="convocation-bench">
          <Text style={[Fonts.p3Bold, styles.caps, { color: Colors.warning400 }]}>
            {t('conversationConvocation.placement.bench', { count: bench.length })}
          </Text>
          <ScrollView
            contentContainerStyle={styles.benchChips}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {bench.map((row) => (
              <View
                key={row.id}
                style={[styles.chip, { backgroundColor: withAlpha(Colors.warning400, 0.14) }]}
              >
                {TOKEN_SHOWS_PHOTO && getCompositionPlayerAvatarUrl(row.player) ? (
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={getCompositionPlayerAvatarUrl(row.player)}
                    name={getCompositionPlayerLabel(row.player)}
                    size={22}
                  />
                ) : (
                  <View style={[styles.chipDot, { backgroundColor: Colors.warning400 }]}>
                    <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
                      {getCompositionPlayerInitials(row.player)}
                    </Text>
                  </View>
                )}
                <Text style={[Fonts.p3Bold, styles.chipName, { color: Colors.neutral00 }]}>
                  {getCompositionPlayerLabel(row.player)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bench: {
    gap: 8,
    marginTop: 12,
  },
  benchChips: {
    gap: 6,
    paddingBottom: 4,
  },
  caps: {
    fontSize: 12,
    letterSpacing: 1.2,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 10,
    paddingTop: 4,
  },
  chipDot: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  chipName: {
    fontSize: 12.5,
  },
  empty: {
    textAlign: 'center',
  },
  field: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  fieldBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
  },
  hint: {
    fontSize: 12.5,
    marginHorizontal: 4,
    marginTop: 8,
  },
  initials: {
    fontSize: 12,
  },
  root: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 12,
  },
  token: {
    alignItems: 'center',
    position: 'absolute',
    width: TOKEN_LABEL_WIDTH,
  },
  tokenFace: {
    alignItems: 'center',
    borderRadius: TOKEN_SIZE / 2,
    borderWidth: 2,
    height: TOKEN_SIZE,
    justifyContent: 'center',
    width: TOKEN_SIZE,
  },
  tokenLifted: {
    elevation: 6,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  tokenName: {
    fontSize: 10.5,
    marginTop: 2,
    maxWidth: TOKEN_LABEL_WIDTH,
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3,
  },
});

export default ConvocationPlacementStep;
