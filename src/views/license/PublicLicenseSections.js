import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import {
  LicenseCard,
  LicenseEmptyState,
  LicenseInstallmentList,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
} from './licenseDesignSystem';

// T-PARENT (15/11) — les rubriques propres à une LICENCE de la page publique `/licenses/pay/:token`
// (PublicLicensePayment.js), sorties telles quelles : une place de tournoi ne les montre pas
// (Campagne, Échéancier, Documents demandés). Une licence les garde, inchangées.

/**
 * « Campagne » puis « Échéancier ».
 * @param {object} props - Les propriétés.
 * @param {string} props.currency - La devise.
 * @param {any} props.payment - La page publique lue sur le serveur.
 * @returns {import('react').ReactElement} Les deux rubriques.
 */
export function LicenseCampaignBlock({ currency, payment }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  return (
    <>
      <LicenseSectionHeader title={t('publicLicensePayment.campaign.title', 'Campagne')} />
      <LicenseCard variant="muted">
        <View style={Spaces.gap[licenseSpacing.actionGap]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {payment?.seasonLabel || t(
              'publicLicensePayment.campaign.seasonFallback',
              'Cotisation en cours',
            )}
          </Text>
          {payment?.description ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>{payment.description}</Text>
          ) : null}
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
    </>
  );
}

/**
 * « Documents demandés ».
 * @param {object} props - Les propriétés.
 * @param {any[]} [props.documentRequests] - Les pièces demandées.
 * @returns {import('react').ReactElement} La rubrique.
 */
export function LicenseDocumentsBlock({ documentRequests }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  return (
    <>
      <LicenseSectionHeader title={t(
        'publicLicensePayment.documents.title',
        'Documents demandes',
      )}
      />
      {(documentRequests || []).length ? (
        <View style={Spaces.gap[licenseSpacing.listGap]}>
          {(documentRequests || []).map((request) => (
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
                {request.description ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{request.description}</Text>
                ) : null}
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
    </>
  );
}
