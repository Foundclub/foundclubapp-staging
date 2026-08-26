import { Text, View } from 'react-native';

import {
  formatSubscriptionPerMemberPriceLabel,
  formatSubscriptionUnitPriceLabel,
  SUBSCRIPTION_LICENSEE_COUNT_MAX,
  SUBSCRIPTION_LICENSEE_COUNT_MIN,
} from '@/domains/subscription/subscriptionBilling';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';

/**
 * LA SAISIE DU NOMBRE DE LICENCIES (decisions D2 et D3 du 2026-08-25).
 *
 * 🔢 Un champ de frappe, PAS un compteur +/- : un club tape « 250 », il ne
 * clique pas 250 fois. `InputStepper` existe et reste le bon outil pour 0 a 20
 * (les remplacants d'un match, les places d'une reservation) ; a l'echelle d'un
 * effectif de club, il devient une punition.
 *
 * 💶 Et le prix se calcule SOUS LES YEUX, a chaque frappe : personne ne signe
 * un montant qu'il doit calculer de tete. Le calcul lui-meme vit dans
 * `subscriptionBilling` (D3) — trois surfaces l'affichent, une seule le fait.
 *
 * Ce composant est volontairement SANS ETAT : c'est l'appelant qui tient la
 * chaine saisie, parce que c'est lui qui doit la transmettre a la caisse.
 * @param {object} props Proprietes.
 * @param {string} [props.billingPeriod] 'monthly' ou 'yearly' — le suffixe du total.
 * @param {string} [props.helperText] Phrase posee sous le total (contexte de l'ecran).
 * @param {string} [props.label] Intitule du champ.
 * @param {number} [props.minCount] Plancher reel de CET ecran (une augmentation
 *   part du nombre deja souscrit, pas de 1).
 * @param {(value: string) => void} props.onChangeText Appele a chaque frappe.
 * @param {number | null} [props.unitPriceEurCents] Prix unitaire du catalogue.
 * @param {string} props.value Chaine saisie (vide autorise : on efface pour retaper).
 * @returns {import('react').ReactElement} Le champ rendu.
 */
function LicenseeCountField({
  billingPeriod = '',
  helperText = '',
  label = 'Nombre de licenciés',
  minCount = SUBSCRIPTION_LICENSEE_COUNT_MIN,
  onChangeText,
  unitPriceEurCents = null,
  value,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const typedCount = Number(value);
  const hasTypedCount = value !== '' && Number.isFinite(typedCount);
  const isBelowMin = hasTypedCount && typedCount < minCount;
  const isAboveMax = hasTypedCount && typedCount > SUBSCRIPTION_LICENSEE_COUNT_MAX;

  const unitPriceLabel = formatSubscriptionUnitPriceLabel(unitPriceEurCents);
  const totalLabel = isBelowMin || isAboveMax
    ? ''
    : formatSubscriptionPerMemberPriceLabel(unitPriceEurCents, typedCount, billingPeriod);

  // Griser en silence est interdit : un champ qui refuse doit DIRE quoi taper.
  let errorText = '';
  if (isBelowMin) {
    errorText = minCount > SUBSCRIPTION_LICENSEE_COUNT_MIN
      ? `Ton abonnement couvre déjà ${minCount - 1} licenciés : indique un nombre plus grand.`
      : 'Indique au moins 1 licencié.';
  } else if (isAboveMax) {
    errorText = `${SUBSCRIPTION_LICENSEE_COUNT_MAX} licenciés maximum. Écris-nous au-delà, on s'en occupe.`;
  }

  return (
    <View style={Spaces.gap[12]}>
      <Input
        accessibilityLabel={label}
        error={errorText || undefined}
        inputMode="numeric"
        keyboardType="number-pad"
        label={label}
        maxLength={String(SUBSCRIPTION_LICENSEE_COUNT_MAX).length}
        onChangeText={onChangeText}
        placeholder="250"
        value={value}
      />

      {/* L'ANCRE PRIX : le prix unitaire d'abord (ce que dit le catalogue),
          le total ensuite (ce que ca fait pour CE club). Sans nombre tape, on
          n'affiche que l'unitaire — jamais un total invente. */}
      {unitPriceLabel || totalLabel ? (
        <View
          style={[
            Spaces.gap[4],
            Spaces.paddingHorizontal[16],
            Spaces.paddingVertical[12],
            {
              backgroundColor: withAlpha(Colors.primary500, 0.1),
              borderColor: withAlpha(Colors.primary500, 0.28),
              borderRadius: 14,
              borderWidth: 1,
            },
          ]}
        >
          {unitPriceLabel ? (
            <Text style={[Fonts.p4Bold, Fonts.primary200, { letterSpacing: 0.6, textTransform: 'uppercase' }]}>
              {unitPriceLabel}
            </Text>
          ) : null}
          {totalLabel ? (
            <Text style={[Alignments.fill, Fonts.p1Bold, Fonts.neutral00]}>
              {totalLabel}
            </Text>
          ) : null}
        </View>
      ) : null}

      {helperText ? (
        <Text style={[Fonts.p4, Fonts.neutral300]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export default LicenseeCountField;
