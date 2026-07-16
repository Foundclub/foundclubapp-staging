import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { useGetTeams } from '@/services/team/teamQueries';

import { sortTeamsForDisplay } from '@/utils/teamSort';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardStepCount,
  isStageEventType,
  isTournamentEventType,
} from './eventWizardDetectionUtils';

const normalizeTournamentSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const toReferenceOptions = (items = [], searchValue = '') => {
  const normalizedSearch = normalizeTournamentSearchText(searchValue);
  return items
    .map((item) => ({
      label: item?.name || '',
      value: item?.documentId || '',
    }))
    .filter((option) => option.label && option.value)
    .filter((option) => (
      !normalizedSearch
      || normalizeTournamentSearchText(option.label).includes(normalizedSearch)
    ));
};

const getRelationDocumentId = (value) => String(value?.documentId || value?.id || '').trim();
const dedupeIds = (values = []) => Array.from(new Set(
  values
    .map((value) => String(value || '').trim())
    .filter(Boolean),
));

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardTeam({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { USER_ROLES, userData } = useAuth();
  const { dispatch, state } = useEventWizard();
  const [searchQuery, setSearchQuery] = useState('');
  const isClubManager = userData?.role?.name === USER_ROLES.president;
  const isTournament = isTournamentEventType(state?.type?.name);
  const [tournamentMode, setTournamentMode] = useState(state.tournamentScopeMode || 'team');
  const [selectedTournamentActivity, setSelectedTournamentActivity] = useState(state.tournamentActivity || null);
  const [selectedTournamentSection, setSelectedTournamentSection] = useState(state.tournamentSection || null);
  const [selectedTournamentCategory, setSelectedTournamentCategory] = useState(state.tournamentCategory || null);
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [sectionSearchValue, setSectionSearchValue] = useState('');
  const [categorySearchValue, setCategorySearchValue] = useState('');
  const managedSectionClubIds = useMemo(
    () => dedupeIds(
      (userData?.multisportClubs || [])
        .flatMap((multisportClub) => multisportClub?.sections || [])
        .map((sectionClub) => getRelationDocumentId(sectionClub)),
    ),
    [userData?.multisportClubs],
  );
  const managedMultisportClubId = useMemo(
    () => getRelationDocumentId((userData?.multisportClubs || [])[0]),
    [userData?.multisportClubs],
  );
  const resolvedClubId = useMemo(
    () => (
      getRelationDocumentId(userData?.club)
      || getRelationDocumentId((userData?.myTeams || []).find((team) => team?.club)?.club)
      || getRelationDocumentId((userData?.trainedTeams || []).find((team) => team?.club)?.club)
    ),
    [userData?.club, userData?.myTeams, userData?.trainedTeams],
  );
  const fallbackTeams = useMemo(
    () => sortTeamsForDisplay(
      dedupeIds([
        ...(Array.isArray(userData?.myTeams) ? userData.myTeams.map((team) => team?.documentId) : []),
        ...(Array.isArray(userData?.trainedTeams) ? userData.trainedTeams.map((team) => team?.documentId) : []),
      ]).map((documentId) => (
        (userData?.myTeams || []).find((team) => team?.documentId === documentId)
        || (userData?.trainedTeams || []).find((team) => team?.documentId === documentId)
      )).filter(Boolean),
    ),
    [userData?.myTeams, userData?.trainedTeams],
  );

  const trainedTeamIds = useMemo(() => new Set(
    (userData?.trainedTeams || [])
      .map((team) => team?.documentId)
      .filter(Boolean),
  ), [userData?.trainedTeams]);

  const {
    data: teamsData,
    error,
    isLoading,
    refetch,
  } = useGetTeams(
    {
      clubId: resolvedClubId,
      clubIds: managedSectionClubIds.length > 0 ? managedSectionClubIds : undefined,
      pageSize: 100,
      parentMultisportId: !resolvedClubId && managedSectionClubIds.length === 0 ? managedMultisportClubId : undefined,
      summary: true,
    },
    {
      enabled: Boolean(
        (resolvedClubId || managedSectionClubIds.length > 0 || managedMultisportClubId)
        && (isClubManager || trainedTeamIds.size > 0 || fallbackTeams.length > 0),
      ),
    },
  );
  const activitiesQuery = useGetActivities({ enabled: isTournament });
  const sectionsQuery = useGetSections({ enabled: isTournament });
  const categoriesQuery = useGetCategories({ enabled: isTournament });

  const fetchedTeams = useMemo(
    () => teamsData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [],
    [teamsData],
  );
  const availableTeams = useMemo(() => {
    if (fetchedTeams.length > 0) {
      if (isClubManager) {
        return sortTeamsForDisplay(fetchedTeams);
      }

      return sortTeamsForDisplay(
        fetchedTeams.filter((team) => (
          trainedTeamIds.has(team?.documentId)
          || team?.trainers?.some((trainer) => trainer?.documentId === userData?.documentId)
        )),
      );
    }

    return sortTeamsForDisplay(fallbackTeams);
  }, [fallbackTeams, fetchedTeams, isClubManager, trainedTeamIds, userData?.documentId]);

  const organizerClub = useMemo(() => (
    userData?.club
    || (userData?.trainedTeams || []).find((team) => team?.club)?.club
    || availableTeams.find((team) => team?.club)?.club
    || null
  ), [availableTeams, userData?.club, userData?.trainedTeams]);

  const activityReferences = useMemo(
    () => (activitiesQuery.data || []).filter((item) => item?.documentId && item?.name),
    [activitiesQuery.data],
  );
  const sectionReferences = useMemo(
    () => (sectionsQuery.data || []).filter((item) => item?.documentId && item?.name),
    [sectionsQuery.data],
  );
  const categoryReferences = useMemo(
    () => (categoriesQuery.data || []).filter((item) => item?.documentId && item?.name),
    [categoriesQuery.data],
  );
  const activityOptions = useMemo(
    () => toReferenceOptions(activityReferences, activitySearchValue),
    [activityReferences, activitySearchValue],
  );
  const sectionOptions = useMemo(
    () => toReferenceOptions(sectionReferences, sectionSearchValue),
    [sectionReferences, sectionSearchValue],
  );
  const categoryOptions = useMemo(
    () => toReferenceOptions(categoryReferences, categorySearchValue),
    [categoryReferences, categorySearchValue],
  );

  const normalizeSearchText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const filteredTeams = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return availableTeams;

    return availableTeams.filter((team) => {
      const searchableParts = [
        team?.name,
        team?.club?.name,
        team?.section?.name,
        team?.category?.name || team?.category,
        team?.level?.name || team?.level,
        ...(Array.isArray(team?.activities) ? team.activities.map((activity) => activity?.name) : []),
      ];

      return searchableParts
        .map((part) => normalizeSearchText(part))
        .some((part) => part.includes(normalizedQuery));
    });
  }, [availableTeams, searchQuery]);

  const teamsByOwnership = useMemo(() => {
    const myTeams = [];
    const otherTeams = [];

    filteredTeams.forEach((team) => {
      const isTrainerTeam = trainedTeamIds.has(team?.documentId)
        || team?.trainers?.some((trainer) => trainer?.documentId === userData?.documentId);

      if (isTrainerTeam) {
        myTeams.push(team);
      } else {
        otherTeams.push(team);
      }
    });

    return {
      myTeams: sortTeamsForDisplay(myTeams),
      otherTeams: isClubManager ? sortTeamsForDisplay(otherTeams) : [],
    };
  }, [filteredTeams, isClubManager, trainedTeamIds, userData?.documentId]);

  const hasTeams = availableTeams.length > 0;
  const hasFilteredTeams = filteredTeams.length > 0;

  // Sans equipe, l'etape est un cul-de-sac : on propose directement la creation
  // d'equipe (meme wizard que l'onglet Equipes), avec le club deja resolu.
  const handleCreateTeam = () => {
    navigation.navigate(RouteNames.TeamStack, {
      params: { clubId: resolvedClubId || organizerClub?.documentId || undefined },
      screen: RouteNames.TeamWizardName,
    });
  };

  const handleSelectTeam = (team) => {
    let nextRoute = RouteNames.EventWizardInvites;
    if (isStageEventType(state?.type?.name)) {
      nextRoute = RouteNames.EventWizardStageProgram;
    } else if (isTournamentEventType(state?.type?.name)) {
      nextRoute = RouteNames.EventWizardLogistics;
    }

    if (isTournamentEventType(state?.type?.name)) {
      dispatch({
        payload: {
          club: team?.club || organizerClub,
          team,
          tournamentActivity: team?.activities?.[0] || team?.sport || null,
          tournamentCategory: team?.category || null,
          tournamentScopeMode: 'team',
          tournamentSection: team?.section || null,
        },
        type: 'SET_TOURNAMENT_CONTEXT',
      });
    } else {
      dispatch({ payload: team, type: 'SET_TEAM' });
    }
    navigation.navigate(nextRoute);
  };

  const canContinueAutonomousTournament = Boolean(
    organizerClub?.documentId
    && selectedTournamentActivity?.documentId
    && selectedTournamentSection?.documentId
    && selectedTournamentCategory?.documentId,
  );

  const handleContinueAutonomousTournament = () => {
    if (!canContinueAutonomousTournament) return;
    dispatch({
      payload: {
        club: organizerClub,
        team: null,
        tournamentActivity: selectedTournamentActivity,
        tournamentCategory: selectedTournamentCategory,
        tournamentScopeMode: 'autonomous',
        tournamentSection: selectedTournamentSection,
      },
      type: 'SET_TOURNAMENT_CONTEXT',
    });
    navigation.navigate(RouteNames.EventWizardLogistics);
  };

  const renderTeamCard = (team) => (
    <EventWizardTeamCard
      key={team.documentId}
      onPress={() => handleSelectTeam(team)}
      team={team}
    />
  );

  const renderModeCard = ({ description, label, mode }) => {
    const selected = tournamentMode === mode;
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setTournamentMode(mode)}
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[12],
          {
            backgroundColor: selected ? 'rgba(1, 179, 244, 0.18)' : Colors.primary700,
            borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
            borderRadius: 20,
            borderWidth: 1,
            minHeight: 112,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignStart, { columnGap: 12, rowGap: 8 }]}>
          <Text style={[Fonts.h4Bold, selected ? Fonts.primary500 : Fonts.neutral00, { flex: 1, lineHeight: 22, minWidth: 0 }]}>
            {label}
          </Text>
          <Text
            style={[
              Fonts.p3Bold,
              selected ? Fonts.neutral900 : Fonts.primary500,
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[4],
              {
                backgroundColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.10)',
                borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.32)',
                borderRadius: 999,
                borderWidth: 1,
                overflow: 'hidden',
              },
            ]}
          >
            {selected ? 'Sélectionné' : 'Choisir'}
          </Text>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20, paddingRight: 4 }]}>
          {description}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderReferenceSelect = ({
    emptyLabel,
    label,
    modalTitle,
    onSelect,
    options,
    placeholder,
    references,
    searchValue,
    selected,
    setSearchValue,
  }) => {
    const hasNoReference = references.length === 0;

    return (
      <View style={[Spaces.gap[8]]}>
        <AutocompleteSelect
          disabled={hasNoReference}
          displayValue={selected?.name || ''}
          displayVariant="compact-card"
          isSearchable
          label={label}
          modalSnapPoints={['78%']}
          modalTitle={modalTitle || label}
          options={options}
          placeholder={hasNoReference ? emptyLabel : placeholder}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(option) => {
            const nextReference = references.find((item) => item?.documentId === option?.value) || null;
            onSelect(nextReference);
          }}
          value={selected?.documentId || ''}
        />
        {hasNoReference ? (
          <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
            {emptyLabel}
          </Text>
        ) : null}
      </View>
    );
  };

  if (isTournament) {
    const isReferenceLoading = activitiesQuery.isLoading || sectionsQuery.isLoading || categoriesQuery.isLoading;
    const hasReferenceError = activitiesQuery.error || sectionsQuery.error || categoriesQuery.error;

    return (
      <WizardStepLayout
        onBack={() => navigation.goBack()}
        stepCount={getEventWizardStepCount(state)}
        stepIndex={2}
        subtitle="Choisissez si le tournoi part d'une équipe existante ou s'il est autonome."
        title="Cadre du tournoi"
      >
        <View style={[Spaces.gap[24]]}>
          <View style={[Spaces.gap[16]]}>
            {renderModeCard({
              description: "L'équipe est inscrite automatiquement. Ses joueurs répondent Présent ou Absent dans le roster tournoi.",
              label: "Tournoi d'une équipe",
              mode: 'team',
            })}
            {renderModeCard({
              description: 'Aucune équipe n’est inscrite au départ. Le tournoi est défini par sport, section et catégorie.',
              label: 'Tournoi autonome',
              mode: 'autonomous',
            })}
          </View>

          {tournamentMode === 'team' ? (
            <View style={[Spaces.gap[16]]}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Équipe source</Text>
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 21 }]}>
                  Les membres de l’équipe choisie seront ajoutés au tournoi. Ils ne passeront pas par le RSVP événement classique.
                </Text>
              </View>

              {hasTeams ? (
                <Input
                  density="compact"
                  icon="search"
                  onChangeText={setSearchQuery}
                  placeholder={t('teamList.searchPlaceholder', 'Rechercher une equipe')}
                  value={searchQuery}
                />
              ) : null}

              {isLoading ? (
                <View style={[ApplicationStyle.card, Spaces.padding[24], { backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55` }]}>
                  <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
                    {t('common.loading', 'Chargement...')}
                  </Text>
                </View>
              ) : null}

              {!isLoading && error ? (
                <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[12], { backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55` }]}>
                  <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
                    {error?.message || t('eventWizard.errors.noTeams')}
                  </Text>
                  <Button onPress={() => refetch()} title="Recharger" variant="Secondary" />
                </View>
              ) : null}

              {!isLoading && !error && !hasTeams ? (
                <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[12], { backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55` }]}>
                  <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
                    {t('eventWizard.errors.noTeams')}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                    {t(
                      'eventWizard.steps.team.createTeamHint',
                      "Crée d'abord ton équipe, puis reviens créer ton événement.",
                    )}
                  </Text>
                  <Button
                    onPress={handleCreateTeam}
                    title={t('eventWizard.steps.team.createTeamCta', 'Créer une équipe')}
                    variant="Primary"
                  />
                </View>
              ) : null}

              {!isLoading && !error && hasTeams && !hasFilteredTeams ? (
                <View style={[ApplicationStyle.card, Spaces.padding[24], { backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55` }]}>
                  <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
                    {t('teamList.noSearchResult', 'Aucune equipe trouvee pour cette recherche')}
                  </Text>
                </View>
              ) : null}

              {!isLoading && !error && hasFilteredTeams && !isClubManager ? filteredTeams.map(renderTeamCard) : null}

              {!isLoading && !error && hasFilteredTeams && isClubManager ? (
                <View style={[Spaces.gap[16]]}>
                  {teamsByOwnership.myTeams.length > 0 ? (
                    <View style={[Spaces.gap[12]]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>MES ÉQUIPES</Text>
                      <View>{teamsByOwnership.myTeams.map(renderTeamCard)}</View>
                    </View>
                  ) : null}
                  {teamsByOwnership.otherTeams.length > 0 ? (
                    <View style={[Spaces.gap[12]]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>AUTRES ÉQUIPES DU CLUB</Text>
                      <View>{teamsByOwnership.otherTeams.map(renderTeamCard)}</View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[16], {
              backgroundColor: Colors.primary700,
              borderColor: 'rgba(1, 179, 244, 0.24)',
              borderRadius: 20,
              borderWidth: 1,
            }]}
            >
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Qualification du tournoi</Text>
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 21 }]}>
                  Ces informations remplacent l’équipe source pour classer le tournoi et guider les inscriptions.
                </Text>
              </View>

              <View style={[Spaces.gap[6]]}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>Club organisateur</Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {organizerClub?.name || 'Aucun club disponible'}
                </Text>
              </View>

              {isReferenceLoading ? (
                <Text style={[Fonts.p3, Fonts.neutral300]}>Chargement des référentiels...</Text>
              ) : null}
              {hasReferenceError ? (
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  Impossible de charger tous les référentiels. Réessayez ou repassez par un tournoi d’équipe.
                </Text>
              ) : null}

              {renderReferenceSelect({
                emptyLabel: 'Aucun sport disponible.',
                label: 'Sport',
                modalTitle: 'Choisir un sport',
                onSelect: setSelectedTournamentActivity,
                options: activityOptions,
                placeholder: 'Sélectionner un sport',
                references: activityReferences,
                searchValue: activitySearchValue,
                selected: selectedTournamentActivity,
                setSearchValue: setActivitySearchValue,
              })}
              {renderReferenceSelect({
                emptyLabel: 'Aucune section disponible.',
                label: 'Section',
                modalTitle: 'Choisir une section',
                onSelect: setSelectedTournamentSection,
                options: sectionOptions,
                placeholder: 'Sélectionner une section',
                references: sectionReferences,
                searchValue: sectionSearchValue,
                selected: selectedTournamentSection,
                setSearchValue: setSectionSearchValue,
              })}
              {renderReferenceSelect({
                emptyLabel: 'Aucune catégorie disponible.',
                label: 'Catégorie',
                modalTitle: 'Choisir une catégorie',
                onSelect: setSelectedTournamentCategory,
                options: categoryOptions,
                placeholder: 'Sélectionner une catégorie',
                references: categoryReferences,
                searchValue: categorySearchValue,
                selected: selectedTournamentCategory,
                setSearchValue: setCategorySearchValue,
              })}

              <Button
                disabled={!canContinueAutonomousTournament}
                onPress={handleContinueAutonomousTournament}
                title="Continuer"
                variant="Primary"
              />
            </View>
          )}
        </View>
      </WizardStepLayout>
    );
  }

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={2}
      subtitle={t('eventWizard.steps.team.subtitle')}
      title={t('eventWizard.steps.team.title')}
    >
      <View style={[Spaces.gap[16]]}>
        {isLoading ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              {
                backgroundColor: Colors.primary700,
                borderColor: `${Colors.primary500}55`,
              },
            ]}
          >
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {t('common.loading', 'Chargement...')}
            </Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[12],
              {
                backgroundColor: Colors.primary700,
                borderColor: `${Colors.primary500}55`,
              },
            ]}
          >
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {error?.message || t('eventWizard.errors.noTeams')}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              style={[
                ApplicationStyle.card,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                {
                  alignSelf: 'center',
                  backgroundColor: 'rgba(1, 179, 244, 0.16)',
                  borderColor: Colors.primary500,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>Recharger</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasTeams ? (
          <Input
            density="compact"
            icon="search"
            onChangeText={setSearchQuery}
            placeholder={t('teamList.searchPlaceholder', 'Rechercher une equipe')}
            value={searchQuery}
          />
        ) : null}

        {!isLoading && !error && !hasTeams ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[12],
              {
                backgroundColor: Colors.primary700,
                borderColor: `${Colors.primary500}55`,
              },
            ]}
          >
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {t('eventWizard.errors.noTeams')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
              {t(
                'eventWizard.steps.team.createTeamHint',
                "Crée d'abord ton équipe, puis reviens créer ton événement.",
              )}
            </Text>
            <Button
              onPress={handleCreateTeam}
              title={t('eventWizard.steps.team.createTeamCta', 'Créer une équipe')}
              variant="Primary"
            />
          </View>
        ) : null}

        {!isLoading && !error && hasTeams && !hasFilteredTeams ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              {
                backgroundColor: Colors.primary700,
                borderColor: `${Colors.primary500}55`,
              },
            ]}
          >
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {t('teamList.noSearchResult', 'Aucune equipe trouvee pour cette recherche')}
            </Text>
          </View>
        ) : null}

        {!isLoading && !error && hasFilteredTeams && !isClubManager ? filteredTeams.map(renderTeamCard) : null}

        {!isLoading && !error && hasFilteredTeams && isClubManager ? (
          <View style={[Spaces.gap[16]]}>
            {teamsByOwnership.myTeams.length > 0 ? (
              <>
                <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                  {t('eventWizard.steps.team.myTeams', 'MES ÉQUIPES')}
                </Text>
                <View style={[Spaces.gap[12]]}>
                  {teamsByOwnership.myTeams.map(renderTeamCard)}
                </View>
              </>
            ) : null}

            {teamsByOwnership.otherTeams.length > 0 ? (
              <>
                <Text style={[Fonts.p3Bold, Fonts.neutral200, Spaces.marginTop[8]]}>
                  {t('eventWizard.steps.team.otherClubTeams', 'AUTRES ÉQUIPES DU CLUB')}
                </Text>
                <View style={[Spaces.gap[12]]}>
                  {teamsByOwnership.otherTeams.map(renderTeamCard)}
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardTeam;
