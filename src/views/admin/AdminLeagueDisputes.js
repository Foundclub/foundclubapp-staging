import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetLeagueDisputes, useResolveLeagueDispute } from '@/services/admin/adminQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const normalizeId = (value) => (value === null || value === undefined ? '' : String(value));

const buildInitialResolution = (match) => {
  const fromA = match?.submitted_score_team_a || {};
  const fromB = match?.submitted_score_team_b || {};
  const scoreA = fromA?.score_a ?? fromB?.score_a ?? '';
  const scoreB = fromA?.score_b ?? fromB?.score_b ?? '';
  return {
    reason: 'Décision SuperAdmin',
    scoreA: scoreA === null || scoreA === undefined ? '' : String(scoreA),
    scoreB: scoreB === null || scoreB === undefined ? '' : String(scoreB),
  };
};

/**
 *
 */
function AdminLeagueDisputes() {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetLeagueDisputes();
  const resolveMutation = useResolveLeagueDispute();
  const [formByMatch, setFormByMatch] = useState({});

  const disputes = useMemo(() => data?.data || [], [data]);

  if (isLoading && !disputes.length) {
    return (
      <AdminStateView
        description={t(
          'adminLeagueDisputes.states.loadingDescription',
          'Nous chargeons les litiges League.',
        )}
        isLoading
        title={t('adminLeagueDisputes.states.loadingTitle', 'Chargement des litiges')}
      />
    );
  }

  if (error && !disputes.length) {
    return (
      <AdminStateView
        actionLabel={t('adminLeagueDisputes.states.retry', 'Réessayer')}
        description={getErrorMessage(error, 'generic') || t(
          'adminLeagueDisputes.states.errorDescription',
          'Impossible de charger les litiges League.',
        )}
        onAction={refetch}
        title={t('adminLeagueDisputes.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  const getForm = (match) => {
    const key = normalizeId(match?.documentId || match?.id);
    if (!key) return buildInitialResolution(match);
    return formByMatch[key] || buildInitialResolution(match);
  };

  const updateForm = (match, patch) => {
    const key = normalizeId(match?.documentId || match?.id);
    if (!key) return;
    setFormByMatch((prev) => ({
      ...prev,
      [key]: {
        ...getForm(match),
        ...patch,
      },
    }));
  };

  const resolveDispute = async (match) => {
    const form = getForm(match);
    const scoreA = Number.parseInt(form.scoreA, 10);
    const scoreB = Number.parseInt(form.scoreB, 10);
    if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      Alert.alert(
        t('adminLeagueDisputes.errorTitle', 'Erreur'),
        t('adminLeagueDisputes.invalidScores', 'Les scores doivent être des entiers positifs.'),
      );
      return;
    }

    try {
      await resolveMutation.mutateAsync({
        matchId: match.documentId || match.id,
        reason: form.reason || 'Décision SuperAdmin',
        scoreA,
        scoreB,
      });
      Alert.alert(
        t('adminLeagueDisputes.successTitle', 'Succès'),
        t('adminLeagueDisputes.resolved', 'Litige résolu.'),
      );
      refetch();
    } catch (error) {
      Alert.alert(
        t('adminLeagueDisputes.errorTitle', 'Erreur'),
        getErrorMessage(error, 'generic') || t(
          'adminLeagueDisputes.resolveError',
          'Impossible de resoudre le litige.',
        ),
      );
    }
  };

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingVertical[24], { paddingBottom: 120 }]}>
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Spaces.marginBottom[16]]}>
          <View>
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>
              {t('adminLeagueDisputes.title', 'Litiges League')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {disputes.length}
              {' '}
              {t('adminLeagueDisputes.count', 'match(es) en litige')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
              {t('adminLeagueDisputes.refresh', 'Rafraîchir')}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
        <LeagueCard>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {t('adminLeagueDisputes.loading', 'Chargement...')}
          </Text>
        </LeagueCard>
        )}

        {!isLoading && disputes.length === 0 && (
        <LeagueCard>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {t('adminLeagueDisputes.empty', 'Aucun litige actif.')}
          </Text>
        </LeagueCard>
        )}

        {disputes.map((match) => {
          const form = getForm(match);
          const subA = match?.submitted_score_team_a || {};
          const subB = match?.submitted_score_team_b || {};
          return (
            <LeagueCard key={normalizeId(match.documentId || match.id)} style={{ marginBottom: 12 }}>
              <Text style={[Fonts.h4, { color: Colors.neutral00, marginBottom: 6 }]}>
                {match?.team_a?.name || 'Team A'}
                {' '}
                vs
                {match?.team_b?.name || 'Team B'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral400, marginBottom: 12 }]}>
                Match ID:
                {' '}
                {match.documentId || match.id}
              </Text>

              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('adminLeagueDisputes.submissionA', 'Soumission A:')}
                {' '}
                {subA?.score_a ?? '-'}
                {' '}
                -
                {subA?.score_b ?? '-'}
                {' '}
                {subA?.dispute ? t('adminLeagueDisputes.disputeTag', '(litige)') : ''}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 10 }]}>
                {t('adminLeagueDisputes.submissionB', 'Soumission B:')}
                {' '}
                {subB?.score_a ?? '-'}
                {' '}
                -
                {subB?.score_b ?? '-'}
                {' '}
                {subB?.dispute ? t('adminLeagueDisputes.disputeTag', '(litige)') : ''}
              </Text>

              <View style={[Alignments.row, { gap: 8, marginBottom: 8 }]}>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(value) => updateForm(match, { scoreA: value.replace(/[^\d]/g, '').slice(0, 2) })}
                  placeholder="Score A"
                  placeholderTextColor={Colors.neutral500}
                  style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: Colors.neutral700,
                      borderRadius: 10,
                      color: Colors.neutral00,
                      paddingHorizontal: 12,
                      height: 44,
                    }}
                  value={form.scoreA}
                />
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(value) => updateForm(match, { scoreB: value.replace(/[^\d]/g, '').slice(0, 2) })}
                  placeholder="Score B"
                  placeholderTextColor={Colors.neutral500}
                  style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: Colors.neutral700,
                      borderRadius: 10,
                      color: Colors.neutral00,
                      paddingHorizontal: 12,
                      height: 44,
                    }}
                  value={form.scoreB}
                />
              </View>

              <TextInput
                onChangeText={(value) => updateForm(match, { reason: value })}
                placeholder={t('adminLeagueDisputes.reasonPlaceholder', 'Raison de résolution')}
                placeholderTextColor={Colors.neutral500}
                style={{
                  borderWidth: 1,
                  borderColor: Colors.neutral700,
                  borderRadius: 10,
                  color: Colors.neutral00,
                  paddingHorizontal: 12,
                  height: 44,
                  marginBottom: 12,
                }}
                value={form.reason}
              />

              <Button
                disabled={resolveMutation.isPending}
                onPress={() => resolveDispute(match)}
                style={{ backgroundColor: Colors.primary500 }}
                title={resolveMutation.isPending ? t(
                  'adminLeagueDisputes.resolving',
                  'Résolution...',
                ) : t(
                  'adminLeagueDisputes.resolve',
                  'Résoudre ce litige',
                )}
                variant="Primary"
              />
            </LeagueCard>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminLeagueDisputes;
