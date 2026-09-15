import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  TextInput,
  View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AdminStateView from '@/views/admin/components/AdminStateView';
import LeagueCard from '@/views/admin/components/SuperAdminLeagueCard';
import SuperAdminLeagueLayout from '@/views/admin/components/SuperAdminLeagueLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetSuperadminLeaguePlatformSettings,
  useUpdateSuperadminLeaguePlatformSettings,
} from '@/services/admin/superadminLeagueQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const formatInputDate = (value) => {
  if (!value) return '';
  const parsedDate = new Date(String(value));
  if (Number.isNaN(parsedDate.getTime())) return '';
  return parsedDate.toISOString().slice(0, 16);
};

const parseInputDate = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) return 'invalid';
  return parsedDate.toISOString();
};

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.tone
 */
function StatusBadge({ label, tone = 'primary' }) {
  const { Colors, Fonts } = useTheme();
  const colorMap = {
    critical: Colors.error500,
    neutral: Colors.neutral300,
    primary: Colors.primary500,
    success: Colors.success500,
    warning: Colors.warning500,
  };
  const color = colorMap[tone] || Colors.primary500;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: `${color}1A`,
        borderColor: `${color}66`,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={[Fonts.p3Bold, { color }]}>{label}</Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.onChangeText
 * @param root0.value
 */
function DateField({ label, onChangeText, value }) {
  const { Colors, Fonts } = useTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
      <TextInput
        onChangeText={onChangeText}
        placeholder="2026-05-12T18:00"
        placeholderTextColor={Colors.neutral500}
        style={{
          backgroundColor: Colors.primary900,
          borderColor: Colors.primary700,
          borderRadius: 14,
          borderWidth: 1,
          color: Colors.neutral00,
          minHeight: 48,
          paddingHorizontal: 14,
        }}
        value={value}
      />
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.configuredOpenValue
 * @param root0.currentOpenValue
 * @param root0.onClose
 * @param root0.onOpen
 */
function ToggleRow({
  configuredOpenValue,
  currentOpenValue,
  onClose,
  onOpen,
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button
        onPress={onOpen}
        size="sm"
        title={t('superAdminLeagueSettings.open', 'Ouvrir')}
        variant={currentOpenValue ? 'Primary' : 'Secondary'}
      />
      <Button
        onPress={onClose}
        size="sm"
        title={t('superAdminLeagueSettings.close', 'Fermer')}
        variant={!currentOpenValue ? 'Primary' : 'Secondary'}
      />
      {currentOpenValue !== configuredOpenValue ? (
        <Button
          disabled
          size="sm"
          title={t('superAdminLeagueSettings.unsaved', 'Modification non enregistrée')}
          variant="Ghost"
        />
      ) : null}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.clearLabel
 * @param root0.configuredIsOpen
 * @param root0.description
 * @param root0.effectiveIsOpen
 * @param root0.inputValue
 * @param root0.isSaving
 * @param root0.onChangeDate
 * @param root0.onClearDate
 * @param root0.onClose
 * @param root0.onOpen
 * @param root0.onSave
 * @param root0.scheduledLabel
 * @param root0.selectedIsOpen
 * @param root0.statusClosedLabel
 * @param root0.statusOpenLabel
 * @param root0.title
 */
function SettingsBlock({
  clearLabel,
  configuredIsOpen,
  description,
  effectiveIsOpen,
  inputValue,
  isSaving,
  onChangeDate,
  onClearDate,
  onClose,
  onOpen,
  onSave,
  scheduledLabel,
  selectedIsOpen,
  statusClosedLabel,
  statusOpenLabel,
  title,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  return (
    <LeagueCard style={{ marginBottom: 0 }}>
      <View style={[Spaces.gap[14]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>{title}</Text>
          <Text style={[Fonts.p2, Fonts.neutral300, { lineHeight: 22 }]}>{description}</Text>
          <StatusBadge
            label={effectiveIsOpen ? statusOpenLabel : statusClosedLabel}
            tone={effectiveIsOpen ? 'success' : 'warning'}
          />
          {scheduledLabel ? <StatusBadge label={scheduledLabel} tone="primary" /> : null}
        </View>

        <ToggleRow
          configuredOpenValue={configuredIsOpen}
          currentOpenValue={selectedIsOpen}
          onClose={onClose}
          onOpen={onOpen}
        />

        <DateField
          label={t(
            'superAdminLeagueSettings.openingDateLabel',
            "Date et heure d'ouverture (optionnel)",
          )}
          onChangeText={onChangeDate}
          value={inputValue}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            isLoading={isSaving}
            onPress={onSave}
            title={t('superAdminLeagueSettings.save', 'Enregistrer')}
            variant="Primary"
          />
          <Button
            onPress={onClearDate}
            style={{ borderColor: Colors.error500 }}
            textStyle={{ color: Colors.error500 }}
            title={clearLabel}
            variant="Secondary"
          />
        </View>
      </View>
    </LeagueCard>
  );
}

/**
 *
 */
function SuperAdminLeagueSettings() {
  const { t } = useTranslation();
  const settingsQuery = useGetSuperadminLeaguePlatformSettings();
  const updateMutation = useUpdateSuperadminLeaguePlatformSettings();
  const [platformIsOpen, setPlatformIsOpen] = useState(true);
  const [matchmakingIsOpen, setMatchmakingIsOpen] = useState(true);
  const [platformOpeningDateInput, setPlatformOpeningDateInput] = useState('');
  const [matchmakingOpeningDateInput, setMatchmakingOpeningDateInput] = useState('');

  useEffect(() => {
    if (!settingsQuery.data) return;
    const configured = settingsQuery.data?.configured || {};
    setPlatformIsOpen(Boolean(configured.platformIsOpen));
    setMatchmakingIsOpen(Boolean(configured.matchmakingIsOpen));
    setPlatformOpeningDateInput(formatInputDate(configured.platformOpeningDate));
    setMatchmakingOpeningDateInput(formatInputDate(configured.matchmakingOpeningDate));
  }, [settingsQuery.data]);

  const runtime = settingsQuery.data?.runtime || null;
  const configured = settingsQuery.data?.configured || {};

  const submitSettings = async (payload, scope) => {
    const nextPlatformOpeningDate = parseInputDate(payload.platformOpeningDate);
    const nextMatchmakingOpeningDate = parseInputDate(payload.matchmakingOpeningDate);

    if (nextPlatformOpeningDate === 'invalid' || nextMatchmakingOpeningDate === 'invalid') {
      Alert.alert(
        t('superAdminLeagueSettings.alerts.invalidDateTitle', 'Date invalide'),
        t(
          'superAdminLeagueSettings.alerts.invalidDateBody',
          'Utilise un format valide du type 2026-05-12T18:00.',
        ),
      );
      return;
    }

    const normalizedPayload = {
      matchmakingIsOpen: payload.matchmakingIsOpen,
      matchmakingOpeningDate: nextMatchmakingOpeningDate,
      platformIsOpen: payload.platformIsOpen,
      platformOpeningDate: nextPlatformOpeningDate,
    };

    try {
      await updateMutation.mutateAsync(normalizedPayload);
      Alert.alert(
        t('superAdminLeagueSettings.alerts.savedTitle', 'Paramètres enregistrés'),
        scope === 'platform'
          ? t(
            'superAdminLeagueSettings.alerts.platformSaved',
            "L'état plateforme League a bien été mis à jour.",
          )
          : t(
            'superAdminLeagueSettings.alerts.matchmakingSaved',
            "L'état de la recherche de match a bien été mis à jour.",
          ),
      );
    } catch (error) {
      Alert.alert(
        t('superAdminLeagueSettings.alerts.saveErrorTitle', 'Enregistrement impossible'),
        getErrorMessage(error, 'generic') || t(
          'superAdminLeagueSettings.alerts.saveErrorBody',
          'Impossible de mettre à jour les paramètres League.',
        ),
      );
    }
  };

  const saveCurrentSettings = async (scope) => submitSettings({
    matchmakingIsOpen,
    matchmakingOpeningDate: matchmakingOpeningDateInput,
    platformIsOpen,
    platformOpeningDate: platformOpeningDateInput,
  }, scope);

  if (settingsQuery.isLoading && !settingsQuery.data) {
    return (
      <AdminStateView
        description={t(
          'superAdminLeagueSettings.states.loadingDescription',
          "Nous chargeons la configuration d'ouverture de Found Club League.",
        )}
        isLoading
        title={t(
          'superAdminLeagueSettings.states.loadingTitle',
          'Chargement des paramètres League',
        )}
      />
    );
  }

  if (settingsQuery.error && !settingsQuery.data) {
    return (
      <AdminStateView
        actionLabel={t('superAdminLeagueSettings.states.retry', 'Réessayer')}
        description={
          getErrorMessage(settingsQuery.error, 'generic')
          || t(
            'superAdminLeagueSettings.states.errorDescription',
            'Impossible de charger les paramètres League.',
          )
        }
        onAction={settingsQuery.refetch}
        title={t('superAdminLeagueSettings.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  const platformScheduledLabel = runtime?.hasScheduledPlatformOpening
    ? t(
      'superAdminLeagueSettings.scheduled.platform',
      'Ouverture programmée : {{date}}',
      {
        date: runtime?.platform?.openingDate || runtime?.platform?.countdownTarget || '',
        ...SANS_ECHAPPEMENT,
      },
    )
    : '';
  const matchmakingScheduledLabel = runtime?.hasScheduledMatchmakingOpening
    ? t(
      'superAdminLeagueSettings.scheduled.matchmaking',
      'Recherche programmée : {{date}}',
      {
        date: runtime?.matchmaking?.openingDate || runtime?.matchmaking?.countdownTarget || '',
        ...SANS_ECHAPPEMENT,
      },
    )
    : '';

  return (
    <SuperAdminLeagueLayout
      activeRouteNames={[RouteNames.SuperAdminSettings]}
      description={t(
        'superAdminLeagueSettings.description',
        // eslint-disable-next-line max-len
        'Ouvre ou ferme Found Club League pour les joueurs, puis pilote séparément la disponibilité du matchmaking.',
      )}
      title={t('superAdminLeagueSettings.title', 'Paramètres plateforme')}
    >
      <SettingsBlock
        clearLabel={t('superAdminLeagueSettings.platform.clear', 'Supprimer la date')}
        configuredIsOpen={Boolean(configured.platformIsOpen)}
        description={t(
          'superAdminLeagueSettings.platform.description',
          // eslint-disable-next-line max-len
          "Quand la plateforme est fermée, les joueurs voient l'écran Found Club League arrive bientôt. Les SuperAdmin gardent l'accès complet.",
        )}
        effectiveIsOpen={Boolean(runtime?.effectivePlatformIsOpen)}
        inputValue={platformOpeningDateInput}
        isSaving={updateMutation.isPending}
        onChangeDate={setPlatformOpeningDateInput}
        onClearDate={() => {
          setPlatformOpeningDateInput('');
          submitSettings({
            matchmakingIsOpen,
            matchmakingOpeningDate: matchmakingOpeningDateInput,
            platformIsOpen,
            platformOpeningDate: '',
          }, 'platform');
        }}
        onClose={() => setPlatformIsOpen(false)}
        onOpen={() => setPlatformIsOpen(true)}
        onSave={() => saveCurrentSettings('platform')}
        scheduledLabel={platformScheduledLabel}
        selectedIsOpen={platformIsOpen}
        statusClosedLabel={t('superAdminLeagueSettings.platform.closed', 'Plateforme fermée')}
        statusOpenLabel={t('superAdminLeagueSettings.platform.open', 'Plateforme ouverte')}
        title={t('superAdminLeagueSettings.platform.title', 'État de Found Club League')}
      />

      <SettingsBlock
        clearLabel={t(
          'superAdminLeagueSettings.matchmaking.clear',
          'Supprimer la date de recherche',
        )}
        configuredIsOpen={Boolean(configured.matchmakingIsOpen)}
        description={t(
          'superAdminLeagueSettings.matchmaking.description',
          // eslint-disable-next-line max-len
          'La plateforme peut rester ouverte pendant que la recherche de match est bloquée pour préparer un lancement synchronisé.',
        )}
        effectiveIsOpen={Boolean(runtime?.effectiveMatchmakingIsOpen)}
        inputValue={matchmakingOpeningDateInput}
        isSaving={updateMutation.isPending}
        onChangeDate={setMatchmakingOpeningDateInput}
        onClearDate={() => {
          setMatchmakingOpeningDateInput('');
          submitSettings({
            matchmakingIsOpen,
            matchmakingOpeningDate: '',
            platformIsOpen,
            platformOpeningDate: platformOpeningDateInput,
          }, 'matchmaking');
        }}
        onClose={() => setMatchmakingIsOpen(false)}
        onOpen={() => setMatchmakingIsOpen(true)}
        onSave={() => saveCurrentSettings('matchmaking')}
        scheduledLabel={matchmakingScheduledLabel}
        selectedIsOpen={matchmakingIsOpen}
        statusClosedLabel={t('superAdminLeagueSettings.matchmaking.closed', 'Recherche fermée')}
        statusOpenLabel={t('superAdminLeagueSettings.matchmaking.open', 'Recherche ouverte')}
        title={t('superAdminLeagueSettings.matchmaking.title', 'Recherche de match')}
      />
    </SuperAdminLeagueLayout>
  );
}

export default SuperAdminLeagueSettings;
