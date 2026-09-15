/* eslint-disable perfectionist/sort-imports */
import i18next from 'i18next';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  addManualLicensePayment,
  approveExternalLicensePayment,
  generateLicenseReceipt,
  refundLicensePayment,
  rejectExternalLicensePayment,
  reviewLicenseDocument,
  sendLicenseReminder,
  unwaiveLicenseAssignment,
  updateLicenseAssignmentAmount,
  uploadOfficialLicenseDocument,
  useLicenseAssignment,
  useLicenseDashboard,
  useLicenseMutation,
  waiveLicenseAssignment,
} from '@/services/license/licenseQueries';
import LinksPlatform from '@/platform/links';
import MediaPlatform from '@/platform/media';
// U06 — la MEME liste de formats sur les trois ecrans de depot, et dans la
// langue de la plateforme (UTI sur iOS, type MIME sur Android).
import { getDocumentPickerOptions } from '@/platform/media/documentUploadFormats';
// AA07 / K2 — jumeaux `.native` / `.web` : Metro resout le premier, Vite le
// second. TypeScript, lui, ne connait pas les suffixes de plateforme et ne
// voit aucun fichier a ce chemin exact — le meme motif ailleurs dans le
// projet (`useShareCard.js`, `visualRender.native.js`) l esquive avec un
// `@ts-nocheck` sur TOUT le fichier. Ici on ne le neutralise QUE sur cette
// ligne : le reste de l ecran garde ses controles de type.
// @ts-ignore -- resolution par suffixe de plateforme, cf. ci-dessus
import { downloadRemoteFile } from '@/platform/media/downloadRemoteFile';
import { resolveMediaUrl } from '@/utils/mediaUrl';

import {
  canValidateAssignmentPayment,
  formatLicenseMoney,
  getEnabledManualPaymentMethods,
  LicenseCard,
  LicenseEmptyState,
  LicenseInstallmentList,
  LicenseMetricRow,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
  manualPaymentMethods,
  paymentModeLabels,
} from './licenseDesignSystem';

const euroToCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);
const usefulReminderStatuses = ['pending', 'partial', 'overdue', 'manual_review'];
const paymentStatusLabels = {
  get cancelled() {
    return i18next.t('clubLicenseMemberDetail.paymentStatus.cancelled', 'Annule');
  },
  get confirmed() {
    return i18next.t('clubLicenseMemberDetail.paymentStatus.confirmed', 'Valide');
  },
  get failed() {
    return i18next.t('clubLicenseMemberDetail.paymentStatus.failed', 'Echoue');
  },
  get manual_review() {
    return i18next.t('clubLicenseMemberDetail.paymentStatus.manualReview', 'A valider');
  },
  get partially_refunded() {
    return i18next.t(
      'clubLicenseMemberDetail.paymentStatus.partiallyRefunded',
      'Remboursement partiel',
    );
  },
  get pending() {
    return i18next.t('clubLicenseMemberDetail.paymentStatus.pending', 'En attente');
  },
  get refunded() {
    return i18next.t('clubLicenseMemberDetail.paymentStatus.refunded', 'Rembourse');
  },
  get rejected() {
    return i18next.t('clubLicenseMemberDetail.paymentStatus.rejected', 'Rejete');
  },
};
const paymentDate = (payment = {}) => String(payment.validatedAt || payment.paidAt || payment.createdAt || '').slice(0, 10);
const documentDate = (submission = {}) => String(submission.validatedAt || submission.submittedAt || submission.createdAt || '').slice(0, 10);
const refundableAmount = (payment = {}) => Math.max(0, Number(payment.amountCents || 0) - Number(payment.refundedAmountCents || 0));
const resolveCanManageLicenses = (scope, routeCanManageLicenses) => {
  if (scope === 'coach') return false;
  if (typeof routeCanManageLicenses === 'boolean') return routeCanManageLicenses;
  return Boolean(scope && scope !== 'coach');
};
const isPickerCancelError = (error) => String(error?.code || error?.message || '')
  .toLowerCase()
  .includes('cancel');

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.value
 */
function InfoRow({ label, value }) {
  const { Fonts, Spaces } = useTheme();
  return (
    <View style={[Spaces.gap[4], { flex: 1 }]}>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{value}</Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.onClose
 * @param root0.onSubmit
 * @param root0.title
 * @param root0.type
 * @param root0.methodOptions
 */
function ActionModal({
  methodOptions = [], onClose, onSubmit, title, type,
}) {
  const { t } = useTranslation();
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(methodOptions[0]?.mode || 'cash');
  const [note, setNote] = useState('');
  const [motifManquant, setMotifManquant] = useState(false);
  const needsAmount = ['amount', 'payment', 'refund'].includes(type);
  const needsMethod = type === 'payment';
  // AA07 / K2 — LE MOTIF ETAIT « OBLIGATOIRE » SANS L ETRE.
  //
  // 🎯 C EST TRES PROBABLEMENT « L ERREUR » D ADEL SUR « A remplacer ». Le
  // serveur REFUSE la demande sans motif — `license.ts:2970` :
  //   if ((nextStatus === 'refused' || 'to_replace') && !s(payload.reason))
  //     throw new ValidationError('reason is required')
  // …et l ecran affichait deja « Motif obligatoire » en invite, mais laissait
  // valider a vide. Le geste partait, le serveur le rejetait, et l alerte
  // GENERIQUE du client (`App.js:onMutationError`) affichait « une erreur »
  // sans jamais dire laquelle. ⇒ On refuse AVANT l aller-retour, et on DIT
  // pourquoi. Les 4 gestes concernes partagent la meme regle.
  const needsReason = ['document-review', 'refund', 'reject', 'waive'].includes(type);
  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      scrollable={false}
      snapPoints={['62%']}
      webPresentation="dialog"
    >
      <View style={Spaces.gap[16]}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>{title}</Text>
        {needsAmount ? (
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder={t(
              'clubLicenseMemberDetail.actionModal.amountPlaceholder',
              'Montant en euros',
            )}
            placeholderTextColor={Colors.neutral400}
            style={{
              borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12,
            }}
            value={amount}
          />
        ) : null}
        {needsMethod ? (
          <View style={Spaces.gap[8]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('clubLicenseMemberDetail.actionModal.paymentMethod', 'Moyen de paiement')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {methodOptions.map((option) => {
                const selected = method === option.mode;
                return (
                  <Pressable
                    key={option.mode}
                    onPress={() => setMethod(option.mode)}
                    style={{
                      backgroundColor: selected ? Colors.primary500 : Colors.primary800,
                      borderColor: selected ? Colors.primary500 : `${Colors.primary500}55`,
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={[Fonts.p3Bold, selected ? Fonts.neutral900 : Fonts.neutral200]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <TextInput
          onChangeText={(value) => { setNote(value); if (value.trim()) setMotifManquant(false); }}
          placeholder={needsReason ? t(
            'clubLicenseMemberDetail.actionModal.reasonRequired',
            'Motif obligatoire',
          ) : t(
            'clubLicenseMemberDetail.actionModal.noteOptional',
            'Note optionnelle',
          )}
          placeholderTextColor={Colors.neutral400}
          style={{
            borderBottomColor: motifManquant ? '#fda4af' : Colors.neutral200,
            borderBottomWidth: 1,
            color: Colors.neutral00,
            paddingVertical: 12,
          }}
          value={note}
        />
        {motifManquant ? (
          <Text style={[Fonts.p3, { color: '#fda4af' }]}>
            {t(
              'clubLicenseMemberDetail.actionModal.reasonMissing',
              'Explique en un mot ce qui ne va pas : le membre recevra ce motif.',
            )}
          </Text>
        ) : null}
        <View style={[Spaces.marginTop[8], { flexDirection: 'row', gap: licenseSpacing.actionGap }]}>
          <Button
            onPress={onClose}
            style={{ flex: 1 }}
            title={t(
              'clubLicenseMemberDetail.buttons.cancel',
              'Annuler',
            )}
            variant="Secondary"
          />
          <Button
            onPress={() => {
              if (needsReason && !note.trim()) {
                setMotifManquant(true);
                return;
              }
              onSubmit({
                amountCents: euroToCents(amount), method, note, reason: note,
              });
            }}
            style={{ flex: 1 }}
            title={t('clubLicenseMemberDetail.actionModal.submit', 'Valider')}
          />
        </View>
      </View>
    </BottomModal>
  );
}

/**
 *
 * @param root0
 * @param root0.route
 */
function ClubLicenseMemberDetail({ route }) {
  const { t } = useTranslation();
  const {
    Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const assignmentId = route?.params?.assignmentId;
  const routeCampaignId = route?.params?.campaignId;
  const routeCanManageLicenses = route?.params?.canManageLicenses;
  const routeScope = route?.params?.scope;
  const query = useLicenseAssignment(assignmentId);
  const assignment = query.data;
  const campaignId = routeCampaignId || assignment?.campaign?.documentId || assignment?.campaign?.id;
  const permissionQuery = useLicenseDashboard(campaignId, {
    enabled: Boolean(campaignId && routeCanManageLicenses === undefined && !routeScope),
  });
  const scope = routeScope || permissionQuery.data?.scope;
  const canManageLicenses = resolveCanManageLicenses(scope, routeCanManageLicenses);
  const canUseSensitiveActions = canManageLicenses && scope !== 'coach';
  // W02 — ENCAISSER UN PAIEMENT N EST PLUS RESERVE AU DIRIGEANT.
  //
  // Adel, 2026-08-19 : « le dirigeant doit pouvoir laisser le choix aux coachs de
  // pouvoir valider les paiements pour LEURS equipes ».
  //
  // 🚨 C EST LE SERVEUR QUI TRANCHE, PAS CET ECRAN. `canValidatePayments` arrive
  // avec la fiche (admin, license.ts `getAssignment`) et vaut la MEME regle que
  // celle qui refusera l appel : dirigeant du club, ou coach nomme par le club
  // sur CETTE equipe. Une fiche muette — vieux serveur — vaut NON : on n affiche
  // jamais un bouton qui repondrait « acces refuse ».
  //
  // ⛔ Et la delegation ne donne QUE l encaissement. Modifier le montant,
  // exempter, rembourser restent des decisions de club : ils continuent de
  // dependre de `canUseSensitiveActions`, et le serveur les refuse au coach.
  //
  // Y06 — la regle a demenage dans `licenseDesignSystem` : la LISTE porte
  // desormais le meme bouton, et elle doit obeir au MEME verdict.
  const canValidatePayment = canValidateAssignmentPayment(assignment, canUseSensitiveActions);
  // Y06 — LA LISTE OUVRE CETTE FENETRE-CI. Elle ne recopie pas le formulaire
  // d encaissement : il n en existe qu un dans le depot, c est celui-la.
  // ⛔ L etat initial ne donne aucun droit : le rendu de la fenetre reste garde
  // par `canValidatePayment` plus bas — un lien fabrique a la main n ouvre rien.
  const [modal, setModal] = useState(
    route?.params?.openPaymentModal ? { type: 'payment' } : null,
  );
  const manualPaymentMutation = useLicenseMutation((payload) => addManualLicensePayment(assignmentId, payload), campaignId);
  const approvePaymentMutation = useLicenseMutation(({ paymentId, ...payload }) => approveExternalLicensePayment(paymentId, payload), campaignId);
  const rejectPaymentMutation = useLicenseMutation(({ paymentId, ...payload }) => rejectExternalLicensePayment(paymentId, payload), campaignId);
  const receiptMutation = useLicenseMutation((paymentId) => generateLicenseReceipt(paymentId), campaignId);
  const refundMutation = useLicenseMutation(({ paymentId, ...payload }) => refundLicensePayment(paymentId, payload), campaignId);
  const reviewDocumentMutation = useLicenseMutation(({ submissionId, ...payload }) => reviewLicenseDocument(submissionId, payload), campaignId);
  const officialLicenseMutation = useLicenseMutation((payload) => uploadOfficialLicenseDocument(assignmentId, payload), campaignId);
  const amountMutation = useLicenseMutation((payload) => updateLicenseAssignmentAmount(assignmentId, payload), campaignId);
  const waiveMutation = useLicenseMutation((payload) => waiveLicenseAssignment(assignmentId, payload), campaignId);
  const reminderMutation = useLicenseMutation((payload) => sendLicenseReminder(assignmentId, payload), campaignId);
  // T03 — le miroir d « Exempter la cotisation ». Cote serveur, `waived` etait
  // une porte a sens unique : `status()` (license.ts:811) le rend tel quel avant
  // tout calcul, donc ni « Modifier le montant » ni un encaissement n en
  // sortaient. Le geste s appuie sur une action neuve, `unwaive`.
  const unwaiveMutation = useLicenseMutation((payload) => unwaiveLicenseAssignment(assignmentId, payload), campaignId);

  const memberName = [assignment?.user?.firstname, assignment?.user?.lastname]
    .filter(Boolean)
    .join(' ')
    || assignment?.user?.username
    || t('clubLicenseMemberDetail.memberFallback', 'Membre');
  const modalType = modal?.type;
  const modalTitle = {
    amount: t('clubLicenseMemberDetail.actions.changeAmount', 'Modifier le montant'),
    'document-review': modal?.reviewStatus === 'to_replace' ? t(
      'clubLicenseMemberDetail.modalTitles.requestNewDocument',
      'Demander un nouveau document',
    ) : t(
      'clubLicenseMemberDetail.modalTitles.reviewDocument',
      'Revoir le document',
    ),
    payment: t('clubLicenseMemberDetail.modalTitles.recordPayment', 'Valider un paiement'),
    refund: t('clubLicenseMemberDetail.modalTitles.refund', 'Rembourser le paiement'),
    reject: t('clubLicenseMemberDetail.modalTitles.reject', 'Rejeter la déclaration'),
    waive: t('clubLicenseMemberDetail.actions.waive', 'Exempter la cotisation'),
  }[modalType];
  const pendingReviewPayments = (assignment?.payments || []).filter((payment) => payment.status === 'manual_review');
  const paymentHistory = (assignment?.payments || []).slice(0, 6);
  const receipts = assignment?.receipts || [];
  const documentRequests = assignment?.campaign?.documentRequests || [];
  const officialLicenseDocument = assignment?.officialLicenseDocument || null;
  const currency = assignment?.currency || assignment?.campaign?.currency || 'EUR';
  const documentSubmissionByRequestId = useMemo(() => new Map(
    (assignment?.documentSubmissions || [])
      .map((submission) => [
        String(submission?.documentRequest?.documentId || submission?.documentRequest?.id || ''),
        submission,
      ])
      .filter(([key]) => key),
  ), [assignment?.documentSubmissions]);
  const manualMethodOptions = useMemo(() => {
    const enabledMethods = getEnabledManualPaymentMethods(assignment?.campaign?.paymentModes);
    if (enabledMethods.length) return enabledMethods;
    return manualPaymentMethods.map((mode) => ({ label: paymentModeLabels[mode], mode }));
  }, [assignment?.campaign?.paymentModes]);
  const canSendReminder = usefulReminderStatuses.includes(assignment?.status)
    && Number(assignment?.amountRemainingCents || 0) > 0;
  const isLoading = query.isLoading || (
    Boolean(campaignId)
    && routeCanManageLicenses === undefined
    && !routeScope
    && permissionQuery.isLoading
  );
  const hasError = query.isError || permissionQuery.isError;

  const submitModal = useCallback((payload) => {
    // W02 — encaisser suit `canValidatePayment` (le coach delegue y a droit) ;
    // tout le reste reste au dirigeant.
    if (modalType === 'payment' ? !canValidatePayment : !canUseSensitiveActions) return;
    const common = { onSuccess: () => { setModal(null); query.refetch(); } };
    if (modalType === 'payment') manualPaymentMutation.mutate(payload, common);
    if (modalType === 'amount') amountMutation.mutate({ amountDueCents: payload.amountCents, note: payload.note }, common);
    if (modalType === 'waive') waiveMutation.mutate({ reason: payload.reason }, common);
    if (modalType === 'reject') rejectPaymentMutation.mutate({ paymentId: modal.paymentId, reason: payload.reason }, common);
    if (modalType === 'refund') refundMutation.mutate({ amountCents: payload.amountCents, paymentId: modal.paymentId, reason: payload.reason }, common);
    if (modalType === 'document-review') {
      reviewDocumentMutation.mutate({
        paymentId: undefined,
        reason: payload.reason,
        status: modal.reviewStatus || 'to_replace',
        submissionId: modal.submissionId,
      }, {
        ...common,
        // AA07 / K2 — la cause NOMMEE plutot que l alerte generique.
        onError: (error) => Alert.alert(
          t('clubLicenseMemberDetail.alerts.replaceRequest.title', 'Demande non envoyée'),
          error?.message || t(
            'clubLicenseMemberDetail.alerts.replaceRequest.fallback',
            'Le serveur a refusé cette demande de remplacement.',
          ),
        ),
      });
    }
  }, [
    amountMutation,
    canUseSensitiveActions,
    canValidatePayment,
    manualPaymentMutation,
    modal,
    modalType,
    query,
    rejectPaymentMutation,
    refundMutation,
    reviewDocumentMutation,
    waiveMutation,
    t,
  ]);

  const remind = useCallback(() => {
    reminderMutation.mutate({}, {
      onSuccess: () => Alert.alert(t(
        'clubLicenseMemberDetail.alerts.reminderSent',
        'Relance envoyée',
      )),
    });
  }, [reminderMutation, t]);

  // T03 — REMETTRE LA COTISATION A PAYER.
  //
  // Adel, recette du 2026-08-17 : « sur les fiches joueurs, ou tu vois
  // "relancer", il faut aussi le bouton pour dire "a payer" ».
  //
  // On DEMANDE avant : annuler une exemption remet de l argent a la charge de
  // quelqu un, et la personne recoit une notification. La question nomme donc le
  // membre ET le montant — pas « confirmer ? ».
  // ⛔ Aucun message de succes avant la reponse du serveur.
  const setBackToDue = useCallback(() => {
    if (!canUseSensitiveActions) return;
    Alert.alert(
      t('clubLicenseMemberDetail.alerts.setBackToDue.title', 'Remettre cette cotisation à payer ?'),
      t(
        'clubLicenseMemberDetail.alerts.setBackToDue.messageAmount',
        '{{memberName}} devra régler {{amount}}. ',
        {
          amount: formatLicenseMoney(assignment?.amountDueCents, currency),
          memberName,
          ...SANS_ECHAPPEMENT,
        },
      )
      + t(
        'clubLicenseMemberDetail.alerts.setBackToDue.messageExemption',
        'L exemption est annulée, les relances redeviennent possibles, ',
      )
      + t(
        'clubLicenseMemberDetail.alerts.setBackToDue.messageNotice',
        'et la personne en est prévenue.',
      ),
      [
        { style: 'cancel', text: t('clubLicenseMemberDetail.buttons.cancel', 'Annuler') },
        {
          onPress: () => unwaiveMutation.mutate({}, {
            onError: (error) => Alert.alert(
              t(
                'clubLicenseMemberDetail.alerts.setBackToDue.errorTitle',
                'Remise à payer impossible',
              ),
              error?.message || t(
                'clubLicenseMemberDetail.alerts.setBackToDue.errorFallback',
                'Le serveur a refusé ce changement.',
              ),
            ),
            onSuccess: () => {
              query.refetch();
              Alert.alert(
                t('clubLicenseMemberDetail.alerts.setBackToDue.successTitle', 'Cotisation à payer'),
                t(
                  'clubLicenseMemberDetail.alerts.setBackToDue.successMessageStart',
                  '{{memberName}} n est plus exempté·e : le reste à payer est rétabli ',
                  { memberName, ...SANS_ECHAPPEMENT },
                )
                + t(
                  'clubLicenseMemberDetail.alerts.setBackToDue.successMessageEnd',
                  'et tu peux de nouveau relancer.',
                ),
              );
            },
          }),
          text: t('clubLicenseMemberDetail.actions.markDue', 'À payer'),
        },
      ],
    );
  }, [
    assignment?.amountDueCents,
    canUseSensitiveActions,
    currency,
    memberName,
    query,
    unwaiveMutation,
    t,
  ]);

  const approvePayment = useCallback((paymentId) => {
    if (!canUseSensitiveActions) return;
    Alert.alert(t(
      'clubLicenseMemberDetail.alerts.approvePayment.title',
      'Valider le paiement déclare',
    ), t(
      'clubLicenseMemberDetail.alerts.approvePayment.message',
      'Confirmer que le club a bien reçu ce paiement ?',
    ), [
      { style: 'cancel', text: t('clubLicenseMemberDetail.buttons.cancel', 'Annuler') },
      {
        onPress: () => approvePaymentMutation.mutate({ paymentId }, {
          onSuccess: () => query.refetch(),
        }),
        text: t('clubLicenseMemberDetail.buttons.approve', 'Valider'),
      },
    ]);
  }, [approvePaymentMutation, canUseSensitiveActions, query, t]);

  const approveDocument = useCallback((submissionId) => {
    if (!canUseSensitiveActions) return;
    Alert.alert(t('clubLicenseMemberDetail.documents.accept', 'Accepter ce document'), t(
      'clubLicenseMemberDetail.alerts.approveDocument.message',
      'Confirmer que ce document est conforme ?',
    ), [
      { style: 'cancel', text: t('clubLicenseMemberDetail.buttons.cancel', 'Annuler') },
      {
        onPress: () => reviewDocumentMutation.mutate({ status: 'validated', submissionId }, {
          // AA07 / K2 — un refus DIT sa cause. Sans ce `onError`, l alerte
          // generique de `App.js` affichait « une erreur » et le dirigeant ne
          // pouvait rien en faire — c est ce qu Adel a decrit.
          onError: (error) => Alert.alert(
            t('clubLicenseMemberDetail.alerts.approveDocument.errorTitle', 'Document non accepté'),
            error?.message || t(
              'clubLicenseMemberDetail.alerts.approveDocument.errorFallback',
              'Le serveur a refusé cette acceptation. Réessaie dans un instant.',
            ),
          ),
          onSuccess: () => {
            query.refetch();
            Alert.alert(t(
              'clubLicenseMemberDetail.alerts.approveDocument.successTitle',
              'Document accepté',
            ), t(
              'clubLicenseMemberDetail.alerts.approveDocument.successMessage',
              'Le membre est prévenu que sa pièce est conforme.',
            ));
          },
        }),
        text: t('clubLicenseMemberDetail.alerts.approveDocument.confirm', 'Accepter'),
      },
    ]);
  }, [canUseSensitiveActions, query, reviewDocumentMutation, t]);

  const generateReceiptForPayment = useCallback((paymentId) => {
    receiptMutation.mutate(paymentId, {
      onSuccess: () => {
        query.refetch();
        Alert.alert(t('clubLicenseMemberDetail.alerts.receipt.title', 'Reçu génère'), t(
          'clubLicenseMemberDetail.alerts.receipt.message',
          'Le reçu est maintenant rattache à ce paiement.',
        ));
      },
    });
  }, [query, receiptMutation, t]);

  // AA07 / K2 — LE MEME DEFAUT QUE SUR `MyLicense`, ET C EST L ECRAN QU ADEL
  // DECRIT (« voir / valider / remplacer », avec « ouvrir » qui marche).
  // Le bouton « Voir la licence » s affichait sur `officialLicenseDocument.file.url`
  // et agissait sur `officialLicenseDocument.SUBMISSION.file.url` : deux
  // chemins pour un seul bouton. §1 bis — on corrige les DEUX appelants, pas
  // seulement celui cite par le constat, sinon le frere reste casse.
  const fileUrlOf = useCallback((/** @type {any} */ source) => resolveMediaUrl(
    source?.file?.url
    || source?.submission?.file?.url
    || source?.file?.formats?.thumbnail?.url
    || '',
  ), []);

  const openUploadedDocument = useCallback(async (/** @type {any} */ source) => {
    const url = fileUrlOf(source);
    if (!url) {
      Alert.alert(t(
        'clubLicenseMemberDetail.alerts.document.unavailableTitle',
        'Document indisponible',
      ), t(
        'clubLicenseMemberDetail.alerts.document.unavailableMessage',
        'Aucun fichier exploitable n est rattaché à ce dépôt.',
      ));
      return;
    }
    await LinksPlatform.openUrl(url);
  }, [fileUrlOf, t]);

  // AA07 / K2 — « on doit pouvoir telecharger le document » (Adel, 20/08).
  // Le club aussi : c est lui qui archive les certificats medicaux.
  const downloadDocument = useCallback(async (/** @type {any} */ source, /** @type {any} */ fileName) => {
    const url = fileUrlOf(source);
    if (!url) {
      Alert.alert(t(
        'clubLicenseMemberDetail.alerts.document.unavailableTitle',
        'Document indisponible',
      ), t(
        'clubLicenseMemberDetail.alerts.document.unavailableMessage',
        'Aucun fichier exploitable n est rattaché à ce dépôt.',
      ));
      return;
    }
    try {
      await downloadRemoteFile({ fileName, url });
    } catch (error) {
      Alert.alert(
        t(
          'clubLicenseMemberDetail.alerts.document.downloadFailedTitle',
          'Téléchargement impossible',
        ),
        error?.message || t(
          'clubLicenseMemberDetail.alerts.document.downloadFailedFallback',
          'Le document n a pas pu être enregistré sur ton téléphone.',
        ),
      );
    }
  }, [fileUrlOf, t]);

  const submitOfficialLicenseFile = useCallback(async (picked) => {
    if (!canUseSensitiveActions || !assignmentId) return;
    const file = Array.isArray(picked) ? picked[0] : picked;
    if (!file) return;
    officialLicenseMutation.mutate({ file }, {
      onSuccess: () => {
        query.refetch();
        Alert.alert(t(
          'clubLicenseMemberDetail.alerts.officialLicense.addedTitle',
          'Licence ajoutée',
        ), t(
          'clubLicenseMemberDetail.alerts.officialLicense.addedMessage',
          'La licence officielle est maintenant disponible pour les personnes autorisées.',
        ));
      },
    });
  }, [assignmentId, canUseSensitiveActions, officialLicenseMutation, query, t]);

  const uploadOfficialLicense = useCallback(() => {
    if (!canUseSensitiveActions) return;
    Alert.alert(
      t('clubLicenseMemberDetail.officialLicense.add', 'Ajouter la licence'),
      t(
        'clubLicenseMemberDetail.alerts.officialLicense.pickMessage',
        'Choisis une source pour importer la licence officielle.',
      ),
      [
        {
          onPress: async () => {
            try {
              await submitOfficialLicenseFile(await MediaPlatform.capturePhoto({}));
            } catch (error) {
              if (!isPickerCancelError(error)) {
                Alert.alert(t(
                  'clubLicenseMemberDetail.alerts.officialLicense.uploadFailedTitle',
                  'Upload impossible',
                ), error?.message || t(
                  'clubLicenseMemberDetail.alerts.officialLicense.takePhotoFailed',
                  'La photo n a pas pu être prise.',
                ));
              }
            }
          },
          text: t('clubLicenseMemberDetail.alerts.officialLicense.takePhoto', 'Prendre une photo'),
        },
        {
          onPress: async () => {
            try {
              await submitOfficialLicenseFile(await MediaPlatform.pickImage({}));
            } catch (error) {
              if (!isPickerCancelError(error)) {
                Alert.alert(t(
                  'clubLicenseMemberDetail.alerts.officialLicense.uploadFailedTitle',
                  'Upload impossible',
                ), error?.message || t(
                  'clubLicenseMemberDetail.alerts.officialLicense.chooseImageFailed',
                  'La photo n a pas pu être choisie.',
                ));
              }
            }
          },
          text: t(
            'clubLicenseMemberDetail.alerts.officialLicense.chooseImage',
            'Choisir une image',
          ),
        },
        {
          onPress: async () => {
            try {
              await submitOfficialLicenseFile(await MediaPlatform.pickDocument(getDocumentPickerOptions()));
            } catch (error) {
              if (!isPickerCancelError(error)) {
                Alert.alert(t(
                  'clubLicenseMemberDetail.alerts.officialLicense.uploadFailedTitle',
                  'Upload impossible',
                ), error?.message || t(
                  'clubLicenseMemberDetail.alerts.officialLicense.importFileFailed',
                  'Le fichier n a pas pu être choisi.',
                ));
              }
            }
          },
          text: t(
            'clubLicenseMemberDetail.alerts.officialLicense.importFile',
            'Importer un fichier',
          ),
        },
        { style: 'cancel', text: t('clubLicenseMemberDetail.buttons.cancel', 'Annuler') },
      ],
    );
  }, [canUseSensitiveActions, submitOfficialLicenseFile, t]);

  const retryData = useCallback(() => {
    query.refetch();
    if (campaignId) permissionQuery.refetch();
  }, [campaignId, permissionQuery, query]);

  if (isLoading) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          description={t(
            'clubLicenseMemberDetail.loading.description',
            'On récupère la cotisation et les droits associes.',
          )}
          title={t('clubLicenseMemberDetail.loading.title', 'Chargement de la fiche')}
        />
      </ScreenContainer>
    );
  }

  if (hasError) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          action={(
            <Button
              onPress={retryData}
              title={t(
                'clubLicenseMemberDetail.error.retry',
                'Réessayer',
              )}
              variant="Secondary"
            />
)}
          description={t(
            'clubLicenseMemberDetail.error.description',
            'Impossible de charger cette fiche cotisation pour le moment.',
          )}
          title={t('clubLicenseMemberDetail.error.title', 'Fiche indisponible')}
        />
      </ScreenContainer>
    );
  }

  if (!assignment) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          description={t(
            'clubLicenseMemberDetail.notFound.description',
            'Cette cotisation est introuvable ou n est plus accessible.',
          )}
          title={t('clubLicenseMemberDetail.notFound.title', 'Cotisation introuvable')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="none" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: Math.max(insets.bottom + 8, 12) }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[Fonts.h2, Fonts.neutral00]}>{memberName}</Text>
          <View style={[Spaces.marginTop[8], Spaces.gap[licenseSpacing.titleGap]]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {assignment?.team?.name || t(
                'clubLicenseMemberDetail.header.noTeam',
                'Sans équipe',
              )}
            </Text>
            <LicenseStatusChip status={assignment?.status} />
          </View>
        </View>
        <LicenseCard>
          <LicenseMetricRow
            items={[
              {
                label: t(
                  'clubLicenseMemberDetail.metrics.total',
                  'Total',
                ),
                value: formatLicenseMoney(assignment?.amountDueCents, currency),
              },
              {
                label: t(
                  'clubLicenseMemberDetail.metrics.paid',
                  'Paye',
                ),
                value: formatLicenseMoney(assignment?.amountPaidCents, currency),
              },
              {
                label: t(
                  'clubLicenseMemberDetail.metrics.remaining',
                  'Reste',
                ),
                value: formatLicenseMoney(assignment?.amountRemainingCents, currency),
              },
            ]}
          />
        </LicenseCard>
        {!canUseSensitiveActions ? (
          <LicenseEmptyState
            description={t(
              'clubLicenseMemberDetail.coachView.description',
              'Les validations de paiement, exemptions et modifications de montant sont '
                + 'réservées aux dirigeants.',
            )}
            title={t('clubLicenseMemberDetail.coachView.title', 'Vue entraîneur')}
          />
        ) : null}
        {pendingReviewPayments.length ? (
          <>
            <LicenseSectionHeader
              description={canUseSensitiveActions
                ? t(
                  'clubLicenseMemberDetail.pendingPayments.descriptionManager',
                  'Ces déclarations viennent du joueur ou d un payeur externe et doivent '
                    + 'être controlees.',
                )
                : t(
                  'clubLicenseMemberDetail.pendingPayments.descriptionCoach',
                  'Déclarations en attente de validation par un dirigeant.',
                )}
              title={canUseSensitiveActions ? t(
                'clubLicenseMemberDetail.pendingPayments.titleManager',
                'Paiements à valider',
              ) : t(
                'clubLicenseMemberDetail.pendingPayments.titleCoach',
                'Paiements declares',
              )}
            />
            {pendingReviewPayments.map((payment) => (
              <LicenseCard key={payment.documentId || payment.id}>
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <InfoRow
                    label={t(
                      'clubLicenseMemberDetail.pendingPayments.declaredAmount',
                      'Montant déclare',
                    )}
                    value={formatLicenseMoney(payment.amountCents, payment.currency || currency)}
                  />
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {paymentModeLabels[payment.method] || payment.method || t(
                      'clubLicenseMemberDetail.pendingPayments.noMethod',
                      'Méthode non précisée',
                    )}
                    {' '}
                    -
                    {' '}
                    {payment.note || payment.externalPaymentId || t(
                      'clubLicenseMemberDetail.pendingPayments.noReference',
                      'Aucune référence fournie.',
                    )}
                  </Text>
                  {canUseSensitiveActions ? (
                    <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                      <Button
                        isLoading={approvePaymentMutation.isPending}
                        onPress={() => approvePayment(payment.documentId || payment.id)}
                        style={{ flex: 1 }}
                        title={t(
                          'clubLicenseMemberDetail.buttons.approve',
                          'Valider',
                        )}
                      />
                      <Button
                        onPress={() => setModal({
                          paymentId: payment.documentId || payment.id,
                          type: 'reject',
                        })}
                        style={{ flex: 1 }}
                        title={t(
                          'clubLicenseMemberDetail.buttons.reject',
                          'Rejeter',
                        )}
                        variant="Secondary"
                      />
                    </View>
                  ) : null}
                </View>
              </LicenseCard>
            ))}
          </>
        ) : null}
        <LicenseSectionHeader title={t('clubLicenseMemberDetail.schedule.title', 'Echeancier')} />
        <LicenseInstallmentList currency={currency} installments={assignment?.installments || []} />
        <LicenseSectionHeader
          description={canUseSensitiveActions
            ? t(
              'clubLicenseMemberDetail.officialLicense.descriptionManager',
              'Ajoute ou remplace la licence officielle de cet adherent.',
            )
            : t(
              'clubLicenseMemberDetail.officialLicense.descriptionCoach',
              'Consulte la licence officielle de cet adherent si elle est disponible.',
            )}
          title={t('clubLicenseMemberDetail.officialLicense.title', 'Licence officielle')}
        />
        <LicenseCard variant="muted">
          <View style={Spaces.gap[licenseSpacing.actionGap]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {officialLicenseDocument?.request?.name || t(
                'clubLicenseMemberDetail.officialLicense.title',
                'Licence officielle',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {officialLicenseDocument?.uploadedAt
                ? t(
                  'clubLicenseMemberDetail.lastUpdated',
                  'Dernière mise à jour {{date}}',
                  {
                    date: documentDate(officialLicenseDocument.submission || {}) || '-',
                    ...SANS_ECHAPPEMENT,
                  },
                )
                : t(
                  'clubLicenseMemberDetail.officialLicense.none',
                  'Aucune licence officielle n est encore disponible.',
                )}
            </Text>
            {officialLicenseDocument?.submission?.status ? (
              <LicenseStatusChip status={officialLicenseDocument.submission.status} />
            ) : null}
            {fileUrlOf(officialLicenseDocument) ? (
              <>
                <Button
                  onPress={() => openUploadedDocument(officialLicenseDocument)}
                  title={t('clubLicenseMemberDetail.officialLicense.open', 'Ouvrir la licence')}
                  variant="Secondary"
                />
                <Button
                  onPress={() => downloadDocument(officialLicenseDocument, 'licence-officielle')}
                  title={t(
                    'clubLicenseMemberDetail.officialLicense.download',
                    'Télécharger la licence',
                  )}
                  variant="Secondary"
                />
              </>
            ) : null}
            {canUseSensitiveActions ? (
              <Button
                isLoading={officialLicenseMutation.isPending}
                onPress={uploadOfficialLicense}
                title={officialLicenseDocument?.file?.url ? t(
                  'clubLicenseMemberDetail.officialLicense.replace',
                  'Remplacer la licence',
                ) : t(
                  'clubLicenseMemberDetail.officialLicense.add',
                  'Ajouter la licence',
                )}
              />
            ) : null}
          </View>
        </LicenseCard>
        <LicenseSectionHeader
          description={canUseSensitiveActions
            ? t(
              'clubLicenseMemberDetail.documents.descriptionManager',
              'Valide ou redemande les pièces fournies par le membre.',
            )
            : t(
              'clubLicenseMemberDetail.documents.descriptionCoach',
              'Statut des pièces rattachées à cette cotisation.',
            )}
          title={t('clubLicenseMemberDetail.documents.title', 'Documents')}
        />
        {documentRequests.length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {documentRequests.map((request) => {
              const requestKey = String(request?.documentId || request?.id || '');
              const submission = documentSubmissionByRequestId.get(requestKey);
              const submissionStatus = submission?.status || 'missing';
              return (
                <LicenseCard key={requestKey || request?.name} variant="muted">
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
                          {request?.name || t(
                            'clubLicenseMemberDetail.documents.fallbackName',
                            'Document',
                          )}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {request?.dueDate ? t(
                            'clubLicenseMemberDetail.documents.dueBefore',
                            'A remettre avant {{dueDate}}',
                            { dueDate: request.dueDate, ...SANS_ECHAPPEMENT },
                          ) : t(
                            'clubLicenseMemberDetail.documents.noDeadline',
                            'Pas de date limite définie',
                          )}
                          {request?.required === false ? t(
                            'clubLicenseMemberDetail.documents.optionalSuffix',
                            ' - Facultatif',
                          ) : t(
                            'clubLicenseMemberDetail.documents.requiredSuffix',
                            ' - Obligatoire',
                          )}
                        </Text>
                      </View>
                      <LicenseStatusChip status={submissionStatus} />
                    </View>
                    {request?.description ? <Text style={[Fonts.p3, Fonts.neutral200]}>{request.description}</Text> : null}
                    {submission?.refusalReason ? (
                      <Text style={[Fonts.p3, { color: '#fda4af' }]}>{submission.refusalReason}</Text>
                    ) : null}
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {submission ? t(
                        'clubLicenseMemberDetail.lastUpdated',
                        'Dernière mise à jour {{date}}',
                        { date: documentDate(submission) || '-', ...SANS_ECHAPPEMENT },
                      ) : t(
                        'clubLicenseMemberDetail.documents.noneSubmitted',
                        'Aucun document déposé',
                      )}
                    </Text>
                    {/*
                      AA07 / K2 — CHAQUE BOUTON DIT CE QU IL FAIT.
                      Adel : « voir / valider / remplacer ne sont ni clairs ni
                      comprehensibles ». « Valider » ne disait pas valider QUOI
                      (le document ? le paiement ? la cotisation ?) sur un ecran
                      qui porte AUSSI un bouton « Valider » pour les paiements.
                      « A remplacer » ne disait pas que ça previent le membre.
                    */}
                    {fileUrlOf(submission) ? (
                      <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                        <Button
                          onPress={() => openUploadedDocument(submission)}
                          style={{ flex: 1 }}
                          title={t('clubLicenseMemberDetail.documents.open', 'Ouvrir le document')}
                          variant="Secondary"
                        />
                        <Button
                          onPress={() => downloadDocument(submission, request?.name)}
                          style={{ flex: 1 }}
                          title={t('clubLicenseMemberDetail.documents.download', 'Télécharger')}
                          variant="Secondary"
                        />
                      </View>
                    ) : null}
                    {canUseSensitiveActions && submission ? (
                      <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                        <Button
                          onPress={() => approveDocument(submission.documentId || submission.id)}
                          style={{ flex: 1 }}
                          title={t(
                            'clubLicenseMemberDetail.documents.accept',
                            'Accepter ce document',
                          )}
                        />
                        <Button
                          onPress={() => setModal({
                            reviewStatus: 'to_replace',
                            submissionId: submission.documentId || submission.id,
                            type: 'document-review',
                          })}
                          style={{ flex: 1 }}
                          title={t(
                            'clubLicenseMemberDetail.documents.requestReplacement',
                            'Demander un remplacement',
                          )}
                          variant="Secondary"
                        />
                      </View>
                    ) : null}
                  </View>
                </LicenseCard>
              );
            })}
          </View>
        ) : (
          <LicenseEmptyState
            description={t(
              'clubLicenseMemberDetail.documents.emptyDescription',
              'Aucune pièce n est demandée pour cette campagne.',
            )}
            title={t('clubLicenseMemberDetail.documents.emptyTitle', 'Pas de documents')}
          />
        )}
        <LicenseSectionHeader title={t('clubLicenseMemberDetail.history.title', 'Historique')} />
        {paymentHistory.length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {paymentHistory.map((payment) => (
              <LicenseCard key={payment.documentId || payment.id} variant="muted">
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <LicenseMetricRow
                    items={[
                      {
                        label: paymentStatusLabels[payment.status] || payment.status || t(
                          'clubLicenseMemberDetail.history.paymentFallback',
                          'Paiement',
                        ),
                        value: formatLicenseMoney(
                          payment.amountCents,
                          payment.currency || currency,
                        ),
                      },
                      {
                        label: t(
                          'clubLicenseMemberDetail.history.method',
                          'Methode',
                        ),
                        value: paymentModeLabels[payment.method] || payment.method || '-',
                      },
                      {
                        label: t(
                          'clubLicenseMemberDetail.history.date',
                          'Date',
                        ),
                        value: paymentDate(payment) || '-',
                      },
                    ]}
                  />
                  {payment?.receiptNumber ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {t(
                        'clubLicenseMemberDetail.history.receiptNumber',
                        'Recu {{receiptNumber}}',
                        { receiptNumber: payment.receiptNumber, ...SANS_ECHAPPEMENT },
                      )}
                    </Text>
                  ) : null}
                  {(payment?.refunds || []).map((refund) => (
                    <Text key={refund.documentId || refund.id} style={[Fonts.p3, Fonts.neutral200]}>
                      {t(
                        'clubLicenseMemberDetail.history.refundLine',
                        'Remboursement {{amount}} - {{status}}',
                        {
                          amount: formatLicenseMoney(
                            refund.amountCents,
                            refund.currency || payment.currency || currency,
                          ),
                          status: paymentStatusLabels[refund.status] || refund.status || t(
                            'clubLicenseMemberDetail.paymentStatus.pending',
                            'En attente',
                          ),
                          ...SANS_ECHAPPEMENT,
                        },
                      )}
                    </Text>
                  ))}
                  {canUseSensitiveActions && ['confirmed', 'partially_refunded'].includes(payment?.status) ? (
                    <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                      {!payment?.receipt ? (
                        <Button
                          isLoading={receiptMutation.isPending}
                          onPress={() => generateReceiptForPayment(payment.documentId || payment.id)}
                          style={{ flex: 1 }}
                          title={t(
                            'clubLicenseMemberDetail.history.generateReceipt',
                            'Générer un reçu',
                          )}
                          variant="Secondary"
                        />
                      ) : null}
                      {refundableAmount(payment) > 0 ? (
                        <Button
                          onPress={() => setModal({ paymentId: payment.documentId || payment.id, type: 'refund' })}
                          style={{ flex: 1 }}
                          title={t('clubLicenseMemberDetail.history.refund', 'Rembourser')}
                          variant="Secondary"
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description={t(
              'clubLicenseMemberDetail.history.emptyDescription',
              'Aucun paiement n est encore rattache à cette cotisation.',
            )}
            title={t('clubLicenseMemberDetail.history.emptyTitle', 'Aucun historique')}
          />
        )}
        <LicenseSectionHeader title={t('clubLicenseMemberDetail.receipts.title', 'Recus')} />
        {receipts.length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {receipts.map((receipt) => (
              <LicenseCard key={receipt.documentId || receipt.id} variant="muted">
                <LicenseMetricRow
                  items={[
                    {
                      label: t(
                        'clubLicenseMemberDetail.receipts.number',
                        'Numero',
                      ),
                      value: receipt.receiptNumber || '-',
                    },
                    {
                      label: t(
                        'clubLicenseMemberDetail.receipts.amount',
                        'Montant',
                      ),
                      value: formatLicenseMoney(receipt.amountCents, receipt.currency || currency),
                    },
                    {
                      label: t(
                        'clubLicenseMemberDetail.receipts.issued',
                        'Emission',
                      ),
                      value: String(receipt.issuedAt || '').slice(0, 10) || '-',
                    },
                  ]}
                />
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description={t(
              'clubLicenseMemberDetail.receipts.emptyDescription',
              'Les reçus apparaîtront ici après validation des paiements.',
            )}
            title={t('clubLicenseMemberDetail.receipts.emptyTitle', 'Aucun reçu')}
          />
        )}
        {canSendReminder || canValidatePayment || canUseSensitiveActions ? (
          <>
            <LicenseSectionHeader title={t('clubLicenseMemberDetail.actions.title', 'Actions')} />
            {canSendReminder ? (
              <Button
                isLoading={reminderMutation.isPending}
                onPress={remind}
                title={t(
                  'clubLicenseMemberDetail.actions.remind',
                  'Relancer',
                )}
                variant="Secondary"
              />
            ) : null}
            {/*
              W02 — « A payé », le geste qu Adel a cherche deux fois. Il s appelait
              « Valider un paiement » et se tenait en bas de la pile ; il est
              renomme et remonte JUSTE a cote de « Relancer ».

              ⚠️ LE COUPLE DE LIBELLES : la fiche porte deja « À payer » (T03,
              annuler une exemption). Cote a cote ils se confondraient — ils sont
              donc MUTUELLEMENT EXCLUSIFS : « À payer » ne sort que sur une
              cotisation exemptee, « A payé » ne sort JAMAIS sur une exemptee
              (encaisser sur une exemption n a aucun sens, et le serveur la
              laisserait « waived » de toute facon).
            */}
            {canValidatePayment && assignment?.status !== 'waived' ? (
              <Button
                onPress={() => setModal({ type: 'payment' })}
                title={t(
                  'clubLicenseMemberDetail.actions.markPaid',
                  'A payé',
                )}
              />
            ) : null}
            {/*
              T03 — le miroir d « Exempter la cotisation ».
              ⛔ AUCUN BOUTON INERTE : il n apparait que sur une cotisation
              EXEMPTEE. Ailleurs il n aurait rien a faire — une cotisation en
              attente est deja a payer — et le serveur refuserait.
            */}
            {canUseSensitiveActions && assignment?.status === 'waived' ? (
              <Button
                isLoading={unwaiveMutation.isPending}
                onPress={setBackToDue}
                title={t('clubLicenseMemberDetail.actions.markDue', 'À payer')}
                variant="Secondary"
              />
            ) : null}
            {canUseSensitiveActions ? (
              <>
                <Button
                  onPress={() => setModal({ type: 'amount' })}
                  title={t(
                    'clubLicenseMemberDetail.actions.changeAmount',
                    'Modifier le montant',
                  )}
                  variant="Secondary"
                />
                <Button
                  onPress={() => setModal({ type: 'waive' })}
                  title={t(
                    'clubLicenseMemberDetail.actions.waive',
                    'Exempter la cotisation',
                  )}
                  variant="Secondary"
                />
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {modal && (canUseSensitiveActions || (modalType === 'payment' && canValidatePayment)) ? (
        <ActionModal
          methodOptions={manualMethodOptions}
          onClose={() => setModal(null)}
          onSubmit={submitModal}
          title={modalTitle}
          type={modalType}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default ClubLicenseMemberDetail;
