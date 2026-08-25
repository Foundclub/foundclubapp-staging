// @ts-nocheck

// S9, vague S — LES TROIS FEUILLES DU PACK : payer, declarer, faire payer.
//
// 💰 LIGNE ROUGE : ces feuilles CABLENT les services existants
// (`licenseQueries`). Elles n effectuent aucun paiement par elles-memes et ne
// touchent a aucune configuration de fournisseur. Stripe reste desactive en
// dur (`licenseDesignSystem.js:137`).
//
// 🎯 UN GESTE, UNE FEUILLE. Et « declarer n est pas payer » : le solde ne bouge
// pas, la ligne passe en tiretee, le club verifie.

import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { formatLicenseMoney } from './licenseDesignSystem';
import {
  currencyOf,
  formatMemberDate,
  getNextInstallment,
  installmentOrderOf,
} from './memberLicenseModel';
import { memberRadius, memberSpacing, memberType } from './memberLicenseUi';

/**
 * LES DEUX SEULS MONTANTS PAYABLES — jamais un champ libre.
 *
 * ⛔ Regle 2 du pack : « un montant libre ouvre la porte aux paiements partiels
 * non rattachables a une echeance ». Le joueur paie SON echeance, ou il solde.
 * 🔎 Le serveur accepte bien les deux : `payableAmount` (admin
 * `license.ts:1859`) lit `payload.amountCents` et refuse tout ce qui depasse le
 * reste. On ne fabrique donc pas un choix que l API rejetterait.
 * @param {any} assignment une affectation de cotisation
 * @returns {{key: string, title: string, hint: string, amountCents: number}[]} les choix
 */
export const getPayableChoices = (assignment) => {
  const currency = currencyOf(assignment);
  const remaining = Number(assignment?.amountRemainingCents) || 0;
  const next = getNextInstallment(assignment);
  const nextRemaining = Number(next?.amountRemainingCents ?? next?.amountDueCents) || 0;
  const choices = [];

  if (next && nextRemaining > 0 && nextRemaining < remaining) {
    const dueDate = formatMemberDate(next.dueDate, { withYear: false });
    choices.push({
      amountCents: nextRemaining,
      hint: `Il restera ${formatLicenseMoney(remaining - nextRemaining, currency)} après`,
      key: `installment-${installmentOrderOf(next)}`,
      title: dueDate ? `L'échéance du ${dueDate}` : `Échéance ${installmentOrderOf(next)}`,
    });
  }
  if (remaining > 0) {
    choices.push({
      amountCents: remaining,
      hint: choices.length ? 'Plus rien ne restera à payer' : 'Le montant total restant',
      key: 'all',
      title: choices.length ? 'Tout solder' : 'Régler ma cotisation',
    });
  }
  return choices;
};

/**
 * L en-tete d une feuille : la poignee du pack est portee par `BottomModal`.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @returns {import('react').ReactElement}
 */
function SheetHeader({ subtitle, title }) {
  const { Fonts } = useTheme();
  const type = memberType(Fonts);

  return (
    <View style={{ gap: 4 }}>
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{title}</Text>
      {subtitle ? <Text style={[type.subtitle, Fonts.neutral300]}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * UNE CARTE RADIO DE MONTANT — padding 14, pastille de 22 px.
 * @param {object} props
 * @param {any} props.choice
 * @param {boolean} props.selected
 * @param {string} props.currency
 * @param {() => void} props.onPress
 * @returns {import('react').ReactElement}
 */
function AmountChoice({
  choice, currency, onPress, selected,
}) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: Colors.primary800,
        borderColor: selected ? Colors.primary500 : withAlpha(Colors.neutral00, 0.08),
        borderRadius: memberRadius.row,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: memberSpacing.cardPadding,
      }}
    >
      <View style={{
        alignItems: 'center',
        borderColor: selected ? Colors.primary500 : Colors.neutral400,
        borderRadius: memberRadius.pill,
        borderWidth: 2,
        height: 22,
        justifyContent: 'center',
        width: 22,
      }}
      >
        {selected ? (
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: memberRadius.pill,
            height: 10,
            width: 10,
          }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.rowTitle, Fonts.neutral00]}>{choice.title}</Text>
        <Text style={[type.rowState, Fonts.neutral300]}>{choice.hint}</Text>
      </View>
      <Text style={[type.amountStrong, Fonts.neutral00]}>
        {formatLicenseMoney(choice.amountCents, currency)}
      </Text>
    </Pressable>
  );
}

/**
 * UNE TUILE DE MOYEN DE PAIEMENT — 64 px, trois par ligne.
 * @param {object} props
 * @param {string} props.glyph
 * @param {string} props.label
 * @param {boolean} props.selected
 * @param {() => void} props.onPress
 * @returns {import('react').ReactElement}
 */
function MethodTile({
  glyph, label, onPress, selected,
}) {
  const { Colors, Fonts } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: selected ? withAlpha(Colors.primary500, 0.14) : Colors.primary800,
        borderColor: selected ? Colors.primary500 : withAlpha(Colors.neutral00, 0.08),
        borderRadius: memberRadius.row,
        borderWidth: 1,
        flex: 1,
        gap: 4,
        justifyContent: 'center',
        minHeight: 64,
        paddingHorizontal: 8,
        paddingVertical: 12,
      }}
    >
      <GlyphIcon color={selected ? Colors.primary500 : Colors.neutral300} name={glyph} size={20} />
      <Text
        numberOfLines={1}
        style={[Fonts.p4Bold, selected ? Fonts.primary500 : Fonts.neutral200]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Un glyphe par moyen de paiement — le glyphe DIT le moyen (planche 04).
const METHOD_GLYPHS = {
  bank_transfer: 'landmark',
  card_physical: 'creditCard',
  cash: 'euroCircle',
  check: 'receiptAlt',
  custom: 'circleInformation',
  external_link: 'creditCard',
  helloasso: 'creditCard',
  stripe: 'creditCard',
};

/**
 * Le glyphe d un moyen de paiement.
 * @param {string} method le moyen, tel que le serveur le nomme
 * @returns {string} le nom du glyphe
 */
export const glyphForPaymentMethod = (method) => METHOD_GLYPHS[method] || 'euroCircle';

/**
 * FEUILLE 1 — PAYER.
 *
 * Le montant est TOUJOURS dans le libelle du bouton : « Payer 66,67 € ». Un
 * bouton « Payer » nu oblige a ouvrir pour savoir combien.
 * @param {object} props
 * @param {any} props.assignment
 * @param {{mode: string, label: string}[]} props.onlineMethods
 * @param {boolean} props.isLoading
 * @param {(choice: {amountCents: number}, provider: string) => void} props.onConfirm
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
export function PayLicenseSheet({
  assignment, isLoading, onClose, onConfirm, onlineMethods,
}) {
  const { Fonts } = useTheme();
  const type = memberType(Fonts);
  const currency = currencyOf(assignment);
  const choices = useMemo(() => getPayableChoices(assignment), [assignment]);
  const clubName = assignment?.club?.name || assignment?.campaign?.club?.name || '';
  const [choiceKey, setChoiceKey] = useState(choices[0]?.key || 'all');
  const [provider, setProvider] = useState(onlineMethods[0]?.mode || 'external');
  const choice = choices.find((item) => item.key === choiceKey) || choices[0];

  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      snapPoints={['72%']}
      webPresentation="dialog"
    >
      <View style={{ gap: memberSpacing.section }}>
        <SheetHeader
          subtitle={[clubName, assignment?.campaign?.name].filter(Boolean).join(' · ')}
          title="Payer ma cotisation"
        />
        {choices.length > 1 ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            {choices.map((item) => (
              <AmountChoice
                choice={item}
                currency={currency}
                key={item.key}
                onPress={() => setChoiceKey(item.key)}
                selected={item.key === choiceKey}
              />
            ))}
          </View>
        ) : null}
        {onlineMethods.length > 1 ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            <Text style={[type.overline, Fonts.neutral300]}>MOYEN DE PAIEMENT</Text>
            <View style={{ flexDirection: 'row', gap: memberSpacing.rowGap }}>
              {onlineMethods.map((method) => (
                <MethodTile
                  glyph={glyphForPaymentMethod(method.mode)}
                  key={method.mode}
                  label={method.label}
                  onPress={() => setProvider(method.mode)}
                  selected={method.mode === provider}
                />
              ))}
            </View>
          </View>
        ) : null}
        <Button
          isLoading={isLoading}
          onPress={() => onConfirm(choice, provider)}
          title={`Payer ${formatLicenseMoney(choice?.amountCents || 0, currency)}`}
        />
      </View>
    </BottomModal>
  );
}

/**
 * FEUILLE 2 — DECLARER UN PAIEMENT.
 *
 * ⛔ DECLARER N EST PAS PAYER : le solde ne bouge pas, la cotisation passe en
 * `manual_review` cote serveur (admin `license.ts:2356`) et la ligne
 * d echeance prend sa bordure tiretee. Le joueur peut corriger tant que le
 * club n a pas valide.
 *
 * 🕳️ CE QUE LE PACK DEMANDE ET QUE LE SERVEUR NE PREND PAS (mesure du 25/08,
 * `declareExternalPaymentForAssignment`, admin `license.ts:2335`) : la DATE du
 * paiement et la PREUVE photo. Le point d entree n accepte que `amountCents`,
 * `method` et `note`. ⇒ On ne dessine pas deux champs morts : ils sont nommes
 * dans le compte rendu comme un trou serveur, pas caches.
 * @param {object} props
 * @param {any} props.assignment
 * @param {{mode: string, label: string}[]} props.methods
 * @param {boolean} props.isLoading
 * @param {(choice: {amountCents: number}, method: string) => void} props.onConfirm
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
export function DeclareLicensePaymentSheet({
  assignment, isLoading, methods, onClose, onConfirm,
}) {
  const { Fonts } = useTheme();
  const type = memberType(Fonts);
  const currency = currencyOf(assignment);
  const choices = useMemo(() => getPayableChoices(assignment), [assignment]);
  const [choiceKey, setChoiceKey] = useState(choices[0]?.key || 'all');
  const [method, setMethod] = useState(methods[0]?.mode || '');
  const choice = choices.find((item) => item.key === choiceKey) || choices[0];

  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      snapPoints={['72%']}
      webPresentation="dialog"
    >
      <View style={{ gap: memberSpacing.section }}>
        <SheetHeader
          subtitle="Le club vérifiera avant de mettre ton solde à jour."
          title="Déclarer un paiement"
        />
        {choices.length > 1 ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            <Text style={[type.overline, Fonts.neutral300]}>MONTANT</Text>
            {choices.map((item) => (
              <AmountChoice
                choice={item}
                currency={currency}
                key={item.key}
                onPress={() => setChoiceKey(item.key)}
                selected={item.key === choiceKey}
              />
            ))}
          </View>
        ) : null}
        <View style={{ gap: memberSpacing.rowGap }}>
          <Text style={[type.overline, Fonts.neutral300]}>COMMENT</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: memberSpacing.rowGap }}>
            {methods.map((item) => (
              <MethodTile
                glyph={glyphForPaymentMethod(item.mode)}
                key={item.mode}
                label={item.label}
                onPress={() => setMethod(item.mode)}
                selected={item.mode === method}
              />
            ))}
          </View>
        </View>
        <Button
          disabled={!method}
          isLoading={isLoading}
          onPress={() => onConfirm(choice, method)}
          title="Envoyer au club"
        />
      </View>
    </BottomModal>
  );
}

/**
 * FEUILLE 3 — QUELQU UN PAIE POUR MOI.
 *
 * 🔒 LA QUESTION DE CONFIDENTIALITE SE POSE AVANT L ENVOI, PAS APRES : un lien
 * partage sort de l app. La feuille montre donc l apercu de ce que verra le
 * tiers, et la liste explicite de ce qu il ne verra pas.
 *
 * ✅ CETTE LISTE EST MESUREE, PAS SUPPOSEE : `publicAssignment` (admin
 * `license.ts:1901`) rend `memberName`, `clubName`, `campaignName`, les
 * montants, l echeancier et les pieces demandees de CETTE cotisation — et rien
 * d autre. Les autres cotisations, le compte et les messages n y sont pas.
 * @param {object} props
 * @param {any} props.assignment
 * @param {number} props.amountCents
 * @param {() => void} props.onShare
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
export function PayerLinkSheet({
  amountCents, assignment, onClose, onShare,
}) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const currency = currencyOf(assignment);
  const clubName = assignment?.club?.name || assignment?.campaign?.club?.name || 'Ton club';

  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      snapPoints={['66%']}
      webPresentation="dialog"
    >
      <View style={{ gap: memberSpacing.section }}>
        <SheetHeader
          subtitle="Un parent, un proche, un employeur : la personne paie sans compte FoundClub."
          title="Faire payer quelqu'un"
        />
        <View style={{ gap: memberSpacing.rowGap }}>
          <Text style={[type.overline, Fonts.neutral300]}>CE QUE LA PERSONNE VERRA</Text>
          <View style={{
            backgroundColor: Colors.primary800,
            borderColor: withAlpha(Colors.neutral00, 0.08),
            borderRadius: memberRadius.row,
            borderWidth: 1,
            gap: 4,
            padding: memberSpacing.cardPadding,
          }}
          >
            <Text style={[type.rowTitle, Fonts.neutral00]}>Ta cotisation, et elle seule</Text>
            <Text style={[type.rowState, Fonts.neutral300]}>
              {`${clubName} · ${assignment?.campaign?.name || 'Cotisation'}`}
            </Text>
            <Text style={[type.amountStrong, Fonts.neutral00]}>
              {formatLicenseMoney(amountCents, currency)}
            </Text>
          </View>
          <Text style={[type.rowState, Fonts.neutral300]}>
            Le lien ne montre ni tes autres cotisations, ni ton compte FoundClub, ni tes messages.
          </Text>
        </View>
        <Button icon="share" onPress={onShare} title="Partager le lien" />
      </View>
    </BottomModal>
  );
}
