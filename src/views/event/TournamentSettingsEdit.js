import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetEvent } from '@/services/event/eventQueries';
import { updateEvent } from '@/services/event/eventService';

import { createTournamentDesignSystem } from './tournamentDesignSystem';
import { getTournamentRosterSummary } from './tournamentUtils';

const parseOptionalInteger = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const STRUCTURE_OPTIONS = [
  { label: 'Poules uniquement', value: 'groups_only' },
  { label: 'Poules + finale', value: 'groups_to_knockout' },
  { label: 'Phase finale directe', value: 'knockout_only' },
  { label: 'Championnat', value: 'round_robin' },
];

const SEEDING_OPTIONS = [
  { label: 'Aleatoire', value: 'random' },
  { label: 'Serpentin', value: 'snake' },
  { label: 'Ordre manuel', value: 'manual' },
];

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function TournamentSettingsEdit({ navigation, route }) {
  const { eventId } = route?.params || {};
  const queryClient = useQueryClient();
  const { canManageEvent } = useAuth();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });

  const {
    data: event,
    error,
    isLoading,
    refetch,
  } = useGetEvent(eventId || '');

  const [maxTeamsText, setMaxTeamsText] = useState('');
  const [minRosterText, setMinRosterText] = useState('');
  const [maxRosterText, setMaxRosterText] = useState('');
  const [allowCustomTeams, setAllowCustomTeams] = useState(true);
  const [allowCrossClubPlayers, setAllowCrossClubPlayers] = useState(false);
  const [formatMode, setFormatMode] = useState('groups_only');
  const [groupCountText, setGroupCountText] = useState('2');
  const [qualifiedPerGroupText, setQualifiedPerGroupText] = useState('2');
  const [bestThirdPlacesText, setBestThirdPlacesText] = useState('0');
  const [knockoutSizeText, setKnockoutSizeText] = useState('8');
  const [seedingMode, setSeedingMode] = useState('random');
  const [matchGenerationMode, setMatchGenerationMode] = useState('auto');
  const [pointsWinText, setPointsWinText] = useState('3');
  const [pointsDrawText, setPointsDrawText] = useState('1');
  const [pointsLossText, setPointsLossText] = useState('0');
  const [pointsForfeitText, setPointsForfeitText] = useState('0');
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
  const [registrationMode, setRegistrationMode] = useState('manual');
  const [rulesText, setRulesText] = useState('');

  useEffect(() => {
    if (!event) return;
    setMaxTeamsText(String(event?.tournamentConfig?.maxTeams || ''));
    setMinRosterText(String(event?.tournamentConfig?.minRosterSize || ''));
    setMaxRosterText(String(event?.tournamentConfig?.maxRosterSize || ''));
    setAllowCustomTeams(event?.tournamentConfig?.allowCustomTeams !== false);
    setAllowCrossClubPlayers(event?.tournamentConfig?.allowCrossClubPlayers === true);
    setFormatMode(event?.tournamentConfig?.formatMode || 'groups_only');
    setGroupCountText(String(event?.tournamentConfig?.groupCount || 2));
    setQualifiedPerGroupText(String(event?.tournamentConfig?.qualifiedPerGroup || 2));
    setBestThirdPlacesText(String(event?.tournamentConfig?.bestThirdPlacesCount || 0));
    setKnockoutSizeText(String(event?.tournamentConfig?.knockoutSize || 8));
    setSeedingMode(event?.tournamentConfig?.seedingMode || 'random');
    setMatchGenerationMode(event?.tournamentConfig?.matchGenerationMode || 'auto');
    setPointsWinText(String(event?.tournamentConfig?.pointsWin ?? 3));
    setPointsDrawText(String(event?.tournamentConfig?.pointsDraw ?? 1));
    setPointsLossText(String(event?.tournamentConfig?.pointsLoss ?? 0));
    setPointsForfeitText(String(event?.tournamentConfig?.pointsForfeit ?? 0));
    setThirdPlaceMatch(event?.tournamentConfig?.thirdPlaceMatch === true);
    setRegistrationMode(event?.tournamentConfig?.registrationMode || event?.validationMode || 'manual');
    setRulesText(event?.tournamentConfig?.rulesText || '');
  }, [event]);

  const maxTeams = useMemo(() => parseOptionalInteger(maxTeamsText), [maxTeamsText]);
  const minRosterSize = useMemo(() => parseOptionalInteger(minRosterText), [minRosterText]);
  const maxRosterSize = useMemo(() => parseOptionalInteger(maxRosterText), [maxRosterText]);
  const groupCount = useMemo(() => parseOptionalInteger(groupCountText) || 1, [groupCountText]);
  const qualifiedPerGroup = useMemo(() => parseOptionalInteger(qualifiedPerGroupText) || 1, [qualifiedPerGroupText]);
  const bestThirdPlacesCount = useMemo(() => Number.parseInt(String(bestThirdPlacesText || '0'), 10) || 0, [bestThirdPlacesText]);
  const knockoutSize = useMemo(() => Number.parseInt(String(knockoutSizeText || '0'), 10) || 0, [knockoutSizeText]);
  const pointsWin = useMemo(() => Number.parseInt(String(pointsWinText || '3'), 10) || 3, [pointsWinText]);
  const pointsDraw = useMemo(() => Number.parseInt(String(pointsDrawText || '1'), 10) || 1, [pointsDrawText]);
  const pointsLoss = useMemo(() => Number.parseInt(String(pointsLossText || '0'), 10) || 0, [pointsLossText]);
  const pointsForfeit = useMemo(() => Number.parseInt(String(pointsForfeitText || '0'), 10) || 0, [pointsForfeitText]);
  const isRosterRangeInvalid = Boolean(minRosterSize && maxRosterSize && minRosterSize > maxRosterSize);
  const usesGroups = ['groups_only', 'groups_to_knockout', 'round_robin'].includes(formatMode);
  const usesKnockout = ['groups_to_knockout', 'knockout_only'].includes(formatMode);
  const isKnockoutSizeInvalid = usesKnockout && knockoutSize > 0 && ![16, 2, 32, 4, 8].includes(knockoutSize);
  const canManageTournament = Boolean(canManageEvent(event));
  let resolvedGroupCount = 0;
  if (formatMode === 'round_robin') {
    resolvedGroupCount = 1;
  } else if (usesGroups) {
    resolvedGroupCount = groupCount;
  }
  const draftTournamentConfig = useMemo(() => ({
    allowCrossClubPlayers,
    allowCustomTeams,
    bestThirdPlacesCount,
    formatMode,
    groupCount: resolvedGroupCount,
    knockoutSize: usesKnockout ? knockoutSize : 0,
    matchGenerationMode,
    maxRosterSize,
    maxTeams,
    minRosterSize,
    pointsDraw,
    pointsForfeit,
    pointsLoss,
    pointsWin,
    qualifiedPerGroup: usesGroups ? qualifiedPerGroup : 0,
    registrationMode,
    rulesText: String(rulesText || '').trim(),
    scorePolicy: 'organizer_only',
    seedingMode,
    thirdPlaceMatch: usesKnockout && thirdPlaceMatch,
  }), [
    allowCrossClubPlayers,
    allowCustomTeams,
    bestThirdPlacesCount,
    formatMode,
    knockoutSize,
    maxRosterSize,
    maxTeams,
    matchGenerationMode,
    minRosterSize,
    pointsDraw,
    pointsForfeit,
    pointsLoss,
    pointsWin,
    qualifiedPerGroup,
    resolvedGroupCount,
    registrationMode,
    rulesText,
    seedingMode,
    thirdPlaceMatch,
    usesGroups,
    usesKnockout,
  ]);
  const nonCompliantAcceptedTeams = useMemo(
    () => (Array.isArray(event?.tournamentTeams) ? event.tournamentTeams : []).filter((team) => {
      if (String(team?.status || '').toLowerCase() !== 'accepted') return false;
      const summary = getTournamentRosterSummary(team, draftTournamentConfig);
      return summary.hasWarning;
    }),
    [draftTournamentConfig, event?.tournamentTeams],
  );

  const updateMutation = useMutation({
    mutationFn: () => updateEvent({
      documentId: eventId,
      eventData: {
        tournamentConfig: draftTournamentConfig,
        validationMode: registrationMode,
      },
    }),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de mettre a jour les parametres du tournoi.');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      navigation.goBack();
    },
  });

  const inputStyle = tournamentDs.styles.input;

  const sectionCardStyle = tournamentDs.styles.wizardSectionCard;

  const renderSelectionCard = (option, selectedValue, onPress, description = null) => {
    const selected = selectedValue === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        onPress={() => onPress(option.value)}
        style={[
          ...tournamentDs.getSelectionCardStyle(selected),
        ]}
      >
        <Text style={[Fonts.p2Bold, selected ? Fonts.primary100 : Fonts.neutral00]}>{option.label}</Text>
        {description ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>{description}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderRegistrationModeCard = (mode, title, subtitle) => {
    const selected = registrationMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        onPress={() => setRegistrationMode(mode)}
        style={[
          ...tournamentDs.getSelectionCardStyle(selected),
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
    <ScreenContainer>
      <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[24], Spaces.paddingBottom[12]]}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
      </View>
      <WithDataWrapper data={event} error={error} isLoading={isLoading} onRetry={refetch}>
        <ScrollView contentContainerStyle={tournamentDs.styles.screenContent}>
          <View style={tournamentDs.styles.screenIntro}>
            <Text style={[Fonts.h2, Fonts.neutral00]}>Parametres du tournoi</Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              Ajuste les regles globales du tournoi sans toucher aux equipes permanentes du club.
            </Text>
          </View>

          {!canManageTournament ? (
            <View style={sectionCardStyle}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Acces reserve a l organisateur</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Seul le createur du tournoi peut modifier ces parametres globaux.
              </Text>
            </View>
          ) : null}

          {canManageTournament ? (
            <View style={sectionCardStyle}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Cadre du tournoi</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Le nombre d equipes et la fourchette d effectif s appliquent a toutes les equipes ephemeres de ce tournoi.
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
              {nonCompliantAcceptedTeams.length > 0 ? (
                <View
                  style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], {
                    backgroundColor: `${Colors.warning500}14`,
                    borderColor: `${Colors.warning500}38`,
                  }]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.warning500]}>Impact roster detecte</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>
                    {`${nonCompliantAcceptedTeams.length} equipe(s) deja acceptee(s) deviendront non conformes avec ces regles. Leur statut restera accepte, avec warning visible seulement.`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {canManageTournament ? (
            <View style={sectionCardStyle}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Structure sportive</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Ces reglages pilotent les poules, la phase finale et le calcul du classement. Apres modification, resynchronisez la competition depuis le cockpit organisateur.
                </Text>
              </View>

              <View style={[Spaces.gap[12]]}>
                {STRUCTURE_OPTIONS.map((option) => renderSelectionCard(option, formatMode, setFormatMode))}
              </View>

              {usesGroups ? (
                <View style={[Spaces.gap[12]]}>
                  {formatMode !== 'round_robin' ? (
                    <View style={[Spaces.gap[8]]}>
                      <Text style={[Fonts.p3Bold, Fonts.primary500]}>Nombre de poules</Text>
                      <TextInput
                        keyboardType="number-pad"
                        onChangeText={setGroupCountText}
                        placeholder="Ex. 4"
                        placeholderTextColor={Colors.neutral500}
                        style={inputStyle}
                        value={groupCountText}
                      />
                    </View>
                  ) : null}

                  <View style={[Alignments.row, Spaces.gap[12]]}>
                    <View style={[Spaces.gap[8], { flex: 1 }]}>
                      <Text style={[Fonts.p3Bold, Fonts.primary500]}>Qualifies par poule</Text>
                      <TextInput
                        keyboardType="number-pad"
                        onChangeText={setQualifiedPerGroupText}
                        placeholder="Ex. 2"
                        placeholderTextColor={Colors.neutral500}
                        style={inputStyle}
                        value={qualifiedPerGroupText}
                      />
                    </View>
                    {formatMode === 'groups_to_knockout' ? (
                      <View style={[Spaces.gap[8], { flex: 1 }]}>
                        <Text style={[Fonts.p3Bold, Fonts.primary500]}>Meilleurs 3es</Text>
                        <TextInput
                          keyboardType="number-pad"
                          onChangeText={setBestThirdPlacesText}
                          placeholder="0"
                          placeholderTextColor={Colors.neutral500}
                          style={inputStyle}
                          value={bestThirdPlacesText}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {usesKnockout ? (
                <View style={[Spaces.gap[12]]}>
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.primary500]}>Taille du bracket</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={setKnockoutSizeText}
                      placeholder="8"
                      placeholderTextColor={Colors.neutral500}
                      style={inputStyle}
                      value={knockoutSizeText}
                    />
                  </View>
                  {isKnockoutSizeInvalid ? (
                    <Text style={[Fonts.p3, Fonts.error500]}>
                      Utilisez une taille de bracket standard: 2, 4, 8, 16 ou 32.
                    </Text>
                  ) : null}

                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.primary500]}>Mode de tirage</Text>
                    <View style={[Spaces.gap[12]]}>
                      {SEEDING_OPTIONS.map((option) => renderSelectionCard(option, seedingMode, setSeedingMode))}
                    </View>
                  </View>

                  <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Match pour la 3e place</Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        Ajoute une petite finale quand la competition atteint les demi-finales.
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

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>Generation des matchs</Text>
                <View style={[Spaces.gap[12]]}>
                  {[
                    {
                      description: 'Le calendrier est genere automatiquement une fois les poules creees.',
                      label: 'Automatique',
                      value: 'auto',
                    },
                    {
                      description: 'L organisateur declenche lui-meme la generation du calendrier.',
                      label: 'Manuelle',
                      value: 'manual',
                    },
                  ].map((option) => renderSelectionCard(option, matchGenerationMode, setMatchGenerationMode, option.description))}
                </View>
              </View>

              <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
                <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>Victoire</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setPointsWinText}
                    placeholder="3"
                    placeholderTextColor={Colors.neutral500}
                    style={inputStyle}
                    value={pointsWinText}
                  />
                </View>
                <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>Nul</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setPointsDrawText}
                    placeholder="1"
                    placeholderTextColor={Colors.neutral500}
                    style={inputStyle}
                    value={pointsDrawText}
                  />
                </View>
                <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>Defaite</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setPointsLossText}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral500}
                    style={inputStyle}
                    value={pointsLossText}
                  />
                </View>
                <View style={[Spaces.gap[8], { flex: 1, minWidth: 130 }]}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>Forfait</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setPointsForfeitText}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral500}
                    style={inputStyle}
                    value={pointsForfeitText}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {canManageTournament ? (
            <View style={sectionCardStyle}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Equipes et eligibility</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Definis qui peut creer une equipe et si le melange de clubs est autorise.
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
                    Autorise les ajouts hors club organisateur dans les rosters tournoi.
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
          ) : null}

          {canManageTournament ? (
            <View style={sectionCardStyle}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Validation des equipes</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  En mode manuel, seul l organisateur valide les equipes inscrites.
                </Text>
              </View>

              <View style={[Spaces.gap[12]]}>
                {renderRegistrationModeCard(
                  'manual',
                  'Validation manuelle',
                  'Chaque equipe reste en attente tant que le dirigeant ne l a pas acceptee.',
                )}
                {renderRegistrationModeCard(
                  'auto',
                  'Validation automatique',
                  'Les equipes compatibles sont acceptees directement a l inscription.',
                )}
              </View>
            </View>
          ) : null}

          {canManageTournament ? (
            <View style={sectionCardStyle}>
              <View style={tournamentDs.styles.headerBlock}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Regles du tournoi</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Ce texte est affiche sur la fiche tournoi et sert de reference commune pour les equipes.
                </Text>
              </View>

              <TextInput
                multiline
                numberOfLines={5}
                onChangeText={setRulesText}
                placeholder="Ex. un joueur actif par tournoi, tenue claire obligatoire..."
                placeholderTextColor={Colors.neutral500}
                style={[
                  ...tournamentDs.styles.multilineInput,
                  {
                    minHeight: 140,
                  },
                ]}
                value={rulesText}
              />
            </View>
          ) : null}

          <View style={[Spaces.gap[12]]}>
            {canManageTournament ? (
              <Button
                disabled={isRosterRangeInvalid || isKnockoutSizeInvalid || updateMutation.isPending}
                isLoading={updateMutation.isPending}
                onPress={() => updateMutation.mutate()}
                title="Enregistrer"
                variant="Primary"
              />
            ) : null}
            <Button
              onPress={() => navigation.goBack()}
              title={canManageTournament ? 'Annuler' : 'Retour'}
              variant="Secondary"
            />
          </View>
        </ScrollView>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TournamentSettingsEdit;
