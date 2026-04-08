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

  const inputStyle = [
    ApplicationStyle.card,
    Spaces.paddingHorizontal[16],
    Spaces.paddingVertical[14],
    Fonts.p2,
    {
      backgroundColor: 'rgba(1, 179, 244, 0.08)',
      borderColor: 'rgba(1, 179, 244, 0.26)',
      color: Colors.neutral00,
    },
  ];

  const sectionCardStyle = [
    ApplicationStyle.card,
    Spaces.padding[20],
    Spaces.gap[16],
    {
      backgroundColor: 'rgba(4, 31, 44, 0.82)',
      borderColor: 'rgba(1, 179, 244, 0.24)',
    },
  ];

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
    navigation.navigate(RouteNames.EventWizardVisibility);
  };

  const renderRegistrationModeCard = (mode, title, subtitle) => {
    const selected = registrationMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        onPress={() => setRegistrationMode(mode)}
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[8],
          {
            backgroundColor: selected ? 'rgba(1, 179, 244, 0.16)' : 'rgba(1, 179, 244, 0.08)',
            borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
          },
        ]}
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
                borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.42)',
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
        'Definis les regles d inscription, les effectifs et les options d equipe pour ton tournoi.',
      )}
      title={t('eventWizard.steps.tournament.title', 'Parametres du tournoi')}
    >
      <View style={[Spaces.gap[20]]}>
        <View style={sectionCardStyle}>
          <View style={[Spaces.gap[6]]}>
            <Text style={[Fonts.h4, Fonts.neutral00]}>Cadre du tournoi</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Ces regles pilotent les equipes ephemeres et les inscriptions sur ce tournoi uniquement.
            </Text>
          </View>

          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>Nombre max d equipes</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setMaxTeamsText}
              placeholder="Ex. 16"
              placeholderTextColor={Colors.neutral500}
              style={inputStyle}
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
                style={inputStyle}
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
                style={inputStyle}
                value={maxRosterText}
              />
            </View>
          </View>

          {isRosterRangeInvalid ? (
            <Text style={[Fonts.p3, Fonts.error500]}>
              L effectif minimum ne peut pas depasser l effectif maximum.
            </Text>
          ) : null}
        </View>

        <View style={sectionCardStyle}>
          <View style={[Spaces.gap[6]]}>
            <Text style={[Fonts.h4, Fonts.neutral00]}>Equipes et eligibility</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Choisis si les joueurs peuvent creer une equipe ephemere et si le melange entre clubs est autorise.
            </Text>
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Autoriser les equipes ephemeres</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Les joueurs peuvent creer leur propre equipe pour ce tournoi.
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
                Ouvre la composition des equipes de tournoi a des profils externes.
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

        <View style={sectionCardStyle}>
          <View style={[Spaces.gap[6]]}>
            <Text style={[Fonts.h4, Fonts.neutral00]}>Validation des equipes</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Decide si les equipes inscrites sont acceptees automatiquement ou validées par l organisateur.
            </Text>
          </View>

          <View style={[Spaces.gap[12]]}>
            {renderRegistrationModeCard(
              'manual',
              'Validation manuelle',
              'Le dirigeant accepte ou refuse chaque equipe inscrite avant son entree dans le tournoi.',
            )}
            {renderRegistrationModeCard(
              'auto',
              'Validation automatique',
              'Les equipes autorisees sont inscrites directement sans file de validation.',
            )}
          </View>
        </View>

        <View style={sectionCardStyle}>
          <View style={[Spaces.gap[6]]}>
            <Text style={[Fonts.h4, Fonts.neutral00]}>Regles du tournoi</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Ajoute les consignes a afficher sur la fiche tournoi: tenue, format, conditions d inscription ou arbitraire.
            </Text>
          </View>

          <TextInput
            multiline
            numberOfLines={5}
            onChangeText={setRulesText}
            placeholder="Ex. 5 contre 5, un joueur actif par tournoi, tenue claire obligatoire..."
            placeholderTextColor={Colors.neutral500}
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Fonts.p2,
              {
                backgroundColor: 'rgba(1, 179, 244, 0.08)',
                borderColor: 'rgba(1, 179, 244, 0.26)',
                color: Colors.neutral00,
                minHeight: 140,
                textAlignVertical: 'top',
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
