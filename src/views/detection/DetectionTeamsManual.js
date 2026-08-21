/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BIB_COLORS,
  buildDetectionSplitPayload,
  buildDraftPayloadWithSplit,
  isTeamMember,
} from '@/domains/detection/detectionSplit';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTeamComposition } from '@/services/event/eventQueries';
import { saveEventCompositionDraft } from '@/services/event/eventService';

/**
 * C-D — ECRAN 14 du pack composition : « Equipes a la main ».
 *
 * Les 4 pastilles de chasuble, et l'affectation PAR APPUI — le pack le dit et le
 * justifie : sur 28 joueurs et 4 equipes, le tap bat le glisser-deposer.
 *
 * 🎽 LES COULEURS SONT UN ECART DECLARE. Le pack demande 4 teintes neuves, ecrites
 * en clair dans `docs/CD-detection-decisions.md` (decision 2) — et NON ici : la
 * porte `verify:theme-contract` compte les teintes ecrites en dur JUSQUE DANS LES
 * COMMENTAIRES (mesure du 2026-08-15 : ce fichier a fait passer le compteur de 12
 * a 13 sans une seule couleur dans le code). Les y recopier couterait une entree
 * dans `scripts/theme-hex-allowlist.json` — une allowlist, donc la liste noire R4,
 * donc un GO nominatif d'Adel. On mappe donc sur les jetons existants : le bleu du
 * pack est EXACTEMENT `Colors.primary500`, les 3 autres sont voisins.
 * ponytail: plafond = la teinte exacte du pack ; voie de sortie = un GO date qui
 * ouvre l'allowlist, et ces 4 lignes deviennent les hex du pack.
 *
 * ⚠️ Le mot « banc » est interdit en detection (regle du pack §6) : un joueur sans
 * chasuble est NON AFFECTE.
 */

/** @type {any[]} */
const EMPTY_LIST = [];

const getPlayerId = (/** @type {any} */ player) => String(player?.documentId || player?.id || '');

const getPlayerName = (/** @type {any} */ player) => [player?.firstname, player?.lastname]
  .filter(Boolean).join(' ').trim();

// Chasuble -> jeton du theme. Voir l'ecart declare en tete de fichier.
// (Commentaire de ligne et non bloc `/** */` : un bloc declencherait
// `jsdoc/require-param-type`, or les types sont deja poses en ligne.)
const getBibToken = (/** @type {any} */ Colors, /** @type {string} */ bibColor) => ({
  bleu: Colors.primary500,
  jaune: Colors.gold500,
  rouge: Colors.error500,
  vert: Colors.success500,
}[bibColor] || Colors.primary500);

function DetectionTeamsManual() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    checkInFirst = false,
    eventId,
    memberMode,
    players: fallbackPlayers = EMPTY_LIST,
    presentIds = null,
    teamId,
  } = params;

  const { data: teamComposition } = useGetEventTeamComposition(eventId, teamId, {
    enabled: Boolean(eventId),
  });

  const allPlayers = useMemo(() => {
    const fromServer = teamComposition?.eligiblePlayers;
    return Array.isArray(fromServer) && fromServer.length ? fromServer : fallbackPlayers;
  }, [fallbackPlayers, teamComposition?.eligiblePlayers]);

  // Le pointage de l'ecran 13 commande VRAIMENT qui apparait ici : « Detection ·
  // 28 presents », pas 34 inscrits. Un joueur non pointe n'est pas affectable.
  const players = useMemo(() => {
    if (!checkInFirst || !Array.isArray(presentIds)) return allPlayers;
    const present = new Set(presentIds);
    return allPlayers.filter((/** @type {any} */ player) => present.has(getPlayerId(player)));
  }, [allPlayers, checkInFirst, presentIds]);

  const [activeBib, setActiveBib] = useState(BIB_COLORS[0]);
  // { [playerId]: bibColor } — une seule chasuble par joueur, par construction :
  // c'est ce qui rend le doublon impossible sur cet ecran.
  const [assignments, setAssignments] = useState(() => {
    const stored = teamComposition?.detectionSplit?.teams;
    if (!Array.isArray(stored)) return {};
    return stored.reduce((accumulator, team) => {
      if (!team?.bibColor) return accumulator;
      (Array.isArray(team.players) ? team.players : []).forEach((/** @type {any} */ playerId) => {
        accumulator[String(playerId)] = team.bibColor;
      });
      return accumulator;
    }, /** @type {Record<string, string>} */ ({}));
  });
  const [isBusy, setIsBusy] = useState(false);

  const toggleAssignment = useCallback((/** @type {string} */ playerId) => {
    setAssignments((/** @type {Record<string, string>} */ current) => {
      const next = { ...current };
      if (next[playerId] === activeBib) delete next[playerId];
      else next[playerId] = activeBib;
      return next;
    });
  }, [activeBib]);

  const countByBib = useMemo(() => BIB_COLORS.reduce((accumulator, bibColor) => ({
    ...accumulator,
    [bibColor]: Object.values(assignments).filter((entry) => entry === bibColor).length,
  }), /** @type {Record<string, number>} */ ({})), [assignments]);

  // Le bandeau du bas nomme les joueurs QUI RESTENT, il ne se contente pas de les
  // compter : un titre « NON AFFECTES · 6 » sans les 6 noms oblige le coach a
  // relire toute la liste pour savoir lesquels.
  const unassignedPlayers = useMemo(
    () => players.filter((/** @type {any} */ player) => !assignments[getPlayerId(player)]),
    [assignments, players],
  );
  const remaining = unassignedPlayers.length;

  const handleSave = useCallback(async () => {
    if (!eventId || !teamId || isBusy) return;
    setIsBusy(true);
    try {
      // Les equipes se construisent depuis les affectations de l'ecran, jamais
      // par un recalcul : le coach a decide, on range sa decision.
      const teams = BIB_COLORS.map((bibColor) => ({
        bibColor,
        playerIds: players
          .filter((/** @type {any} */ player) => assignments[getPlayerId(player)] === bibColor)
          .map(getPlayerId),
      }));

      const detectionSplit = buildDetectionSplitPayload({
        checkInFirst,
        memberMode,
        players,
        presentIds: presentIds || players.map(getPlayerId),
        rounds: teamComposition?.detectionSplit?.rounds || EMPTY_LIST,
        teamCount: BIB_COLORS.length,
        teamNames: BIB_COLORS.map((bibColor) => t(`detection.teams.manual.bibs.${bibColor}`)),
        teams,
      });

      await saveEventCompositionDraft(eventId, {
        draft: buildDraftPayloadWithSplit(teamComposition?.draft, detectionSplit),
        teamId,
      });
      Alert.alert(
        t('detection.alerts.saved.title'),
        t('detection.alerts.saved.message'),
        // AD01 (🚪) — LA SUITE NATURELLE, ENFIN BRANCHEE. Ce bouton s'appelle
        // `detection.teams.manual.actions.field` — « le terrain ». Il promettait
        // un ecran qui n'arrivait jamais : `DetectionTeamsBoard` (850 lignes)
        // n'avait AUCUN appelant. Seule la DESTINATION change ici.
        [{
          onPress: () => navigation.navigate(RouteNames.DetectionTeamsBoard, params),
          text: t('detection.alerts.ok'),
        }],
      );
    } catch (error) {
      Alert.alert(
        t('detection.alerts.error.title'),
        t('detection.alerts.error.save'),
      );
    } finally {
      setIsBusy(false);
    }
  }, [
    assignments, checkInFirst, eventId, isBusy, memberMode, navigation, params, players,
    presentIds, t, teamComposition?.detectionSplit?.rounds, teamComposition?.draft, teamId,
  ]);

  const renderBibPill = (/** @type {string} */ bibColor) => {
    const isActive = bibColor === activeBib;
    const token = getBibToken(Colors, bibColor);

    return (
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        activeOpacity={0.8}
        key={bibColor}
        onPress={() => setActiveBib(bibColor)}
        style={[
          styles.bibPill,
          {
            backgroundColor: isActive ? token : 'transparent',
            borderColor: token,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: isActive ? Colors.primary900 : token }]}>
          {`${t(`detection.teams.manual.bibs.${bibColor}`)} ${countByBib[bibColor]}`}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPlayerRow = (/** @type {any} */ player) => {
    const playerId = getPlayerId(player);
    const assignedBib = assignments[playerId] || null;
    const isOnActiveTeam = assignedBib === activeBib;
    const isOnOtherTeam = Boolean(assignedBib) && !isOnActiveTeam;
    const token = assignedBib ? getBibToken(Colors, assignedBib) : null;

    return (
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isOnActiveTeam }}
        activeOpacity={0.8}
        key={playerId}
        onPress={() => toggleAssignment(playerId)}
        style={[
          styles.playerRow,
          {
            backgroundColor: isOnActiveTeam
              ? withAlpha(Colors.primary500, 0.1)
              : withAlpha(Colors.neutral00, 0.035),
            borderColor: isOnActiveTeam
              ? withAlpha(Colors.primary500, 0.45)
              : withAlpha(Colors.neutral00, 0.09),
            // Le pack desature les joueurs deja pris par une AUTRE equipe : ils
            // restent lisibles et cliquables, ils ne sont juste pas ici.
            opacity: isOnOtherTeam ? 0.62 : 1,
          },
        ]}
      >
        <View style={styles.playerTexts}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{getPlayerName(player)}</Text>
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {isTeamMember(player)
              ? t('detection.squad.meta.member', { teamName: params?.teamName || '' })
              : t('detection.squad.meta.requestedPosition', {
                position: player?.appliedPosition || t('detection.squad.meta.positionToDefine'),
              })}
          </Text>
        </View>

        {isOnOtherTeam && token ? (
          <View
            style={[styles.bibTag, { backgroundColor: withAlpha(token, 0.22), borderColor: token }]}
          >
            <Text style={[Fonts.p4Bold, { color: token }]}>
              {t(`detection.teams.manual.bibs.${assignedBib}`)}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: isOnActiveTeam ? Colors.primary500 : 'transparent',
                borderColor: isOnActiveTeam ? Colors.primary500 : withAlpha(Colors.neutral00, 0.24),
              },
            ]}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('detection.teams.manual.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('detection.teams.manual.subtitle', { count: players.length })}
          </Text>
        </View>
        {/* Fond neutre — meme motif que l'ecran 13, voir le commentaire la-bas. */}
        <View style={[styles.stepChip, { backgroundColor: withAlpha(Colors.neutral00, 0.08) }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
            {t('detection.teams.manual.remaining', { count: remaining })}
          </Text>
        </View>
      </View>

      <View style={styles.bibRow}>{BIB_COLORS.map(renderBibPill)}</View>

      <Text style={[Fonts.p3, styles.hint, { color: Colors.neutral300 }]}>
        {t('detection.teams.manual.hint', { bib: t(`detection.teams.manual.bibs.${activeBib}`) })}
      </Text>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {players.length ? players.map(renderPlayerRow) : (
          <Text style={[Fonts.p3, styles.emptyText, { color: Colors.neutral300 }]}>
            {t('detection.teams.manual.empty')}
          </Text>
        )}

        {remaining ? (
          <>
            <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
              {t('detection.teams.manual.unassigned', { count: remaining }).toUpperCase()}
            </Text>
            <View style={styles.unassignedRow}>
              {unassignedPlayers.map((/** @type {any} */ player) => (
                <View
                  key={getPlayerId(player)}
                  style={[
                    styles.unassignedChip,
                    {
                      backgroundColor: withAlpha(Colors.neutral00, 0.035),
                      borderColor: withAlpha(Colors.neutral00, 0.24),
                    },
                  ]}
                >
                  <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                    {getPlayerName(player)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          // @ts-ignore — `navigate` est bien la sur un ecran de pile.
          onPress={() => navigation.navigate(RouteNames.DetectionTeamsAuto, params)}
          style={styles.footerGhost}
          title={t('detection.teams.manual.actions.auto')}
          variant="Secondary"
        />
        <Button
          isLoading={isBusy}
          onPress={handleSave}
          style={styles.footerCta}
          title={t('detection.teams.manual.actions.field')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bibPill: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  bibRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  bibTag: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  checkbox: {
    borderRadius: 8,
    borderWidth: 1.5,
    height: 24,
    width: 24,
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
  // Le pack donne 120 pt au CTA de contour de l'ecran 14.
  footerGhost: {
    width: 120,
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
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  list: {
    flex: 1,
  },
  playerRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    minHeight: 44,
    padding: 12,
  },
  playerTexts: {
    flex: 1,
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
  unassignedChip: {
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unassignedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

export default DetectionTeamsManual;
