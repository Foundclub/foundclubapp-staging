import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

export const licenseSpacing = {
  actionGap: 12,
  cardPadding: 16,
  fieldGap: 16,
  heroPadding: 20,
  listGap: 12,
  page: 24,
  pageWide: 32,
  sectionGap: 24,
  titleGap: 8,
};

export const licenseRadius = {
  card: 16,
  hero: 20,
  panel: 24,
  pill: 999,
  sheet: 20,
};

export const licenseStatusLabels = {
  active: 'Active',
  cancelled: 'Annulee',
  closed: 'Cloturee',
  draft: 'Brouillon',
  manual_review: 'A valider',
  not_configured: 'A configurer',
  not_due: 'Non due',
  overdue: 'En retard',
  paid: 'Payee',
  partial: 'Partiel',
  pending: 'En attente',
  waived: 'Exemptee',
};

export const paymentModeLabels = {
  bank_transfer: 'Virement',
  card_physical: 'Carte au club',
  cash: 'Especes',
  check: 'Cheque',
  external_link: 'Lien club',
  helloasso: 'HelloAsso',
  stripe: 'Carte en ligne',
};

export const paymentInstructionFields = {
  bank_transfer: 'bankTransferInstructions',
  card_physical: 'cardPhysicalInstructions',
  cash: 'cashInstructions',
  check: 'checkInstructions',
};

export const formatLicenseMoney = (value = 0, currency = 'EUR') => new Intl.NumberFormat('fr-FR', {
  currency,
  style: 'currency',
}).format((Number(value) || 0) / 100);

export const getInstallmentOrder = (installment = {}) => installment.installmentOrder || installment.order || 1;

export const normalizePaymentModes = (raw = {}) => ({
  bank_transfer: raw.bank_transfer !== false,
  card_physical: Boolean(raw.card_physical),
  cash: raw.cash !== false,
  check: raw.check !== false,
  external_link: Boolean(raw.external_link),
  helloasso: Boolean(raw.helloasso),
  stripe: Boolean(raw.stripe),
});

export const getLicenseStatusTone = (Colors, status) => ({
  active: Colors.success500,
  closed: Colors.neutral200,
  draft: Colors.primary200,
  manual_review: Colors.warning500,
  not_configured: Colors.neutral300,
  overdue: Colors.error500,
  paid: Colors.success500,
  partial: Colors.primary200,
  pending: Colors.primary500,
  waived: Colors.neutral200,
}[status] || Colors.primary500);

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.style
 * @param root0.tone
 * @param root0.variant
 */
export function LicenseCard({
  children, style, tone, variant = 'default',
}) {
  const { ApplicationStyle, Colors } = useTheme();
  const backgroundColor = variant === 'muted' ? Colors.primary800 : Colors.primary700;

  return (
    <View
      style={[ApplicationStyle.card, {
        backgroundColor,
        borderColor: `${tone || Colors.primary500}55`,
        borderRadius: licenseRadius.card,
        paddingHorizontal: licenseSpacing.cardPadding,
        paddingVertical: licenseSpacing.cardPadding,
      }, style]}
    >
      {children}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.description
 * @param root0.title
 */
export function LicenseSectionHeader({ description, title }) {
  const { Fonts, Spaces } = useTheme();

  return (
    <View style={Spaces.gap[licenseSpacing.titleGap]}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
      {description ? <Text style={[Fonts.p2, Fonts.neutral200]}>{description}</Text> : null}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.status
 */
export function LicenseStatusChip({ status }) {
  const { Colors, Fonts } = useTheme();
  const tone = getLicenseStatusTone(Colors, status);

  return (
    <View style={{
      alignSelf: 'flex-start',
      backgroundColor: `${tone}22`,
      borderColor: `${tone}99`,
      borderRadius: licenseRadius.pill,
      borderWidth: 1,
      paddingHorizontal: licenseSpacing.listGap,
      paddingVertical: 4,
    }}
    >
      <Text style={[Fonts.p3Bold, { color: tone }]}>{licenseStatusLabels[status] || status || 'Inconnu'}</Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.items
 */
export function LicenseMetricRow({ items }) {
  const { Fonts, Spaces } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
      {(items || []).map((item) => (
        <View key={item.label} style={[Spaces.gap[4], { flex: 1 }]}>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{item.label}</Text>
          <Text numberOfLines={1} style={[Fonts.p1Bold, item.tone ? { color: item.tone } : Fonts.neutral00]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.action
 * @param root0.description
 * @param root0.title
 */
export function LicenseEmptyState({ action, description, title }) {
  const { Fonts, Spaces } = useTheme();

  return (
    <LicenseCard variant="muted">
      <View style={Spaces.gap[licenseSpacing.actionGap]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{description}</Text>
        {action || null}
      </View>
    </LicenseCard>
  );
}

/**
 *
 * @param root0
 * @param root0.currency
 * @param root0.installments
 */
export function LicenseInstallmentList({ currency = 'EUR', installments = [] }) {
  const { Colors, Fonts, Spaces } = useTheme();

  if (!installments.length) {
    return (
      <LicenseEmptyState
        description="Aucune echeance detaillee n est encore disponible."
        title="Echeancier indisponible"
      />
    );
  }

  return (
    <View style={Spaces.gap[licenseSpacing.listGap]}>
      {installments.map((installment) => {
        const tone = getLicenseStatusTone(Colors, installment.status);
        return (
          <LicenseCard key={installment.documentId || installment.id || getInstallmentOrder(installment)} tone={tone}>
            <View style={Spaces.gap[licenseSpacing.titleGap]}>
              <View style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: licenseSpacing.actionGap,
                justifyContent: 'space-between',
              }}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  Echeance
                  {' '}
                  {getInstallmentOrder(installment)}
                </Text>
                <Text style={[Fonts.p2Bold, { color: tone }]}>
                  {formatLicenseMoney(installment.amountDueCents, currency)}
                </Text>
              </View>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {installment.dueDate || 'Date non definie'}
                {' '}
                -
                {' '}
                {licenseStatusLabels[installment.status] || installment.status}
              </Text>
            </View>
          </LicenseCard>
        );
      })}
    </View>
  );
}
