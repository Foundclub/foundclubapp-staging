// @ts-nocheck
/* eslint-disable perfectionist/sort-imports */
// S9, vague S — ECRAN 3 DU PACK « MES COTISATIONS » : LES SAISONS PASSEES.
//
// ❄️ FROID, PLAT, CONSULTABLE. Aucune pastille de statut, aucune barre de
// progression, AUCUNE action : tout est regle, l ecran n a rien a demander.
// On n y vient que pour retrouver un recu — il doit rester telechargeable
// indefiniment.
//
// 🧭 Le dock reste (D5) : c est un ecran de consultation, pas de tache.

import { useCallback, useMemo } from 'react';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { downloadRemoteFile } from '@/platform/media/downloadRemoteFile';

import { useMyLicenses } from '@/services/license/licenseQueries';

import { resolveMediaUrl } from '@/utils/mediaUrl';

import { formatLicenseMoney, LicenseEmptyState } from './licenseDesignSystem';
import {
  campaignTitleOf,
  clubNameOf,
  currencyOf,
  formatMemberDate,
  groupBySeason,
  licenseKeyOf,
  splitSeasons,
} from './memberLicenseModel';
import {
  MemberOverline,
  MemberRow,
  MemberRowAction,
  memberSpacing,
  MemberTopBar,
  memberType,
} from './memberLicenseUi';

/**
 * LE DERNIER RECU D UNE COTISATION SOLDEE — celui qu on vient chercher ici.
 * @param {any} assignment une affectation archivee
 * @returns {any} le recu portant un fichier, ou null
 */
const lastReceiptOf = (assignment) => (assignment?.receipts || [])
  .concat((assignment?.payments || []).map((payment) => payment?.receipt).filter(Boolean))
  .find((receipt) => receipt?.pdfFile?.url) || null;

/**
 * LA DATE DE SOLDE — ce qui date vraiment une cotisation archivee.
 * @param {any} assignment une affectation archivee
 * @returns {string} la date en toutes lettres, ou une chaine vide
 */
const settledDateOf = (assignment) => formatMemberDate(
  assignment?.lastPaymentAt
  || (assignment?.payments || [])
    .map((payment) => payment?.validatedAt || payment?.paidAt)
    .filter(Boolean)
    .sort()
    .pop()
  || '',
);

/**
 * ECRAN 3 — « Saisons passées ».
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function MyLicensesArchive({ navigation }) {
  const { Fonts } = useTheme();
  const type = memberType(Fonts);
  const query = useMyLicenses();
  const assignments = useMemo(() => query.data || [], [query.data]);
  const { archived } = useMemo(() => splitSeasons(assignments), [assignments]);
  const seasons = useMemo(() => groupBySeason(archived), [archived]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate(RouteNames.MyLicenses);
  }, [navigation]);

  const downloadReceipt = useCallback(async (receipt) => {
    const url = resolveMediaUrl(receipt?.pdfFile?.url || '');
    if (!url) {
      Alert.alert('Reçu indisponible', 'Aucun fichier n est rattaché à ce reçu.');
      return;
    }
    try {
      await downloadRemoteFile({ fileName: `recu-${receipt?.receiptNumber || ''}`, url });
    } catch (error) {
      Alert.alert(
        'Téléchargement impossible',
        error?.message || 'Le reçu n a pas pu être enregistré sur ton téléphone.',
      );
    }
  }, []);

  if (query.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title="Saisons passées" />
        <LicenseEmptyState description="On récupère tes anciennes saisons." title="Chargement" />
      </ScreenContainer>
    );
  }

  if (!seasons.length) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title="Saisons passées" />
        <LicenseEmptyState
          description="Tes saisons terminées apparaîtront ici, avec leurs reçus."
          title="Aucune saison archivée"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <MemberTopBar onBack={goBack} title="Saisons passées" />
      <ScrollView
        contentContainerStyle={{ gap: memberSpacing.section, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {seasons.map((group) => (
          <View key={group.season} style={{ gap: memberSpacing.rowGap }}>
            <MemberOverline title={group.season} />
            {group.items.map((assignment) => {
              const currency = currencyOf(assignment);
              const receipt = lastReceiptOf(assignment);
              const settledOn = settledDateOf(assignment);
              return (
                <MemberRow
                  key={licenseKeyOf(assignment)}
                  // ⛔ Pas de pastille, pas de barre : tout est regle.
                  state={[
                    formatLicenseMoney(assignment.amountDueCents, currency),
                    settledOn ? `soldée le ${settledOn}` : 'soldée',
                  ].join(' · ')}
                  title={`${clubNameOf(assignment)} · ${campaignTitleOf(assignment)}`}
                  trailing={receipt ? (
                    <MemberRowAction
                      glyph="arrowDownToBracket"
                      label="Télécharger le reçu"
                      onPress={() => downloadReceipt(receipt)}
                    />
                  ) : null}
                />
              );
            })}
          </View>
        ))}
        <Text style={[type.meta, Fonts.neutral400]}>
          Une saison archivée ne demande rien : elle sert à retrouver un reçu, et il reste
          téléchargeable indéfiniment.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyLicensesArchive;
