import Slider from '@react-native-community/slider';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubSearchResultCard from '@/components/molecules/clubSearchResultCard/ClubSearchResultCard';
import SearchBar from '@/components/molecules/searchBar/SearchBar';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { useGetActivities } from '@/services/activity/activityQueries';
import { getClubs } from '@/services/club/clubService';
import { getTeams } from '@/services/team/teamService';

import { useEventWizard } from '../EventWizardContext';
import useEventWizardAudiences, {
  EXTERNAL_AUDIENCE_KIND,
  getAudienceTeamId,
} from '../useEventWizardAudiences';

// W07 — la recherche de club externe interroge le serveur, une page a la fois.
// Meme taille que `useSearchClubs` (`clubQueries.js:75`) : on lit la meme
// grammaire de recherche que le reste de l'application.
const EXTERNAL_CLUB_PAGE_SIZE = 10;

const normalizeSearchText = (/** @type {any} */ value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const buildTeamSearchHaystack = (/** @type {any} */ team) => [
  team?.name,
  team?.category?.name,
  team?.level?.name,
  team?.section?.name,
  ...(Array.isArray(team?.activities)
    ? team.activities.map((/** @type {any} */ activity) => activity?.name)
    : []),
]
  .map((value) => normalizeSearchText(value))
  .filter(Boolean)
  .join(' ');

const normalizeGeohash = (/** @type {any} */ value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return String(value[0] || '');
  return '';
};

const createDefaultFilters = (/** @type {any} */ filters = {}) => ({
  activity: typeof filters?.activity === 'string' ? filters.activity : '',
  city: {
    label: String(filters?.city?.label || ''),
    value: String(filters?.city?.value || ''),
  },
  geohash: normalizeGeohash(filters?.geohash),
  radius: Number.isFinite(Number(filters?.radius)) ? Number(filters.radius) : 20,
});

const getFilterCount = (/** @type {any} */ filters = {}) => {
  let count = 0;
  if (filters?.activity) count += 1;
  if (filters?.city?.value) count += 1;
  return count;
};

const formatLocationLabel = (/** @type {any} */ filters = {}) => {
  if (!filters?.city?.label) return '';
  const radius = Number.isFinite(Number(filters?.radius)) ? Number(filters.radius) : 20;
  return `${filters.city.label} - ${radius} km`;
};

/**
 * INVITER L'EQUIPE ADVERSE SUR FOUNDCLUB — S10-B (cadre d'Adel du 2026-08-25,
 * reponse 4 : « equipes EXTERNES seulement sur les MATCHS, via une option dans
 * l'etape Contre qui ? — l'equipe externe invitee EST l'adversaire »).
 *
 * 🧭 Cette recherche vivait dans `EventWizardInvites`, ou elle cotoyait les
 * equipes du club et pouvait en ajouter PLUSIEURS. Ici il n'y en a qu'UNE :
 * l'adversaire du match. En choisir une remplace la precedente.
 *
 * 🔒 CE QUI NE CHANGE PAS, ET C'EST LE POINT : le statut part a `PENDING`. Le
 * coach de l'equipe adverse doit accepter avant qu'elle apparaisse — c'est
 * pour ca qu'elle n'entre pas dans `invitedTeams` (voir
 * `useEventWizardAudiences`).
 *
 * 🔴 W07 — la recherche interroge le SERVEUR (`getClubs`), une page bornee a la
 * fois. Elle ne telecharge JAMAIS la table des equipes pour filtrer en memoire :
 * ce defaut-la coutait 40 requetes a l'ouverture de la section.
 * @param {{ onTeamInvited: (team: any) => void, surfaceStyle: any }} props Proprietes.
 * @returns {import('react').ReactElement} La section rendue.
 */
function EventWizardOpponentInvite({ onTeamInvited, surfaceStyle }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();
  const { dispatch, state } = useEventWizard();
  const { externalAudiences, setExternalAudiences } = useEventWizardAudiences();
  const {
    data: allActivities,
    error: activitiesError,
    isLoading: isLoadingActivities,
    refetch: refetchActivities,
  } = useGetActivities();

  const [isSectionOpen, setIsSectionOpen] = useState(externalAudiences.length > 0);
  const [clubSearch, setClubSearch] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [clubResults, setClubResults] = useState(/** @type {any[]} */ ([]));
  const [isLoadingClubs, setIsLoadingClubs] = useState(false);
  const [hasClubSearchError, setHasClubSearchError] = useState(false);
  const [selectedClub, setSelectedClub] = useState(/** @type {any} */ (null));
  const [clubTeams, setClubTeams] = useState(/** @type {any[]} */ ([]));
  const [teamSearch, setTeamSearch] = useState('');
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [hasTeamsError, setHasTeamsError] = useState(false);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState(createDefaultFilters(state.externalClubFilters));

  const clubId = getAudienceTeamId(state.team?.club) || getAudienceTeamId(userData?.club);
  const filters = useMemo(
    () => createDefaultFilters(state.externalClubFilters),
    [state.externalClubFilters],
  );
  const filterCount = useMemo(() => getFilterCount(filters), [filters]);
  const searchQuery = useMemo(() => String(clubSearch || '').trim(), [clubSearch]);
  const hasSearchQuery = searchQuery.length >= 2;
  const hasActiveFilters = filterCount > 0;

  // S10-B — UNE SEULE equipe adverse. La liste `externalAudiences` peut en
  // porter plusieurs (elle vient d'un ecran qui le permettait) : on lit la
  // premiere, et on n'en ecrit jamais qu'une.
  const invitedAudience = externalAudiences[0] || null;
  const invitedTeamId = getAudienceTeamId(invitedAudience?.team);

  useEffect(() => {
    if (!isFiltersModalOpen) return;
    setFiltersDraft(filters);
  }, [filters, isFiltersModalOpen]);

  const loadClubTeams = useCallback(async (/** @type {any} */ club) => {
    const externalClubId = getAudienceTeamId(club);
    if (!externalClubId) {
      setClubTeams([]);
      setHasTeamsError(false);
      return;
    }

    setIsLoadingTeams(true);
    setHasTeamsError(false);
    try {
      const response = await getTeams({ clubId: externalClubId, pageSize: 100 });
      setClubTeams(Array.isArray(response?.data) ? response.data : []);
    } catch (_error) {
      setClubTeams([]);
      setHasTeamsError(true);
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  // 🔴 W07 — CE QUE CETTE SECTION CHERCHE : un CLUB, n'importe lequel en
  // France, pour ensuite ouvrir SES equipes. Elle ne cherche pas des equipes
  // ici : il faut donc une RECHERCHE serveur, et le depot en a deja une
  // (`getClubs` : nom en `$containsi`, sport, geohash).
  //
  // 🔴 AVANT : `getTeams({ page: 1, pageSize: 100 })` SANS filtre, puis toutes
  // les pages restantes d'un coup dans un `Promise.all`, pour n'en garder que
  // les clubs distincts. Mesure du filet : 40 requetes a l'ouverture, meme
  // quand le serveur n'avait AUCUNE equipe a rendre.
  useEffect(() => {
    let cancelled = false;

    if (!isSectionOpen || selectedClub) {
      setIsLoadingClubs(false);
      setHasClubSearchError(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setIsLoadingClubs(true);
      setHasClubSearchError(false);
      try {
        const response = await getClubs({
          activity: filters.activity || undefined,
          // ⚠️ `getClubs` ANNONCE `geohash?: string[]` (`clubService.js:314`)
          // mais l'UTILISE en `$contains` (`:254-257`), c'est-a-dire sur une
          // CHAINE. L'ecran d'ou vient cette section passait deja une chaine et
          // la recherche marche (temoins W07). On nomme l'ecart plutot que de
          // changer le contrat d'un service partage depuis un seul appelant.
          geohash: /** @type {any} */ (filters.geohash || undefined),
          // Une equipe appartient a un `club`, jamais a un club multisport :
          // les inclure ajouterait une requete et des resultats dont on ne
          // peut inviter personne.
          includeMultisport: false,
          name: hasSearchQuery ? searchQuery : undefined,
          pageSize: EXTERNAL_CLUB_PAGE_SIZE,
        });
        if (cancelled) return;

        const clubs = Array.isArray(response?.data) ? response.data : [];
        setClubResults(clubs.filter((club) => getAudienceTeamId(club) !== clubId));
      } catch (_error) {
        if (cancelled) return;
        setClubResults([]);
        setHasClubSearchError(true);
      } finally {
        if (!cancelled) setIsLoadingClubs(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    clubId,
    filters.activity,
    filters.geohash,
    hasSearchQuery,
    isSectionOpen,
    searchNonce,
    searchQuery,
    selectedClub,
  ]);

  const filteredTeams = useMemo(() => {
    const query = normalizeSearchText(teamSearch);
    if (!query) return clubTeams;
    return clubTeams.filter((team) => buildTeamSearchHaystack(team).includes(query));
  }, [clubTeams, teamSearch]);

  const activityOptions = useMemo(
    () => (allActivities || []).map(({ documentId, name }) => ({ label: name, value: documentId })),
    [allActivities],
  );
  const filteredActivityOptions = useMemo(() => {
    const query = String(activitySearchValue || '').trim().toLowerCase();
    if (!query) return activityOptions;
    return activityOptions.filter((activity) => activity.label.toLowerCase().includes(query));
  }, [activityOptions, activitySearchValue]);
  const activeActivityLabel = useMemo(
    () => activityOptions.find((a) => a.value === filters.activity)?.label || '',
    [activityOptions, filters.activity],
  );
  const draftActivityLabel = useMemo(
    () => activityOptions.find((a) => a.value === filtersDraft.activity)?.label || '',
    [activityOptions, filtersDraft.activity],
  );

  let resultsTitle = t('eventWizard.steps.opponent.inviteClubsProposed', 'Clubs proposes');
  if (hasSearchQuery) {
    resultsTitle = t('eventWizard.steps.opponent.inviteClubsFound', 'Résultats de recherche');
  } else if (hasActiveFilters) {
    resultsTitle = t(
      'eventWizard.steps.opponent.inviteClubsFiltered',
      'Clubs correspondant aux filtres',
    );
  }

  let emptyMessage = t(
    'eventWizard.steps.opponent.inviteNoClub',
    'Aucun club externe disponible pour le moment.',
  );
  if (hasSearchQuery) {
    emptyMessage = t(
      'eventWizard.steps.opponent.inviteNoClubForSearch',
      'Aucun club externe trouve pour cette recherche.',
    );
  } else if (hasActiveFilters) {
    emptyMessage = t(
      'eventWizard.steps.opponent.inviteNoClubForFilters',
      'Aucun club externe ne correspond à ces filtres pour le moment.',
    );
  }

  const handleSelectClub = async (/** @type {any} */ club) => {
    setSelectedClub(club);
    setTeamSearch('');
    await loadClubTeams(club);
  };

  const handleResetClub = () => {
    setSelectedClub(null);
    setTeamSearch('');
    setClubTeams([]);
    setHasTeamsError(false);
  };

  const persistFilters = (/** @type {any} */ nextFilters) => {
    dispatch({ payload: { externalClubFilters: nextFilters }, type: 'SET_META' });
    setSearchNonce((current) => current + 1);
  };

  const handleApplyFilters = () => {
    const nextFilters = createDefaultFilters(filtersDraft);
    const coordinates = String(nextFilters.city?.value || '').split('|');
    const lon = Number.parseFloat(coordinates?.[0] || '');
    const lat = Number.parseFloat(coordinates?.[1] || '');
    const hasCoordinates = Boolean(nextFilters.city?.value)
      && Number.isFinite(lat)
      && Number.isFinite(lon);
    const geohash = hasCoordinates
      ? getGeohashForPointAndRadius(lat, lon, nextFilters.radius)
      : '';

    persistFilters({ ...nextFilters, geohash: typeof geohash === 'string' ? geohash : '' });
    setIsFiltersModalOpen(false);
    setActivitySearchValue('');
  };

  /**
   * Retient (ou relache) l'equipe adverse. S10-B : il n'y en a qu'UNE.
   * @param {any} team L'equipe pressee.
   */
  const toggleInvitedTeam = (team) => {
    const teamId = getAudienceTeamId(team);
    if (teamId && teamId === invitedTeamId) {
      setExternalAudiences([]);
      return;
    }

    setExternalAudiences([{
      audienceKind: EXTERNAL_AUDIENCE_KIND,
      // ⛔ Pas de cochage pour une equipe externe : c'est TOUTE l'equipe, et
      // c'est son coach qui accepte (cadre d'Adel, reponse 4).
      selectedMembers: [],
      selectionMode: 'ALL_MEMBERS',
      status: 'PENDING',
      team,
    }]);
    onTeamInvited(team);
  };

  const renderFilterChip = (/** @type {string} */ label) => (
    <View
      key={label}
      style={[
        Alignments.selfStart,
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[8],
        {
          backgroundColor: `${Colors.primary500}12`,
          borderColor: `${Colors.primary500}44`,
          borderRadius: 999,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary100]}>{label}</Text>
    </View>
  );

  return (
    <View style={Spaces.gap[12]}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.88}
        onPress={() => setIsSectionOpen((current) => !current)}
        style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], surfaceStyle]}
      >
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.gap[12],
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {t(
              'eventWizard.steps.opponent.inviteTitle',
              'Inviter l équipe adverse sur FoundClub',
            )}
          </Text>
          <Image
            source={Images.chevronDown}
            style={{
              height: 16,
              tintColor: Colors.primary500,
              transform: [{ rotate: isSectionOpen ? '180deg' : '0deg' }],
              width: 16,
            }}
          />
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 18 }]}>
          {invitedAudience
            ? t(
              'eventWizard.steps.opponent.invitePendingSummary',
              'Invitation envoyée à {{team}} — son coach doit accepter.',
              { team: invitedAudience?.team?.name || '' },
            )
            : t(
              'eventWizard.steps.opponent.inviteSubtitle',
              'Cherche son club, puis son équipe : elle recevra une invitation à ce match.',
            )}
        </Text>
      </TouchableOpacity>

      {isSectionOpen ? (
        <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], surfaceStyle]}>
          {invitedAudience ? (
            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                {t('eventWizard.steps.opponent.inviteCurrent', 'Équipe adverse invitée')}
              </Text>
              <EventWizardTeamCard
                isSelected
                onPress={() => toggleInvitedTeam(invitedAudience.team)}
                selectionSummary={t(
                  'eventWizard.steps.opponent.invitePending',
                  'Invitation en attente de réponse',
                )}
                showSelectionIndicator
                team={invitedAudience.team}
              />
            </View>
          ) : null}

          {!selectedClub ? (
            <View style={Spaces.gap[12]}>
              <SearchBar
                onChangeText={setClubSearch}
                onFilterPress={() => {
                  setFiltersDraft(filters);
                  setActivitySearchValue('');
                  setIsFiltersModalOpen(true);
                }}
                placeholder={t(
                  'eventWizard.steps.opponent.inviteSearchPlaceholder',
                  'Rechercher un club externe',
                )}
                value={clubSearch}
                withCalendar={false}
                withFilter
              />

              {filterCount > 0 ? (
                <View style={Spaces.gap[8]}>
                  <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                    {activeActivityLabel ? renderFilterChip(activeActivityLabel) : null}
                    {filters.city?.label ? renderFilterChip(formatLocationLabel(filters)) : null}
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    onPress={() => {
                      const emptyFilters = createDefaultFilters();
                      setFiltersDraft(emptyFilters);
                      persistFilters(emptyFilters);
                    }}
                    style={Alignments.selfStart}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                      {t('eventWizard.steps.opponent.inviteClearFilters', 'Effacer les filtres')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {isLoadingClubs ? (
                <ActivityIndicator color={Colors.primary500} size="large" />
              ) : null}

              {!isLoadingClubs && hasClubSearchError ? (
                <View style={Spaces.gap[12]}>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>
                    {t(
                      'eventWizard.steps.opponent.inviteClubsError',
                      'Impossible de charger les clubs externes pour le moment.',
                    )}
                  </Text>
                  <Button
                    onPress={() => setSearchNonce((current) => current + 1)}
                    title={t('common.retry', 'Reessayer')}
                    variant="Primary"
                  />
                </View>
              ) : null}

              {!isLoadingClubs && !hasClubSearchError && clubResults.length > 0 ? (
                <View style={Spaces.gap[12]}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{resultsTitle}</Text>
                  {clubResults.map((club) => (
                    <ClubSearchResultCard
                      footer={(
                        <Text style={[Fonts.p3, Fonts.primary200]}>
                          {t(
                            'eventWizard.steps.opponent.inviteOpenClub',
                            'Appuie pour voir les équipes du club',
                          )}
                        </Text>
                      )}
                      item={club}
                      key={club.documentId || club.id}
                      onPress={() => handleSelectClub(club)}
                    />
                  ))}
                </View>
              ) : null}

              {!isLoadingClubs && !hasClubSearchError && clubResults.length === 0 ? (
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 18 }]}>{emptyMessage}</Text>
              ) : null}
            </View>
          ) : (
            <View style={Spaces.gap[16]}>
              <View style={Spaces.gap[12]}>
                <View
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.gap[12],
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.neutral200, { flex: 1 }]}>
                    {t('eventWizard.steps.opponent.inviteSelectedClub', 'Club sélectionne')}
                  </Text>
                  <Button
                    onPress={handleResetClub}
                    title={t('eventWizard.steps.opponent.inviteChangeClub', 'Changer de club')}
                    variant="Secondary"
                  />
                </View>
                <ClubSearchResultCard isSelected item={selectedClub} />
              </View>

              <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 18 }]}>
                {t(
                  'eventWizard.steps.opponent.inviteTeamHint',
                  'Choisis l équipe que tu affrontes : son coach recevra l invitation.',
                )}
              </Text>

              <SearchBar
                onChangeText={setTeamSearch}
                placeholder={t(
                  'eventWizard.steps.opponent.inviteTeamSearchPlaceholder',
                  'Rechercher une équipe',
                )}
                value={teamSearch}
                withCalendar={false}
              />

              {isLoadingTeams ? (
                <ActivityIndicator color={Colors.primary500} size="large" />
              ) : null}

              {!isLoadingTeams && hasTeamsError ? (
                <View style={Spaces.gap[12]}>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>
                    {t(
                      'eventWizard.steps.opponent.inviteTeamsError',
                      'Impossible de charger les équipes de ce club.',
                    )}
                  </Text>
                  <Button
                    onPress={() => loadClubTeams(selectedClub)}
                    title={t('common.retry', 'Reessayer')}
                    variant="Primary"
                  />
                </View>
              ) : null}

              {!isLoadingTeams && !hasTeamsError && clubTeams.length === 0 ? (
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 18 }]}>
                  {t(
                    'eventWizard.steps.opponent.inviteNoTeam',
                    'Aucune équipe disponible pour ce club.',
                  )}
                </Text>
              ) : null}

              {!isLoadingTeams && !hasTeamsError && clubTeams.length > 0
                && filteredTeams.length === 0 ? (
                  <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 18 }]}>
                    {t(
                      'eventWizard.steps.opponent.inviteNoTeamForSearch',
                      'Aucune équipe ne correspond à cette recherche.',
                    )}
                  </Text>
                ) : null}

              {!isLoadingTeams && !hasTeamsError && filteredTeams.length > 0 ? (
                <View style={Spaces.gap[12]}>
                  {filteredTeams.map((team) => (
                    <EventWizardTeamCard
                      isSelected={getAudienceTeamId(team) === invitedTeamId}
                      key={team.documentId}
                      onPress={() => toggleInvitedTeam(team)}
                      selectionSummary={getAudienceTeamId(team) === invitedTeamId
                        ? t(
                          'eventWizard.steps.opponent.invitePending',
                          'Invitation en attente de réponse',
                        )
                        : t(
                          'eventWizard.steps.opponent.inviteTeamAction',
                          'Appuie pour inviter cette équipe',
                        )}
                      showSelectionIndicator
                      team={team}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {isFiltersModalOpen ? (
        <BottomModal
          close={() => {
            setIsFiltersModalOpen(false);
            setActivitySearchValue('');
          }}
          isVisible
          snapPoints={['88%']}
          webPresentation="dialog"
        >
          <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
            <Text style={[Fonts.h3, Fonts.neutral00]}>
              {t('eventWizard.steps.opponent.inviteFiltersTitle', 'Filtres de recherche club')}
            </Text>

            <AutocompleteAddressInput
              address={filtersDraft.city}
              label={t('clubFilters.fields.city.label', 'Ville')}
              placeholder={t('clubFilters.fields.city.placeholder', 'Entre une ville')}
              setAddress={(/** @type {any} */ city) => setFiltersDraft((current) => ({
                ...current,
                city: city || { label: '', value: '' },
              }))}
            />

            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {`${t('clubFilters.fields.radius.label', 'Rayon')} : ${filtersDraft.radius}km`}
              </Text>
              <Slider
                disabled={!filtersDraft.city?.value}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={2}
                onValueChange={(/** @type {number} */ radius) => setFiltersDraft((current) => ({
                  ...current,
                  radius,
                }))}
                step={1}
                style={[Alignments.fullWidth, { height: 50 }]}
                tapToSeek
                thumbTintColor={Colors.primary500}
                value={filtersDraft.radius}
              />
            </View>

            <View style={Spaces.gap[12]}>
              <AutocompleteSelect
                disabled={Boolean(activitiesError)}
                isLoading={isLoadingActivities}
                isSearchable
                label={t('clubFilters.fields.activity.label', 'Sport')}
                options={filteredActivityOptions}
                placeholder={t(
                  'clubFilters.fields.activity.placeholder',
                  'Sélectionner une activité',
                )}
                searchValue={activitySearchValue}
                setSearchValue={setActivitySearchValue}
                setValue={(/** @type {any} */ option) => setFiltersDraft((current) => ({
                  ...current,
                  activity: option?.value || '',
                }))}
                value={draftActivityLabel}
              />

              {activitiesError ? (
                <View style={Spaces.gap[8]}>
                  <Text style={[Fonts.p3, Fonts.error500]}>
                    {t(
                      'eventWizard.steps.opponent.inviteActivitiesError',
                      'Impossible de charger la liste des sports pour le moment.',
                    )}
                  </Text>
                  <Button
                    onPress={() => refetchActivities()}
                    title={t('common.retry', 'Reessayer')}
                    variant="Secondary"
                  />
                </View>
              ) : null}
            </View>

            <View style={[Alignments.row, Spaces.gap[8], Spaces.paddingTop[8]]}>
              <Button
                onPress={() => {
                  setActivitySearchValue('');
                  setFiltersDraft(createDefaultFilters());
                }}
                style={{ flex: 1 }}
                title={t('clubFilters.actions.clear', 'Vider')}
                variant="Secondary"
              />
              <Button
                onPress={() => {
                  setIsFiltersModalOpen(false);
                  setActivitySearchValue('');
                }}
                style={{ flex: 1 }}
                title={t('common.actions.cancel', 'Annuler')}
                variant="Secondary"
              />
              <Button
                onPress={handleApplyFilters}
                style={{ flex: 1 }}
                title={t('clubFilters.actions.apply', 'Appliquer')}
              />
            </View>
          </View>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default EventWizardOpponentInvite;
