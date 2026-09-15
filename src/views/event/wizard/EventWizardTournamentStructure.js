import i18next from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { createTournamentDesignSystem } from '../tournamentDesignSystem';
import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardStepCount,
  getEventWizardTournamentStructureStepIndex,
} from './eventWizardDetectionUtils';

// I18N-2 : des GETTERS, pas des textes — lus à l import, avant l initialisation
// d i18next ; le libellé se traduit au moment où il s affiche.
const STRUCTURE_OPTIONS = [
  {
    get description() {
      return i18next.t(
        'eventWizardTournamentStructure.groupsOnlyDescription',
        'Des poules uniquement, sans tableau final.',
      );
    },
    get label() {
      return i18next.t('eventWizardTournamentStructure.groupsOnly', 'Poules uniquement');
    },
    value: 'groups_only',
  },
  {
    get description() {
      return i18next.t(
        'eventWizardTournamentStructure.groupsFinalDescription',
        'Des poules puis une phase finale automatique.',
      );
    },
    get label() {
      return i18next.t('eventWizardTournamentStructure.groupsFinal', 'Poules + finale');
    },
    value: 'groups_to_knockout',
  },
  {
    get description() {
      return i18next.t(
        'eventWizardTournamentStructure.straightKnockoutDescription',
        'Un tableau final direct a elimination simple.',
      );
    },
    get label() {
      return i18next.t('eventWizardTournamentStructure.straightKnockout', 'Phase finale directe');
    },
    value: 'knockout_only',
  },
  {
    get description() {
      return i18next.t(
        'eventWizardTournamentStructure.leagueDescription',
        'Un seul classement general, sans bracket.',
      );
    },
    get label() {
      return i18next.t('eventWizardTournamentStructure.league', 'Championnat');
    },
    value: 'round_robin',
  },
];

const SEEDING_OPTIONS = [
  {
    get label() {
      return i18next.t('eventWizardTournamentStructure.seedingRandom', 'Aleatoire');
    },
    value: 'random',
  },
  {
    get label() {
      return i18next.t('eventWizardTournamentStructure.seedingSnake', 'Serpentin');
    },
    value: 'snake',
  },
  {
    get label() {
      return i18next.t('eventWizardTournamentStructure.seedingManual', 'Ordre manuel');
    },
    value: 'manual',
  },
];

const GENERATION_OPTIONS = [
  {
    get description() {
      return i18next.t(
        'eventWizardTournamentStructure.generationAutomaticDescription',
        'Le calendrier est généré automatiquement des que les poules sont créées.',
      );
    },
    get label() {
      return i18next.t('eventWizardTournamentStructure.generationAutomatic', 'Automatique');
    },
    value: 'auto',
  },
  {
    get description() {
      return i18next.t(
        'eventWizardTournamentStructure.generationManualDescription',
        'L organisateur garde la main sur le declenchement des matchs.',
      );
    },
    get label() {
      return i18next.t('eventWizardTournamentStructure.generationManual', 'Manuelle');
    },
    value: 'manual',
  },
];

const parseOptionalInteger = (value, fallback = null) => {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardTournamentStructure({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { dispatch, state } = useEventWizard();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });

  const [formatMode, setFormatMode] = useState(state.tournamentFormatMode || 'groups_only');
  const [groupCountText, setGroupCountText] = useState(String(state.tournamentGroupCount || 2));
  const [qualifiedPerGroupText, setQualifiedPerGroupText] = useState(String(state.tournamentQualifiedPerGroup || 2));
  const [bestThirdPlacesText, setBestThirdPlacesText] = useState(String(state.tournamentBestThirdPlacesCount || 0));
  const [knockoutSizeText, setKnockoutSizeText] = useState(String(state.tournamentKnockoutSize || 8));
  const [seedingMode, setSeedingMode] = useState(state.tournamentSeedingMode || 'random');
  const [matchGenerationMode, setMatchGenerationMode] = useState(state.tournamentMatchGenerationMode || 'auto');
  const [pointsWinText, setPointsWinText] = useState(String(state.tournamentPointsWin ?? 3));
  const [pointsDrawText, setPointsDrawText] = useState(String(state.tournamentPointsDraw ?? 1));
  const [pointsLossText, setPointsLossText] = useState(String(state.tournamentPointsLoss ?? 0));
  const [pointsForfeitText, setPointsForfeitText] = useState(String(state.tournamentPointsForfeit ?? 0));
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(state.tournamentThirdPlaceMatch === true);

  const groupCount = useMemo(() => parseOptionalInteger(groupCountText, 1), [groupCountText]);
  const qualifiedPerGroup = useMemo(() => parseOptionalInteger(qualifiedPerGroupText, 1), [qualifiedPerGroupText]);
  const bestThirdPlacesCount = useMemo(() => parseOptionalInteger(bestThirdPlacesText, 0), [bestThirdPlacesText]);
  const knockoutSize = useMemo(() => parseOptionalInteger(knockoutSizeText, 0), [knockoutSizeText]);
  const pointsWin = useMemo(() => parseOptionalInteger(pointsWinText, 3), [pointsWinText]);
  const pointsDraw = useMemo(() => parseOptionalInteger(pointsDrawText, 1), [pointsDrawText]);
  const pointsLoss = useMemo(() => parseOptionalInteger(pointsLossText, 0), [pointsLossText]);
  const pointsForfeit = useMemo(() => parseOptionalInteger(pointsForfeitText, 0), [pointsForfeitText]);

  const usesGroups = formatMode === 'groups_only' || formatMode === 'groups_to_knockout' || formatMode === 'round_robin';
  const usesKnockout = formatMode === 'groups_to_knockout' || formatMode === 'knockout_only';
  const isInvalid = usesKnockout && knockoutSize > 0 && ![16, 2, 32, 4, 8].includes(knockoutSize);

  const handleNext = () => {
    dispatch({
      payload: {
        tournamentBestThirdPlacesCount: bestThirdPlacesCount,
        tournamentFormatMode: formatMode,
        tournamentGroupCount: usesGroups && formatMode !== 'round_robin' ? Math.max(1, groupCount) : 1,
        tournamentKnockoutSize: usesKnockout ? Math.max(2, knockoutSize || 2) : 0,
        tournamentMatchGenerationMode: matchGenerationMode,
        tournamentPointsDraw: pointsDraw,
        tournamentPointsForfeit: pointsForfeit,
        tournamentPointsLoss: pointsLoss,
        tournamentPointsWin: pointsWin,
        tournamentQualifiedPerGroup: usesKnockout || formatMode === 'groups_only' ? Math.max(1, qualifiedPerGroup) : 1,
        tournamentSeedingMode: seedingMode,
        tournamentThirdPlaceMatch: usesKnockout && thirdPlaceMatch,
      },
      type: 'SET_TOURNAMENT_STRUCTURE',
    });
    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardTournamentStructure, state),
      route?.params,
    ));
  };

  const renderChoiceCard = (option, selectedValue, onPress) => {
    const selected = selectedValue === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        onPress={() => onPress(option.value)}
        style={tournamentDs.getSelectionCardStyle(selected)}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <Text style={[Fonts.p2Bold, selected ? Fonts.primary100 : Fonts.neutral00]}>{option.label}</Text>
          <View
            style={[
              ApplicationStyle.card,
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: selected ? Colors.primary500 : 'transparent',
                borderColor: selected ? Colors.primary500 : tournamentDs.colors.borderStrong,
                borderRadius: 999,
                height: 22,
                width: 22,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, selected ? Fonts.neutral900 : Fonts.primary500]}>{selected ? 'OK' : ''}</Text>
          </View>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{option.description}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <WizardStepLayout
      isNextDisabled={isInvalid}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardTournamentStructureStepIndex(state)}
      subtitle={t(
        'eventWizardTournamentStructure.setTheTournamentSSports',
        'Définis la structure sportive du tournoi: poules, tableau final, génération des matchs et règles de classement.',
      )}
      title={t('eventWizardTournamentStructure.tournamentStructure', 'Structure du tournoi')}
    >
      <View style={tournamentDs.styles.sectionStack}>
        <View style={tournamentDs.styles.wizardSectionCard}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('eventWizardTournamentStructure.competitionFormat', 'Format de compétition')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'eventWizardTournamentStructure.chooseTheTournamentSMain',
                'Choisis le fonctionnement sportif principal du tournoi. Le cockpit organisateur pilotera ensuite le tirage, les matchs et les scores.',
              )}
            </Text>
          </View>
          <View style={Spaces.gap[12]}>
            {STRUCTURE_OPTIONS.map((option) => renderChoiceCard(option, formatMode, setFormatMode))}
          </View>
        </View>

        {usesGroups ? (
          <View style={tournamentDs.styles.wizardSectionCard}>
            <View style={tournamentDs.styles.headerBlock}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                {t(
                  'eventWizardTournamentStructure.groupsAndQualification',
                  'Poules et qualification',
                )}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('eventWizardTournamentStructure.setTheNumberOfGroups', 'Configure le nombre de poules et la facon dont les équipes passent au tableau final ou au classement.')}
              </Text>
            </View>
            {formatMode !== 'round_robin' ? (
              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {t('eventWizardTournamentStructure.numberOfGroups', 'Nombre de poules')}
                </Text>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={setGroupCountText}
                  placeholder="Ex. 4"
                  placeholderTextColor={Colors.neutral500}
                  style={tournamentDs.styles.input}
                  value={groupCountText}
                />
              </View>
            ) : null}
            <View style={[Alignments.row, Spaces.gap[12]]}>
              <View style={[Spaces.gap[8], { flex: 1 }]}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {t('eventWizardTournamentStructure.qualifiedPerGroup', 'Qualifiés par poule')}
                </Text>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={setQualifiedPerGroupText}
                  placeholder="Ex. 2"
                  placeholderTextColor={Colors.neutral500}
                  style={tournamentDs.styles.input}
                  value={qualifiedPerGroupText}
                />
              </View>
              {formatMode === 'groups_to_knockout' ? (
                <View style={[Spaces.gap[8], { flex: 1 }]}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('eventWizardTournamentStructure.best3rds', 'Meilleurs 3es')}
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setBestThirdPlacesText}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral500}
                    style={tournamentDs.styles.input}
                    value={bestThirdPlacesText}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {usesKnockout ? (
          <View style={tournamentDs.styles.wizardSectionCard}>
            <View style={tournamentDs.styles.headerBlock}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                {t('eventWizardTournamentStructure.knockoutBracket', 'Tableau final')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('eventWizardTournamentStructure.theKnockoutBracketWillBe', 'Le tableau final sera généré automatiquement depuis les équipes qualifiees ou directement depuis les équipes acceptées.')}
              </Text>
            </View>
            <View style={[Alignments.row, Spaces.gap[12]]}>
              <View style={[Spaces.gap[8], { flex: 1 }]}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {t('eventWizardTournamentStructure.bracketSize', 'Taille du bracket')}
                </Text>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={setKnockoutSizeText}
                  placeholder="8"
                  placeholderTextColor={Colors.neutral500}
                  style={tournamentDs.styles.input}
                  value={knockoutSizeText}
                />
              </View>
            </View>
            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('eventWizardTournamentStructure.drawMode', 'Mode de tirage')}
              </Text>
              <View style={Spaces.gap[12]}>
                {SEEDING_OPTIONS.map((option) => {
                  let description = t(
                    'eventWizardTournamentStructure.automaticShuffleOfTheAccepted',
                    'Melange automatique des équipes acceptées.',
                  );
                  if (option.value === 'manual') {
                    description = t(
                      'eventWizardTournamentStructure.theOrganiserKeepsTheSeed',
                      'L organisateur garde l ordre de seed pour le tirage.',
                    );
                  } else if (option.value === 'snake') {
                    description = t(
                      'eventWizardTournamentStructure.snakeDistributionAcrossTheGroups',
                      'Répartition serpent entre les poules puis le tableau.',
                    );
                  }

                  return renderChoiceCard({
                    ...option,
                    description,
                  }, seedingMode, setSeedingMode);
                })}
              </View>
            </View>
            {isInvalid ? (
              <Text style={[Fonts.p3, Fonts.error500]}>
                {t(
                  'eventWizardTournamentStructure.useAStandardBracketSize',
                  'Utilise une taille de bracket standard: 2, 4, 8, 16 ou 32.',
                )}
              </Text>
            ) : null}
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('eventWizardTournamentStructure.thirdPlaceMatch', 'Match pour la 3e place')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t(
                    'eventWizardTournamentStructure.addsASmallFinalWhen',
                    'Ajoute une petite finale quand le tableau atteint les demi-finales.',
                  )}
                </Text>
              </View>
              <Switch
                onValueChange={setThirdPlaceMatch}
                thumbColor={Colors.neutral00}
                trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
                value={thirdPlaceMatch}
              />
            </View>
          </View>
        ) : null}

        <View style={tournamentDs.styles.wizardSectionCard}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('eventWizardTournamentStructure.generationAndPoints', 'Génération et points')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('eventWizardTournamentStructure.setWhetherTheScheduleIs', 'Définis si le calendrier se génère automatiquement et comment le classement attribue les points.')}
            </Text>
          </View>
          <View style={Spaces.gap[12]}>
            {GENERATION_OPTIONS.map((option) => renderChoiceCard(option, matchGenerationMode, setMatchGenerationMode))}
          </View>
          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('eventWizardTournamentStructure.win', 'Victoire')}
              </Text>
              <TextInput keyboardType="number-pad" onChangeText={setPointsWinText} placeholder="3" placeholderTextColor={Colors.neutral500} style={tournamentDs.styles.input} value={pointsWinText} />
            </View>
            <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('eventWizardTournamentStructure.draw', 'Nul')}
              </Text>
              <TextInput keyboardType="number-pad" onChangeText={setPointsDrawText} placeholder="1" placeholderTextColor={Colors.neutral500} style={tournamentDs.styles.input} value={pointsDrawText} />
            </View>
            <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('eventWizardTournamentStructure.loss', 'Défaite')}
              </Text>
              <TextInput keyboardType="number-pad" onChangeText={setPointsLossText} placeholder="0" placeholderTextColor={Colors.neutral500} style={tournamentDs.styles.input} value={pointsLossText} />
            </View>
            <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('eventWizardTournamentStructure.forfeit', 'Forfait')}
              </Text>
              <TextInput keyboardType="number-pad" onChangeText={setPointsForfeitText} placeholder="0" placeholderTextColor={Colors.neutral500} style={tournamentDs.styles.input} value={pointsForfeitText} />
            </View>
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardTournamentStructure;
