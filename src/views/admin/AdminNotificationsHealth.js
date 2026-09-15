import { useFocusEffect } from '@react-navigation/native';
import i18next from 'i18next';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppContext } from '@/store/appContext';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import {
  useGetNotificationsHealth,
  usePurgeNotificationDeliveries,
  useRetryNotificationDelivery,
  useSendNotificationsHealthTest,
} from '@/services/admin/adminQueries';

const toDisplayValue = (value, fallback = '-') => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') {
    return value ? i18next.t(
      'adminNotificationsHealth.yes',
      'Oui',
    ) : i18next.t('adminNotificationsHealth.no', 'Non');
  }
  return String(value);
};

const formatDate = (value) => {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return '-';
  return new Date(parsed).toLocaleString(localeDesFormats(), {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
};

function AdminNotificationsHealth() {
  const {
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [{ authSessions }] = useAppContext();
  const [feedback, setFeedback] = useState('');
  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useGetNotificationsHealth();
  const testMutation = useSendNotificationsHealthTest();
  const retryMutation = useRetryNotificationDelivery();
  const purgeMutation = usePurgeNotificationDeliveries();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const firstFailureDocumentId = data?.recentFailures?.[0]?.documentId;
  const runtimeRows = useMemo(() => ([
    [t('adminNotificationsHealth.runtime.environment', 'Environnement'), data?.runtime?.appEnv],
    ['Push backend', data?.runtime?.push?.enabled],
    [t(
      'adminNotificationsHealth.runtime.firebaseProject',
      'Projet Firebase',
    ), data?.runtime?.firebase?.projectId],
    [t(
      'adminNotificationsHealth.runtime.firebaseConfig',
      'Config Firebase',
    ), data?.runtime?.firebase?.configured],
    [t('adminNotificationsHealth.runtime.cronActive', 'Cron actif'), data?.runtime?.cron?.enabled],
    [t(
      'adminNotificationsHealth.runtime.cronLeader',
      'Leader cron',
    ), data?.runtime?.cron?.isCronLeader],
  ]), [data, t]);

  const queueCounts = data?.queueCounts || {};
  const tokenCounts = data?.tokenCounts || {};
  const localSessions = Array.isArray(authSessions) ? authSessions : [];
  const currentDeviceLinkedUsers = (data?.currentDeviceInstallations || [])
    .flatMap((installation) => installation?.linkedUsers || [])
    .filter(Boolean);
  const currentDeviceLinkedUserDocumentIds = new Set(
    currentDeviceLinkedUsers
      .map((linkedUser) => String(linkedUser?.documentId || '').trim())
      .filter(Boolean),
  );
  const localSessionDocumentIds = localSessions
    .map((session) => String(session?.user?.documentId || '').trim())
    .filter(Boolean);
  const unsubscribedLocalAccounts = localSessionDocumentIds.filter(
    (documentId) => !currentDeviceLinkedUserDocumentIds.has(documentId),
  );
  const subscribedLocalAccountsCount = localSessionDocumentIds.filter(
    (documentId) => currentDeviceLinkedUserDocumentIds.has(documentId),
  ).length;

  const runAction = async (label, action) => {
    setFeedback('');
    try {
      const result = await action();
      setFeedback(`${label} : OK${result?.ok === false ? t(
        'adminNotificationsHealth.withWarning',
        ' avec avertissement',
      ) : ''}`);
      refetch();
    } catch (actionError) {
      setFeedback(`${label} : ${actionError?.message || 'echec'}`);
    }
  };

  if (isLoading) {
    return (
      <AdminStateView
        description={t(
          'adminNotificationsHealth.states.loadingDescription',
          "Nous lisons l'état runtime push, la queue et les installations.",
        )}
        isLoading
        title={t('adminNotificationsHealth.states.loadingTitle', 'Diagnostic notifications')}
      />
    );
  }

  if (error) {
    return (
      <AdminStateView
        actionLabel={t('adminNotificationsHealth.states.retry', 'Reessayer')}
        description={error?.message || t(
          'adminNotificationsHealth.states.errorDescription',
          'Impossible de charger le diagnostic notifications.',
        )}
        onAction={refetch}
        title={t('adminNotificationsHealth.states.errorTitle', 'Diagnostic indisponible')}
      />
    );
  }

  const renderCard = (title, children) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: Colors.primary700,
          borderColor: Colors.primary500,
        },
      ]}
    >
      <Text style={[Fonts.h3, Fonts.neutral00, styles.cardTitle]}>{title}</Text>
      {children}
    </View>
  );

  const renderMetric = (label, value, tone = Colors.primary200) => (
    <View
      style={[
        styles.metric,
        {
          backgroundColor: Colors.primary900,
          borderColor: `${Colors.primary500}55`,
        },
      ]}
    >
      <Text style={[Fonts.h2Bold, { color: tone }]}>{toDisplayValue(value, '0')}</Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>{label}</Text>
    </View>
  );

  const renderAction = (label, onPress, disabled = false) => (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        {
          backgroundColor: disabled ? Colors.primary900 : Colors.primary500,
          borderColor: disabled ? Colors.primary700 : Colors.primary500,
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, { color: disabled ? Colors.neutral300 : Colors.neutral00 }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[
          Spaces.paddingHorizontal[20],
          Spaces.paddingBottom[48],
          styles.content,
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isFetching}
            tintColor={Colors.primary500}
          />
        )}
      >
        <View style={styles.header}>
          <Text style={[Fonts.label, Fonts.uppercase, { color: Colors.primary500 }]}>
            SuperAdmin
          </Text>
          <Text style={[Fonts.h1, Fonts.neutral00]}>Notifications Health</Text>
          <Text style={[Fonts.p2, Fonts.neutral300, styles.headerDescription]}>
            {t(
              'adminNotificationsHealth.description',
              // eslint-disable-next-line max-len
              "Verifie la configuration push, la queue d'envoi et les abonnements multi-comptes sans exposer les secrets.",
            )}
          </Text>
        </View>

        {feedback ? (
          <View style={[styles.feedback, { backgroundColor: Colors.primary900, borderColor: Colors.primary500 }]}>
            <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]}>{feedback}</Text>
          </View>
        ) : null}

        {renderCard(
          'Runtime', (
            <View style={styles.rows}>
              {runtimeRows.map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>{label}</Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, styles.rowValue]}>
                    {toDisplayValue(value)}
                  </Text>
                </View>
              ))}
            </View>
          ),
        )}

        {renderCard(
          'Queue', (
            <View style={styles.metricsGrid}>
              {renderMetric(
                t('adminNotificationsHealth.metrics.pending', 'En attente'),
                queueCounts.pending,
              )}
              {renderMetric(
                t('adminNotificationsHealth.metrics.sending', 'Envoi'),
                queueCounts.sending,
              )}
              {renderMetric(
                t('adminNotificationsHealth.metrics.sent', 'Envoyees'),
                queueCounts.sent,
                Colors.success500,
              )}
              {renderMetric(
                t('adminNotificationsHealth.metrics.failed', 'Echouees'),
                queueCounts.failed,
                Colors.warning500,
              )}
              {renderMetric('Dead', queueCounts.dead, Colors.error500)}
            </View>
          ),
        )}

        {renderCard(
          'Tokens', (
            <>
              <View style={styles.metricsGrid}>
                {renderMetric('Total', tokenCounts.total)}
                {renderMetric('iOS', tokenCounts.ios)}
                {renderMetric('Android', tokenCounts.android)}
                {renderMetric(
                  t('adminNotificationsHealth.metrics.subscriptions', 'Abonnements'),
                  tokenCounts.subscriptions,
                  Colors.primary200,
                )}
                {renderMetric(
                  t('adminNotificationsHealth.metrics.multiAccount', 'Multi-comptes'),
                  tokenCounts.multiAccountInstallations,
                  Colors.success500,
                )}
                {renderMetric(
                  t('adminNotificationsHealth.metrics.orphaned', 'Orphelins'),
                  tokenCounts.orphaned,
                  Colors.warning500,
                )}
              </View>

              <View style={styles.tokenSummary}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {subscribedLocalAccountsCount}
                  {' '}
                  {t(
                    'adminNotificationsHealth.tokens.subscribedLocal',
                    'compte(s) local(aux) abonnes sur cet appareil.',
                  )}
                </Text>
                {unsubscribedLocalAccounts.length > 0 ? (
                  <Text style={[Fonts.p3, { color: Colors.warning500 }]}>
                    {unsubscribedLocalAccounts.length}
                    {' '}
                    {t(
                      'adminNotificationsHealth.tokens.unsubscribedLocal',
                      // eslint-disable-next-line max-len
                      'compte(s) local(aux) connecte(s) ne sont pas encore abonnes sur cet appareil.',
                    )}
                  </Text>
                ) : (
                  <Text style={[Fonts.p3, { color: Colors.success500 }]}>
                    {t(
                      'adminNotificationsHealth.tokens.allSubscribed',
                      'Tous les comptes locaux detectes sur cet appareil sont abonnés.',
                    )}
                  </Text>
                )}
              </View>

              <View style={styles.tokenList}>
                {(data?.currentUserTokens || []).map((token) => (
                  <View key={token.documentId || token.tokenPrefix} style={styles.tokenRow}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {token.platform}
                      {' - '}
                      {token.tokenPrefix || t(
                        'adminNotificationsHealth.tokens.masked',
                        'token masque',
                      )}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {token.supportsPushActions ? t(
                        'adminNotificationsHealth.tokens.quickActions',
                        'Actions rapides',
                      ) : 'Standard'}
                      {' - '}
                      {formatDate(token.updatedAt)}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {token.subscriptionCount || 0}
                      {' '}
                      {t('adminNotificationsHealth.tokens.subscriptionsCount', 'abonnement(s)')}
                      {Array.isArray(token.linkedUsers) && token.linkedUsers.length > 0
                        ? ` - ${token.linkedUsers.map((linkedUser) => linkedUser.label || linkedUser.documentId || linkedUser.id).filter(Boolean).join(', ')}`
                        : ''}
                    </Text>
                  </View>
                ))}
                {!data?.currentUserTokens?.length ? (
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    {t(
                      'adminNotificationsHealth.tokens.noneForAccount',
                      "Aucune installation push n'est encore abonnee pour ton compte courant.",
                    )}
                  </Text>
                ) : null}
              </View>

              {data?.currentDeviceInstallations?.length ? (
                <View style={styles.currentDeviceSection}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {t(
                      'adminNotificationsHealth.tokens.deviceInstallations',
                      'Installations detectees pour cet appareil',
                    )}
                  </Text>
                  <View style={styles.tokenList}>
                    {data.currentDeviceInstallations.map((installation) => (
                      <View
                        key={`device-${installation.documentId || installation.tokenPrefix}`}
                        style={styles.tokenRow}
                      >
                        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                          {installation.platform || 'other'}
                          {' - '}
                          {installation.tokenPrefix || t(
                            'adminNotificationsHealth.tokens.masked',
                            'token masque',
                          )}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral300]}>
                          {installation.subscriptionCount || 0}
                          {' '}
                          {t('adminNotificationsHealth.tokens.linkedAccounts', 'compte(s) lie(s)')}
                        </Text>
                        {Array.isArray(installation.linkedUsers) && installation.linkedUsers.length > 0 ? (
                          <Text style={[Fonts.p3, Fonts.neutral300]}>
                            {installation.linkedUsers
                              .map((linkedUser) => linkedUser.label || linkedUser.documentId || linkedUser.id)
                              .filter(Boolean)
                              .join(', ')}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ),
        )}

        {renderCard(
          t('adminNotificationsHealth.actions.title', 'Actions de test'), (
            <View style={styles.actions}>
              {renderAction('Test standard', () => runAction('Test standard', () => testMutation.mutateAsync({ kind: 'standard' })), testMutation.isPending)}
              {renderAction('Test RSVP', () => runAction('Test RSVP', () => testMutation.mutateAsync({ kind: 'event-rsvp' })), testMutation.isPending)}
              {renderAction('Test participant', () => runAction('Test participant', () => testMutation.mutateAsync({ kind: 'event-participant' })), testMutation.isPending)}
              {renderAction('Test convocation', () => runAction('Test convocation', () => testMutation.mutateAsync({ kind: 'event-lineup' })), testMutation.isPending)}
              {renderAction('Test absence', () => runAction('Test absence', () => testMutation.mutateAsync({ kind: 'event-absence' })), testMutation.isPending)}
              {renderAction('Test chat', () => runAction('Test chat', () => testMutation.mutateAsync({ kind: 'chat-reply' })), testMutation.isPending)}
              {renderAction('Test groupe', () => runAction('Test groupe', () => testMutation.mutateAsync({ kind: 'chat-group' })), testMutation.isPending)}
              {renderAction(
                t('adminNotificationsHealth.actions.retryLastFailure', 'Relancer dernier échec'),
                () => runAction('Relance delivery', () => retryMutation.mutateAsync(firstFailureDocumentId)),
                !firstFailureDocumentId || retryMutation.isPending,
              )}
              {renderAction(
                t('adminNotificationsHealth.actions.purgeDead', 'Purger dead non-prod'),
                () => runAction('Purge', () => purgeMutation.mutateAsync({ statuses: ['dead'] })),
                purgeMutation.isPending || data?.runtime?.appEnv === 'production',
              )}
            </View>
          ),
        )}

        {renderCard(
          t('adminNotificationsHealth.failures.title', 'Derniers echecs'), (
            <View style={styles.failures}>
              {(data?.recentFailures || []).map((failure) => (
                <View key={failure.documentId} style={styles.failureRow}>
                  <View>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {failure.notificationType || 'Notification'}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {failure.status}
                      {' - '}
                      {formatDate(failure.updatedAt || failure.lastAttemptAt)}
                    </Text>
                  </View>
                  <Text numberOfLines={3} style={[Fonts.p3, Fonts.neutral300, styles.failureError]}>
                    {failure.lastError || t(
                      'adminNotificationsHealth.failures.noDetail',
                      'Sans erreur détaillée',
                    )}
                  </Text>
                </View>
              ))}
              {!data?.recentFailures?.length ? (
                <Text style={[Fonts.p2, Fonts.neutral300]}>
                  {t('adminNotificationsHealth.failures.empty', 'Aucun échec récent.')}
                </Text>
              ) : null}
            </View>
          ),
        )}

        {isFetching ? (
          <ActivityIndicator color={Colors.primary500} style={styles.loader} />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  actions: {
    gap: 10,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  cardTitle: {
    marginBottom: 14,
  },
  content: {
    paddingTop: 18,
  },
  currentDeviceSection: {
    gap: 10,
    marginTop: 18,
  },
  failureError: {
    flex: 1,
    textAlign: 'right',
  },
  failureRow: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  failures: {
    gap: 6,
  },
  feedback: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  header: {
    marginBottom: 20,
  },
  headerDescription: {
    marginTop: 8,
  },
  loader: {
    marginTop: 8,
  },
  metric: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 86,
    padding: 14,
    width: '48%',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rows: {
    gap: 2,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  tokenList: {
    gap: 10,
    marginTop: 14,
  },
  tokenRow: {
    gap: 4,
  },
  tokenSummary: {
    gap: 4,
    marginTop: 14,
  },
});

export default AdminNotificationsHealth;
