import { Pressable, Text, View } from 'react-native';

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
  checkout_failed: 'Test checkout en erreur',
  closed: 'Cloturee',
  confirmed: 'Valide',
  credentials_missing: 'Configuration incomplète',
  disabled: 'Desactive',
  disputed: 'Litige',
  draft: 'Brouillon',
  failed: 'Echoue',
  issued: 'Emis',
  link_missing: 'Lien manquant',
  manual_review: 'A valider',
  missing: 'Manquant',
  not_configured: 'A configurer',
  not_due: 'Non due',
  oauth_failed: 'OAuth en erreur',
  overdue: 'En retard',
  paid: 'Payee',
  partial: 'Partiel',
  partially_refunded: 'Remboursement partiel',
  pending: 'En attente',
  ready: 'Pret',
  refunded: 'Remboursee',
  refused: 'Refuse',
  rejected: 'Rejete',
  scheduled: 'Programmee',
  submitted: 'Depose',
  to_replace: 'A remplacer',
  validated: 'Valide',
  waived: 'Exemptee',
  webhook_pending: 'Webhook à confirmer',
  webhook_stale: 'Webhook à vérifier',
};

// ⛔ Les CLES sont les valeurs de `paymentModes` en base. Seuls les LIBELLES
// changent ici, pour porter leurs accents (defaut de recette du 2026-08-07).
export const paymentModeLabels = {
  bank_transfer: 'Virement',
  card_physical: 'Carte au club',
  cash: 'Espèces',
  check: 'Chèque',
  custom: 'Autre moyen',
  external_link: 'Lien externe club',
  helloasso: 'HelloAsso',
  stripe: 'Carte en ligne',
};

export const paymentInstructionFields = {
  bank_transfer: 'bankTransferInstructions',
  card_physical: 'cardPhysicalInstructions',
  cash: 'cashInstructions',
  check: 'checkInstructions',
};

export const manualPaymentMethods = ['cash', 'check', 'bank_transfer', 'card_physical', 'custom'];

export const formatLicenseMoney = (value = 0, currency = 'EUR') => new Intl.NumberFormat('fr-FR', {
  currency,
  style: 'currency',
}).format((Number(value) || 0) / 100);

export const getInstallmentOrder = (installment = {}) => installment.installmentOrder || installment.order || 1;

// ── HelloAsso ──────────────────────────────────────────────────────────────
// D26 : ces 4 fonctions vivaient dans le tunnel de campagne. Elles en sortent
// parce que la connexion HelloAsso est un reglage de CLUB, pas de campagne — la
// charge utile envoyee au serveur porte un `clubId`, jamais un `campaignId`.
// Le tunnel n'en garde que la LECTURE (« Compte du club connecté ✓ ») ; le
// formulaire vit desormais dans une feuille du hub des Cotisations.

const helloAssoReadyStates = new Set(['ready', 'webhook_pending', 'webhook_stale']);

export const getHelloAssoSnapshot = (campaign) => campaign?.paymentProviderSnapshot?.helloasso || null;

export const isHelloAssoReadyForCampaign = (snapshot) => helloAssoReadyStates
  .has(String(snapshot?.readiness || '').trim());

export const createHelloAssoDraft = (snapshot) => ({
  clientId: '',
  clientSecret: '',
  environment: snapshot?.environment || 'production',
  organizationSlug: snapshot?.organizationSlug || '',
});

export const describeHelloAssoReadiness = (snapshot) => {
  const readiness = String(snapshot?.readiness || '').trim();
  return {
    checkout_failed: 'Le test de checkout HelloAsso a échoué. Vérifie le slug organisation et les droits API.',
    credentials_missing: 'Renseigne le slug, le client id et le client secret avant publication.',
    disabled: 'HelloAsso est désactivé pour ce scope.',
    oauth_failed: 'OAuth HelloAsso en erreur. Vérifie le client id et le client secret.',
    pending: 'La configuration HelloAsso existe, mais elle n a pas encore été vérifiée.',
    ready: 'Connexion HelloAsso validée. La campagne peut utiliser le paiement in-app.',
    webhook_pending: 'Connexion validée. Le premier paiement doit encore confirmer le webhook.',
    webhook_stale: 'Connexion validée, mais aucun webhook récent n a été vu. Un test de paiement est recommandé.',
  }[readiness] || (readiness
    ? 'La configuration HelloAsso demande une vérification supplémentaire.'
    : 'La connexion HelloAsso n est pas encore configurée pour ce club.');
};

export const normalizePaymentModes = (raw = {}) => {
  const modes = raw || {};
  return {
    bank_transfer: modes.bank_transfer !== false,
    card_physical: Boolean(modes.card_physical),
    cash: modes.cash !== false,
    check: modes.check !== false,
    custom: Boolean(modes.custom),
    external_link: Boolean(modes.external_link),
    helloasso: Boolean(modes.helloasso),
    stripe: false,
  };
};

export const getEnabledManualPaymentMethods = (raw = {}) => {
  const modes = normalizePaymentModes(raw);
  return manualPaymentMethods
    .filter((mode) => modes[mode])
    .map((mode) => ({ label: paymentModeLabels[mode], mode }));
};

export const getLicenseStatusTone = (Colors, status) => ({
  active: Colors.success500,
  checkout_failed: Colors.error500,
  closed: Colors.neutral200,
  confirmed: Colors.success500,
  credentials_missing: Colors.warning500,
  disabled: Colors.neutral300,
  draft: Colors.primary200,
  failed: Colors.error500,
  issued: Colors.primary200,
  link_missing: Colors.warning500,
  manual_review: Colors.warning500,
  missing: Colors.error500,
  not_configured: Colors.neutral300,
  oauth_failed: Colors.error500,
  overdue: Colors.error500,
  paid: Colors.success500,
  partial: Colors.primary200,
  partially_refunded: Colors.warning500,
  pending: Colors.primary500,
  ready: Colors.success500,
  refused: Colors.error500,
  rejected: Colors.error500,
  submitted: Colors.primary500,
  to_replace: Colors.warning500,
  validated: Colors.success500,
  waived: Colors.neutral200,
  webhook_pending: Colors.warning500,
  webhook_stale: Colors.warning500,
}[status] || Colors.primary500);

/**
 * T03 — LA PASTILLE DE SELECTION DES COTISATIONS, ECRITE UNE SEULE FOIS.
 *
 * Adel, recette du 2026-08-17 : « il faut regler les textes dans les boutons de
 * l ecran filtres — "tous", "en attente", etc. — ils ne sont pas centres dans
 * les boutons ».
 *
 * Le meme bouton etait recopie a QUATRE endroits, avec la meme palette et les
 * memes marges : `SelectionChip` (ClubLicenseCampaignSettings.js:1050), la
 * rangee de filtres rapides du hub, et les deux pastilles de la feuille
 * « Filtrer les membres ». Aucun ne centrait. Corriger a un seul endroit aurait
 * laisse trois defauts identiques derriere — d ou cette brique, posee la ou
 * vivent deja `LicenseCard` et `LicenseStatusChip`.
 *
 * Deux reglages ne sont PAS negociables et c est pourquoi ils vivent ici :
 * · `alignItems` + `justifyContent` a `center` — sans eux, une pastille etiree
 *   par une voisine plus haute garde son texte colle en haut (rangee de filtres
 *   rapides : `ScrollView horizontal`, donc `alignItems: 'stretch'` par defaut ;
 *   feuille de filtres : `flexWrap`, donc etirement de toute la ligne) ;
 * · `minHeight: 44` — la cible tactile accessible, la meme que `FilterTrigger`
 *   et que `ChoiceChipGroup` (molecules/choiceChipGroup). C est elle qui rend
 *   l etirement inoffensif au lieu de le subir.
 *
 * `variant` ne fait que porter les DEUX palettes deja en place : `solid` pour
 * les filtres rapides et le tunnel, `soft` pour la feuille de filtres. Aucune
 * couleur ne change — Adel a demande un centrage, pas une nouvelle peinture.
 * @param {object} root0
 * @param {string} root0.label - Le libelle affiche.
 * @param {() => void} root0.onPress
 * @param {boolean} root0.selected
 * @param {'soft' | 'solid'} [root0.variant]
 * @returns {import('react').ReactElement}
 */
export function LicenseSelectionChip({
  label,
  onPress,
  selected,
  variant = 'solid',
}) {
  const { Colors, Fonts } = useTheme();
  const isSoft = variant === 'soft';
  const backgroundColor = isSoft
    ? (selected ? 'rgba(1, 179, 244, 0.14)' : Colors.primary700)
    : (selected ? Colors.primary500 : Colors.primary800);
  const borderColor = isSoft
    ? (selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)')
    : (selected ? Colors.primary500 : `${Colors.primary500}55`);
  let textStyle = selected ? Fonts.neutral900 : Fonts.neutral200;
  if (isSoft) textStyle = selected ? Fonts.primary500 : Fonts.neutral00;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor,
        borderColor,
        borderRadius: licenseRadius.pill,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={[Fonts.p3Bold, textStyle]}>{label}</Text>
    </Pressable>
  );
}

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
        description="Aucune échéance détaillée n est encore disponible."
        title="Échéancier indisponible"
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
                  Échéance
                  {' '}
                  {getInstallmentOrder(installment)}
                </Text>
                <Text style={[Fonts.p2Bold, { color: tone }]}>
                  {formatLicenseMoney(installment.amountDueCents, currency)}
                </Text>
              </View>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {installment.dueDate || 'Date non définie'}
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
