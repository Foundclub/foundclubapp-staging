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
import { useTranslation } from 'react-i18next';
import {
  Pressable, ScrollView, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import useAuth from '@/domains/auth/useAuth';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMyDeclaredChildren } from '@/services/declaredChild/declaredChildQueries';
import { useChildrenLicenses, useMyLicenses } from '@/services/license/licenseQueries';
import { useParentLinksAsParent } from '@/services/parentLink/parentLinkQueries';

import { getErrorStatus } from '@/utils/errors/displayError';

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
 * Le retour de la liste : la pile s il y en a une, sinon l accueil.
 * @param {any} navigation
 * @returns {() => void} Le geste.
 */
const useGoBack = (navigation) => useCallback(() => {
  if (navigation.canGoBack?.()) navigation.goBack();
  else navigation.navigate(RouteNames.HomeTab);
}, [navigation]);

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
  const { t } = useTranslation();
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
          {isSettled ? t(
            'myLicenses.total.settled',
            'tout est réglé',
          ) : t('myLicenses.total.toPay', 'à payer en tout')}
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
            {t('myLicenses.total.overdue', {
              count: lateCount,
              defaultValue_one: '{{count}} cotisation en retard',
              defaultValue_other: '{{count}} cotisations en retard',
            })}
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
 * @param {() => void} [props.onPress] Sans geste, la carte se lit seulement (FIN-PARENT).
 * @returns {import('react').ReactElement}
 */
function AssignmentCard({ assignment, onPress }) {
  const { t } = useTranslation();
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
  const Carte = onPress ? Pressable : View;

  return (
    <Carte
      accessibilityLabel={`${campaignTitleOf(assignment)} — ${cardSubtitleOf(assignment)}`}
      accessibilityRole={onPress ? 'button' : undefined}
      accessible
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
        {onPress ? <GlyphIcon color={Colors.primary500} name="chevronRight" size={20} /> : null}
      </View>
      {/* ⛔ Pas de barre quand il n y a rien a progresser (cotisation exemptee). */}
      {isWaived ? null : <MemberProgressBar height={6} ratio={getPaidRatio(assignment)} />}
      {installmentCount > 1 ? (
        <Text style={[type.meta, Fonts.neutral400]}>
          {t('myLicenses.card.instalments', {
            count: installmentCount,
            defaultValue_one: '{{count}} échéance',
            defaultValue_other: '{{count}} échéances',
          })}
        </Text>
      ) : null}
    </Carte>
  );
}

/**
 * PERF2 — LE CHARGEMENT MONTRE LA FORME DE LA LISTE, IL N AFFIRME RIEN.
 *
 * 🧨 Avant : `LicenseEmptyState` pendant `isLoading` — une carte `muted`
 * visuellement IDENTIQUE a « tu n as aucune cotisation ». L utilisateur
 * croyait n avoir rien, le temps d un aller-retour reseau.
 *
 * Des `View` avec leur propre fond, JAMAIS du texte ni des cartes reelles :
 * tant que `SkeletonLoader` n a pas mesure son cadre, il rend ses enfants
 * NUS — du texte factice ferait un eclair de faux contenu.
 * @returns {import('react').ReactElement}
 */
function ListSkeleton() {
  const { Colors } = useTheme();
  const bloc = { backgroundColor: Colors.primary700, borderRadius: memberRadius.card };

  return (
    <View style={{ gap: memberSpacing.section }} testID="my-licenses-skeleton">
      <WithDataWrapper isLoading wrapperStyle={[{ gap: memberSpacing.section }]}>
        {/* La carte de total, puis un groupe : ecusson + nom, et deux cartes. */}
        <View style={[bloc, { height: 104 }]} />
        <View style={{ gap: memberSpacing.rowGap }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
            <View style={{
              backgroundColor: Colors.primary700,
              borderRadius: memberRadius.pill,
              height: 28,
              width: 28,
            }}
            />
            <View style={{
              backgroundColor: Colors.primary700, borderRadius: 6, height: 12, width: '40%',
            }}
            />
          </View>
          <View style={{ gap: memberSpacing.cardGap }}>
            <View style={[bloc, { height: 136 }]} />
            <View style={[bloc, { height: 136 }]} />
          </View>
        </View>
      </WithDataWrapper>
    </View>
  );
}

/**
 * FIN-PARENT (02/11, Adel « 3d enfants ») — « MES COTISATIONS » D UN COMPTE PARENT : celles de SES
 * enfants, en lecture.
 *
 * ⛔ `/licenses/me` lui est refuse, et le detail d une cotisation aussi : la carte ne s ouvre pas.
 * Le serveur ne lui rend pas non plus le jeton de paiement.
 * 👪 Une fiche sans compte n a pas de cotisation : `license-assignment.user` est un compte, et une
 * campagne ne vise que les comptes de l equipe. L ecran la nomme quand meme : un enfant absent de
 * la liste laisserait croire a un oubli.
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function ChildrenLicenses({ navigation }) {
  const { t } = useTranslation();
  const { Alignments, Fonts } = useTheme();
  const type = memberType(Fonts);
  const goBack = useGoBack(navigation);
  const liens = useParentLinksAsParent();
  const fiches = useGetMyDeclaredChildren();
  const comptes = useMemo(() => liens.data?.children || [], [liens.data]);
  const licences = useChildrenLicenses(useMemo(
    () => comptes.map((compte) => compte?.documentId).filter(Boolean),
    [comptes],
  ));
  const enfants = useMemo(() => [
    ...comptes.map((compte) => ({
      cle: compte.documentId,
      // Une saison passee ou une cotisation retiree ne se dessine pas ici (`splitSeasons`).
      cotisation: splitSeasons([licences.data?.[compte.documentId]].filter(Boolean)).active[0],
      personne: compte,
    })),
    ...(fiches.data || []).filter((fiche) => !fiche?.account).map((fiche) => ({
      cle: fiche.documentId,
      cotisation: null,
      personne: fiche,
    })),
  ], [comptes, fiches.data, licences.data]);
  const cotisations = enfants.map((enfant) => enfant.cotisation).filter(Boolean);
  const titre = <MemberTopBar onBack={goBack} title={t('myLicenses.title', 'Mes cotisations')} />;

  if (liens.isLoading || fiches.isLoading || licences.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        {titre}
        <ListSkeleton />
      </ScreenContainer>
    );
  }

  if (liens.isError || fiches.isError || licences.isError) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        {titre}
        <LicenseEmptyState
          action={(
            <Button
              onPress={() => [liens, fiches, licences].forEach((requete) => {
                if (requete.isError) requete.refetch();
              })}
              title={t('myLicenses.error.retry', 'Réessayer')}
              variant="Secondary"
            />
          )}
          description={t(
            'myLicenses.error.description',
            'Impossible de charger tes cotisations pour le moment.',
          )}
          title={t('myLicenses.error.title', 'Cotisations indisponibles')}
        />
      </ScreenContainer>
    );
  }

  if (!enfants.length) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        {titre}
        <LicenseEmptyState
          action={(
            <Button
              onPress={() => navigation.navigate(RouteNames.ProfileStack, {
                screen: RouteNames.MyChildren,
              })}
              title={t('myLicenses.children.open', 'Mes enfants')}
              variant="Secondary"
            />
          )}
          description={t('myLicenses.children.empty', 'Aucun enfant déclaré pour l’instant.')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      {titre}
      <ScrollView
        contentContainerStyle={{ gap: memberSpacing.section, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        style={Alignments.fill}
      >
        <Text style={[type.subtitle, Fonts.neutral300]}>
          {t('myLicenses.children.intro', 'Les cotisations de tes enfants.')}
        </Text>
        {cotisations.length ? <TotalCard assignments={cotisations} /> : null}
        {enfants.map(({ cle, cotisation, personne }) => (
          <View key={cle} style={{ gap: memberSpacing.rowGap }}>
            <MemberOverline
              title={[personne?.firstname, personne?.lastname].filter(Boolean).join(' ')}
            />
            {cotisation ? <AssignmentCard assignment={cotisation} /> : (
              <Text style={[type.meta, Fonts.neutral300]}>
                {t('myLicenses.children.none', 'Aucune cotisation pour l’instant.')}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

/**
 * ECRAN 1 — « Mes cotisations ».
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function OwnLicenses({ navigation }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const query = useMyLicenses();
  const assignments = useMemo(() => query.data || [], [query.data]);
  const { active, archived } = useMemo(() => splitSeasons(assignments), [assignments]);
  const groups = useMemo(() => groupAssignmentsByClub(active), [active]);
  const archivedSeasons = useMemo(() => [...new Set(
    archived.map((item) => String(item?.campaign?.seasonLabel || '')).filter(Boolean),
  )].sort().reverse(), [archived]);
  const archivedCount = archivedSeasons.length || archived.length;
  const archivedAllPaid = archived.every(
    (item) => (Number(item?.amountRemainingCents) || 0) <= 0,
  );

  const openAssignment = useCallback((assignment) => {
    navigation.navigate(RouteNames.MyLicense, { assignmentId: licenseKeyOf(assignment) });
  }, [navigation]);

  const goBack = useGoBack(navigation);

  if (query.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title={t('myLicenses.title', 'Mes cotisations')} />
        <ListSkeleton />
      </ScreenContainer>
    );
  }

  if (query.isError) {
    // REPRISE-TEXTES (point 25) : un refus (403) n'est pas une panne,
    // « Réessayer » n'y changerait rien.
    const refuse = getErrorStatus(query.error) === 403;
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title={t('myLicenses.title', 'Mes cotisations')} />
        <LicenseEmptyState
          action={refuse ? null : (
            <Button
              onPress={() => query.refetch()}
              title={t(
                'myLicenses.error.retry',
                'Réessayer',
              )}
              variant="Secondary"
            />
          )}
          description={refuse
            ? t(
              'myLicenses.error.refusedDescription',
              'Ton profil ne donne pas accès aux cotisations.',
            )
            : t(
              'myLicenses.error.description',
              'Impossible de charger tes cotisations pour le moment.',
            )}
          title={refuse
            ? t('myLicenses.error.refusedTitle', 'Cette page n’est pas ouverte à ton profil.')
            : t('myLicenses.error.title', 'Cotisations indisponibles')}
        />
      </ScreenContainer>
    );
  }

  if (!active.length && !archived.length) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <MemberTopBar onBack={goBack} title={t('myLicenses.title', 'Mes cotisations')} />
        <LicenseEmptyState
          description={t(
            'myLicenses.empty.description',
            'Aucune cotisation n’est encore rattachée à ton compte.',
          )}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <MemberTopBar onBack={goBack} title={t('myLicenses.title', 'Mes cotisations')} />
      {/* S9-bis : meme borne de hauteur que le detail — cf. le temoin
          `MyLicenseDetail.S9bis.defilement.test.js` pour la cause. */}
      <ScrollView
        contentContainerStyle={{ gap: memberSpacing.section, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        style={Alignments.fill}
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
                {/* MARQUEE — le nom du club se lit en entier */}
                <MarqueeText
                  containerStyle={{ flex: 1 }}
                  style={[type.clubName, Fonts.neutral00]}
                  text={group.clubName}
                />
              </View>
              <Text style={[type.metaBold, group.remainingCents > 0
                ? Fonts.neutral200
                : Fonts.success500]}
              >
                {group.remainingCents > 0
                  ? formatLicenseMoney(group.remainingCents, currencyOf(group.items[0]))
                  : t('myLicenses.group.upToDate', 'à jour')}
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
            <MemberOverline title={t('myLicenses.archive.title', 'Saisons passées')} />
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
                  {t('myLicenses.archive.count', {
                    count: archivedCount,
                    defaultValue_one: '{{count}} saison archivée',
                    defaultValue_other: '{{count}} saisons archivées',
                  })}
                </Text>
                <Text numberOfLines={1} style={[type.rowState, Fonts.neutral300]}>
                  {archivedSeasons.join(' · ')}
                  {archivedAllPaid ? t('myLicenses.archive.allPaid', ' — tout est payé') : ''}
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

/**
 * « Mes cotisations » : les siennes, ou celles de ses enfants pour un compte Parent.
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function MyLicenses({ navigation }) {
  const { accountRoleKey } = useAuth();
  return accountRoleKey === 'parent'
    ? <ChildrenLicenses navigation={navigation} />
    : <OwnLicenses navigation={navigation} />;
}

export default MyLicenses;
