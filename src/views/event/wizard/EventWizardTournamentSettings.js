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
  getEventWizardStepCount,
  getEventWizardTournamentSettingsStepIndex,
} from './eventWizardDetectionUtils';

const parseOptionalInteger = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardTournamentSettings({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });

  const [maxTeamsText, setMaxTeamsText] = useState(
    state.tournamentMaxTeams === null || state.tournamentMaxTeams === undefined
      ? ''
      : String(state.tournamentMaxTeams),
  );
  const [minRosterText, setMinRosterText] = useState(
    state.tournamentMinRosterSize === null || state.tournamentMinRosterSize === undefined
      ? ''
      : String(state.tournamentMinRosterSize),
  );
  const [maxRosterText, setMaxRosterText] = useState(
    state.tournamentMaxRosterSize === null || state.tournamentMaxRosterSize === undefined
      ? ''
      : String(state.tournamentMaxRosterSize),
  );
  const [allowCustomTeams, setAllowCustomTeams] = useState(
    state.tournamentAllowCustomTeams !== false,
  );
  const [allowCrossClubPlayers, setAllowCrossClubPlayers] = useState(
    state.tournamentAllowCrossClubPlayers === true,
  );
  const [registrationMode, setRegistrationMode] = useState(
    state.tournamentRegistrationMode || 'manual',
  );
  const [rulesText, setRulesText] = useState(state.tournamentRulesText || '');

  const maxTeams = useMemo(() => parseOptionalInteger(maxTeamsText), [maxTeamsText]);
  const minRosterSize = useMemo(() => parseOptionalInteger(minRosterText), [minRosterText]);
  const maxRosterSize = useMemo(() => parseOptionalInteger(maxRosterText), [maxRosterText]);

  const isRosterRangeInvalid = Boolean(
    minRosterSize
    && maxRosterSize
    && minRosterSize > maxRosterSize,
  );

  const handleNext = () => {
    dispatch({
      payload: {
        tournamentAllowCrossClubPlayers: allowCrossClubPlayers,
        tournamentAllowCustomTeams: allowCustomTeams,
        tournamentMaxRosterSize: maxRosterSize,
        tournamentMaxTeams: maxTeams,
        tournamentMinRosterSize: minRosterSize,
        tournamentRegistrationMode: registrationMode,
        tournamentRulesText: rulesText.trim(),
        validationMode: registrationMode,
      },
      type: 'SET_TOURNAMENT_SETTINGS',
    });
    navigation.navigate(RouteNames.EventWizardTournamentStructure);
  };

  const renderRegistrationModeCard = (mode, title, subtitle) => {
    const selected = registrationMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        onPress={() => setRegistrationMode(mode)}
        style={tournamentDs.getSelectionCardStyle(selected)}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <Text style={[Fonts.p2Bold, selected ? Fonts.primary100 : Fonts.neutral00]}>{title}</Text>
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
            <Text style={[Fonts.p4Bold, selected ? Fonts.neutral900 : Fonts.primary500]}>
              {selected ? 'OK' : ''}
            </Text>
          </View>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{subtitle}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <WizardStepLayout
      isNextDisabled={isRosterRangeInvalid}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardTournamentSettingsStepIndex(state)}
      subtitle={t(
        'eventWizard.steps.tournament.subtitle',
        'Définis les règles d inscription, les effectifs et les options d équipe pour ton tournoi.',
      )}
      title={t('eventWizard.steps.tournament.title', 'Paramètres du tournoi')}
    >
      <View style={tournamentDs.styles.sectionStack}>
        <View style={tournamentDs.styles.wizardSectionCard}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Cadre du tournoi</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Ces règles pilotent les équipes éphémères et les inscriptions sur ce tournoi uniquement.
            </Text>
          </View>

          <View style={Spaces.gap[8]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>Nombre max d équipes</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setMaxTeamsText}
              placeholder="Ex. 16"
              placeholderTextColor={Colors.neutral500}
              style={tournamentDs.styles.input}
              value={maxTeamsText}
            />
          </View>

          <View style={[Alignments.row, Spaces.gap[12]]}>
            <View style={[Spaces.gap[8], { flex: 1 }]}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>Effectif min</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setMinRosterText}
                placeholder="Ex. 5"
                placeholderTextColor={Colors.neutral500}
                style={tournamentDs.styles.input}
                value={minRosterText}
              />
            </View>

            <View style={[Spaces.gap[8], { flex: 1 }]}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>Effectif max</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setMaxRosterText}
                placeholder="Ex. 8"
                placeholderTextColor={Colors.neutral500}
                style={tournamentDs.styles.input}
                value={maxRosterText}
              />
            </View>
          </View>

          {isRosterRangeInvalid ? (
            <Text style={[Fonts.p3, Fonts.error500]}>
              L effectif minimum ne peut pas dépasser l effectif maximum.
            </Text>
          ) : null}
        </View>

        <View style={tournamentDs.styles.wizardSectionCard}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Équipes et éligibilité</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Choisis si les joueurs peuvent créer une équipe éphémère et si le melange entre clubs est autorise.
            </Text>
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Autoriser les équipes éphémères</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Les joueurs peuvent créer leur propre équipe pour ce tournoi.
              </Text>
            </View>
            <Switch
              onValueChange={setAllowCustomTeams}
              thumbColor={Colors.neutral00}
              trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
              value={allowCustomTeams}
            />
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Autoriser les joueurs d autres clubs</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Ouvre la composition des équipes de tournoi a des profils externes.
              </Text>
            </View>
            <Switch
              onValueChange={setAllowCrossClubPlayers}
              thumbColor={Colors.neutral00}
              trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
              value={allowCrossClubPlayers}
            />
          </View>
        </View>

        <View style={tournamentDs.styles.wizardSectionCard}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Validation des équipes</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Décide si les équipes inscrites sont acceptées automatiquement ou validées par l organisateur.
            </Text>
          </View>

          <View style={Spaces.gap[12]}>
            {renderRegistrationModeCard(
              'manual',
              'Validation manuelle',
              'Le dirigeant accepte ou refuse chaque équipe inscrite avant son entrée dans le tournoi.',
            )}
            {renderRegistrationModeCard(
              'auto',
              'Validation automatique',
              'Les équipes autorisées sont inscrites directement sans file de validation.',
            )}
          </View>
        </View>

        <View style={tournamentDs.styles.wizardSectionCard}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Règles du tournoi</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Ajoute les consignes a afficher sur la fiche tournoi: tenue, format, conditions d inscription ou arbitrage.
            </Text>
          </View>

          <TextInput
            multiline
            numberOfLines={5}
            onChangeText={setRulesText}
            placeholder="Ex. 5 contre 5, un joueur actif par tournoi, tenue claire obligatoire..."
            placeholderTextColor={Colors.neutral500}
            style={[
              ...tournamentDs.styles.multilineInput,
              {
                minHeight: 144,
              },
            ]}
            value={rulesText}
          />
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardTournamentSettings;
