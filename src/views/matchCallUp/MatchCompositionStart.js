/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { getCompositionPlayerInitials } from '@/utils/compositionPlayer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeamDefaultComposition } from '@/services/team/teamQueries';

import { getTacticalFieldAspectRatio } from '@/utils/tacticalField';

import {
  buildStartFromOptions,
  getDefaultStartFromKey,
  START_FROM_EMPTY,
  START_FROM_LAST_MATCH,
} from './matchCompositionUtils';

/**
 * D79 — ECRAN 4 du pack composition : « Partir de… ».
 *
 * Le dernier temps avant le terrain. Le coach a convoque (ecrans 1 a 3), il
 * choisit maintenant ce qui est DEJA pose quand le terrain s'ouvre : rien, sa
 * compo type, ou le dernier match.
 *
 * 🔒 La regle du pack qui commande cet ecran : une option sans source ne
 * s'affiche JAMAIS comme choisissable a vide. `buildStartFromOptions` decide de
 * la disponibilite ET de la raison, pour que la rangee grisee et son explication
 * ne puissent pas se contredire.
 *
 * ⚠️ MESURE (2026-08-12) : « Dernier match » n'a de source que si le serveur l'a
 * vraiment renvoyee. Sa cascade (`getBootstrapComposition`) n'en rend qu'UNE :
 * brouillon, puis compo type, puis derniere publiee. Une equipe qui a une compo
 * type ne verra donc jamais « Dernier match » proposee — c'est une limite du
 * contrat serveur, pas un oubli d'ecran.
 */

/** @type {any[]} */
const EMPTY_LIST = Object.freeze([]);

/** Diametre du jeton de l'apercu. Le terrain fait 268 pt : plus gros deborde. */
const PREVIEW_TOKEN = 22;

function MatchCompositionStart() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // 🧨 Fige : `route.params || {}` fabrique un objet NEUF a chaque rendu. Les
  // listes par defaut sont gelees au niveau module pour la meme raison — c'est
  // ce defaut exact qui avait produit 402 rendus et gele le terrain (D42).
  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    selectedPlayers = EMPTY_LIST,
    sport = 'football',
    teamComposition = null,
    teamId,
    teamName = '',
  } = params;

  const { data: defaultCompositionPayload } = useGetTeamDefaultComposition(teamId || '', {
    enabled: Boolean(teamId),
  });

  const options = useMemo(() => buildStartFromOptions({
    bootstrap: teamComposition?.bootstrap,
    defaultComposition: defaultCompositionPayload,
    players: selectedPlayers,
    sport,
  }), [defaultCompositionPayload, selectedPlayers, sport, teamComposition?.bootstrap]);

  const [pickedKey, setPickedKey] = useState(null);
  const [magnetOverride, setMagnetOverride] = useState(null);

  const activeKey = pickedKey || getDefaultStartFromKey(options);
  const activeOption = options.find((option) => option.key === activeKey) || options[0];
  const startsFromFormation = activeKey !== START_FROM_EMPTY;

  // 🚦 L'aimantation n'est ACTIVABLE que si on part d'une formation : sur terrain
  // vide il n'y a aucun poste ou coller. Elle suit donc le choix, sauf si le
  // coach l'a lui-meme touchee.
  const magnetEnabled = startsFromFormation && magnetOverride !== false;

  const previewPlayers = useMemo(() => {
    const byId = new Map((Array.isArray(selectedPlayers) ? selectedPlayers : EMPTY_LIST)
      .map((/** @type {any} */ player) => [String(player?.documentId || player?.id || ''), player]));
    return (activeOption?.placements || EMPTY_LIST)
      .map((/** @type {any} */ placement) => ({
        placement,
        player: byId.get(String(placement?.playerId || '')),
      }))
      .filter((/** @type {any} */ entry) => Boolean(entry.player));
  }, [activeOption?.placements, selectedPlayers]);

  const handlePick = useCallback((/** @type {string} */ key) => {
    setPickedKey(key);
    // Repartir d'un terrain vide eteint l'aimantation ; repartir d'une formation
    // la rallume. Un choix precedent du coach ne doit pas survivre a un
    // changement qui le rend absurde.
    setMagnetOverride(null);
  }, []);

  const handleOpenField = useCallback(() => {
    // @ts-ignore — `navigate` est bien la sur un ecran de pile.
    navigation.navigate(RouteNames.MatchCompositionBoard, {
      ...params,
      magnetEnabled,
      startFrom: activeKey,
      startPlacements: activeOption?.placements || EMPTY_LIST,
    });
  }, [activeKey, activeOption?.placements, magnetEnabled, navigation, params]);

  const subtitle = [
    t('matchComposition.start.eventLabel'),
    teamName,
    t('matchComposition.start.calledUpCount', { count: selectedPlayers.length }),
  ].filter(Boolean).join(' · ');

  // Le pack ecrit « La compo de samedi dernier ». La date vient du serveur, qui
  // joint l'evenement a sa reprise ; sans elle on dit « du dernier match »,
  // jamais une date inventee.
  const optionSubtitle = (/** @type {any} */ option) => {
    if (option.key === START_FROM_LAST_MATCH && option.detail) {
      const parsed = new Date(option.detail);
      if (!Number.isNaN(parsed.getTime())) {
        return t('matchComposition.start.options.last_match.subtitleDated', {
          date: format(parsed, 'EEEE d MMMM', { locale: fr }),
        });
      }
    }
    return t(`matchComposition.start.options.${option.key}.subtitle`, { teamName });
  };

  const renderOption = (/** @type {any} */ option) => {
    const isActive = option.key === activeKey;
    const isDisabled = !option.available;

    return (
      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityState={{ disabled: isDisabled, selected: isActive }}
        activeOpacity={0.8}
        disabled={isDisabled}
        key={option.key}
        onPress={() => handlePick(option.key)}
        style={[
          styles.optionRow,
          {
            backgroundColor: isActive
              ? withAlpha(Colors.primary500, 0.1)
              : withAlpha(Colors.neutral00, 0.035),
            borderColor: isActive
              ? withAlpha(Colors.primary500, 0.45)
              : withAlpha(Colors.neutral00, 0.09),
            opacity: isDisabled ? 0.45 : 1,
          },
        ]}
      >
        <View style={styles.optionTexts}>
          {/* Le pack ecrit « Compo type · 4-3-3 » : le schema est une donnee, on
              ne l'affiche que si le pack enregistre le porte vraiment. */}
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {[t(`matchComposition.start.options.${option.key}.title`), option.detail]
              .filter(Boolean).join(' · ')}
          </Text>
          <Text style={[Fonts.p3, styles.optionSubtitle, { color: Colors.neutral300 }]}>
            {isDisabled
              ? t(`matchComposition.start.unavailable.${option.unavailableReason}`)
              : optionSubtitle(option)}
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

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('matchComposition.start.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>{subtitle}</Text>
        </View>
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {t('matchComposition.start.progress', { current: 2, total: 2 })}
        </Text>
      </View>

      {/* Barre de progression 2/2 : convoquer est fait, placer commence. */}
      <View
        accessibilityLabel={t('matchComposition.start.progress', { current: 2, total: 2 })}
        accessibilityRole="progressbar"
        style={styles.progressRow}
      >
        <View style={[styles.progressSegment, { backgroundColor: Colors.primary500 }]} />
        <View style={[styles.progressSegment, { backgroundColor: Colors.primary500 }]} />
      </View>

      {/* R07 point 7 — `styles.list` (flex: 1) BORNE la zone qui defile. C'est
          EXACTEMENT le correctif de D84 sur les ecrans 2 et 3 du meme pack :
          sans lui, React Native mesure un ScrollView a la hauteur de ses
          enfants (son `flexShrink` vaut 0 par defaut), et le contenu POUSSE la
          barre du bas hors de l'ecran au lieu de defiler dessous.
          ⚠️ D84 avait CONTROLE cet ecran-ci et l'avait laisse intact, sur une
          mesure de 494 pt pour 797 disponibles. La mesure etait juste pour le
          sport mesure — mais l'apercu du terrain porte
          `aspectRatio: 1 / getTacticalFieldAspectRatio(sport)` : sa hauteur
          DEPEND du sport et de la largeur de l'ecran. Le contenu de cet ecran
          n'est donc pas d'une hauteur fixe, et c'est ce qui a rattrape Adel
          (« G.20 non pas bon », le bouton « Ouvrir le terrain » colle au bord).
          La reserve basse du pied, elle, etait DEJA la : ce n'est pas elle qui
          manquait, c'est le conteneur qui debordait. */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {options.map(renderOption)}

        <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
          {t('matchComposition.start.preview').toUpperCase()}
        </Text>

        <View style={styles.previewWrapper}>
          <RenderedTacticalField
            sport={sport}
            style={[styles.previewField, { aspectRatio: 1 / getTacticalFieldAspectRatio(sport) }]}
          >
            {previewPlayers.map((/** @type {any} */ { placement, player }) => (
              <View
                key={placement.playerId}
                style={[
                  styles.previewToken,
                  {
                    backgroundColor: withAlpha(Colors.primary500, 0.85),
                    borderColor: Colors.primary100,
                    left: `${placement.positionX}%`,
                    top: `${placement.positionY}%`,
                  },
                ]}
              >
                <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                  {getCompositionPlayerInitials(player)}
                </Text>
              </View>
            ))}
          </RenderedTacticalField>
          {previewPlayers.length === 0 ? (
            <Text style={[Fonts.p3, styles.previewEmpty, { color: Colors.neutral300 }]}>
              {t('matchComposition.start.previewEmpty')}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.magnetCard,
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderColor: withAlpha(Colors.neutral00, 0.1),
              opacity: startsFromFormation ? 1 : 0.55,
            },
          ]}
        >
          <View style={styles.magnetTexts}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {t('matchComposition.start.magnet.title')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {startsFromFormation
                ? t('matchComposition.start.magnet.subtitle')
                : t('matchComposition.start.magnet.disabled')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('matchComposition.start.magnet.title')}
            disabled={!startsFromFormation}
            onValueChange={setMagnetOverride}
            thumbColor={Colors.neutral00}
            trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
            value={magnetEnabled}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          onPress={handleOpenField}
          style={styles.footerCta}
          title={t('matchComposition.start.actions.openField')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCta: {
    flex: 1,
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
  // R07 — meme nom et meme valeur que dans `MatchCallUpSelection` et
  // `MatchCallUpManualPlayer` (D84) : un seul idiome pour tout le pack.
  list: {
    flex: 1,
  },
  magnetCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 16,
  },
  magnetTexts: {
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
  previewEmpty: {
    paddingTop: 12,
    textAlign: 'center',
  },
  previewField: {
    alignSelf: 'center',
    borderRadius: 16,
    height: 268,
  },
  previewToken: {
    alignItems: 'center',
    borderRadius: PREVIEW_TOKEN / 2,
    borderWidth: 1.5,
    height: PREVIEW_TOKEN,
    justifyContent: 'center',
    marginLeft: -(PREVIEW_TOKEN / 2),
    marginTop: -(PREVIEW_TOKEN / 2),
    position: 'absolute',
    width: PREVIEW_TOKEN,
  },
  previewWrapper: {
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  progressSegment: {
    borderRadius: 2,
    flex: 1,
    height: 4,
  },
  radioInner: {
    borderRadius: 6,
    height: 11,
    width: 11,
  },
  radioOuter: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  screen: {
    paddingHorizontal: 0,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
});

export default MatchCompositionStart;
