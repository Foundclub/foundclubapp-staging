import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { formatDateTimeToSend } from '@/domains/event/eventUseCases';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Tag from '@/components/atoms/tag/Tag';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetEvent } from '@/services/event/eventQueries';
import { useGetFacilities } from '@/services/facility/facilityQueries';
import { useGetTournamentMatch } from '@/services/tournamentCompetition/tournamentCompetitionQueries';
import {
  reportTournamentMatchScore,
  scheduleTournamentMatch,
  validateTournamentMatchScore,
} from '@/services/tournamentCompetition/tournamentCompetitionService';

import { createTournamentDesignSystem } from './tournamentDesignSystem';
import { getTournamentMatchStatusMeta, normalizeTournamentText } from './tournamentUtils';

const formatDateValue = (value) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch {
    return '';
  }
};

const formatTimeValue = (value) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'HH:mm');
  } catch {
    return '';
  }
};

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function TournamentMatchDetails({ navigation, route }) {
  const routeEventId = route?.params?.eventId || '';
  const matchId = route?.params?.matchId || '';
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
    data: match,
    error,
    isLoading,
    refetch,
  } = useGetTournamentMatch(matchId);

  const eventId = routeEventId || match?.event?.documentId || '';
  const { data: event } = useGetEvent(eventId, { enabled: Boolean(eventId) });
  const canManageMatch = Boolean(canManageEvent(event));
  const clubId = event?.club?.documentId || event?.team?.club?.documentId || '';
  const { data: facilitiesResponse } = useGetFacilities(clubId, { enabled: Boolean(clubId) });
  const facilities = Array.isArray(facilitiesResponse?.data) ? facilitiesResponse.data : [];

  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [scoreAText, setScoreAText] = useState('');
  const [scoreBText, setScoreBText] = useState('');
  const [winnerTeamId, setWinnerTeamId] = useState('');
  const [notesText, setNotesText] = useState('');

  useEffect(() => {
    if (!match) return;
    setScheduledDate(formatDateValue(match?.scheduledAt));
    setStartTime(formatTimeValue(match?.scheduledAt));
    setEndTime(formatTimeValue(match?.endAt));
    setSelectedFacilityId(match?.facility?.documentId || '');
    setScoreAText(Number.isFinite(Number(match?.scoreA)) ? String(match.scoreA) : '');
    setScoreBText(Number.isFinite(Number(match?.scoreB)) ? String(match.scoreB) : '');
    setWinnerTeamId(match?.winner?.documentId || '');
    setNotesText(match?.notes || '');
  }, [match]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
      queryClient.invalidateQueries({ queryKey: ['tournament-dashboard', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['tournament-match', matchId] }),
    ]);
  };

  const scheduleMutation = useMutation({
    mutationFn: (payload) => scheduleTournamentMatch(matchId, payload),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de programmer ce match.');
    },
    onSuccess: invalidate,
  });

  const reportScoreMutation = useMutation({
    mutationFn: (payload) => reportTournamentMatchScore(matchId, payload),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d enregistrer ce score.');
    },
    onSuccess: invalidate,
  });

  const validateScoreMutation = useMutation({
    mutationFn: () => validateTournamentMatchScore(matchId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de valider ce score.');
    },
    onSuccess: invalidate,
  });

  const scoreA = Number.parseInt(scoreAText, 10);
  const scoreB = Number.parseInt(scoreBText, 10);
  const scoresAreValid = Number.isFinite(scoreA) && Number.isFinite(scoreB) && scoreA >= 0 && scoreB >= 0;
  const isKnockoutLike = ['knockout', 'placement'].includes(normalizeTournamentText(match?.phase?.type));
  const scoresNeedWinner = scoresAreValid && scoreA === scoreB && isKnockoutLike;
  const canSubmitScore = scoresAreValid && (!scoresNeedWinner || Boolean(winnerTeamId));
  const matchStatusMeta = getTournamentMatchStatusMeta(match?.status, Colors);
  const currentFacilityName = match?.facility?.name || facilities.find((facility) => facility?.documentId === selectedFacilityId)?.name || 'Aucune installation';

  const handleSchedule = () => {
    const scheduledAt = formatDateTimeToSend(scheduledDate, startTime);
    const endAt = formatDateTimeToSend(scheduledDate, endTime);

    if (!scheduledAt || !endAt) {
      Alert.alert('Creneau incomplet', 'Selectionnez une date, une heure de debut et une heure de fin valides.');
      return;
    }

    scheduleMutation.mutate({
      endAt,
      facilityId: selectedFacilityId || null,
      scheduledAt,
    });
  };

  const handleReportScore = (options = {}) => {
    if (!canSubmitScore && options.status !== 'forfeit') {
      Alert.alert('Score incomplet', 'Renseignez deux scores valides. Pour un match nul en phase finale, indiquez aussi le vainqueur.');
      return;
    }

    reportScoreMutation.mutate({
      notes: notesText.trim(),
      resultMeta: options.resultMeta,
      scoreA,
      scoreB,
      status: options.status,
      winnerTeamId: options.winnerTeamId || winnerTeamId || undefined,
    });
  };

  const renderFacilityChoice = (facility) => {
    const selected = selectedFacilityId === facility?.documentId;
    return (
      <TouchableOpacity
        key={facility?.documentId}
        onPress={() => setSelectedFacilityId(selected ? '' : facility?.documentId || '')}
        style={[
          ...tournamentDs.styles.compactPanelCard,
          {
            backgroundColor: selected ? tournamentDs.colors.fieldSurfaceSelected : tournamentDs.colors.subtleSurface,
            borderColor: selected ? Colors.primary500 : tournamentDs.colors.borderSoft,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, selected ? Fonts.primary100 : Fonts.neutral100]}>{facility?.name || 'Installation'}</Text>
        <Text style={[Fonts.p4, Fonts.neutral200]}>{facility?.address || 'Adresse indisponible'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[24], Spaces.paddingBottom[12]]}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
      </View>
      <WithDataWrapper data={match} error={error} isLoading={isLoading} onRetry={refetch}>
        <ScrollView contentContainerStyle={tournamentDs.styles.screenContent}>
          <View style={tournamentDs.styles.screenIntro}>
            <Text style={[Fonts.h2, Fonts.neutral00]}>{match?.roundLabel || 'Match tournoi'}</Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {`${match?.teamA?.name || 'Equipe A'} vs ${match?.teamB?.name || 'Equipe B'}`}
            </Text>
          </View>

          <View style={tournamentDs.styles.panelCard}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>{match?.group?.label ? `Poule ${match.group.label}` : match?.phase?.label || 'Phase finale'}</Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{`${match?.teamA?.name || 'Equipe A'} - ${match?.teamB?.name || 'Equipe B'}`}</Text>
              </View>
              <Tag
                style={tournamentDs.getToneTagStyle(matchStatusMeta.tone)}
                text={matchStatusMeta.label}
                textColor="neutral00"
                textStyle={{ color: matchStatusMeta.tone }}
              />
            </View>

            <Text style={[Fonts.h3Bold, Fonts.primary500]}>
              {scoresAreValid ? `${scoreA} - ${scoreB}` : '--'}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {scheduledDate && startTime ? `${scheduledDate} - ${startTime}${endTime ? ` / ${endTime}` : ''}` : 'Horaire a definir'}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>{`Installation: ${currentFacilityName}`}</Text>
            {match?.winner?.name ? (
              <Text style={[Fonts.p3, Fonts.success500]}>{`Vainqueur: ${match.winner.name}`}</Text>
            ) : null}
          </View>

          {canManageMatch ? (
            <View style={tournamentDs.styles.panelCard}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Programmer le match</Text>
              <DatePickerInput label="Date" onChange={setScheduledDate} value={scheduledDate} />
              <View style={[Alignments.row, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <TimePickerInput label="Heure de debut" onChange={setStartTime} value={startTime} />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePickerInput label="Heure de fin" onChange={setEndTime} value={endTime} />
                </View>
              </View>

              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>Installation</Text>
                {facilities.length === 0 ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>Aucune installation disponible pour ce club.</Text>
                ) : (
                  <View style={Spaces.gap[8]}>
                    {facilities.map((facility) => renderFacilityChoice(facility))}
                  </View>
                )}
              </View>

              <Button
                isLoading={scheduleMutation.isPending}
                onPress={handleSchedule}
                title="Enregistrer le creneau"
                variant="Primary"
              />
            </View>
          ) : null}

          {canManageMatch ? (
            <View style={tournamentDs.styles.panelCard}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Saisie du score</Text>
              <View style={[Alignments.row, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{match?.teamA?.name || 'Equipe A'}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setScoreAText}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral500}
                    style={tournamentDs.styles.input}
                    value={scoreAText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{match?.teamB?.name || 'Equipe B'}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setScoreBText}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral500}
                    style={tournamentDs.styles.input}
                    value={scoreBText}
                  />
                </View>
              </View>

              {scoresNeedWinner ? (
                <View style={Spaces.gap[8]}>
                  <Text style={[Fonts.p3Bold, Fonts.warning500]}>Choisir le vainqueur</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    En phase finale, un match nul doit tout de meme designer une equipe qualifiee.
                  </Text>
                  <View style={[Alignments.row, Spaces.gap[12]]}>
                    <Button
                      onPress={() => setWinnerTeamId(match?.teamA?.documentId || '')}
                      size="sm"
                      style={{ flex: 1 }}
                      title={match?.teamA?.name || 'Equipe A'}
                      variant={winnerTeamId === match?.teamA?.documentId ? 'Primary' : 'Secondary'}
                    />
                    <Button
                      onPress={() => setWinnerTeamId(match?.teamB?.documentId || '')}
                      size="sm"
                      style={{ flex: 1 }}
                      title={match?.teamB?.name || 'Equipe B'}
                      variant={winnerTeamId === match?.teamB?.documentId ? 'Primary' : 'Secondary'}
                    />
                  </View>
                </View>
              ) : null}

              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>Notes</Text>
                <TextInput
                  multiline
                  numberOfLines={4}
                  onChangeText={setNotesText}
                  placeholder="Commentaires arbitre, contexte du match, forfait..."
                  placeholderTextColor={Colors.neutral500}
                  style={[
                    ...tournamentDs.styles.multilineInput,
                    {
                      minHeight: 120,
                    },
                  ]}
                  value={notesText}
                />
              </View>

              <Button
                disabled={!canSubmitScore}
                isLoading={reportScoreMutation.isPending}
                onPress={() => handleReportScore()}
                title="Enregistrer le score"
                variant="Primary"
              />

              <View style={[Alignments.row, Spaces.gap[12]]}>
                <Button
                  isLoading={reportScoreMutation.isPending}
                  onPress={() => handleReportScore({
                    resultMeta: { forfeitTeamId: match?.teamB?.documentId || null },
                    status: 'forfeit',
                    winnerTeamId: match?.teamA?.documentId || undefined,
                  })}
                  size="sm"
                  style={{ flex: 1 }}
                  title={`Forfait ${match?.teamB?.name || 'Equipe B'}`}
                  variant="Secondary"
                />
                <Button
                  isLoading={reportScoreMutation.isPending}
                  onPress={() => handleReportScore({
                    resultMeta: { forfeitTeamId: match?.teamA?.documentId || null },
                    status: 'forfeit',
                    winnerTeamId: match?.teamB?.documentId || undefined,
                  })}
                  size="sm"
                  style={{ flex: 1 }}
                  title={`Forfait ${match?.teamA?.name || 'Equipe A'}`}
                  variant="Secondary"
                />
              </View>

              {['forfeit', 'played_pending_validation'].includes(normalizeTournamentText(match?.status)) ? (
                <Button
                  isLoading={validateScoreMutation.isPending}
                  onPress={() => validateScoreMutation.mutate()}
                  title="Valider le score"
                  variant="Secondary"
                />
              ) : null}
            </View>
          ) : null}

          <Button onPress={() => navigation.goBack()} title="Retour au tournoi" variant="Secondary" />
        </ScrollView>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TournamentMatchDetails;
