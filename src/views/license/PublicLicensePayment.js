/* eslint-disable import/order, perfectionist/sort-imports */
import { useMutation, useQuery } from '@tanstack/react-query';
import i18next from 'i18next';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useRetraitBasDuDefilement from '@/components/templates/useRetraitBasDuDefilement';

import {
  createPublicLicenseCheckout,
  declarePublicExternalLicensePayment,
  getPublicLicensePayment,
} from '@/services/license/licenseService';
import {
  formatLicenseMoney,
  getEnabledManualPaymentMethods,
  getLicenseStatusTone,
  LicenseCard,
  LicenseEmptyState,
  LicenseInstallmentList,
  LicenseMetricRow,
  licenseRadius,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
  normalizePaymentModes,
  paymentInstructionFields,
  paymentModeLabels,
} from './licenseDesignSystem';
import LinksPlatform from '@/platform/links';
import { RouteNames } from '@/navigation/routeNames';

import { TournamentPlacePay, TournamentPlaceResult } from './TournamentPlacePanels';

// T-PAIE (15/11) — une place de tournoi (`campaignType: 'tournament'`) : Stripe s'ouvre pour
// elle seule (une licence garde `normalizePaymentModes`, qui force `stripe: false`) ; le retour
// de Stripe revient ICI (`?status=success`), page publique : lisible sans compte.
// ponytail: « Conditions d'inscription » ouvre la fiche du tournoi tant que les conditions n'ont
// pas leur page. Sortie : TOURNAMENT_TERMS_URL.
const TOURNAMENT_TERMS_URL = '';
const CONFIRMING_REFETCH_MS = 3000;

/**
 *
 * @param root0
 * @param root0.isLoading
 * @param root0.methods
 * @param root0.onClose
 * @param root0.onSelect
 */
function DeclarePaymentModal({
  isLoading, methods, onClose, onSelect,
}) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();

  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      scrollable={false}
      snapPoints={['58%']}
      webPresentation="dialog"
    >
      <View style={Spaces.gap[licenseSpacing.fieldGap]}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>
          {t('publicLicensePayment.declareModal.title', 'Paiement hors app')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'publicLicensePayment.declareModal.description',
            'Choisis le moyen utilise pour prevenir le club.',
          )}
        </Text>
        {methods.map((method) => (
          <Button
            isLoading={isLoading}
            key={method.mode}
            onPress={() => onSelect(method.mode)}
            title={method.label}
            variant="Secondary"
          />
        ))}
      </View>
    </BottomModal>
  );
}

/**
 * La page publique d'un lien de paiement (`/licenses/pay/:token`), connecté ou non.
 * @param {object} root0 - Les propriétés de l'écran.
 * @param {any} root0.navigation - La navigation (lien vers la fiche du tournoi).
 * @param {any} root0.route - La route : `token`, et `status` au retour de Stripe.
 * @returns {import('react').ReactElement} L'écran.
 */
function PublicLicensePayment({ navigation, route }) {
  const retraitBas = useRetraitBasDuDefilement(12);
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const token = route?.params?.token;
  const returnStatus = String(route?.params?.status || '').toLowerCase();
  const [declareModalVisible, setDeclareModalVisible] = useState(false);
  const query = useQuery({
    enabled: Boolean(token),
    queryFn: () => getPublicLicensePayment(token),
    queryKey: ['licenses', 'public-payment', token],
    // T-PAIE : au retour de Stripe, l'avis suit en quelques secondes : relire jusqu'à « payée ».
    refetchInterval: (state) => {
      const waiting = returnStatus === 'success' && state?.state?.data?.status !== 'paid';
      return waiting ? CONFIRMING_REFETCH_MS : false;
    },
    staleTime: 20_000,
  });
  const checkoutMutation = useMutation({
    mutationFn: (provider) => createPublicLicenseCheckout(token, { provider }),
  });
  const declareMutation = useMutation({
    mutationFn: (method) => declarePublicExternalLicensePayment(token, {
      amountCents: query.data?.remainingCents,
      method,
    }),
  });

  const payment = query.data;
  const paymentModes = normalizePaymentModes(payment?.paymentModes);
  const offlinePaymentMethods = useMemo(() => getEnabledManualPaymentMethods(payment?.paymentModes), [payment?.paymentModes]);
  const offlineInstructions = Object.entries(paymentInstructionFields)
    .map(([mode, field]) => ({
      label: paymentModeLabels[mode],
      mode,
      value: payment?.[field],
    }))
    .filter((item) => paymentModes[item.mode] || item.value)
    .filter((item) => item.value);
  const isCampaignPaused = payment?.campaignStatus === 'paused';
  // BH11 P5-05 : la meme regle pour payer en ligne et pour declarer hors app.
  const hasSomethingToPay = Number(payment?.remainingCents || 0) > 0
    && !['cancelled', 'paid', 'waived'].includes(payment?.status);
  const canPayOnline = !isCampaignPaused && hasSomethingToPay;
  const canDeclareOfflinePayment = offlinePaymentMethods.length > 0 && canPayOnline;
  const tone = getLicenseStatusTone(Colors, payment?.status);
  const currency = payment?.currency || 'EUR';
  const isTournament = payment?.campaignType === 'tournament';
  const tournament = isTournament ? (payment?.tournament || {}) : null;
  const tournamentEventId = tournament?.eventDocumentId;
  const openTournament = useCallback(() => {
    if (!tournamentEventId) return;
    navigation?.navigate?.(RouteNames.EventDetails, { eventId: tournamentEventId });
  }, [navigation, tournamentEventId]);
  const openTerms = useCallback(() => {
    if (TOURNAMENT_TERMS_URL) LinksPlatform.openUrl(TOURNAMENT_TERMS_URL);
    else openTournament();
  }, [openTournament]);

  const openCheckout = useCallback((provider) => {
    if (isCampaignPaused) {
      Alert.alert(i18next.t(
        'publicLicensePayment.alerts.paused.title',
        'Campagne en pause',
      ), i18next.t(
        'publicLicensePayment.alerts.paused.message',
        'Cette campagne est temporairement suspendue. Le paiement reprendra quand le club la '
          + 'rouvrira.',
      ));
      return;
    }
    if (!hasSomethingToPay || checkoutMutation.isPending) return;
    checkoutMutation.mutate(provider, {
      onError: (error) => Alert.alert(i18next.t(
        'publicLicensePayment.unavailable.title',
        'Paiement indisponible',
      ), error?.message || i18next.t(
        'publicLicensePayment.alerts.checkoutError.noLink',
        'Aucun lien de paiement configure.',
      )),
      onSuccess: async (result) => {
        if (result?.checkoutUrl) {
          await LinksPlatform.openUrl(result.checkoutUrl);
        }
      },
    });
  }, [checkoutMutation, hasSomethingToPay, isCampaignPaused]);

  const declareOfflinePayment = useCallback((method) => {
    declareMutation.mutate(method, {
      onSuccess: () => {
        setDeclareModalVisible(false);
        query.refetch();
        Alert.alert(i18next.t(
          'publicLicensePayment.alerts.declared.title',
          'Déclaration envoyée',
        ), i18next.t(
          'publicLicensePayment.alerts.declared.message',
          'Le club devra valider ce paiement.',
        ));
      },
    });
  }, [declareMutation, query]);

  if (!token) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          description={t(
            'publicLicensePayment.invalidLink.description',
            'Le lien de paiement est incomplet.',
          )}
          title={t('publicLicensePayment.invalidLink.title', 'Lien invalide')}
        />
      </ScreenContainer>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          description={t(
            'publicLicensePayment.loading.description',
            'On récupère les informations de paiement.',
          )}
          title={t('publicLicensePayment.loading.title', 'Chargement')}
        />
      </ScreenContainer>
    );
  }

  if (query.isError) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          action={(
            <Button
              onPress={query.refetch}
              title={t(
                'publicLicensePayment.error.retry',
                'Réessayer',
              )}
              variant="Secondary"
            />
)}
          description={t(
            'publicLicensePayment.error.description',
            'Impossible de charger ce lien de paiement pour le moment.',
          )}
          title={t('publicLicensePayment.unavailable.title', 'Paiement indisponible')}
        />
      </ScreenContainer>
    );
  }

  if (!payment && !query.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          description={t(
            'publicLicensePayment.notFound.description',
            'Ce lien est introuvable ou n est plus disponible.',
          )}
          title={t('publicLicensePayment.unavailable.title', 'Paiement indisponible')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="scroll-edge" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: 40 + retraitBas }]} showsVerticalScrollIndicator={false}>
        <View style={[ApplicationStyle.card, {
          backgroundColor: Colors.primary700,
          borderColor: `${tone}99`,
          borderRadius: licenseRadius.hero,
          paddingHorizontal: licenseSpacing.heroPadding,
          paddingVertical: licenseSpacing.heroPadding,
        }]}
        >
          <View style={Spaces.gap[licenseSpacing.titleGap]}>
            <LicenseStatusChip status={payment?.status} />
            <Text style={[Fonts.h2, Fonts.neutral00]}>
              {isTournament
                ? t('publicLicensePayment.tournament.heroTitle', 'Inscription au tournoi')
                : t('publicLicensePayment.hero.title', 'Paiement cotisation')}
            </Text>
            {isTournament ? (
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {[tournament?.eventName, tournament?.teamName].filter(Boolean).join(' - ')}
              </Text>
            ) : null}
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {payment?.memberName || t('publicLicensePayment.hero.memberFallback', 'Membre')}
              {' '}
              -
              {' '}
              {payment?.clubName || t('publicLicensePayment.hero.clubFallback', 'Club')}
            </Text>
          </View>
        </View>
        {isTournament ? (
          <TournamentPlaceResult
            isPaid={payment?.status === 'paid'}
            onOpenTournament={openTournament}
            returnStatus={returnStatus}
            tournament={tournament}
          />
        ) : null}
        <LicenseCard>
          <LicenseMetricRow
            items={[
              {
                label: t(
                  'publicLicensePayment.metrics.total',
                  'Total',
                ),
                value: formatLicenseMoney(payment?.totalDueCents, currency),
              },
              {
                label: t(
                  'publicLicensePayment.metrics.paid',
                  'Paye',
                ),
                value: formatLicenseMoney(payment?.totalPaidCents, currency),
              },
              {
                label: t(
                  'publicLicensePayment.metrics.remaining',
                  'Reste',
                ),
                tone,
                value: formatLicenseMoney(payment?.remainingCents, currency),
              },
            ]}
          />
        </LicenseCard>
        <LicenseSectionHeader title={t('publicLicensePayment.campaign.title', 'Campagne')} />
        <LicenseCard variant="muted">
          <View style={Spaces.gap[licenseSpacing.actionGap]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {payment?.seasonLabel || t(
                'publicLicensePayment.campaign.seasonFallback',
                'Cotisation en cours',
              )}
            </Text>
            {payment?.description ? <Text style={[Fonts.p2, Fonts.neutral200]}>{payment.description}</Text> : null}
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('publicLicensePayment.campaign.deadline', 'Date limite:')}
              {' '}
              {payment?.dueDate || t('publicLicensePayment.campaign.deadlineNotSet', 'Non définie')}
            </Text>
            {payment?.teamName ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('publicLicensePayment.campaign.team', 'Equipe:')}
                {' '}
                {payment.teamName}
              </Text>
            ) : null}
          </View>
        </LicenseCard>
        <LicenseSectionHeader title={t('publicLicensePayment.installments.title', 'Echeancier')} />
        <LicenseInstallmentList currency={currency} installments={payment?.installments || []} />
        {isCampaignPaused ? (
          <LicenseCard variant="muted">
            <View style={Spaces.gap[licenseSpacing.actionGap]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {t('publicLicensePayment.paused.title', 'Campagne temporairement suspendue')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t(
                  'publicLicensePayment.paused.description',
                  'Le dossier reste consultable, mais les paiements et déclarations sont '
                    + 'bloques tant que le club n a pas repris cette campagne.',
                )}
              </Text>
            </View>
          </LicenseCard>
        ) : null}
        <LicenseSectionHeader
          description={t(
            'publicLicensePayment.pay.description',
            'Choisis le moyen propose par le club.',
          )}
          title={t('publicLicensePayment.pay.title', 'Regler')}
        />
        {isTournament && hasSomethingToPay ? (
          <TournamentPlacePay
            canPay={canPayOnline && payment?.paymentModes?.stripe === true}
            complexeName={tournament?.complexeName || null}
            isLoading={checkoutMutation.isPending}
            onOpenTerms={openTerms}
            onPay={() => openCheckout('stripe')}
          />
        ) : null}
        {canPayOnline && paymentModes.helloasso ? (
          <Button
            isLoading={checkoutMutation.isPending}
            onPress={() => openCheckout('helloasso')}
            title={t('publicLicensePayment.pay.helloAsso', 'Payer avec HelloAsso')}
          />
        ) : null}
        {canPayOnline && paymentModes.external_link ? (
          <Button
            isLoading={checkoutMutation.isPending}
            onPress={() => openCheckout('external')}
            title={t('publicLicensePayment.pay.externalLink', 'Ouvrir le lien externe du club')}
            variant="Secondary"
          />
        ) : null}
        {!isCampaignPaused && canDeclareOfflinePayment ? (
          <Button
            onPress={() => setDeclareModalVisible(true)}
            title={t('publicLicensePayment.pay.declareOffline', 'Déclarer un paiement hors app')}
            variant="Secondary"
          />
        ) : null}
        {offlineInstructions.length ? (
          <>
            <LicenseSectionHeader title={t(
              'publicLicensePayment.instructions.title',
              'Instructions du club',
            )}
            />
            {offlineInstructions.map((instruction) => (
              <LicenseCard key={instruction.label} variant="muted">
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{instruction.label}</Text>
                <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[licenseSpacing.titleGap]]}>{instruction.value}</Text>
              </LicenseCard>
            ))}
          </>
        ) : null}
        <LicenseSectionHeader title={t(
          'publicLicensePayment.documents.title',
          'Documents demandes',
        )}
        />
        {(payment?.documentRequests || []).length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {(payment?.documentRequests || []).map((request) => (
              <LicenseCard key={request.documentId || request.id || request.name} variant="muted">
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <View style={{
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                    gap: licenseSpacing.actionGap,
                    justifyContent: 'space-between',
                  }}
                  >
                    <View style={[Spaces.gap[4], { flex: 1 }]}>
                      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                        {request.name || t(
                          'publicLicensePayment.documents.nameFallback',
                          'Document',
                        )}
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {request.required === false ? t(
                          'publicLicensePayment.documents.optional',
                          'Facultatif',
                        ) : t(
                          'publicLicensePayment.documents.required',
                          'Obligatoire',
                        )}
                        {request.dueDate ? t(
                          'publicLicensePayment.documents.dueBefore',
                          ' - Dépôt avant {{dueDate}}',
                          { dueDate: request.dueDate, ...SANS_ECHAPPEMENT },
                        ) : ''}
                      </Text>
                    </View>
                    <LicenseStatusChip status={request.status || 'missing'} />
                  </View>
                  {request.description ? <Text style={[Fonts.p3, Fonts.neutral200]}>{request.description}</Text> : null}
                </View>
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description={t(
              'publicLicensePayment.documents.empty.description',
              'Aucune pièce supplémentaire n est associée à ce lien.',
            )}
            title={t('publicLicensePayment.documents.empty.title', 'Aucun document')}
          />
        )}
        <LicenseSectionHeader title={t('publicLicensePayment.receipts.title', 'Reçus déjà emis')} />
        {(payment?.receipts || []).length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {(payment?.receipts || []).map((receipt) => (
              <LicenseCard key={receipt.documentId || receipt.id || receipt.receiptNumber} variant="muted">
                <LicenseMetricRow
                  items={[
                    {
                      label: t(
                        'publicLicensePayment.receipts.number',
                        'Numero',
                      ),
                      value: receipt.receiptNumber || '-',
                    },
                    {
                      label: t(
                        'publicLicensePayment.receipts.amount',
                        'Montant',
                      ),
                      value: formatLicenseMoney(receipt.amountCents, currency),
                    },
                    {
                      label: t(
                        'publicLicensePayment.receipts.status',
                        'Statut',
                      ),
                      value: receipt.status || '-',
                    },
                  ]}
                />
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description={t(
              'publicLicensePayment.receipts.empty.description',
              'Le reçu apparaîtra après confirmation du paiement par le club ou le prestataire.',
            )}
            title={t('publicLicensePayment.receipts.empty.title', 'Pas encore de reçu')}
          />
        )}
      </ScrollView>
      {declareModalVisible && canDeclareOfflinePayment ? (
        <DeclarePaymentModal
          isLoading={declareMutation.isPending}
          methods={offlinePaymentMethods}
          onClose={() => setDeclareModalVisible(false)}
          onSelect={declareOfflinePayment}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default PublicLicensePayment;
