import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  TextInput,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AdminStateView from '@/views/admin/components/AdminStateView';
import LeagueCard from '@/views/admin/components/SuperAdminLeagueCard';
import SuperAdminLeagueLayout from '@/views/admin/components/SuperAdminLeagueLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  useApplySuperadminLeagueDisputeAction,
  useGetSuperadminLeagueDisputes,
} from '@/services/admin/superadminLeagueQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const toFormKey = (match) => String(match?.documentId || match?.id || '');

const buildInitialForm = (match) => ({
  reason: match?.reason || 'Décision SuperAdmin',
  scoreA: String(match?.proposedScoreA ?? match?.contestedScoreA ?? match?.teamA?.score ?? ''),
  scoreB: String(match?.proposedScoreB ?? match?.contestedScoreB ?? match?.teamB?.score ?? ''),
});

function FilterField({ onChangeText, placeholder, value }) {
  const { Colors, Fonts } = useTheme();

  return (
    <TextInput
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.neutral500}
      style={{
        backgroundColor: Colors.primary900,
        borderColor: Colors.primary700,
        borderRadius: 14,
        borderWidth: 1,
        color: Colors.neutral00,
        minHeight: 46,
        paddingHorizontal: 14,
        ...Fonts.p2,
      }}
      value={value}
    />
  );
}

function SuperAdminLeagueDisputes() {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState('open');
  const [sport, setSport] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [formsByMatch, setFormsByMatch] = useState({});
  const params = useMemo(() => ({
    from: from || undefined,
    page: 1,
    pageSize: 50,
    sport: sport || undefined,
    status: status || undefined,
    to: to || undefined,
  }), [from, sport, status, to]);
  const disputesQuery = useGetSuperadminLeagueDisputes(params);
  const applyActionMutation = useApplySuperadminLeagueDisputeAction();
  const disputes = disputesQuery.data?.data || [];

  if (disputesQuery.isLoading && !disputes.length) {
    return (
      <AdminStateView
        description={t(
          'superAdminLeagueDisputes.states.loadingDescription',
          'Nous chargeons les litiges League à traiter.',
        )}
        isLoading
        title={t('superAdminLeagueDisputes.states.loadingTitle', 'Chargement des litiges')}
      />
    );
  }

  if (disputesQuery.error && !disputes.length) {
    return (
      <AdminStateView
        actionLabel={t('superAdminLeagueDisputes.states.retry', 'Réessayer')}
        description={getErrorMessage(disputesQuery.error, 'generic') || t(
          'superAdminLeagueDisputes.states.errorDescription',
          'Impossible de charger les litiges League.',
        )}
        onAction={disputesQuery.refetch}
        title={t('superAdminLeagueDisputes.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  const getForm = (match) => formsByMatch[toFormKey(match)] || buildInitialForm(match);

  const updateForm = (match, patch) => {
    const formKey = toFormKey(match);
    if (!formKey) return;
    setFormsByMatch((currentValue) => ({
      ...currentValue,
      [formKey]: {
        ...getForm(match),
        ...patch,
      },
    }));
  };

  const submitAction = async (match, action) => {
    const form = getForm(match);

    if (action !== 'cancel_result') {
      const scoreA = Number.parseInt(form.scoreA, 10);
      const scoreB = Number.parseInt(form.scoreB, 10);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
        Alert.alert(
          t('superAdminLeagueDisputes.alerts.invalidScoresTitle', 'Scores invalides'),
          t(
            'superAdminLeagueDisputes.alerts.invalidScoresBody',
            'Renseigne deux scores entiers avant de traiter ce litige.',
          ),
        );
        return;
      }
    }

    try {
      await applyActionMutation.mutateAsync({
        documentId: match?.documentId || match?.id,
        payload: {
          action,
          reason: form.reason,
          scoreA: Number.parseInt(form.scoreA, 10),
          scoreB: Number.parseInt(form.scoreB, 10),
        },
      });
      Alert.alert(
        t('superAdminLeagueDisputes.alerts.updatedTitle', 'Litige mis à jour'),
        t(
          'superAdminLeagueDisputes.alerts.updatedBody',
          "L'action Super Admin a bien été enregistrée.",
        ),
      );
    } catch (error) {
      Alert.alert(
        t('superAdminLeagueDisputes.alerts.errorTitle', 'Traitement impossible'),
        getErrorMessage(error, 'generic') || t(
          'superAdminLeagueDisputes.alerts.errorBody',
          'Impossible de traiter ce litige.',
        ),
      );
    }
  };

  return (
    <SuperAdminLeagueLayout
      activeRouteNames={[RouteNames.SuperAdminLeagueDisputes]}
      description={t(
        'superAdminLeagueDisputes.description',
        'Analyse les litiges League, compare les scores proposés, puis valide, corrige ou annule le résultat.', // eslint-disable-line max-len
      )}
      title={t('superAdminLeagueDisputes.title', 'Gestion des litiges')}
    >
      <LeagueCard style={{ marginBottom: 0 }}>
        <View style={[Spaces.gap[10]]}>
          <FilterField
            onChangeText={setStatus}
            placeholder={t(
              'superAdminLeagueDisputes.filters.status',
              'Statut (open, resolved, all)',
            )}
            value={status}
          />
          <FilterField onChangeText={setSport} placeholder="Sport" value={sport} />
          <FilterField
            onChangeText={setFrom}
            placeholder={t('superAdminLeagueDisputes.filters.dateMin', 'Date min (2026-04-24)')}
            value={from}
          />
          <FilterField
            onChangeText={setTo}
            placeholder={t('superAdminLeagueDisputes.filters.dateMax', 'Date max (2026-04-30)')}
            value={to}
          />
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {disputesQuery.data?.meta?.pagination?.total || disputes.length}
            {' '}
            {t('superAdminLeagueDisputes.found', 'litiges trouvés')}
          </Text>
        </View>
      </LeagueCard>

      <View style={[Spaces.gap[12]]}>
        {disputes.length === 0 ? (
          <LeagueCard style={{ marginBottom: 0 }}>
            <Text style={[Fonts.p2, Fonts.neutral300]}>
              {t('superAdminLeagueDisputes.empty', 'Aucun litige League pour ces filtres.')}
            </Text>
          </LeagueCard>
        ) : (
          disputes.map((match) => {
            const form = getForm(match);
            return (
              <LeagueCard key={match?.documentId || match?.id} style={{ marginBottom: 0 }}>
                <View style={[Spaces.gap[10]]}>
                  <Text style={[Fonts.h4, Fonts.neutral00]}>
                    {match?.teamA?.name || 'Squad A'}
                    {' '}
                    vs
                    {' '}
                    {match?.teamB?.name || 'Squad B'}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    {t('superAdminLeagueDisputes.fields.status', 'Statut :')}
                    {' '}
                    {match?.disputeState || 'open'}
                    {' · '}
                    {t('superAdminLeagueDisputes.fields.sport', 'Sport :')}
                    {' '}
                    {match?.sport || t('superAdminLeagueDisputes.unknown', 'Inconnu')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {t('superAdminLeagueDisputes.fields.proposedScore', 'Score proposé :')}
                    {' '}
                    {match?.proposedScoreA ?? '-'}
                    {' '}
                    -
                    {' '}
                    {match?.proposedScoreB ?? '-'}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {t('superAdminLeagueDisputes.fields.disputedScore', 'Score contesté :')}
                    {' '}
                    {match?.contestedScoreA ?? '-'}
                    {' '}
                    -
                    {' '}
                    {match?.contestedScoreB ?? '-'}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {t('superAdminLeagueDisputes.fields.reason', 'Raison :')}
                    {' '}
                    {match?.reason || t('superAdminLeagueDisputes.noComment', 'Aucun commentaire')}
                  </Text>

                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={(value) => updateForm(match, { scoreA: value.replace(/[^\d]/g, '').slice(0, 3) })}
                    placeholder="Score A"
                    placeholderTextColor={Colors.neutral500}
                    style={{
                      backgroundColor: Colors.primary900,
                      borderColor: Colors.primary700,
                      borderRadius: 14,
                      borderWidth: 1,
                      color: Colors.neutral00,
                      minHeight: 46,
                      paddingHorizontal: 14,
                    }}
                    value={form.scoreA}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={(value) => updateForm(match, { scoreB: value.replace(/[^\d]/g, '').slice(0, 3) })}
                    placeholder="Score B"
                    placeholderTextColor={Colors.neutral500}
                    style={{
                      backgroundColor: Colors.primary900,
                      borderColor: Colors.primary700,
                      borderRadius: 14,
                      borderWidth: 1,
                      color: Colors.neutral00,
                      minHeight: 46,
                      paddingHorizontal: 14,
                    }}
                    value={form.scoreB}
                  />
                  <TextInput
                    onChangeText={(value) => updateForm(match, { reason: value })}
                    placeholder={t('superAdminLeagueDisputes.adminComment', 'Commentaire admin')}
                    placeholderTextColor={Colors.neutral500}
                    style={{
                      backgroundColor: Colors.primary900,
                      borderColor: Colors.primary700,
                      borderRadius: 14,
                      borderWidth: 1,
                      color: Colors.neutral00,
                      minHeight: 46,
                      paddingHorizontal: 14,
                    }}
                    value={form.reason}
                  />

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    <Button
                      disabled={applyActionMutation.isPending}
                      onPress={() => submitAction(match, 'validate_proposed')}
                      size="sm"
                      title={t('superAdminLeagueDisputes.actions.validate', 'Valider le score')}
                      variant="Primary"
                    />
                    <Button
                      disabled={applyActionMutation.isPending}
                      onPress={() => submitAction(match, 'correct_score')}
                      size="sm"
                      title={t('superAdminLeagueDisputes.actions.correct', 'Corriger le score')}
                      variant="Secondary"
                    />
                    <Button
                      disabled={applyActionMutation.isPending}
                      onPress={() => submitAction(match, 'cancel_result')}
                      size="sm"
                      style={{ borderColor: Colors.error500 }}
                      textStyle={{ color: Colors.error500 }}
                      title={t('superAdminLeagueDisputes.actions.cancel', 'Annuler le résultat')}
                      variant="Secondary"
                    />
                  </View>
                </View>
              </LeagueCard>
            );
          })
        )}
      </View>
    </SuperAdminLeagueLayout>
  );
}

export default SuperAdminLeagueDisputes;
