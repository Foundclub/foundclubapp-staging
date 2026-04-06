import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetInvitedLeagueTeams,
  useGetMyLeagueTeam,
  useGetPendingLeagueTeams,
} from '@/services/leagueTeam/leagueTeamQueries';
import { searchSquads } from '@/services/leagueTeam/leagueTeamService';

import { normalizeLocationInput } from '@/utils/location';

/**
 * @typedef {'joined' | 'invited' | 'pending' | 'available'} SearchSquadStatus
 */

/**
 * @param {unknown} value
 * @returns {string | null}
 */
const readFilterValue = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    const safeValue = /** @type {Record<string, any>} */ (value);
    return safeValue.label || safeValue.value || null;
  }
  return String(value);
};

/**
 * @param {unknown} value
 * @returns {string | null}
 */
const getSectionLabel = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!normalized) return null;
  if (normalized === 'male' || normalized === 'masculin') return 'Masculin';
  if (normalized === 'female' || normalized === 'feminin') return 'Feminin';
  if (normalized === 'mixed' || normalized === 'mixte') return 'Mixte';
  return String(value || '');
};

/**
 * @param {SearchSquadStatus} status
 * @param {Record<string, any>} Colors
 * @returns {{
 *   accentColor: string,
 *   actionLabel: string,
 *   badgeLabel: string,
 *   badgeTextColor: string,
 *   helperLabel: string,
 *   surfaceColor: string,
 * }}
 */
const getStatusConfig = (status, Colors) => {
  const warningColor = Colors.warning500 || Colors.gold500;
  const successColor = Colors.success500 || '#2ED47A';

  if (status === 'joined') {
    return {
      accentColor: successColor,
      actionLabel: 'Voir ma squad',
      badgeLabel: 'MEMBRE',
      badgeTextColor: successColor,
      helperLabel: 'Vous faites d\u00E9j\u00E0 partie de cette squad.',
      surfaceColor: `${successColor}14`,
    };
  }

  if (status === 'invited') {
    return {
      accentColor: Colors.gold500,
      actionLabel: 'Repondre a l invitation',
      badgeLabel: 'INVITATION',
      badgeTextColor: Colors.gold500,
      helperLabel: 'Une invitation vous attend sur cette squad.',
      surfaceColor: `${Colors.gold500}16`,
    };
  }

  if (status === 'pending') {
    return {
      accentColor: warningColor,
      actionLabel: 'Voir la demande',
      badgeLabel: 'EN ATTENTE',
      badgeTextColor: warningColor,
      helperLabel: 'Votre demande est en attente de validation.',
      surfaceColor: `${warningColor}14`,
    };
  }

  return {
    accentColor: Colors.primary500,
    actionLabel: 'Voir la squad',
    badgeLabel: 'DISPONIBLE',
    badgeTextColor: Colors.primary500,
    helperLabel: 'Squad ouverte aux nouveaux joueurs.',
    surfaceColor: `${Colors.primary500}14`,
  };
};

/**
 * @param {SearchSquadStatus} status
 * @returns {number}
 */
const getStatusPriority = (status) => {
  if (status === 'invited') return 0;
  if (status === 'pending') return 1;
  if (status === 'available') return 2;
  return 3;
};

/**
 * @param {SearchSquadStatus} status
 * @returns {string}
 */
const getStatusFooterLabel = (status) => {
  if (status === 'joined') return 'Acces rapide a votre squad League';
  if (status === 'invited') return 'Invitation a traiter en priorite';
  if (status === 'pending') return 'Le capitaine doit encore vous repondre';
  return 'Ouvrez la fiche pour voir les details et rejoindre';
};

/**
 *
 */
function SquadSearchScreen() {
  const { Colors, Fonts, Images } = useTheme();
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const { userData } = useAuth();

  const [{ squadFilters }] = useAppContext();

  const [query, setQuery] = useState('');
  const [squads, setSquads] = useState(/** @type {any[]} */ ([]));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentUserId = String(userData?.documentId || '').trim();

  const {
    data: joinedSquads,
    error: joinedSquadsError,
    refetch: refetchJoinedSquads,
  } = useGetMyLeagueTeam(currentUserId, {
    enabled: Boolean(currentUserId),
    staleTime: 30_000,
  });

  const {
    data: pendingSquads,
    error: pendingSquadsError,
    refetch: refetchPendingSquads,
  } = useGetPendingLeagueTeams(currentUserId, {
    enabled: Boolean(currentUserId),
    staleTime: 30_000,
  });

  const {
    data: invitedSquads,
    error: invitedSquadsError,
    refetch: refetchInvitedSquads,
  } = useGetInvitedLeagueTeams(currentUserId, {
    enabled: Boolean(currentUserId),
    staleTime: 30_000,
  });

  const squadStatusById = useMemo(() => {
    /** @type {Map<string, SearchSquadStatus>} */
    const statusMap = new Map();

    (joinedSquads || []).forEach((team) => {
      const teamId = String(team?.documentId || '').trim();
      if (teamId) statusMap.set(teamId, 'joined');
    });

    (invitedSquads || []).forEach((team) => {
      const teamId = String(team?.documentId || '').trim();
      if (teamId && !statusMap.has(teamId)) statusMap.set(teamId, 'invited');
    });

    (pendingSquads || []).forEach((team) => {
      const teamId = String(team?.documentId || '').trim();
      if (teamId && !statusMap.has(teamId)) statusMap.set(teamId, 'pending');
    });

    return statusMap;
  }, [invitedSquads, joinedSquads, pendingSquads]);

  const decoratedSquads = useMemo(() => squads
    .map((team) => {
      const teamId = String(team?.documentId || team?.id || '').trim();
      return {
        ...team,
        membershipStatus: squadStatusById.get(teamId) || 'available',
      };
    })
    .sort((leftTeam, rightTeam) => {
      const leftStatus = /** @type {SearchSquadStatus} */ (leftTeam?.membershipStatus || 'available');
      const rightStatus = /** @type {SearchSquadStatus} */ (rightTeam?.membershipStatus || 'available');
      const priorityDelta = getStatusPriority(leftStatus) - getStatusPriority(rightStatus);
      if (priorityDelta !== 0) return priorityDelta;

      const leftName = String(leftTeam?.name || '').trim();
      const rightName = String(rightTeam?.name || '').trim();
      return leftName.localeCompare(rightName, 'fr', { sensitivity: 'base' });
    }), [squadStatusById, squads]);

  const statusSummary = useMemo(() => {
    const counts = decoratedSquads.reduce((accumulator, team) => {
      const status = /** @type {SearchSquadStatus} */ (team?.membershipStatus || 'available');
      accumulator[status] += 1;
      return accumulator;
    }, /** @type {Record<SearchSquadStatus, number>} */ ({
      available: 0,
      invited: 0,
      joined: 0,
      pending: 0,
    }));

    const parts = [];
    if (counts.joined > 0) parts.push(`${counts.joined} d\u00E9j\u00E0 membre${counts.joined > 1 ? 's' : ''}`);
    if (counts.invited > 0) parts.push(`${counts.invited} invitation${counts.invited > 1 ? 's' : ''}`);
    if (counts.pending > 0) parts.push(`${counts.pending} demande${counts.pending > 1 ? 's' : ''} en attente`);

    return parts.join(' · ');
  }, [decoratedSquads]);

  const activeFiltersLabel = useMemo(() => {
    const chips = [];
    const city = readFilterValue(squadFilters?.city);
    const sport = readFilterValue(squadFilters?.sport);
    const category = readFilterValue(squadFilters?.category);
    const section = readFilterValue(squadFilters?.section);
    const division = readFilterValue(squadFilters?.division);
    const radius = squadFilters?.radius;

    if (city) chips.push(city);
    if (sport) chips.push(sport);
    if (category) chips.push(category);
    if (section) chips.push(section);
    if (division) chips.push(`Div ${division}`);
    if (city && radius) chips.push(`${radius} km`);

    return chips.join(' - ');
  }, [squadFilters]);

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const results = await searchSquads(/** @type {any} */ ({
        ...squadFilters,
        query: query.trim(),
      }));
      setSquads(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error('[SquadSearch] search failed:', error);
      setErrorMessage('Erreur de recherche. Reessayez.');
      setSquads([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, squadFilters]);

  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([
      handleSearch(),
      refetchJoinedSquads(),
      refetchPendingSquads(),
      refetchInvitedSquads(),
    ]);
  }, [handleSearch, refetchInvitedSquads, refetchJoinedSquads, refetchPendingSquads]);

  const statusQueryError = joinedSquadsError || pendingSquadsError || invitedSquadsError;

  useFocusEffect(
    useCallback(() => {
      handleSearch();
    }, [handleSearch]),
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length >= 2 || query.trim().length === 0) {
        handleSearch();
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, handleSearch]);

  const renderItem = (/** @type {{ item: any }} */ { item }) => {
    const teamId = item?.documentId || item?.id;
    const normalizedHomeBase = normalizeLocationInput(item?.home_base);
    const cityLabel = normalizedHomeBase?.city
      || normalizedHomeBase?.label
      || normalizedHomeBase?.address
      || 'Ville inconnue';
    const membershipStatus = /** @type {SearchSquadStatus} */ (item?.membershipStatus || 'available');
    const statusConfig = getStatusConfig(membershipStatus, Colors);
    const sportLabel = item?.sport || 'Sport';
    const categoryLabel = item?.category || 'Categorie';
    const sectionLabel = getSectionLabel(item?.section);
    const divisionLabel = `Div ${item?.division || '?'}`;

    return (
      <TouchableOpacity
        onPress={() => {
          if (!teamId) return;
          navigation.navigate(RouteNames.SquadDetails, { teamId });
        }}
        style={{
          backgroundColor: 'rgba(10, 28, 43, 0.90)',
          borderColor: `${statusConfig.accentColor}4D`,
          borderRadius: 14,
          borderWidth: 1,
          marginBottom: 12,
          padding: 14,
        }}
      >
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[Fonts.h4, { color: Colors.neutral00, flex: 1, paddingRight: 12 }]}>{item?.name || 'Squad'}</Text>
          <View
            style={{
              backgroundColor: statusConfig.surfaceColor,
              borderColor: `${statusConfig.accentColor}55`,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: statusConfig.badgeTextColor }]}>
              {statusConfig.badgeLabel}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', flexDirection: 'row', marginTop: 8 }}>
          <Image
            source={Images.pin}
            style={{
              height: 13, marginRight: 6, tintColor: Colors.primary500, width: 13,
            }}
          />
          <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}>
            {cityLabel}
          </Text>
        </View>

        <Text style={[Fonts.p3, { color: statusConfig.badgeTextColor, marginTop: 8 }]}>
          {statusConfig.helperLabel}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          <View style={{
            backgroundColor: 'rgba(1, 179, 244, 0.10)',
            borderColor: 'rgba(1, 179, 244, 0.35)',
            borderRadius: 999,
            borderWidth: 1,
            marginBottom: 6,
            marginRight: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>{sportLabel}</Text>
          </View>

          <View style={{
            backgroundColor: 'rgba(1, 179, 244, 0.10)',
            borderColor: 'rgba(1, 179, 244, 0.35)',
            borderRadius: 999,
            borderWidth: 1,
            marginBottom: 6,
            marginRight: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>{categoryLabel}</Text>
          </View>

          {sectionLabel ? (
            <View style={{
              backgroundColor: 'rgba(1, 179, 244, 0.10)',
              borderColor: 'rgba(1, 179, 244, 0.35)',
              borderRadius: 999,
              borderWidth: 1,
              marginBottom: 6,
              marginRight: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>{sectionLabel}</Text>
            </View>
          ) : null}

          <View style={{
            backgroundColor: 'rgba(250, 204, 21, 0.12)',
            borderColor: 'rgba(250, 204, 21, 0.45)',
            borderRadius: 999,
            borderWidth: 1,
            marginBottom: 6,
            marginRight: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{divisionLabel}</Text>
          </View>
        </View>

        <View
          style={{
            alignItems: 'center',
            borderTopColor: `${statusConfig.accentColor}2D`,
            borderTopWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
          }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.neutral200, flex: 1, paddingRight: 12 }]}>
            {getStatusFooterLabel(membershipStatus)}
          </Text>
          <View
            style={{
              backgroundColor: statusConfig.surfaceColor,
              borderColor: `${statusConfig.accentColor}55`,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: statusConfig.badgeTextColor }]}>
              {statusConfig.actionLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ marginTop: 8 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
            {t('squad.search.title', 'Trouver une Squad')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.SquadFilters)}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(1, 179, 244, 0.12)',
              borderColor: 'rgba(1, 179, 244, 0.40)',
              borderRadius: 999,
              borderWidth: 1,
              flexDirection: 'row',
              justifyContent: 'center',
              minWidth: 92,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Image
              source={Images.filter}
              style={{
                height: 14, marginRight: 6, tintColor: Colors.primary500, width: 14,
              }}
            />
            <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Filtres</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: 20 }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(9, 27, 42, 0.84)',
            borderColor: 'rgba(1, 179, 244, 0.25)',
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Image source={Images.search} style={{ height: 18, tintColor: Colors.primary500, width: 18 }} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Nom de squad ou ville"
            placeholderTextColor={Colors.neutral500}
            style={[Fonts.p2, {
              color: Colors.neutral00, flex: 1, marginLeft: 10, minHeight: 46,
            }]}
            value={query}
          />
        </View>

        {activeFiltersLabel ? (
          <View style={{
            backgroundColor: 'rgba(1, 179, 244, 0.12)',
            borderColor: 'rgba(1, 179, 244, 0.30)',
            borderRadius: 10,
            borderWidth: 1,
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
              Filtres actifs:
              {' '}
              {activeFiltersLabel}
            </Text>
          </View>
        ) : null}

        {statusSummary ? (
          <View style={{
            backgroundColor: 'rgba(1, 179, 244, 0.10)',
            borderColor: 'rgba(1, 179, 244, 0.28)',
            borderRadius: 10,
            borderWidth: 1,
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
              Statuts detectes:
              {' '}
              {statusSummary}
            </Text>
            <Text style={[Fonts.p4, { color: Colors.neutral300, marginTop: 6 }]}>
              Les invitations et demandes en attente remontent en premier.
            </Text>
          </View>
        ) : null}

        {statusQueryError ? (
          <View style={{
            backgroundColor: 'rgba(250, 204, 21, 0.14)',
            borderColor: 'rgba(250, 204, 21, 0.40)',
            borderRadius: 10,
            borderWidth: 1,
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          >
            <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
              Impossible de charger vos statuts personnels League. La recherche reste disponible.
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                alignSelf: 'flex-start',
                marginTop: 10,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.gold500, textDecorationLine: 'underline' }]}>
                Réessayer
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={{
            backgroundColor: 'rgba(239, 68, 68, 0.16)',
            borderColor: 'rgba(239, 68, 68, 0.45)',
            borderRadius: 10,
            borderWidth: 1,
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          >
            <Text style={[Fonts.p3, { color: Colors.error500 }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Button
          onPress={handleSearch}
          style={{ marginTop: 14, width: '100%' }}
          title="Rechercher"
          variant="Primary"
        />

        {isLoading ? (
          <View style={{ alignItems: 'center', marginTop: 28 }}>
            <ActivityIndicator color={Colors.primary500} size="large" />
            <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 10 }]}>
              Recherche des squads...
            </Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: 28, paddingTop: 16 }}
            data={decoratedSquads}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item, index) => String(item?.documentId || item?.id || `squad-${index}`)}
            ListEmptyComponent={(
              <View style={{
                alignItems: 'center',
                backgroundColor: 'rgba(9, 27, 42, 0.78)',
                borderColor: 'rgba(1, 179, 244, 0.20)',
                borderRadius: 14,
                borderWidth: 1,
                marginTop: 8,
                paddingHorizontal: 16,
                paddingVertical: 20,
              }}
              >
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
                  Aucune squad trouvee
                </Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 6, textAlign: 'center' }]}>
                  Essaie avec d&apos;autres filtres ou un autre nom de squad.
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate(RouteNames.SquadFilters)}
                  style={{
                    backgroundColor: 'rgba(1, 179, 244, 0.10)',
                    borderColor: 'rgba(1, 179, 244, 0.40)',
                    borderRadius: 999,
                    borderWidth: 1,
                    marginTop: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Modifier les filtres</Text>
                </TouchableOpacity>
              </View>
            )}
            onRefresh={handleRefresh}
            refreshing={isLoading}
            renderItem={renderItem}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

export default SquadSearchScreen;
