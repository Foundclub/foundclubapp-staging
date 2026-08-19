import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceAction } from '@/domains/guidance/guidanceRuntime';
import {
  extractSubscriptionDecisionFromError,
  getSubscriptionQuotaItem,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import { isReferentialEmpty } from '@/views/team/wizard/TeamWizardEmptyReferential';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { createTeam } from '@/services/team/teamService';

import { useAppMode } from '@/context/AppModeContext';

/**
 * Les trois caches devenus faux des qu'une equipe est creee.
 * @type {string[][]}
 */
const CACHES_A_RAFRAICHIR = [
  ['teams'],
  ['get-me'],
  ['app-bootstrap'],
];

/**
 * Rafraichit les trois caches SANS retenir l'ecran.
 *
 * 🧨 Meme defaut que la creation d'evenement (lot D19), et meme correctif : les
 * trois `await queryClient.invalidateQueries(...)` partaient EN FILE INDIENNE,
 * chacun attendant la refetch du precedent avant de lancer le suivant. Sur un
 * reseau reel (150 a 300 ms par aller-retour), ca fige l'ecran de 0,45 a 0,9 s
 * apres l'appui sur « Creer l'equipe », sans rien montrer — c'est le « c'est
 * long parfois quand il cree pour s'afficher comme tel » de la recette du
 * 2026-08-07.
 *
 * ⚠️ Ne pas attendre ne perd RIEN : `invalidateQueries` marque les requetes
 * perimees de facon SYNCHRONE, seule la refetch est asynchrone. Et le
 * `queryClient` est un singleton : la refetch se termine meme apres que cet
 * ecran a disparu.
 * @param {any} queryClient Le client de cache de l'application.
 * @returns {void}
 */
const refreshCachesAfterTeamCreation = (queryClient) => {
  Promise.all(
    CACHES_A_RAFRAICHIR.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).catch(() => {});
};

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardRecap({ navigation }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isGold } = useAppMode();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const {
    freeUsageSummary,
    subscriptionAccessLevel,
    userData,
  } = useAuth();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const activitiesQuery = useGetActivities();
  const categoriesQuery = useGetCategories();
  const levelsQuery = useGetLevels();
  const sectionsQuery = useGetSections();
  const clubQuery = useGetClub(state.clubId, { enabled: Boolean(state.clubId) });
  const { data: activities } = activitiesQuery;
  const { data: categories } = categoriesQuery;
  const { data: levels } = levelsQuery;
  const { data: sections } = sectionsQuery;
  const { data: clubData } = clubQuery;
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const freeTeamQuotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, 'FREE_TEAM', subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );

  const selectedOverview = useMemo(() => ({
    activity: state.activities || '',
    category: state.category || '',
    clubId: state.clubId || '',
    description: state.description?.trim() || '',
    level: state.level || '',
    name: state.name?.trim() || '',
    section: state.section || '',
    trainers: Array.isArray(state.trainers) ? state.trainers.filter(Boolean) : [],
  }), [state]);

  const createTeamMutation = useMutation({
    // Erreurs gerees localement (sheet de quota ou alerte dediee) : on coupe
    // l'alerte globale onMutationError pour eviter le double affichage.
    meta: { preventToastError: true },
    mutationFn: createTeam,
    onError: (error) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : t('APIerrors.unknown');
      Alert.alert(t('common.error', 'Erreur'), message);
    },
    onSuccess: () => {
      emitGuidanceAction('team.created');
      refreshCachesAfterTeamCreation(queryClient);
      const targetClubId = selectedOverview.clubId;
      dispatch({ type: 'RESET' });
      const rootRoute = isGold ? RouteNames.LeagueHomeTab : RouteNames.HomeTab;
      const targetScreen = isGold ? RouteNames.LeagueSquadTab : RouteNames.MyTeamList;
      const rootNavigation = navigation.getParent();

      if (rootNavigation) {
        rootNavigation.reset({
          index: 0,
          routes: [{
            name: rootRoute,
            params: {
              params: !isGold && targetClubId ? { clubId: targetClubId } : undefined,
              screen: targetScreen,
            },
          }],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{
          name: RouteNames.TeamList,
          params: targetClubId ? { clubId: targetClubId } : undefined,
        }],
      });
    },
  });

  // W06 — UNE ETAPE PASSEE FAUTE DE REFERENTIEL NE DOIT PAS REBLOQUER ICI.
  // Les etapes 3 a 6 laissent desormais continuer quand leur liste globale est
  // vide (voir `TeamWizardEmptyReferential`). Sans ces quatre echappatoires, le
  // cul-de-sac ne serait pas repare : il se contenterait de se DEPLACER a la
  // derniere marche, apres huit ecrans remplis pour rien.
  // ⚠️ C'est bien une exigence de l'APP, pas du serveur : `section`, `category`,
  // `level` et `activities` sont des relations OPTIONNELLES du content-type
  // `team`, et `handleSubmit` poste deja `undefined` pour une valeur absente.
  const isActivityOptional = isReferentialEmpty(activitiesQuery);
  const isCategoryOptional = isReferentialEmpty(categoriesQuery);
  const isLevelOptional = isReferentialEmpty(levelsQuery);
  const isSectionOptional = isReferentialEmpty(sectionsQuery);

  const isRecapReady = useMemo(
    () => Boolean(
      selectedOverview.name
      && (selectedOverview.section || isSectionOptional)
      && (selectedOverview.activity || isActivityOptional)
      && (selectedOverview.category || isCategoryOptional)
      && (selectedOverview.level || isLevelOptional)
      && selectedOverview.trainers.length > 0
      && selectedOverview.clubId,
    ),
    [
      isActivityOptional,
      isCategoryOptional,
      isLevelOptional,
      isSectionOptional,
      selectedOverview.activity,
      selectedOverview.category,
      selectedOverview.clubId,
      selectedOverview.level,
      selectedOverview.name,
      selectedOverview.section,
      selectedOverview.trainers.length,
    ],
  );

  const isReferenceLoading = activitiesQuery.isLoading
    || categoriesQuery.isLoading
    || levelsQuery.isLoading
    || sectionsQuery.isLoading
    || (Boolean(state.clubId) && clubQuery.isLoading);

  const hasReferenceError = Boolean(
    activitiesQuery.error
    || categoriesQuery.error
    || levelsQuery.error
    || sectionsQuery.error
    || clubQuery.error,
  );

  const handleSubmit = () => {
    if (!selectedOverview.clubId) {
      Alert.alert(t('common.error', 'Erreur'), t('teamWizard.errors.clubRequired', 'Club introuvable. Recommence la création depuis la liste équipe.'));
      return;
    }
    if (selectedOverview.trainers.length === 0) {
      Alert.alert(t('common.error', 'Erreur'), t('teamWizard.errors.trainerRequired', 'Sélectionne au moins un entraîneur.'));
      return;
    }

    createTeamMutation.mutate(/** @type {any} */ ({
      activities: selectedOverview.activity ? [selectedOverview.activity] : [],
      authorizedMembershipManagers: [],
      category: selectedOverview.category || undefined,
      club: selectedOverview.clubId,
      description: selectedOverview.description,
      level: selectedOverview.level || undefined,
      name: selectedOverview.name,
      section: selectedOverview.section || undefined,
      teamMembershipApprovalEnabledForCoaches: clubData?.membershipRequestManagementMode !== 'CLUB_OWNER_ONLY',
      trainers: selectedOverview.trainers,
    }));
  };

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  /**
   * @param {{ documentId?: string, name?: string }[] | undefined} collection
   * @param {string} value
   * @returns {string}
   */
  const getLabelFromCollection = (collection, value) => (
    collection?.find((item) => item?.documentId === value)?.name || value || t('eventWizard.recap.notSet', 'Non renseigné')
  );

  const activityLabel = getLabelFromCollection(activities, selectedOverview.activity);
  const sectionLabel = getLabelFromCollection(sections, selectedOverview.section);
  const categoryLabel = getLabelFromCollection(categories, selectedOverview.category);
  const levelLabel = getLabelFromCollection(levels, selectedOverview.level);
  const clubLabel = clubData?.name || t('eventWizard.recap.notSet', 'Non renseigné');
  const heroChips = [activityLabel, categoryLabel, sectionLabel, levelLabel]
    .filter((chip) => chip && chip !== t('eventWizard.recap.notSet', 'Non renseigné'));
  const teamInitials = String(selectedOverview.name || '')
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase() || '·';
  const selectedTrainerRows = selectedOverview.trainers.map((trainerDocumentId) => {
    const member = clubData?.members?.find(
      (/** @param {any} candidate */ candidate) => candidate?.documentId === trainerDocumentId,
    );
    const isSelf = trainerDocumentId === userData?.documentId;
    // Fallback userData pour soi-meme : un compte fraichement affilie n'est pas
    // encore dans clubData.members — et on n'affiche JAMAIS un documentId brut.
    const firstname = member?.firstname || (isSelf ? userData?.firstname : '') || '';
    const lastname = member?.lastname || (isSelf ? userData?.lastname : '') || '';
    const fullName = `${firstname} ${lastname}`.trim();
    const roleName = member?.role?.name || (isSelf ? userData?.role?.name : '');
    const roleLabel = roleName === 'Dirigeant' ? 'dirigeant·e' : 'coach';
    let displayName = fullName;
    if (!displayName) {
      displayName = isSelf ? 'Toi' : 'Entraîneur·e';
    }
    return {
      displayName,
      documentId: trainerDocumentId,
      hasName: Boolean(fullName),
      isSelf,
      roleLabel,
    };
  });

  /**
   * Carte de section du recap avec action « Modifier » (handoff tunnel 8/8).
   * @param {{ children: import('react').ReactNode; onEdit: () => void; title: string }} props
   * @returns {import('react').ReactElement}
   */
  const renderRecapCard = ({ children, onEdit, title }) => (
    <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{title}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onEdit}
          style={[Spaces.paddingVertical[4], Spaces.paddingHorizontal[4]]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            {t('eventWizard.recap.actions.edit', 'Modifier')}
          </Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );

  /**
   * Ligne cle/valeur du recap.
   * @param {{ label: string; value: string }} props
   * @returns {import('react').ReactElement}
   */
  const renderRecapRow = ({ label, value }) => (
    <View
      key={label}
      style={[Alignments.row, Alignments.justifySpaceBetween, Spaces.gap[12], Spaces.paddingVertical[4]]}
    >
      <Text style={[Fonts.p3, Fonts.neutral400]}>{label}</Text>
      <Text style={[Fonts.p3Bold, Fonts.neutral100, { flexShrink: 1, textAlign: 'right' }]}>
        {value}
      </Text>
    </View>
  );

  return (
    <>
      <WizardStepLayout
        isNextDisabled={!isRecapReady || isReferenceLoading || hasReferenceError}
        isNextLoading={createTeamMutation.isPending}
        nextLabel={t('teamWizard.actions.create', "Créer l'équipe")}
        onBack={() => navigation.navigate(RouteNames.TeamWizardTrainers)}
        onClose={handleExitWizard}
        onNext={handleSubmit}
        stepCount={8}
        stepIndex={8}
        subtitle={t('teamWizard.steps.recap.subtitle', 'Vérifie, puis crée ton équipe.')}
        title={t('teamWizard.steps.recap.title', 'Récapitulatif')}
      >
        <View style={[Spaces.gap[12]]}>
          {isReferenceLoading ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                <ActivityIndicator size="small" />
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  Chargement du récapitulatif de cette équipe…
                </Text>
              </View>
            </View>
          ) : null}

          {hasReferenceError ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Impossible de charger toutes les informations du récapitulatif.
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Réessaie avant de créer cette équipe pour vérifier le club, les référentiels et les
                entraîneur·e·s.
              </Text>
              <Button
                onPress={() => {
                  activitiesQuery.refetch();
                  categoriesQuery.refetch();
                  levelsQuery.refetch();
                  sectionsQuery.refetch();
                  if (state.clubId) {
                    clubQuery.refetch();
                  }
                }}
                title="Réessayer"
                variant="Secondary"
              />
            </View>
          ) : null}

          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[12],
              {
                backgroundColor: 'rgba(1,179,244,0.08)',
                borderColor: Colors.primary500,
                borderRadius: 18,
                borderWidth: 1.5,
                paddingHorizontal: 16,
                paddingVertical: 14,
              },
            ]}
          >
            <View
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(1,179,244,0.16)',
                borderRadius: 999,
                height: 52,
                justifyContent: 'center',
                width: 52,
              }}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>{teamInitials}</Text>
            </View>
            <View style={Alignments.fill}>
              <Text numberOfLines={1} style={[Fonts.h5Bold, Fonts.neutral00]}>
                {selectedOverview.name || t('eventWizard.recap.notSet', 'Non renseigné')}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral300, { marginTop: 2 }]}>
                {clubLabel}
              </Text>
              {heroChips.length > 0 ? (
                <View
                  style={[
                    Alignments.row,
                    Spaces.marginTop[8],
                    { columnGap: 6, flexWrap: 'wrap', rowGap: 6 },
                  ]}
                >
                  {heroChips.map((chip) => (
                    <View
                      key={chip}
                      style={{
                        backgroundColor: 'rgba(1,179,244,0.12)',
                        borderRadius: 999,
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, Fonts.primary200]}>{chip}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {renderRecapCard({
            children: (
              <View>
                {renderRecapRow({
                  label: t('teamEdit.fields.name.label'),
                  value: selectedOverview.name || t('eventWizard.recap.notSet', 'Non renseigné'),
                })}
                {renderRecapRow({
                  label: t('teamEdit.fields.description.label'),
                  value: selectedOverview.description
                    || t('teamWizard.recap.noDescription', 'Aucune — ajouter ?'),
                })}
              </View>
            ),
            onEdit: () => navigation.navigate(RouteNames.TeamWizardName),
            title: t('teamWizard.recap.identity', 'Identité'),
          })}

          {renderRecapCard({
            children: (
              <View>
                {selectedTrainerRows.map((trainer) => (
                  <View
                    key={trainer.documentId}
                    style={[
                      Alignments.row,
                      Alignments.alignCenter,
                      Spaces.gap[8],
                      Spaces.paddingVertical[4],
                    ]}
                  >
                    <View
                      style={{
                        alignItems: 'center',
                        backgroundColor: 'rgba(1,179,244,0.16)',
                        borderRadius: 999,
                        height: 30,
                        justifyContent: 'center',
                        width: 30,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                        {trainer.displayName
                          .split(/\s+/)
                          .map((/** @type {string} */ word) => word.charAt(0))
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || '·'}
                      </Text>
                    </View>
                    <Text style={[Fonts.p3Bold, Fonts.neutral100, { flexShrink: 1 }]}>
                      {trainer.displayName}
                      {trainer.isSelf ? (
                        <Text style={[Fonts.p3, Fonts.neutral400]}>
                          {trainer.hasName ? ` — toi, ${trainer.roleLabel}` : ` — ${trainer.roleLabel}`}
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                ))}
              </View>
            ),
            onEdit: () => navigation.navigate(RouteNames.TeamWizardTrainers),
            title: t('teamWizard.recap.staff', 'Encadrement'),
          })}

          {freeTeamQuotaItem ? (
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.paddingHorizontal[4]]}>
              {t(
                'teamWizard.recap.freeQuota.footnote',
                'Cette équipe utilise ta création gratuite ({{used}}/{{total}}).',
                {
                  total: freeTeamQuotaItem.total,
                  used: Math.min(freeTeamQuotaItem.total, freeTeamQuotaItem.used + 1),
                },
              )}
            </Text>
          ) : null}
        </View>
      </WizardStepLayout>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={selectedOverview.clubId || null}
        contextLabel={selectedOverview.name || 'Ta nouvelle équipe'}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
        resumeRouteName={RouteNames.TeamStack}
        resumeRouteParams={{ screen: RouteNames.TeamWizardRecap }}
      />
    </>
  );
}

export default TeamWizardRecap;
