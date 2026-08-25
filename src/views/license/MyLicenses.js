// @ts-nocheck
/* eslint-disable perfectionist/sort-imports */
// S9, vague S — ECRAN 1 DU PACK « MES COTISATIONS » : LA LISTE.
//
// 🚪 C EST LE POINT D ENTREE (architecture A, retour d Adel du 21/08). On tape
// une carte pour ouvrir son detail ; il n y a PAS de selecteur de club dans le
// detail — la liste est le seul chemin entre deux cotisations.
//
// 🧭 CE QUE CET ECRAN REMPLACE : l ancien `MyLicense.js` (716 lignes) montrait
// UNE cotisation en entete et reléguait les autres derriere un bouton
// « Voir la cotisation STADE MARS… » tronque. Le pack supprime ce bouton :
// la carte ENTIERE est la cible tactile.
//
// 🔒 AA07 / K1 SURVIT ICI, ET C EST LE CONTRAT DE CET ECRAN : plusieurs
// cotisations restent ATTEIGNABLES. Le temoin
// `MyLicenses.AA07.plusieursCotisations.test.js` l observe.

import { useCallback, useMemo } from 'react';
import {
  Pressable, ScrollView, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyLicenses } from '@/services/license/licenseQueries';

import { formatLicenseMoney, LicenseEmptyState } from './licenseDesignSystem';
import {
  campaignTitleOf,
  cardSubtitleOf,
  currencyOf,
  describeAssignmentContext,
  describeTotalsLine,
  getMemberStatusTone,
  getPaidRatio,
  groupAssignmentsByClub,
  licenseKeyOf,
  splitSeasons,
  sumRemainingCents,
} from './memberLicenseModel';
import {
  MemberClubCrest,
  MemberOverline,
  MemberProgressBar,
  memberRadius,
  memberSpacing,
  MemberStatusPill,
  MemberTile,
  MemberTopBar,
  memberType,
} from './memberLicenseUi';

/**
 * LA CARTE DE TOTAL — un seul total transversal, en haut de l ecran.
 *
 * ⛔ Aucune carte de cotisation n additionne les clubs : ce total n existe
 * qu ici. Et il se CALCULE (somme des restes affiches), il ne se lit pas dans
 * un champ denormalise — sinon il mentirait juste apres un paiement.
 * @param {object} props
 * @param {any[]} props.assignments
 * @returns {import('react').ReactElement}
 */
function TotalCard({ assignments }) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const remaining = sumRemainingCents(assignments);
  const currency = currencyOf(assignments[0]);
  const lateCount = assignments.filter((item) => item?.status === 'overdue').length;
  const isSettled = remaining <= 0;

  return (
    <View style={{
      backgroundColor: Colors.primary700,
      borderColor: lateCount
        ? withAlpha(Colors.error500, 0.34)
        : withAlpha(Colors.primary500, 0.24),
      borderRadius: memberRadius.card,
      borderWidth: 1,
      gap: memberSpacing.rowGap,
      padding: memberSpacing.cardPadding,
    }}
    >
      <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8 }}>
        <Text style={[type.totalAmount, isSettled ? Fonts.success500 : Fonts.neutral00]}>
          {formatLicenseMoney(remaining, currency)}
        </Text>
        <Text style={[type.subtitle, Fonts.neutral300]}>
          {isSettled ? 'tout est réglé' : 'à payer en tout'}
        </Text>
      </View>
      <Text style={[type.keyLabel, Fonts.neutral300]}>{describeTotalsLine(assignments)}</Text>
      {lateCount ? (
        <View style={{
          alignItems: 'center',
          borderTopColor: withAlpha(Colors.neutral00, 0.08),
          borderTopWidth: 1,
          flexDirection: 'row',
          gap: 8,
          paddingTop: memberSpacing.rowGap,
        }}
        >
          <GlyphIcon color={Colors.error100} name="triangleExclamation" size={18} />
          <Text style={[type.keyValue, { color: Colors.error100 }]}>
            {`${lateCount} cotisation${lateCount > 1 ? 's' : ''} en retard`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * UNE CARTE DE COTISATION — la carte ENTIERE est la cible tactile.
 *
 * 🧨 Defaut 3 du pack : le bouton « Voir la cotisation STADE MARS… » etait
 * tronque parce qu il portait un nom de club de 42 caracteres. Il n y a plus
 * de bouton du tout : un chevron de 20 px porte l affordance, et la carte
 * recoit le tap.
 *
 * 🧨 Defaut 2 : LE TITRE EST LA CAMPAGNE, jamais le club. Deux cotisations du
 * meme club se distinguent par leur campagne — le club descend en sous-titre.
 * @param {object} props
 * @param {any} props.assignment
 * @param {() => void} props.onPress
 * @returns {import('react').ReactElement}
 */
function AssignmentCard({ assignment, onPress }) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const tone = getMemberStatusTone(Colors, assignment.status);
  const currency = currencyOf(assignment);
  const installmentCount = (assignment?.installments || []).length;
  const remaining = Number(assignment?.amountRemainingCents) || 0;
  const isWaived = assignment?.status === 'waived';
  const isCancelled = assignment?.status === 'cancelled';

  let amountStyle = Fonts.neutral00;
  if (isWaived || isCancelled) amountStyle = Fonts.neutral300;
  else if (remaining <= 0) amountStyle = Fonts.success500;

  return (
    <Pressable
      accessibilityLabel={`${campaignTitleOf(assignment)} — ${cardSubtitleOf(assignment)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: Colors.primary700,
        borderColor: withAlpha(tone, assignment?.status === 'overdue' ? 0.45 : 0.32),
        borderRadius: memberRadius.card,
        borderWidth: 1,
        gap: memberSpacing.rowGap,
        padding: memberSpacing.cardPadding,
      }}
    >
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12 }}>
        <MemberTile
          glyph={installmentCount > 1 ? 'calendarDays' : 'euroCircle'}
          tone={tone}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[type.title, Fonts.neutral00]}>
            {campaignTitleOf(assignment)}
          </Text>
          <Text numberOfLines={1} style={[type.meta, Fonts.neutral300]}>
            {cardSubtitleOf(assignment)}
          </Text>
        </View>
        <MemberStatusPill status={assignment.status} />
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[
            type.listAmount,
            amountStyle,
            isCancelled ? { textDecorationLine: 'line-through' } : null,
          ]}
          >
            {formatLicenseMoney(remaining, currency)}
          </Text>
          <Text style={[type.keyLabel, Fonts.neutral300]}>
            {describeAssignmentContext(assignment)}
          </Text>
        </View>
        <GlyphIcon color={Colors.primary500} name="chevronRight" size={20} />
      </View>
      {/* ⛔ Pas de barre quand il n y a rien a progresser (cotisation exemptee). */}
      {isWaived ? null : <MemberProgressBar height={6} ratio={getPaidRatio(assignment)} />}
      {installmentCount > 1 ? (
        <Text style={[type.meta, Fonts.neutral400]}>
          {`${installmentCount} échéances`}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * ECRAN 1 — « Mes cotisations ».
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function MyLicenses({ navigation }) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const query = useMyLicenses();
  const assignments = useMemo(() => query.data || [], [query.data]);
  const { active, archived } = useMemo(() => splitSeasons(assignments), [assignments]);
  const groups = useMemo(() => groupAssignmentsByClub(active), [active]);
  const archivedSeasons = useMemo(() => [...new Set(
    archived.map((item) => String(item?.campaign?.seasonLabel || '')).filter(Boolean),
  )].sort().reverse(), [archived]);
  const archivedCount = archivedSeasons.length || archived.length;
  const archivedPlural = archivedCount > 1 ? 's' : '';
  const archivedAllPaid = archived.every(
    (item) => (Number(item?.amountRemainingCents) || 0) <= 0,
  );

  const openAssignment = useCallback((assignment) => {
    navigation.navigate(RouteNames.MyLicense, { assignmentId: licenseKeyOf(assignment) });
  }, [navigation]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate(RouteNames.HomeTab);
  }, [navigation]);

  if (query.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title="Mes cotisations" />
        <LicenseEmptyState
          description="On récupère tes cotisations."
          title="Chargement"
        />
      </ScreenContainer>
    );
  }

  if (query.isError) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title="Mes cotisations" />
        <LicenseEmptyState
          action={<Button onPress={() => query.refetch()} title="Réessayer" variant="Secondary" />}
          description="Impossible de charger tes cotisations pour le moment."
          title="Cotisations indisponibles"
        />
      </ScreenContainer>
    );
  }

  if (!active.length && !archived.length) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title="Mes cotisations" />
        <LicenseEmptyState
          description="Aucune cotisation n est encore rattachée à ton compte."
          title="Mes cotisations"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <MemberTopBar onBack={goBack} title="Mes cotisations" />
      <ScrollView
        contentContainerStyle={{ gap: memberSpacing.section, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {active.length ? <TotalCard assignments={active} /> : null}

        {groups.map((group) => (
          <View key={group.clubId} style={{ gap: memberSpacing.rowGap }}>
            {/* L en-tete de groupe : l ecusson, le club, et ce qu il reste a ce club. */}
            <View style={{
              alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between',
            }}
            >
              <View style={{
                alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8,
              }}
              >
                <MemberClubCrest name={group.clubName} />
                <Text numberOfLines={1} style={[type.clubName, Fonts.neutral00, { flex: 1 }]}>
                  {group.clubName}
                </Text>
              </View>
              <Text style={[type.metaBold, group.remainingCents > 0
                ? Fonts.neutral200
                : Fonts.success500]}
              >
                {group.remainingCents > 0
                  ? formatLicenseMoney(group.remainingCents, currencyOf(group.items[0]))
                  : 'à jour'}
              </Text>
            </View>
            <View style={{ gap: memberSpacing.cardGap }}>
              {group.items.map((assignment) => (
                <AssignmentCard
                  assignment={assignment}
                  key={licenseKeyOf(assignment)}
                  onPress={() => openAssignment(assignment)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* ⛔ Une saison passee ne se dessine pas ici : elle se replie en UNE
            ligne, et l archive est un ecran a part (ecran 3 du pack). */}
        {archived.length ? (
          <View style={{ gap: memberSpacing.rowGap }}>
            <MemberOverline title="Saisons passées" />
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(RouteNames.MyLicensesArchive)}
              style={{
                alignItems: 'center',
                backgroundColor: Colors.primary800,
                borderColor: withAlpha(Colors.neutral00, 0.08),
                borderRadius: memberRadius.row,
                borderWidth: 1,
                flexDirection: 'row',
                gap: 12,
                minHeight: 62,
                paddingHorizontal: memberSpacing.rowPaddingH,
                paddingVertical: memberSpacing.rowPaddingV,
              }}
            >
              <GlyphIcon color={Colors.neutral300} name="receiptAlt" size={20} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[type.rowTitle, Fonts.neutral00]}>
                  {`${archivedCount} saison${archivedPlural} archivée${archivedPlural}`}
                </Text>
                <Text numberOfLines={1} style={[type.rowState, Fonts.neutral300]}>
                  {archivedSeasons.join(' · ')}
                  {archivedAllPaid ? ' — tout est payé' : ''}
                </Text>
              </View>
              <GlyphIcon color={Colors.primary500} name="chevronRight" size={20} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyLicenses;
