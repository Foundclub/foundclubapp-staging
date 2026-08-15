/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { MEMBER_MODES, isTeamMember } from '@/domains/detection/detectionSplit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTeamComposition } from '@/services/event/eventQueries';

/**
 * C-D — ECRAN 13 du pack composition : « Membres de l'equipe ».
 *
 * L'etape 1/3 d'une DETECTION. Le coach n'y convoque personne (le mot
 * « convocation » est interdit ici, regle du pack §6) : il decide COMMENT les
 * inscrits entrent dans la repartition, et s'il pointe les arrivees avant de
 * generer.
 *
 * 🔑 POURQUOI LE POINTAGE VIT ICI ET PAS SUR UN ECRAN A LUI
 * Le pack numerote 17 ecrans sans trou et decrit `checkInFirst` sous le titre
 * `ENSUITE` de CET ecran : c'est un MODE, pas une etape. La liste de pointage
 * n'apparait donc que si l'interrupteur est allume — sans quoi l'interrupteur ne
 * commanderait rien, exactement le defaut mesure sur `requireResponse` (D79).
 *
 * ⚠️ LA LISTE DE JOUEURS VIENT DU SERVEUR, PAS DES PARAMETRES DE ROUTE.
 * `getCompositionPlayersForEvent` (EventDetails) melange membres et candidats
 * SANS marqueur : impossible d'y distinguer « 12 de Senior 1 » des inscrits.
 * `eligiblePlayers` du serveur, lui, porte `participantSource` et
 * `appliedPosition` (admin `event-composition.ts:184-200`). On lit donc la
 * source qui sait, et les parametres de route ne servent que de repli.
 */

/** @type {any[]} */
const EMPTY_LIST = Object.freeze([]);

const MODE_ORDER = [MEMBER_MODES.MIX, MEMBER_MODES.GROUPED, MEMBER_MODES.EXCLUDED];

const getPlayerId = (/** @type {any} */ player) => String(player?.documentId || player?.id || '');

const getPlayerName = (/** @type {any} */ player) => [player?.firstname, player?.lastname]
  .filter(Boolean).join(' ').trim();

function DetectionSquadSetup() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // 🧨 Fige : `route.params || {}` fabrique un objet NEUF a chaque rendu — c'est
  // ce defaut exact qui avait produit 402 rendus et gele le terrain (D42).
  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    eventId,
    players: fallbackPlayers = EMPTY_LIST,
    sport = 'football',
    teamId,
    teamName = '',
  } = params;

  const { data: teamComposition } = useGetEventTeamComposition(eventId, teamId, {
    enabled: Boolean(eventId),
  });

  const players = useMemo(() => {
    const fromServer = teamComposition?.eligiblePlayers;
    return Array.isArray(fromServer) && fromServer.length ? fromServer : fallbackPlayers;
  }, [fallbackPlayers, teamComposition?.eligiblePlayers]);

  const existingSplit = teamComposition?.detectionSplit || null;

  const members = useMemo(() => players.filter(isTeamMember), [players]);
  const candidateCount = players.length - members.length;

  const [pickedMode, setPickedMode] = useState(null);
  const [checkInOverride, setCheckInOverride] = useState(null);
  const [presentIds, setPresentIds] = useState(null);

  // Les reglages deja enregistres gagnent sur les defauts du pack, sinon revenir
  // sur l'ecran effacerait un choix que le coach avait fait.
  const activeMode = pickedMode
    || (MODE_ORDER.includes(existingSplit?.memberMode) ? existingSplit.memberMode : MEMBER_MODES.GROUPED);
  const checkInFirst = checkInOverride !== null
    ? checkInOverride
    : existingSplit?.checkInFirst !== false;

  // ⚠️ `presentIds` n'est relu du serveur que si celui-ci sait le ranger. Tant
  // que le lot C-D cote admin n'est pas deploye, `normalizeDetectionSplit` jette
  // la clef en silence : on retombe alors sur « tout le monde est pointe », ce
  // qui ne fait perdre personne. Rien ne casse, rien ne ment.
  const activePresentIds = useMemo(() => {
    if (presentIds) return presentIds;
    const stored = existingSplit?.presentIds;
    if (Array.isArray(stored) && stored.length) return stored;
    return players.map(getPlayerId).filter(Boolean);
  }, [existingSplit?.presentIds, players, presentIds]);

  const presentSet = useMemo(() => new Set(activePresentIds), [activePresentIds]);

  const togglePresent = useCallback((/** @type {string} */ playerId) => {
    setPresentIds((current) => {
      const base = current || activePresentIds;
      return base.includes(playerId)
        ? base.filter((entry) => entry !== playerId)
        : [...base, playerId];
    });
  }, [activePresentIds]);

  const toggleAll = useCallback(() => {
    const allIds = players.map(getPlayerId).filter(Boolean);
    setPresentIds(presentSet.size >= allIds.length ? [] : allIds);
  }, [players, presentSet.size]);

  const goToTeams = useCallback((/** @type {string} */ routeName) => {
    // @ts-ignore — `navigate` est bien la sur un ecran de pile.
    navigation.navigate(routeName, {
      ...params,
      checkInFirst,
      memberMode: activeMode,
      presentIds: checkInFirst ? activePresentIds : null,
      sport,
      teamName,
    });
  }, [activeMode, activePresentIds, checkInFirst, navigation, params, sport, teamName]);

  const subtitle = t('detection.squad.subtitle', {
    members: members.length,
    registered: players.length,
    teamName: teamName || t('common.team', { defaultValue: '' }),
  });

  // L'apercu du pack change avec le choix : c'est lui qui rend la consequence
  // lisible AVANT de generer, et il compte de vrais joueurs, jamais un exemple.
  const previewText = useMemo(() => {
    const base = t(`detection.squad.preview.${activeMode}`, {
      candidates: candidateCount,
      members: members.length,
      teamName,
      total: players.length,
    });
    return checkInFirst ? `${base} ${t('detection.squad.preview.withCheckIn')}` : base;
  }, [activeMode, candidateCount, checkInFirst, members.length, players.length, t, teamName]);

  const renderMode = (/** @type {string} */ mode) => {
    const isActive = mode === activeMode;

    return (
      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive }}
        activeOpacity={0.8}
        key={mode}
        onPress={() => setPickedMode(mode)}
        style={[
          styles.optionRow,
          {
            backgroundColor: isActive
              ? withAlpha(Colors.primary500, 0.1)
              : withAlpha(Colors.neutral00, 0.035),
            borderColor: isActive
              ? withAlpha(Colors.primary500, 0.45)
              : withAlpha(Colors.neutral00, 0.09),
          },
        ]}
      >
        <View style={styles.optionTexts}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t(`detection.squad.modes.${mode}.title`)}
          </Text>
          <Text style={[Fonts.p3, styles.optionSubtitle, { color: Colors.neutral300 }]}>
            {t(`detection.squad.modes.${mode}.subtitle`)}
          </Text>
        </View>
        <View
          style={[
            styles.radioOuter,
            { borderColor: isActive ? Colors.primary500 : withAlpha(Colors.neutral00, 0.24) },
          ]}
        >
          {isActive ? (
            <View style={[styles.radioInner, { backgroundColor: Colors.primary500 }]} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCheckInRow = (/** @type {any} */ player) => {
    const playerId = getPlayerId(player);
    const isPresent = presentSet.has(playerId);

    return (
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isPresent }}
        activeOpacity={0.8}
        key={playerId}
        onPress={() => togglePresent(playerId)}
        style={[
          styles.checkInRow,
          {
            backgroundColor: isPresent
              ? withAlpha(Colors.primary500, 0.1)
              : withAlpha(Colors.neutral00, 0.035),
            borderColor: isPresent
              ? withAlpha(Colors.primary500, 0.45)
              : withAlpha(Colors.neutral00, 0.09),
          },
        ]}
      >
        <View style={styles.optionTexts}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{getPlayerName(player)}</Text>
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {isTeamMember(player)
              ? t('detection.squad.meta.member', { teamName })
              : t('detection.squad.meta.requestedPosition', {
                position: player?.appliedPosition || t('matchCallUp.selection.meta.positionToDefine'),
              })}
          </Text>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: isPresent ? Colors.primary500 : 'transparent',
              borderColor: isPresent ? Colors.primary500 : withAlpha(Colors.neutral00, 0.24),
            },
          ]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('detection.squad.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>{subtitle}</Text>
        </View>
        <View style={[styles.stepChip, { backgroundColor: withAlpha(Colors.primary500, 0.16) }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
            {t('detection.squad.progress', { current: 1, total: 3 })}
          </Text>
        </View>
      </View>

      {/* `styles.list` (flex: 1) BORNE la zone qui defile : sans lui, React Native
          mesure un ScrollView a la hauteur de ses enfants et le contenu POUSSE la
          barre du bas hors de l'ecran (correctif D84, repris tel quel). */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.1),
              borderColor: withAlpha(Colors.primary500, 0.45),
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t('detection.squad.intro.title', { count: members.length, teamName })}
          </Text>
          <Text style={[Fonts.p3, styles.optionSubtitle, { color: Colors.neutral300 }]}>
            {t('detection.squad.intro.subtitle')}
          </Text>
        </View>

        <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
          {t('detection.squad.sectionTitle').toUpperCase()}
        </Text>
        {MODE_ORDER.map(renderMode)}

        <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
          {t('detection.squad.next').toUpperCase()}
        </Text>
        <View
          style={[
            styles.switchCard,
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderColor: withAlpha(Colors.neutral00, 0.1),
            },
          ]}
        >
          <View style={styles.optionTexts}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {t('detection.squad.checkIn.title')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('detection.squad.checkIn.subtitle', { count: players.length })}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('detection.squad.checkIn.title')}
            onValueChange={setCheckInOverride}
            thumbColor={Colors.neutral00}
            trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
            value={checkInFirst}
          />
        </View>

        {/* Le pointage n'existe QUE si l'interrupteur est allume — sinon
            l'interrupteur serait decoratif, et le lot repeterait le defaut
            mesure sur `requireResponse`. */}
        {checkInFirst ? (
          <>
            <View style={styles.checkInHeader}>
              <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                {t('detection.squad.checkInList.title', {
                  present: presentSet.size,
                  total: players.length,
                }).toUpperCase()}
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={toggleAll} style={styles.checkInToggleAll}>
                <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                  {presentSet.size >= players.length
                    ? t('detection.squad.checkInList.markNone')
                    : t('detection.squad.checkInList.markAll')}
                </Text>
              </TouchableOpacity>
            </View>
            {players.length
              ? players.map(renderCheckInRow)
              : (
                <Text style={[Fonts.p3, styles.emptyText, { color: Colors.neutral300 }]}>
                  {t('detection.squad.checkIn.empty')}
                </Text>
              )}
          </>
        ) : null}

        <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
          {t('detection.squad.previewTitle').toUpperCase()}
        </Text>
        <View style={[styles.previewCard, { borderColor: withAlpha(Colors.neutral00, 0.24) }]}>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{previewText}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          onPress={() => goToTeams(RouteNames.DetectionTeamsManual)}
          style={styles.footerGhost}
          title={t('detection.squad.actions.manual')}
          variant="Secondary"
        />
        <Button
          onPress={() => goToTeams(RouteNames.DetectionTeamsAuto)}
          style={styles.footerCta}
          title={t('detection.squad.actions.next')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    borderRadius: 8,
    borderWidth: 1.5,
    height: 24,
    width: 24,
  },
  checkInHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 16,
  },
  checkInRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    minHeight: 44,
    padding: 12,
  },
  checkInToggleAll: {
    justifyContent: 'center',
    minHeight: 44,
    paddingLeft: 12,
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    paddingVertical: 12,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCta: {
    flex: 1,
  },
  // Le pack donne 108 pt au CTA de contour de l'ecran 13.
  footerGhost: {
    width: 108,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerTexts: {
    flex: 1,
  },
  introCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  list: {
    flex: 1,
  },
  optionRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    minHeight: 44,
    padding: 12,
  },
  optionSubtitle: {
    marginTop: 2,
  },
  optionTexts: {
    flex: 1,
  },
  previewCard: {
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 16,
  },
  radioInner: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  radioOuter: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 8,
    marginTop: 16,
  },
  stepChip: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  switchCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
});

export default DetectionSquadSetup;
