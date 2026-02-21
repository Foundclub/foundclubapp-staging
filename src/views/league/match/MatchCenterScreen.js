import LocationIcon from '../../../assets/icons/location.png';
import ClockIcon from '../../../assets/icons/clock.png';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, Image, RefreshControl, FlatList, Dimensions } from 'react-native';
import AutocompleteAddressInput from '../../../components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import SectionHeader from '../../../components/atoms/SectionHeader/SectionHeader';
import Button from '../../../components/atoms/button/Button';
import MatchmakingService from '../../../services/league/MatchmakingService';
import { getMyLeagueTeam } from '../../../services/leagueTeam/leagueTeamService';
import { getAvailableSlots } from '../../../services/teamSlot/teamSlotService';
import useAuth from '../../../domains/auth/useAuth';
import { formatDateWithDayPrefix as formatDate } from '../../../utils/date';
import {
    getLocationCoordinates,
    hasValidLocationCoordinates,
    normalizeLocationInput,
    normalizeRadius,
} from '@/utils/location';

import ScreenContainer from '@/components/templates/ScreenContainer';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import LeagueCard from '../../../components/atoms/league/LeagueCard';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import { RouteNames } from '@/navigation/routeNames'; // Import RouteNames

import Slider from '@react-native-community/slider';

import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import { getMatchHistory, updateMatch } from '@/services/league/leagueMatchService';
import { createChatMessage } from '@/services/chat/chatService';
import NextMatchCard from './components/NextMatchCard';
import SearchCountdown from '@/components/organisms/league/SearchCountdown';
import TeamSlotCreationForm from '@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm';
import { shouldShowNextMatchCard } from '@/views/league/match/utils/matchStatus';
import { buildProposalDefaultsFromMatch, toHourMinute } from '@/views/league/match/utils/proposalDefaults';
import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { useMatchmakingStateMachine } from '@/views/league/match/hooks/useMatchmakingStateMachine';
import { navigateToLeagueMatchDetails } from '@/views/league/match/utils/leagueNavigation';
import { createTeamSlot } from '@/services/teamSlot/teamSlotService';
import DivisionBadge from '@/components/atoms/league/DivisionBadge';

/**
 * @typedef {'loading' | 'initializing' | 'no_squad' | 'locker_room' | 'lobby' | 'radar' | 'match_found' | 'connection_error' | 'searching_start'} MatchCenterViewState
 */

/**
 * @typedef {{address: string | null, city: string | null, context?: string | null, country?: string, label: string | null, lat: number | null, lng: number | null, postcode: string | null, radius?: number, value: string}} SearchLocation
 */

/**
 * @typedef {{day: string, startTime: string, endTime: string}} AddSearchSlotPayload
 */

/**
 * @typedef {{address?: string, addressObject?: {label?: string, address?: string} | null, date?: string, endDate?: string, venue?: string}} VenueProposalPayload
 */

const MatchCenterScreen = () => {
    const swordsIcon = '\u2694\uFE0F';
    const radarIcon = '\uD83D\uDCE1';
    const navigation = /** @type {any} */ (useNavigation());
    const { userData } = useAuth();
    const { Colors, Fonts, Images, Alignments, Spaces, ApplicationStyle } = useTheme();
    
    // Data State
    const [mySquad, setMySquad] = useState(/** @type {Team | null} */ (null));
    const [allSquads, setAllSquads] = useState(/** @type {Team[]} */ ([])); // Store all user squads
    const [viewState, setViewState] = useState(/** @type {MatchCenterViewState} */ ('loading')); // loading, no_squad, locker_room, lobby, radar, match_found, connection_error
    const [activeSlot, setActiveSlot] = useState(/** @type {LeagueSlot | null} */ (null));
    const [squadSlots, setSquadSlots] = useState(/** @type {LeagueSlot[]} */ ([])); // Store all available slots for carousel
    const [matchRequest, setMatchRequest] = useState(/** @type {MatchRequest | null} */ (null));
    const [currentMatch, setCurrentMatch] = useState(/** @type {LeagueMatch | null} */ (null));
    const [opponentDetails, setOpponentDetails] = useState(/** @type {OpponentDetails | null} */ (null)); // Add state
    const [recentMatches, setRecentMatches] = useState(/** @type {MatchHistoryEntry[]} */ ([]));

    const slotCardGap = 12;
    const screenWidth = React.useRef(Dimensions.get('window').width).current;
    const [slotCarouselWidth, setSlotCarouselWidth] = useState(0);
    const slotCardWidth = React.useMemo(() => {
        if (slotCarouselWidth > 0) {
            // Keep one full "page" = card width + gap to avoid clipped content while swiping.
            return Math.max(slotCarouselWidth - slotCardGap, 220);
        }
        return Math.max(screenWidth - 88 - slotCardGap, 220);
    }, [screenWidth, slotCarouselWidth, slotCardGap]);
    
    // UI State
    const [loading, setLoading] = useState(false);
    const [isSquadSelectorVisible, setIsSquadSelectorVisible] = useState(false);
    const [isProposalModalVisible, setIsProposalModalVisible] = useState(false);

    // Search Config State
    const [searchRadius, setSearchRadius] = useState(20);
    const [tempSearchLocation, setTempSearchLocation] = useState(/** @type {SearchLocation | null} */ (null));
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [selectedSlotIds, setSelectedSlotIds] = useState(/** @type {string[]} */ ([])); // IDs of slots to include in search
    const [isAddingSearchSlot, setIsAddingSearchSlot] = useState(false);
    const [isSavingSearchSlot, setIsSavingSearchSlot] = useState(false);
    const [matchmakingServerNow, setMatchmakingServerNow] = useState(/** @type {string | null} */ (null));

    // DAY_MAP for display
    /** @type {Record<string, string>} */
    const DAY_MAP = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };

    const isCurrentUserCaptain = React.useMemo(() => {
        const captainId = getEntityDocumentId(mySquad?.captain);
        const currentUserId = getEntityDocumentId(userData);
        return Boolean(captainId && currentUserId && areSameEntityId(captainId, currentUserId));
    }, [mySquad?.captain, userData]);

    /**
     * @param {string} routeName
     * @returns {any}
     */
    const findNavigatorWithRoute = useCallback((routeName) => {
        let cursor = navigation;
        while (cursor) {
            const routeNames = cursor?.getState?.()?.routeNames || [];
            if (routeNames.includes(routeName)) return cursor;
            cursor = cursor?.getParent?.();
        }
        return null;
    }, [navigation]);

    /**
     * @param {string} routeName
     * @param {Record<string, any>} [params]
     * @returns {boolean}
     */
    const safeNavigate = useCallback((routeName, params) => {
        const targetNavigator = findNavigatorWithRoute(routeName);
        if (!targetNavigator) return false;
        targetNavigator.navigate(routeName, params);
        return true;
    }, [findNavigatorWithRoute]);

    const promptCaptainSearchRequirements = useCallback(() => {
        Alert.alert(
            'Recherche reservee au capitaine',
            'Seul le capitaine peut lancer une recherche manuelle. La recherche demarre aussi automatiquement quand 5 membres sont prets sur un creneau.',
            [
                {
                    text: 'Compris',
                    style: 'cancel',
                },
                {
                    text: 'Inviter des joueurs',
                    onPress: () => {
                        const squadId = getEntityDocumentId(mySquad);
                        if (safeNavigate(RouteNames.LeagueSquadTab)) return;
                        if (squadId && safeNavigate(RouteNames.SquadDetails, { teamId: squadId })) return;
                        safeNavigate(RouteNames.LeagueHomeTab, { screen: RouteNames.LeagueSquadTab });
                    },
                },
            ],
        );
    }, [mySquad, safeNavigate]);

    /**
     * @param {Array<any>} items
     * @returns {string[]}
     */
    const toDocumentIdList = (items) => (
        (items || [])
            .map((item) => getEntityDocumentId(item))
            .filter((id) => typeof id === 'string' && id.length > 0)
    );

    // Normalized home base shape shared across all league screens.
    const homeBase = React.useMemo(
        () => normalizeLocationInput(mySquad?.home_base),
        [mySquad?.home_base]
    );

    // Initialize temp location from homeBase or User Location
    useEffect(() => {
        // console.log('[DEBUG] MatchCenter - Init Location', { homeBase, userLoc: userData?.location });
        if (!tempSearchLocation) {
            const normalizedHomeBase = normalizeLocationInput(homeBase);
            if (normalizedHomeBase && hasValidLocationCoordinates(normalizedHomeBase)) {
                setTempSearchLocation(normalizedHomeBase);
                return;
            }

            const normalizedUserLocation = normalizeLocationInput(userData?.location);
            if (normalizedUserLocation && hasValidLocationCoordinates(normalizedUserLocation)) {
                setTempSearchLocation(normalizedUserLocation);
            }
        }
    }, [homeBase, userData]);

    // Initialize searchRadius from homeBase
    useEffect(() => {
        if (homeBase?.radius) {
            setSearchRadius(normalizeRadius(homeBase.radius, 20));
        }
    }, [homeBase]);

    const lastMatchRef = useRef(/** @type {LeagueMatch | null} */ (null));
    const cancellationLikeStatuses = React.useMemo(
        () => new Set(['provisionary', 'negotiating', 'scheduled']),
        []
    );

    const fetchMatchData = useCallback(async (
        /** @type {Team} */ squad,
    ) => {
        setMySquad(squad);
        setLoading(true);
        try {
            try {
                const history = await getMatchHistory(getEntityDocumentId(squad), 5);
                setRecentMatches(Array.isArray(history) ? history : []);
            } catch (historyError) {
                console.error('Fetch match history error:', historyError);
                setRecentMatches([]);
            }

            // B. Check Active Matchmaking Request for THIS squad
            const activeReq = await MatchmakingService.getActiveRequest(getEntityDocumentId(squad));
            setMatchmakingServerNow(activeReq?.serverNow || null);
            
            // activeReq is { state: 'idle' | 'searching' | 'matched', request?, match? }
            if (activeReq && (activeReq.state === 'searching' || activeReq.state === 'matched')) {
                setMatchRequest(activeReq.request || null);
                if (activeReq.state === 'matched') {
                    setViewState('match_found');
                    setCurrentMatch(activeReq.match || null);
                    setOpponentDetails(activeReq.opponentDetails || null);
                    lastMatchRef.current = activeReq.match || null; // Track match
                } else {
                    setViewState('radar');
                    setCurrentMatch(null);
                    // Match disappeared or switched to searching?
                    if (lastMatchRef.current) {
                        const previousStatus = String(lastMatchRef.current.status || '').toLowerCase();
                        if (cancellationLikeStatuses.has(previousStatus)) {
                             Alert.alert('Match annule', 'Le match precedent a ete annule.');
                        }
                        lastMatchRef.current = null;
                    }
                }
            } else {
                // No active request/match
                setMatchmakingServerNow(null);
                if (lastMatchRef.current) {
                     // Only show cancellation if previous status was in cancellable pre-result phases.
                     const previousStatus = String(lastMatchRef.current.status || '').toLowerCase();
                     if (cancellationLikeStatuses.has(previousStatus)) {
                         Alert.alert('Match annule', "Votre match a ete annule par l'adversaire ou le systeme.");
                     }
                     lastMatchRef.current = null;
                     setCurrentMatch(null);
                }

                // C. Check Next Available Slot
                const slots = await getAvailableSlots(getEntityDocumentId(squad));
                setSquadSlots(slots || []);
                
                if (slots && slots.length > 0) {
                    setActiveSlot(slots[0]);
                    setViewState('locker_room');
                } else {
                    // No slots available
                    setViewState('locker_room'); 
                    setActiveSlot(null);
                }
            }
        } catch (error) {
             console.error("Fetch Match Data Error:", error);
        } finally {
            setLoading(false);
        }
    }, [userData, searchRadius, cancellationLikeStatuses]);

    const loadMatchCenter = useCallback(async () => {
        if (!userData) return;
        setLoading(true);
        try {
            // A. Fetch User's LEAGUE Squads
            const squads = await getMyLeagueTeam(getEntityDocumentId(userData)); 
            setAllSquads(squads);
            
            if (squads.length === 0) {
                setViewState('no_squad');
                setRecentMatches([]);
                setLoading(false);
                return;
            }

            // Select initial squad (either currently selected or first one)
            const initialSquad = mySquad && squads.find((/** @type {Team} */ s) => areSameEntityId(getEntityDocumentId(s), getEntityDocumentId(mySquad))) 
                ? mySquad 
                : squads[0];
            
            // Allow fetchMatchData to set mySquad and viewState
           await fetchMatchData(initialSquad);

        } catch (error) {
            console.error("Load Match Center Error:", error);
            Alert.alert("Erreur", "Impossible de charger le Match Center");
            setLoading(false);
        }
    }, [userData, mySquad, fetchMatchData]);

    // 1. Load Squads & State on Focus
    useFocusEffect(
        useCallback(() => {
            loadMatchCenter();
        }, [loadMatchCenter])
    );

    const handleSquadSwitch = async (/** @type {Team} */ squad) => {
        setIsSquadSelectorVisible(false);
        if (!areSameEntityId(getEntityDocumentId(squad), getEntityDocumentId(mySquad))) {
            await fetchMatchData(squad);
        }
    };

    const handleLaunchLobby = () => {
        if (!isCurrentUserCaptain) {
            promptCaptainSearchRequirements();
            return;
        }
        setViewState('lobby');
    };

    const handleConfirmSearch = async () => {
        if (!mySquad) return; 
        if (!isCurrentUserCaptain) {
            promptCaptainSearchRequirements();
            return;
        }
        if (!Array.isArray(selectedSlotIds) || selectedSlotIds.length === 0) {
            Alert.alert(
                'Creneau requis',
                'Selectionnez au moins un creneau avant de lancer la recherche.'
            );
            return;
        }
        
        // 1. Show Loading Screen immediately (closes modal)
        setViewState('searching_start');
        
        // 2. Artificial Delay for UX (let user appreciate the transition)
        setTimeout(async () => {
            try {
                const locationCandidates = [
                    tempSearchLocation,
                    mySquad?.home_base,
                    mySquad?.address,
                    userData?.location,
                ];

                let normalizedLocation = null;
                for (const candidate of locationCandidates) {
                    const current = normalizeLocationInput(candidate);
                    if (current && hasValidLocationCoordinates(current)) {
                        normalizedLocation = current;
                        break;
                    }
                }

                if (!normalizedLocation) {
                    Alert.alert(
                        'Localisation requise',
                        'Ajoutez une adresse de squad valide (coordonnees GPS) avant de lancer la recherche.'
                    );
                    setViewState('lobby');
                    return;
                }

                const coordinates = getLocationCoordinates(normalizedLocation);
                if (!coordinates) {
                    Alert.alert(
                        'Localisation invalide',
                        'Impossible de lire les coordonnees de votre localisation.'
                    );
                    setViewState('lobby');
                    return;
                }

                const searchLocation = {
                    address: normalizedLocation.address || normalizedLocation.label || null,
                    city: normalizedLocation.city || null,
                    label: normalizedLocation.label || normalizedLocation.address || null,
                    lat: coordinates.lat,
                    lng: coordinates.lng,
                    postcode: normalizedLocation.postcode || null,
                    value: `${coordinates.lng}|${coordinates.lat}`,
                };

                const params = {
                    teamId: getEntityDocumentId(mySquad),
                    selectedSlotIds: selectedSlotIds, // Array of selected recurring slot IDs
                    radius: normalizeRadius(searchRadius, normalizedLocation.radius || 20),
                    location: searchLocation,
                };

                const result = await MatchmakingService.triggerSearch(params.teamId, params.selectedSlotIds, params);

                
                if (result && 'status' in result && result.status === 'matched') {
                     Alert.alert('Match trouve !', 'Un adversaire a ete trouve instantanement !');
                     setViewState('match_found');
                } else {
                    setMatchRequest(result);
                    setMatchmakingServerNow(result?.serverNow || null);
                    setViewState('radar');
                }
            } catch (error) {
                console.error(error);
                const apiError = /** @type {any} */ (error);
                const backendCode = apiError?.response?.data?.code;
                const backendMessage = apiError?.response?.data?.message;
                if (backendCode === 'SEARCH_ALREADY_ACTIVE') {
                    Alert.alert('Recherche deja active', 'Une recherche est deja en cours pour cette squad.');
                } else if (backendCode === 'UNAUTHORIZED_TEAM_ACTION') {
                    promptCaptainSearchRequirements();
                } else {
                    Alert.alert('Erreur', backendMessage || 'Recherche echouee');
                }
                setViewState('lobby'); // Go back to config on error
            }
        }, 2000); // 2 seconds delay
    };
    const handleAutoSearchingDetected = useCallback((/** @type {MatchmakingStatus} */ statusData) => {
        setMatchRequest(statusData?.request || null);
        setMatchmakingServerNow(statusData?.serverNow || null);
        setViewState('radar');
    }, []);

    const handleSearchingStatusSync = useCallback((/** @type {MatchmakingStatus} */ statusData) => {
        if (statusData?.request) {
            setMatchRequest(statusData.request);
        }
        if (statusData?.serverNow) {
            setMatchmakingServerNow(statusData.serverNow);
        }
    }, []);

    const handleConnectionError = useCallback(() => {
        setViewState('connection_error');
    }, []);

    const handleMatched = useCallback((/** @type {MatchmakingStatus} */ statusData, /** @type {{silent?: boolean}} */ options = {}) => {
        const nextMatch = statusData?.match || null;
        const nextMatchId = getEntityDocumentId(nextMatch);
        const currentMatchId = getEntityDocumentId(currentMatch);
        const sameMatch = Boolean(nextMatchId && currentMatchId && areSameEntityId(nextMatchId, currentMatchId));
        const shouldAlert = !options?.silent && (!sameMatch || viewState !== 'match_found');
        setMatchRequest(statusData?.request || null);
        setMatchmakingServerNow(statusData?.serverNow || null);
        setCurrentMatch(nextMatch);
        setOpponentDetails(statusData?.opponentDetails || null);
        setViewState('match_found');
        if (shouldAlert) {
            Alert.alert('Match trouve', "Un adversaire a ete trouve.");
        }
    }, [currentMatch, viewState]);

    const handleRecoverFromBackground = useCallback(() => {
        setViewState('radar');
    }, []);

    const { searchStatus, serverNow: pollingServerNow } = useMatchmakingStateMachine({
        matchRequest,
        mySquad,
        viewState,
        onAutoSearchingDetected: handleAutoSearchingDetected,
        onConnectionError: handleConnectionError,
        onMatched: handleMatched,
        onSearchingStatus: handleSearchingStatusSync,
        onRecoverFromBackground: handleRecoverFromBackground,
    });

    // Ensure searchRadius is initialized from squad preferences 
    useEffect(() => {
        const normalized = normalizeLocationInput(mySquad?.home_base);
        if (normalized?.radius) {
            setSearchRadius(normalizeRadius(normalized.radius, 20));
        }
    }, [mySquad]);

    // Search is manual: no silent preselection of all slots.
    useEffect(() => {
        setSelectedSlotIds([]);
    }, [getEntityDocumentId(mySquad)]);

    useEffect(() => {
        const allowedIds = new Set(
            (squadSlots || [])
                .map((slot) => getEntityDocumentId(slot))
                .filter((id) => typeof id === 'string' && id.length > 0),
        );
        setSelectedSlotIds((prev) => prev.filter((slotId) => allowedIds.has(slotId)));
    }, [squadSlots]);

    useEffect(() => {
        if (viewState === 'radar' && !matchRequest?.createdAt) {
            console.warn('[MatchCenter] Missing request.createdAt while searching. Countdown fallback active.');
        }
    }, [matchRequest?.createdAt, viewState]);

    // Toggle slot selection for matchmaking
    const toggleSlotSelection = (/** @type {string} */ slotId) => {
        setSelectedSlotIds(prev => 
            prev.includes(slotId) 
                ? prev.filter(id => id !== slotId) 
                : [...prev, slotId]
        );
    };

    const handleAddSearchSlot = async (/** @type {AddSearchSlotPayload} */ slotData) => {
        if (!mySquad || isSavingSearchSlot) return;

        try {
            setIsSavingSearchSlot(true);
            const teamId = getEntityDocumentId(mySquad);
            const previousSlotIds = new Set(toDocumentIdList(squadSlots));
            const payload = {
                start_hour: `${slotData.startTime}:00`,
                end_hour: `${slotData.endTime}:00`,
                recurrence_day: slotData.day,
                league_team: teamId,
                status: 'open',
            };

            await createTeamSlot(payload);
            const refreshedSlots = await getAvailableSlots(teamId);
            setSquadSlots(refreshedSlots || []);

            const newlyAddedSlot = (refreshedSlots || []).find((slot) => {
                const slotId = getEntityDocumentId(slot);
                return slotId && !previousSlotIds.has(slotId);
            });

            const newSlotId = getEntityDocumentId(newlyAddedSlot);
            if (newSlotId) {
                setSelectedSlotIds((prev) => (
                    prev.includes(newSlotId) ? prev : [...prev, newSlotId]
                ));
            }

            setIsAddingSearchSlot(false);
            Alert.alert('Succes', 'Creneau ajoute a la recherche.');
        } catch (error) {
            console.error('Add search slot error:', error);
            Alert.alert('Erreur', "Impossible d'ajouter le creneau.");
        } finally {
            setIsSavingSearchSlot(false);
        }
    };




    const handleCancelSearch = async () => {
        if (!matchRequest) return;
        setLoading(true);
        try {
            const reqId = getEntityDocumentId(matchRequest);
            await MatchmakingService.cancelRequest(reqId);
            setMatchRequest(null);
            // Refresh data to ensure consistent state
            await loadMatchCenter();
            setViewState('locker_room');
        } catch (error) {
            console.error("Cancel Error:", error);
            Alert.alert("Erreur", "Impossible d'annuler");
        } finally {
            setLoading(false);
        }
    };

    const handleSendProposal = async (/** @type {VenueProposalPayload} */ proposalData) => {
        if (!currentMatch) return;
        setLoading(true);
        try {
            const matchId = getEntityDocumentId(currentMatch);
            if (!proposalData?.date) {
                throw new Error('Missing proposal date');
            }
            const addressLabel = typeof proposalData?.address === 'string'
                ? proposalData.address
                : proposalData?.addressObject?.label
                    || proposalData?.addressObject?.address
                    || null;

            const nextLocation = {
                ...(currentMatch?.location && typeof currentMatch.location === 'object' ? currentMatch.location : {}),
                ...(proposalData?.addressObject && typeof proposalData.addressObject === 'object' ? proposalData.addressObject : {}),
                ...(addressLabel ? { address: addressLabel, label: addressLabel } : {}),
                ...(proposalData?.endDate ? { proposed_end_time: proposalData.endDate } : {}),
            };
            
            // 1. Update Match with Proposal
            await updateMatch(matchId, {
                proposed_venue: proposalData.venue,
                proposed_time: proposalData.date,
                location: nextLocation
            });

            // 2. Refresh Match Data Locally (Optimistic or fetch)
            const updatedMatch = { 
                ...currentMatch, 
                proposed_venue: proposalData.venue, 
                proposed_time: proposalData.date,
                location: nextLocation,
            };
            setCurrentMatch(updatedMatch);

            // 3. Send Formatted Message in Chat
            if (currentMatch.chat) {
                const chatId = getEntityDocumentId(currentMatch.chat);
                if (!chatId) {
                    throw new Error('Missing chat id');
                }
                const proposalDate = String(proposalData.date);
                
                const startDate = new Date(proposalDate);
                const endDate = proposalData.endDate
                    ? new Date(proposalData.endDate)
                    : new Date(startDate.getTime() + (60 * 60 * 1000));
                
                const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                const startStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const endStr = endDate ? endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '?';
                
                const timeStr = `de ${startStr} a ${endStr}`;
                const placeLine = addressLabel
                    ? `${proposalData.venue} (${addressLabel})`
                    : proposalData.venue;
                
                const messageText = `Proposition de match\n` +
                    `${placeLine}\n` +
                    `${dateStr}\n` +
                    `${timeStr}\n\n` +
                    `Cela vous convient-il ?`;

                await createChatMessage(/** @type {any} */ ({
                    chatId,
                    message: messageText,
                    composition: {
                        type: 'proposal',
                        venue: proposalData.venue,
                        address: addressLabel,
                        addressObject: nextLocation,
                        date: proposalData.date,
                        endDate: endDate.toISOString(),
                        status: 'pending',
                        matchId: matchId 
                    }
                }));
                
                // 4. Navigate to Chat
                setIsProposalModalVisible(false);
                const opponentName = opponentDetails ? `Vs ${opponentDetails.name || 'Adversaire'}` : 'Chat';
                navigation.navigate('Conversation', { 
                    chatId, 
                    title: opponentName, 
                    subTitle: 'Match de Ligue' 
                });
            }

        } catch (error) {
            console.error("Proposal Error:", error);
            Alert.alert("Erreur", "Impossible d'envoyer la proposition.");
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERERS ---

    const renderNoSquad = () => (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 }}>
            <LeagueCard style={{ width: '100%', alignItems: 'center', paddingVertical: 40 }}>
                <Text style={[Fonts.h2, { color: Colors.neutral00, marginBottom: 8 }]}>PRET A L'ACTION ?</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 24 }]}>
                    Cree ton equipe pour rejoindre la competition officielle.
                </Text>
                <Button 
                    title="CREER UNE SQUAD" 
                    variant="Primary" 
                    icon="plus"
                    iconColor={Colors.primary500}
                    onPress={() => navigation.navigate(RouteNames.TeamStack, { screen: RouteNames.CreateSquad })}
                    style={{ 
                        width: '100%',
                        backgroundColor: Colors.gold500,
                        borderRadius: 30,
                        shadowColor: Colors.gold500,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 5,
                        elevation: 5
                    }}
                    textStyle={{ color: Colors.neutral900 }}
                />
            </LeagueCard>
        </View>
    );

    const VisualRoster = ({ rsvpCount = 0, total = 5 }) => {
        const slots = [];
        for (let i = 0; i < total; i++) {
            const isFilled = i < rsvpCount;
            slots.push(
                <View 
                    key={i} 
                    style={{
                        width: 36, height: 36, borderRadius: 18,
                        marginRight: -8,
                        backgroundColor: Colors.neutral800,
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,0.14)',
                        justifyContent: 'center', alignItems: 'center',
                        overflow: 'hidden'
                    }}
                >
                    {isFilled ? (
                        <Image source={Images.roundAvatar} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.neutral700 }} />
                    )}
                </View>
            );
        }
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingLeft: 8 }}>
                {slots}
            </View>
        );
    };

    const renderMatchCardContent = () => {
        if (viewState === 'initializing') {
            return (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                     <ActivityIndicator size="large" color={Colors.gold500 || '#D4AF37'} />
                     <Text style={[Fonts.h3, { color: Colors.neutral00, marginTop: 16, textAlign:'center' }]}>
                         INITIALISATION...
                     </Text>
                     <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginTop: 8 }]}>
                         Lancement du protocole de match.
                     </Text>
                </View>
            );
        }

        if (viewState === 'searching_start') {
            return (
                <View style={{ alignItems: 'center', paddingVertical: 40, width: '100%' }}>
                     <View style={{ 
                         width: 80, height: 80, borderRadius: 40, 
                         backgroundColor: Colors.neutral800, 
                         justifyContent: 'center', alignItems: 'center',
                         marginBottom: 24,
                         borderWidth: 2, borderColor: Colors.primary500 
                     }}>
                        <ActivityIndicator size="large" color={Colors.primary500} />
                     </View>
                     <Text style={[Fonts.h2, { color: Colors.neutral00, marginBottom: 8, textAlign:'center' }]}>
                         LANCEMENT DU SCAN
                     </Text>
                     <Text style={[Fonts.p1, { color: Colors.primary500, textAlign: 'center', marginBottom: 16 }]}>
                         Analyse de la zone de recherche...
                     </Text>
                     <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
                         Nous identifions les adversaires potentiels.
                     </Text>
                </View>
            );
        }

        if (viewState === 'connection_error') {
            return (
                <View style={{ alignItems: 'center', paddingVertical: 40, width: '100%' }}>
                     <View style={{ 
                         width: 80, height: 80, borderRadius: 40, 
                         backgroundColor: Colors.neutral800, 
                         justifyContent: 'center', alignItems: 'center',
                         marginBottom: 24,
                         borderWidth: 2, borderColor: Colors.error500 
                     }}>
                        <Text style={{ fontSize: 32 }}>!</Text>
                     </View>
                     <Text style={[Fonts.h2, { color: Colors.neutral00, marginBottom: 8, textAlign:'center' }]}>
                         CONNEXION PERDUE
                     </Text>
                     <Text style={[Fonts.p1, { color: Colors.neutral300, textAlign: 'center', marginBottom: 24 }]}>
                         Impossible de joindre le serveur.
                     </Text>
                     <Button
                        title="REESSAYER"
                        variant="Primary"
                        onPress={() => {
                            setViewState('radar');
                        }}
                    />
                     <Button
                        title="ANNULER"
                        variant="Secondary"
                        style={{ marginTop: 12 }}
                        onPress={() => {
                            // Reset everything
                            setViewState('locker_room');
                            setMatchRequest(null);
                        }}
                    />
                </View>
            );
        }

        if (viewState === 'radar') {
            return (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                     <View style={[styles.radarCircle, { width: 80, height: 80, borderRadius: 40, marginBottom: 16, borderColor: Colors.gold500 }]}>
                        <Text style={{ fontSize: 24, color: Colors.gold500 }}>{radarIcon}</Text>
                     </View>
                     <Text style={[Fonts.h3, { color: Colors.neutral00, marginBottom: 4 }]}>RECHERCHE EN COURS</Text>
                     <Text style={[Fonts.p2, { color: Colors.gold500, textAlign: 'center', marginBottom: 8, fontWeight: 'bold' }]}>
                         {searchStatus}
                     </Text>
                     <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 16 }]}>
                         Nous cherchons une equipe compatible dans votre zone.
                     </Text>
                     
                     {/* Timer Countdown */}
                     <SearchCountdown
                         createdAt={matchRequest?.createdAt}
                         serverNow={pollingServerNow || matchmakingServerNow}
                         onExpired={handleCancelSearch}
                     />
                     
                     <Button
                        title="ANNULER"
                        variant="Secondary"
                        onPress={handleCancelSearch}
                        disabled={loading}
                    />
                </View>
            );
        }

        if (viewState === 'match_found') {
            // CRITICAL FIX: If match is already scheduled/pending, Show NextMatchCard instead of Mystery Card
            if (currentMatch && shouldShowNextMatchCard(currentMatch, currentMatch?.event)) {
                return (
                    <NextMatchCard 
                        match={currentMatch}
                        event={currentMatch?.event}
                        myTeamId={getEntityDocumentId(mySquad)}
                        onRefresh={loadMatchCenter}
                        onPress={() => navigateToLeagueMatchDetails(navigation, currentMatch)}
                    />
                );
            }
            // Helpers for display
            /** @type {Record<string, string>} */
            const DAY_MAP = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };
            const formatHour = (/** @type {string | undefined | null} */ h) => (h ? h.substring(0, 5) : '?');
            const cleanLabel = (/** @type {unknown} */ value) => {
                if (typeof value !== 'string') return null;
                const trimmed = value.trim();
                if (!trimmed) return null;
                return trimmed.split('(')[0].trim();
            };

            const parseMaybeJson = (/** @type {unknown} */ value) => {
                if (value && typeof value === 'object') return value;
                if (typeof value !== 'string') return value;
                try {
                    return JSON.parse(value);
                } catch (_err) {
                    return value;
                }
            };

            const getOpponentCity = (/** @type {OpponentDetails | null} */ details) => {
                if (!details) return "Zone inconnue";

                const homeBase = parseMaybeJson(details.home_base);
                const location = parseMaybeJson(details.location);
                const homeBaseAddress = parseMaybeJson(homeBase?.address);

                const candidates = [
                    homeBase?.city,
                    homeBaseAddress?.city,
                    homeBaseAddress?.properties?.city,
                    homeBaseAddress?.properties?.context,
                    homeBaseAddress?.label,
                    homeBaseAddress?.address,
                    homeBase?.label,
                    location?.city,
                    location?.label,
                    details?.city,
                ];

                for (const candidate of candidates) {
                    const cleaned = cleanLabel(candidate);
                    if (cleaned) return cleaned;
                }

                if (homeBase?.lat || homeBase?.lng || location?.lat || location?.lng) {
                    return "Zone approximative";
                }

                return "Zone inconnue";
            };

            const city = getOpponentCity(opponentDetails);
            const radiusDisplay = (opponentDetails?.radius && opponentDetails.radius > 0) ? `+/- ${opponentDetails.radius} km` : 'Rayon Standard';
            const parsedDivision = Number.parseInt(String(opponentDetails?.division), 10);
            const division = Number.isFinite(parsedDivision)
                ? Math.max(1, Math.min(5, parsedDivision))
                : '?';
            // Recurring slot display
            const recurringDayKey = String(opponentDetails?.recurring_day || currentMatch?.recurring_day || '').toLowerCase();
            const recurringDay = DAY_MAP[recurringDayKey] || recurringDayKey || '?';
            const recurringStart = formatHour(opponentDetails?.recurring_start_hour || currentMatch?.recurring_start_hour);
            const recurringEnd = formatHour(opponentDetails?.recurring_end_hour || currentMatch?.recurring_end_hour);
            // Sport/Category handling (Relation objects or strings)
            const sportData = opponentDetails?.sport;
            const sportLabel = typeof sportData === 'string'
                ? sportData
                : sportData?.label || sportData?.name || "Sport";
            const categoryData = opponentDetails?.category;
            const catLabel = typeof categoryData === 'string'
                ? categoryData
                : categoryData?.label || categoryData?.name || "Senior";
            const matchCommonSlots = currentMatch?.common_slots;
            const allCommonSlots = Array.isArray(matchCommonSlots) ? matchCommonSlots : [];
            /** @type {string[]} */
            const commonSlotsSummary = [];
            (allCommonSlots || []).forEach((/** @type {LeagueSlot} */ slot) => {
                const dayLabel = DAY_MAP[String(slot?.day || '').toLowerCase()] || slot?.day || '';
                const startLabel = toHourMinute(slot?.startHour || slot?.start_hour) || '?';
                const endLabel = toHourMinute(slot?.endHour || slot?.end_hour) || '?';
                if (!dayLabel) return;
                commonSlotsSummary.push(`${dayLabel} ${startLabel}-${endLabel}`);
            });
            
            console.log('[DEBUG] MatchCenter Opponent Details:', JSON.stringify(opponentDetails, null, 2));

            return (
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                     {/* ANONYMOUS HEADER */}
                     <Text style={[Fonts.h3, { color: Colors.neutral200, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 2 }]}>
                        ADVERSAIRE MYSTERE
                     </Text>

                     {/* MAIN CARD */}
                     <View style={{
                         backgroundColor: 'rgba(255,255,255,0.04)',
                         borderRadius: 16, 
                         padding: 24, 
                         width: '100%',
                         alignItems: 'center',
                         borderWidth: 1,
                         borderColor: Colors.gold500,
                         shadowColor: Colors.gold500,
                         shadowOffset: { width: 0, height: 6 },
                         shadowOpacity: 0.12,
                         shadowRadius: 14,
                         marginBottom: 24
                     }}>
                        {/* Generic Identity */}
                        <View style={{ marginBottom: 16 }}>
                            <View style={{ 
                                width: 80, height: 80, borderRadius: 40, 
                                backgroundColor: 'rgba(255, 215, 0, 0.10)',
                                justifyContent: 'center', alignItems: 'center',
                                borderWidth: 2, borderColor: Colors.gold500,
                                shadowColor: Colors.gold500,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 10,
                                marginBottom: 12
                            }}>
                                 <Text style={{ fontSize: 36, fontWeight: '700', color: Colors.neutral00, lineHeight: 42 }}>?</Text>
                            </View>
                            <View style={{ 
                                position: 'absolute', bottom: 6, right: -8,
                                backgroundColor: Colors.gold500, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999
                            }}>
                                <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>DIV {division}</Text>
                            </View>
                        </View>

                        {/* Stats / Context */}
                        <View style={{ alignItems: 'center', width: '100%' }}>
                            <Text style={{ color: Colors.gold500, fontSize: 18, marginBottom: 2 }}>
                                {swordsIcon}
                            </Text>
                            <Text style={[Fonts.h2, { color: 'white', marginBottom: 4 }]}>EQUIPE ADVERSE</Text>
                            <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 16 }]}>{sportLabel} - {catLabel}</Text>
                            
                            <View style={{ width: '100%', height: 1, backgroundColor: Colors.neutral700, marginBottom: 16 }} />

                            {/* Details Grid */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Image source={LocationIcon} style={{ width: 24, height: 24, marginBottom: 4, tintColor: Colors.gold500 }} resizeMode="contain" />
                                    <Text style={[Fonts.p2Bold, { color: 'white' }]}>
                                        {city}
                                    </Text>
                                    <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{radiusDisplay}</Text>
                                </View>
                                <View style={{ width: 1, height: '100%', backgroundColor: Colors.neutral700 }} />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Image source={ClockIcon} style={{ width: 20, height: 20, marginBottom: 4, tintColor: Colors.primary500 }} resizeMode="contain" />
                                    <Text style={[Fonts.p2Bold, { color: 'white' }]}>
                                        {/* Translate Day */}
                                        {(() => {
                                            /** @type {Record<string, string>} */
                                            const dayMap = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };
                                            const rDay = String(recurringDay || '').toLowerCase();
                                            return dayMap[rDay] || rDay || "Date Inconnue";
                                        })()}
                                    </Text>
                                    <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{recurringStart} - {recurringEnd}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Common Slots Negotiation Text */}
                        {commonSlotsSummary.length > 0 && (
                            <View style={{
                                marginTop: 12,
                                width: '100%',
                                padding: 10,
                                backgroundColor: 'rgba(255,255,255,0.08)',
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.10)',
                            }}>
                                <Text style={[Fonts.p3Bold, { color: Colors.neutral200, marginBottom: 8 }]}>
                                    Creneaux en commun
                                </Text>
                                {commonSlotsSummary.map((/** @type {string} */ slotLabel) => (
                                    <Text key={slotLabel} style={[Fonts.p3, { color: Colors.neutral200, marginBottom: 4 }]}>
                                        - {slotLabel}
                                    </Text>
                                ))}
                            </View>
                        )}
                     </View>

                     <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 28, paddingHorizontal: 10 }]}>
                        Le match correspond a vos criteres. Discutez pour valider le terrain.
                     </Text>

                    <Button
                        title="ACCEDER AU CHAT"
                        variant="Primary"
                        onPress={() => {
                             if (currentMatch && currentMatch.chat) {
                                  const chatId = getEntityDocumentId(currentMatch.chat);
                                  // Check if we should show proposal modal (First Contact)
                                  if (!currentMatch.proposed_venue) {
                                      setIsProposalModalVisible(true);
                                  } else {
                                      const opponentName = opponentDetails ? `Vs ${opponentDetails.name || 'Adversaire'}` : 'Chat';
                                      navigation.navigate('Conversation', { 
                                          chatId,
                                          title: opponentName,
                                          subTitle: 'Match de Ligue'
                                      }); 
                                  }
                             } else {
                                  Alert.alert('Erreur', "Le chat n'est pas encore pret. Reessayez dans quelques secondes.");
                             }
                        }}
                        style={{ width: '100%', backgroundColor: Colors.gold500 }}
                        textStyle={{ color: Colors.neutral900, fontWeight: 'bold', fontSize: 16 }}
                    />

                    {/* Cancel Button - Captain Only */}
                    {areSameEntityId(getEntityDocumentId(mySquad?.captain), getEntityDocumentId(userData)) && (
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    "Annuler le match ?",
                                    "Etes-vous sur de vouloir annuler ce match ? Votre equipe reviendra en mode recherche.",
                                    [
                                        { text: "Non", style: "cancel" },
                                        {
                                            text: "Annuler et Relancer",
                                            onPress: async () => {
                                                try {
                                                    const currentMatchId = getEntityDocumentId(currentMatch);
                                                    if (currentMatchId) {
                                                        const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                                                        await cancelMatch(currentMatchId, getEntityDocumentId(mySquad), 'captain_request');
                                                        
                                                        // Trigger new search immediately
                                                        setViewState('searching_start');
                                                        setTimeout(async () => {
                                                            try {
                                                                // Re-use current params if available or re-trigger logic
                                                                // Ideally we call handleConfirmSearch logic but access is tricky.
                                                                // Simpler: Trigger search with current params from squad
                                                                const userLoc = userData?.location ? (typeof userData.location === 'string' ? JSON.parse(userData.location) : userData.location) : { lat: 48.8566, lng: 2.3522 };
                                                                const fallbackSlotIds = (selectedSlotIds && selectedSlotIds.length > 0)
                                                                    ? selectedSlotIds
                                                                    : toDocumentIdList(squadSlots);
                                                                if (fallbackSlotIds.length === 0) {
                                                                    throw new Error('Ajoutez puis selectionnez au moins un creneau pour relancer la recherche.');
                                                                }
                                                                await MatchmakingService.triggerSearch(
                                                                    getEntityDocumentId(mySquad), 
                                                                    fallbackSlotIds,
                                                                    { radius: searchRadius, location: userLoc }
                                                                );
                                                                loadMatchCenter(); // Refresh state to show searching
                                                            } catch(e) {
                                                                console.error("Restart search failed", e);
                                                                Alert.alert('Erreur', 'Match annule mais impossible de relancer la recherche.');
                                                                loadMatchCenter();
                                                            }
                                                        }, 500);
                                                    }
                                                } catch (err) {
                                                    console.error("Cancel/Restart error:", err);
                                                    Alert.alert("Erreur", "Impossible d'annuler le match.");
                                                }
                                            }
                                        },
                                        {
                                            text: "Annuler seulement",
                                            style: "destructive",
                                            onPress: async () => {
                                                try {
                                                    const currentMatchId = getEntityDocumentId(currentMatch);
                                                    if (currentMatchId) {
                                                        const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                                                        await cancelMatch(currentMatchId, getEntityDocumentId(mySquad), 'captain_request');
                                                        Alert.alert('Match annule', 'Vous pouvez relancer une recherche.');
                                                        loadMatchCenter();
                                                    }
                                                } catch (err) {
                                                    console.error("Cancel match error:", err);
                                                    Alert.alert("Erreur", "Impossible d'annuler le match.");
                                                }
                                            }
                                        }
                                    ]
                                );
                            }}
                            style={{ marginTop: 16, paddingVertical: 12 }}
                        >
                            <Text style={[Fonts.p2, { color: Colors.error500, textAlign: 'center' }]}>
                                Annuler le match
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            );
        }



        // If Match Scheduled / Validated
        if (currentMatch && shouldShowNextMatchCard(currentMatch, currentMatch?.event)) {
             // Navigate to standalone LeagueMatchDetails (no event dependency)
             return (
                 <NextMatchCard 
                    match={currentMatch}
                    event={currentMatch?.event}
                    myTeamId={getEntityDocumentId(mySquad)}
                    onRefresh={loadMatchCenter}
                    onPress={() => navigateToLeagueMatchDetails(navigation, currentMatch)}
                 />
             );
        }

        // DEFAULT: Locker Room / Ticket View
        /** @type {LeagueSlot[]} */
        const displayedSlots = squadSlots.length > 0 ? squadSlots : (activeSlot ? [activeSlot] : []);

        return (
            <View>
                 {/* Carousel of Slots */}
                 <View
                    onLayout={(/** @type {import('react-native').LayoutChangeEvent} */ event) => {
                        const nextWidth = event?.nativeEvent?.layout?.width || 0;
                        if (nextWidth > 0 && Math.abs(nextWidth - slotCarouselWidth) > 1) {
                            setSlotCarouselWidth(nextWidth);
                        }
                    }}
                 >
                     <FlatList
                        data={displayedSlots}
                        bounces={false}
                        disableIntervalMomentum
                        overScrollMode="never"
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        snapToAlignment="start"
                        snapToInterval={slotCardWidth + slotCardGap}
                        decelerationRate="fast"
                        pagingEnabled={false}
                        keyExtractor={(item, index) => getEntityDocumentId(item) || `slot-${index}`}
                        onMomentumScrollEnd={(/** @type {import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>} */ e) => {
                            const index = Math.round(e.nativeEvent.contentOffset.x / (slotCardWidth + slotCardGap));
                            if (displayedSlots[index]) {
                                setActiveSlot(displayedSlots[index]);
                            }
                        }}
                        contentContainerStyle={
                            !displayedSlots.length
                                ? {}
                                : { paddingLeft: 0, paddingRight: slotCardGap }
                        }
                        renderItem={({ item, index }) => {
                            if (!item) return null;
                            const isLast = index === displayedSlots.length - 1;

                            return (
                                <View style={{ width: slotCardWidth, marginRight: isLast ? 0 : slotCardGap }}>
                                    <View style={{ marginBottom: 8 }}>
                                            {(() => {
                                                const baseDate = item.start_time || item.date || '';
                                                const recurringStart = item.start_hour ? item.start_hour.substring(0, 5) : null;
                                                const recurringEnd = item.end_hour ? item.end_hour.substring(0, 5) : null;
                                                const fallbackStart = baseDate
                                                    ? new Date(baseDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : '?';
                                                const fallbackEnd = baseDate
                                                    ? new Date(new Date(baseDate).getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : '?';
                                                const rangeLabel = recurringStart && recurringEnd
                                                    ? `${recurringStart} - ${recurringEnd}`
                                                    : `${fallbackStart} - ${fallbackEnd}`;
                                                const recurrenceKey = String(item.recurrence_day || '').toLowerCase();
                                                const dayLabel = recurrenceKey
                                                    ? (DAY_MAP[recurrenceKey] || recurrenceKey)
                                                    : (baseDate ? formatDate(baseDate).split(' ')[0] : 'Date');
                                                return (
                                                   <View>
                                                        <Text style={[Fonts.h2, { color: Colors.neutral00, textTransform: 'uppercase' }]}>
                                                           {dayLabel}
                                                        </Text>
                                                        <Text style={[Fonts.p1, { color: Colors.primary500, marginTop: 2 }]}>
                                                            {rangeLabel}
                                                        </Text>
                                                   </View>
                                                );
                                            })()}
                                       </View>
                                       {/* Status Chip */}
                                        <View style={{ 
                                            position: 'absolute', right: 10, top: 0,
                                            backgroundColor: 'rgba(1, 179, 244, 0.1)', 
                                            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 
                                       }}>
                                             <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                                                 OUVERT
                                             </Text>
                                        </View>
                    
                                     {/* Visual Roster */}
                                     <View style={{ marginTop: 16 }}>
                                        <Text style={[Fonts.p3, { color: Colors.neutral300, textTransform: 'uppercase' }]}>
                                            EFFECTIF {item.rsvp_count || 0}/5
                                        </Text>
                                        <VisualRoster rsvpCount={item.rsvp_count || 0} />
                                     </View>

                                     {/* Navigation Indicators (Dots) */}
                                     {squadSlots.length > 1 && (
                                         <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
                                             {squadSlots.map((_, i) => (
                                                 <View 
                                                    key={i} 
                                                    style={{ 
                                                        width: 6, height: 6, borderRadius: 3, 
                                                        backgroundColor: i === index ? Colors.gold500 : Colors.neutral700,
                                                        marginHorizontal: 4 
                                                    }} 
                                                 />
                                             ))}
                                         </View>
                                     )}
                                </View>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={{ width: slotCardWidth }}>
                                 <View>
                                     <Text style={[Fonts.h2, { color: Colors.neutral500 }]}>Pas de match</Text>
                                     <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>Aucun creneau reserve</Text>
                                 </View>
                                  <View style={{ position: 'absolute', right: 0, top: 0,
                                     backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                                     paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 
                                }}>
                                      <Text style={[Fonts.p3Bold, { color: Colors.neutral500 }]}>
                                          VIDE
                                      </Text>
                                 </View>
                            </View>
                        }
                     />
                 </View>

                 <View style={{ height: 1, backgroundColor: Colors.neutral800, marginVertical: 16 }} />

                 {/* Actions */}
                 {activeSlot ? (
                    <View>
                        {(activeSlot.rsvp_count || 0) >= 5 ? (
                            <View>
                                 <Text style={[Fonts.p2, { color: Colors.success500 || '#27d6a3', marginBottom: 12, textAlign: 'center' }]}>
                                     Equipe complete
                                 </Text>
                                 <Button 
                                    title="RECHERCHER UN MATCH" 
                                    onPress={handleLaunchLobby}
                                    style={{ backgroundColor: Colors.gold500, shadowColor: Colors.gold500, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 }}
                                    textStyle={{ color: Colors.neutral900, fontWeight: 'bold', fontSize: 13 }}
                                />
                            </View>
                        ) : (
                            <View>
                                 <Text style={[Fonts.p2, { color: Colors.neutral00, marginBottom: 12 }]}>
                                     Il manque {5 - (activeSlot.rsvp_count || 0)} joueurs pour etre au complet.
                                 </Text>
                                 <Button 
                                    title="INVITER DES JOUEURS" 
                                    variant="Primary"
                                    onPress={() => navigation.navigate('LeagueSquadTab')}
                                    style={{ backgroundColor: Colors.neutral800, borderColor: Colors.primary500, borderWidth: 1, marginBottom: 12 }}
                                    textStyle={{ color: Colors.primary500 }}
                                />
                                <Button 
                                    title="LANCER LA RECHERCHE" 
                                    variant="Primary"
                                    onPress={handleLaunchLobby}
                                    style={{ backgroundColor: Colors.gold500, marginTop: 8, borderColor: Colors.gold500 }}
                                    textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
                                />
                            </View>
                        )}
                    </View>
                 ) : (
                    <Button
                        title="RECHERCHER UN MATCH" 
                        variant="Primary"
                        onPress={handleLaunchLobby}
                        style={{ backgroundColor: Colors.gold500 }}
                        textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
                    />
                 )}
            </View>
        );
    }


    const renderLockerRoom = () => {
        const rawStreak = Number(mySquad?.streak || 0);
        const streakValue = Number.isFinite(rawStreak) && rawStreak !== 0
            ? `${rawStreak > 0 ? '+' : ''}${rawStreak}`
            : '-';
        const showEmptyHistoryCta = !currentMatch && viewState !== 'radar' && viewState !== 'searching_start';
        const leagueSurface = {
            backgroundColor: 'rgba(10, 28, 43, 0.82)',
            borderColor: 'rgba(1, 179, 244, 0.22)',
        };

        return (
        <View style={styles.container}>
             
             {/* 1. IDENTITY HEADER - NOW WITH SWITCHER */}
             <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32, marginTop: 16 }}>
                <View style={{ 
                    width: 64, height: 64, borderRadius: 32, 
                    backgroundColor: Colors.neutral800, borderWidth: 2, borderColor: Colors.gold500,
                    justifyContent: 'center', alignItems: 'center', marginRight: 16 
                }}>
                    <Image source={Images.shield} style={{ width: 32, height: 32, tintColor: Colors.gold500 }}resizeMode="contain" />
                </View>
                <View style={{ flex: 1 }}>
                    <TouchableOpacity 
                        onPress={() => setIsSquadSelectorVisible(true)}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                         <Text style={[Fonts.h1Bold, { color: Colors.neutral00, textTransform: 'uppercase', lineHeight: 32 }]}>
                            {mySquad ? mySquad.name : "Team Alpha"}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, opacity: 0.8 }}>
                            <Text style={[Fonts.p3, { color: Colors.gold500 }]}>Changer</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <View style={{ marginRight: 8 }}>
                            <DivisionBadge
                                division={mySquad?.division || 5}
                                showChrome={false}
                                showLabel={false}
                                size={34}
                            />
                        </View>
                        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>{mySquad?.elo || 1200} PTS</Text>
                    </View>
                </View>
             </View>

            <SectionHeader title={viewState === 'radar' ? "RECHERCHE..." : (viewState === 'match_found' ? "ACTION REQUISE" : "PROCHAIN MATCH")} />

            {shouldShowNextMatchCard(currentMatch, currentMatch?.event) ? (
                <View style={{ marginTop: 8, marginBottom: 26 }}>
                    {renderMatchCardContent()}
                </View>
            ) : (
                <LeagueCard
                    style={{
                        marginBottom: 26,
                        marginTop: 8,
                        overflow: 'hidden',
                        padding: 0,
                        ...leagueSurface,
                    }}
                >
                    <View style={{ padding: 20 }}>
                         {renderMatchCardContent()}
                    </View>
                </LeagueCard>
            )}

            {/* 3. SEASON STATS */}
            <View style={{ marginTop: 4 }}>
                <SectionHeader title="SAISON EN COURS" />
            </View>
            <LeagueCard style={{ marginTop: 8, marginBottom: 6, ...leagueSurface }}>
                 <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>{mySquad?.wins || 0}</Text>
                          <Text style={[Fonts.p3Bold, { color: Colors.neutral200, marginTop: 4 }]}>VICTOIRES</Text>
                      </View>
                      <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>{streakValue}</Text>
                          <Text style={[Fonts.p3Bold, { color: Colors.neutral200, marginTop: 4 }]}>SERIE</Text>
                      </View>
                       <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                        <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
                            <TouchableOpacity 
                                style={{
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(1, 179, 244, 0.14)',
                                    borderColor: 'rgba(1, 179, 244, 0.48)',
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    justifyContent: 'center',
                                    minHeight: 36,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    width: '100%',
                                }}
                                onPress={() => navigation.navigate(RouteNames.LeagueRanking)}
                            >
                                 <Text style={[Fonts.p3Bold, { color: Colors.primary500, lineHeight: 16 }]}>CLASSEMENT</Text>
                            </TouchableOpacity>
                       </View>
                 </View>
            </LeagueCard>

            <View style={{ marginTop: 14 }}>
                <SectionHeader title="DERNIERS MATCHS" />
            </View>
            <LeagueCard style={{ marginTop: 8, marginBottom: 8, ...leagueSurface }}>
                {recentMatches.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                        <View
                            style={{
                                alignItems: 'center',
                                backgroundColor: 'rgba(1, 179, 244, 0.12)',
                                borderColor: 'rgba(1, 179, 244, 0.32)',
                                borderRadius: 999,
                                borderWidth: 1,
                                height: 40,
                                justifyContent: 'center',
                                marginBottom: 10,
                                width: 40,
                            }}
                        >
                            <Text style={{ fontSize: 16 }}>[]</Text>
                        </View>
                        <Text style={[Fonts.p2, { color: Colors.neutral100, textAlign: 'center' }]}>
                            Aucun match termine pour le moment.
                        </Text>
                        <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6, textAlign: 'center' }]}>
                            Terminez un premier match pour alimenter votre historique.
                        </Text>
                        {showEmptyHistoryCta && (
                            <TouchableOpacity
                                onPress={() => setViewState('lobby')}
                                style={{
                                    backgroundColor: 'rgba(1, 179, 244, 0.15)',
                                    borderColor: 'rgba(1, 179, 244, 0.42)',
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    marginTop: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                }}
                            >
                                <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                                    Lancer une recherche
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    recentMatches.map((/** @type {MatchHistoryEntry} */ item, /** @type {number} */ index) => {
                        const resultColor = item.result === 'win'
                            ? Colors.success500
                            : item.result === 'loss'
                                ? Colors.error500
                                : Colors.neutral300;
                        const resultLabel = item.result === 'win'
                            ? 'Victoire'
                            : item.result === 'loss'
                                ? 'Defaite'
                                : item.result === 'draw'
                                    ? 'Nul'
                                    : item.status;
                        const matchDate = item.date ? new Date(item.date) : null;
                        const dateLabel = matchDate && !Number.isNaN(matchDate.getTime())
                            ? matchDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : 'Date inconnue';

                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => navigation.navigate(RouteNames.LeagueDashboard, {
                                    screen: RouteNames.PastMatchDetails,
                                    params: {
                                        matchId: item.id,
                                        myTeamId: getEntityDocumentId(mySquad),
                                    },
                                })}
                                style={{
                                    paddingVertical: 12,
                                    borderBottomWidth: index === recentMatches.length - 1 ? 0 : 1,
                                    borderBottomColor: 'rgba(255,255,255,0.09)',
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]} numberOfLines={1}>
                                            vs {item.opponent?.name || 'Adversaire'}
                                        </Text>
                                        <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>
                                            {dateLabel}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                                            {item.score_a ?? '-'} - {item.score_b ?? '-'}
                                        </Text>
                                        <Text style={[Fonts.p3Bold, { color: resultColor, marginTop: 2 }]}>
                                            {resultLabel}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </LeagueCard>
        </View>
    );
    };



    const renderLobbyModal = () => {
        // Helper to extract string from string or object
        const getSafeLabel = (/** @type {unknown} */ val) => {
            if (!val) return null;
            if (typeof val === 'string') return val;
            if (typeof val === 'object') {
                const obj = /** @type {{label?: string}} */ (val);
                if (obj.label) return obj.label;
            }
            return null;
        };

        // Display Label
        let displayLabel = 'Zone indefinie';
        const tempAddr = getSafeLabel(tempSearchLocation?.address);
        const tempCity = getSafeLabel(tempSearchLocation?.city);
        const homeAddr = getSafeLabel(homeBase?.address);
        const homeCity = getSafeLabel(homeBase?.city);

        if (tempAddr) displayLabel = tempAddr;
        else if (tempCity) displayLabel = tempCity;
        else if (homeAddr) displayLabel = homeAddr;
        else if (homeCity) displayLabel = homeCity;

        return (
        <BottomModal 
            isVisible={viewState === 'lobby'} 
            close={() => setViewState('locker_room')}
            snapPoints={['90%']}
            scrollable={true}
            headerComponent={
                <View>
                    <Text style={[Fonts.h3, { color: Colors.gold500, textAlign: 'center', letterSpacing: 1 }]}>CONFIGURATION</Text>
                     <Text style={[Fonts.p1, { color: Colors.neutral300, textAlign: 'center', marginBottom: 8 }]}>
                        Rechercher match
                    </Text>
                </View>
            }
        >
             <View style={{ marginBottom: 24 }}>
                <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 8 }]}>Zone de recherche</Text>
                
                {isEditingLocation ? (
                    <View style={{ height: 200 }}>
                        <AutocompleteAddressInput
                            placeholder="Entrez une nouvelle adresse..."
                            onSelect={(/** @type {unknown} */ data) => {
                                const normalized = normalizeLocationInput(data);
                                if (normalized && hasValidLocationCoordinates(normalized)) {
                                    setTempSearchLocation(normalized);
                                }
                                setIsEditingLocation(false);
                            }}
                            styles={{
                                textInput: { color: Colors.neutral00, backgroundColor: Colors.neutral800 }
                            }}
                        />
                        <Button title="Annuler" variant="Secondary" onPress={() => setIsEditingLocation(false)} style={{ marginTop: 8 }} />
                    </View>
                ) : (
                    <TouchableOpacity 
                        onPress={() => setIsEditingLocation(true)}
                        style={{ 
                            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                            padding: 12, backgroundColor: Colors.neutral800, borderRadius: 8,
                            borderWidth: 1, borderColor: Colors.neutral700
                        }}
                    >
                        <Text style={[Fonts.p1Bold, { color: Colors.neutral00, flex: 1, marginRight: 8 }]} numberOfLines={1}>
                            Lieu: {displayLabel}
                        </Text>
                        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>MODIFIER</Text>
                    </TouchableOpacity>
                )}
            </View>

             <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Rayon de recherche</Text>
                    <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>{searchRadius} km</Text>
                </View>
                <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={5}
                    maximumValue={100}
                     step={5}
                    value={searchRadius}
                    onValueChange={setSearchRadius}
                    minimumTrackTintColor={Colors.primary500 || '#01b3f4'}
                    maximumTrackTintColor={Colors.neutral600 || '#555'}
                    thumbTintColor={Colors.primary500 || '#01b3f4'}
                />
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>5 km</Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>100 km</Text>
                </View>
            </View>

            {/* SECTION: Selection des creneaux recurrents */}
            <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                    <Text style={[Fonts.p2, { color: Colors.neutral300, flex: 1 }]}>
                        Vos disponibilites ({selectedSlotIds.length}/{squadSlots.length || 0})
                    </Text>
                    <TouchableOpacity
                        onPress={() => setIsAddingSearchSlot((prev) => !prev)}
                        style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: Colors.gold500,
                            backgroundColor: 'rgba(255, 209, 0, 0.08)',
                        }}
                    >
                        <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                            {isAddingSearchSlot ? 'Fermer' : '+ Ajouter'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {isAddingSearchSlot && (
                    <View style={{ marginBottom: 12 }}>
                        {isSavingSearchSlot && (
                            <ActivityIndicator size="small" color={Colors.primary500} style={{ marginBottom: 8 }} />
                        )}
                        <TeamSlotCreationForm
                            onAdd={handleAddSearchSlot}
                            onCancel={() => setIsAddingSearchSlot(false)}
                        />
                    </View>
                )}

                {!isAddingSearchSlot && (squadSlots || []).length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            const allSlotIds = toDocumentIdList(squadSlots);
                            const hasAllSelected = allSlotIds.length > 0
                                && allSlotIds.every((slotId) => selectedSlotIds.includes(slotId));
                            setSelectedSlotIds(hasAllSelected ? [] : allSlotIds);
                        }}
                        style={{
                            alignSelf: 'flex-end',
                            marginBottom: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: Colors.primary500,
                            backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        }}
                    >
                        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                            {selectedSlotIds.length === (squadSlots || []).length && selectedSlotIds.length > 0
                                ? 'Tout deselectionner'
                                : 'Tout selectionner'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* SECTION: Autres creneaux communs (negociation) */}
                {currentMatch?.common_slots && currentMatch.common_slots.length > 1 && (
                    <View style={{ marginTop: 16, padding: 12, backgroundColor: Colors.neutral800, borderRadius: 8, borderWidth: 1, borderColor: Colors.neutral700 }}>
                        <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
                            - Autres creneaux communs possibles :
                        </Text>
                        {currentMatch.common_slots.map((/** @type {LeagueSlot} */ slot, /** @type {number} */ index) => {
                             // Skip the currently selected slot
                             if (slot.day === (currentMatch.recurring_day || opponentDetails?.recurring_day)) return null;

                             const dayKey = String(slot.day || '').toLowerCase();
                             const dayName = DAY_MAP[dayKey] || slot.day;
                             return (
                                 <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                     <Text style={{ fontSize: 14 }}>-</Text>
                                     <Text style={[Fonts.p2, { color: Colors.neutral100, marginLeft: 8 }]}>
                                         {dayName} {slot.startHour}-{slot.endHour}
                                     </Text>
                                 </View>
                             );
                        })}
                    </View>
                )}

                {!isAddingSearchSlot && (squadSlots || []).map((/** @type {LeagueSlot} */ slot) => {
                    const slotId = getEntityDocumentId(slot) || '';
                    const isSelected = selectedSlotIds.includes(slotId);
                    const formatHour = (/** @type {string | undefined | null} */ h) => (h ? h.substring(0, 5) : '?');
                    return (
                        <TouchableOpacity
                            key={slotId}
                            onPress={() => toggleSlotSelection(slotId)}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                padding: 12, backgroundColor: Colors.neutral800,
                                borderRadius: 8, marginBottom: 8,
                                borderWidth: isSelected ? 1 : 0,
                                borderColor: Colors.primary500
                            }}
                        >
                            <View style={{ 
                                width: 24, height: 24, borderRadius: 12,
                                backgroundColor: isSelected ? Colors.primary500 : Colors.neutral700,
                                justifyContent: 'center', alignItems: 'center', marginRight: 12
                            }}>
                                {isSelected && <Text style={{ color: 'white', fontWeight: 'bold' }}>OK</Text>}
                            </View>
                            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                                {DAY_MAP[String(slot.recurrence_day || '').toLowerCase()] || slot.recurrence_day} {formatHour(slot.start_hour)} - {formatHour(slot.end_hour)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                {!isAddingSearchSlot && (!squadSlots || squadSlots.length === 0) && (
                    <Text style={[Fonts.p2, { color: Colors.neutral500, textAlign: 'center', padding: 16 }]}>
                        Aucun creneau defini. Ajoutez-en directement ici.
                    </Text>
                )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.neutral800, paddingBottom: 16, marginBottom: 24  }}>
                <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Duree Match</Text>
                 <View style={{ backgroundColor: Colors.neutral800, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                     <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>60 min</Text>
                 </View>
            </View>

             <Button 
                title={loading ? "Lancement..." : "CONFIRMER & SCANNER"} 
                variant="Primary"
                onPress={handleConfirmSearch}
                disabled={loading || selectedSlotIds.length === 0}
                style={{ marginBottom: 16 }}
            />
            <Button 
                title="Annuler" 
                variant="Secondary"
                onPress={() => setViewState('locker_room')}
            />
        </BottomModal>
        );
    };

    const renderSquadSelectorModal = () => (
        <BottomModal
            isVisible={isSquadSelectorVisible}
            close={() => setIsSquadSelectorVisible(false)}
            snapPoints={['50%']}
            headerComponent={
                <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center', marginBottom: 16 }]}>
                     Changer d'equipe
                </Text>
            }
        >
            <View style={{ paddingBottom: 24 }}>
                {allSquads.map((/** @type {Team} */ squad) => (
                    <TouchableOpacity
                        key={getEntityDocumentId(squad)}
                        onPress={() => handleSquadSwitch(squad)}
                        style={[
                            ApplicationStyle.backgroundColor.neutral800,
                            Spaces.padding[16],
                            ApplicationStyle.borderRadius12,
                            Spaces.marginBottom[12],
                            Alignments.row,
                            Alignments.alignCenter,
                            areSameEntityId(getEntityDocumentId(squad), getEntityDocumentId(mySquad)) && { borderWidth: 1, borderColor: Colors.primary500 }
                        ]}
                    >
                         <View style={{ 
                            width: 40, height: 40, borderRadius: 20, 
                            backgroundColor: Colors.neutral900, borderWidth: 1, borderColor: Colors.gold500,
                            justifyContent: 'center', alignItems: 'center', marginRight: 16 
                        }}>
                             {squad.crest?.url ? (
                                   <Image source={{ uri: squad.crest?.url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                              ) : (
                                   <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{squad.name.substring(0, 2).toUpperCase()}</Text>
                              )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{squad.name}</Text>
                            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                                 {squad?.sport || 'Sport'} - Div {squad?.division || 5}
                            </Text>
                        </View>
                         {areSameEntityId(getEntityDocumentId(squad), getEntityDocumentId(mySquad)) && (
                             <Text style={{ color: Colors.primary500, fontSize: 16 }}>OK</Text>
                         )}
                    </TouchableOpacity>
                ))}
            </View>
        </BottomModal>
    );

    const proposalDefaults = React.useMemo(() => buildProposalDefaultsFromMatch(currentMatch), [currentMatch]);

    if (viewState === 'loading' && !mySquad) { return <View style={[styles.screen, {justifyContent:'center'}]}><ActivityIndicator color={Colors.gold500 || '#D4AF37'} /></View>; }
    if (viewState === 'no_squad') return <View style={styles.screen}>{renderNoSquad()}</View>;
    
    return (
        <ScreenContainer bgImage="bg2">
             <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={
                <RefreshControl refreshing={loading} onRefresh={() => loadMatchCenter()} tintColor={Colors.primary500} colors={[Colors.primary500]} />
             }>
                {/* STANDARD HEADER */}
                <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween, Spaces.marginBottom[24]]}>
                    <LeagueHeaderSwitch />
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4 }}>
                        <NotificationBadge />
                        <ProfileButton />
                    </View>
                </View>

                {renderLockerRoom()}
            </ScrollView>
            
            {/* MODALS OUTSIDE SCROLLVIEW */}
            {renderLobbyModal()}
            {renderSquadSelectorModal()}
            
            <VenueProposalModal
                isVisible={isProposalModalVisible}
                onClose={() => setIsProposalModalVisible(false)}
                onSend={handleSendProposal}
                initialDate={proposalDefaults.date}
                initialStartTime={proposalDefaults.start}
                initialEndTime={proposalDefaults.end}
                onSkip={() => {
                    setIsProposalModalVisible(false);
                    if (currentMatch && currentMatch.chat) {
                        const chatId = getEntityDocumentId(currentMatch.chat);
                        const opponentName = opponentDetails ? `Vs ${opponentDetails.name || 'Adversaire'}` : 'Chat';
                        navigation.navigate('Conversation', { 
                            chatId,
                            title: opponentName,
                            subTitle: 'Match de Ligue'
                        });
                    }
                }}
            />
        </ScreenContainer>
    );
};

// Simplified Styles that rely on inline style overrides for Colors
const styles = StyleSheet.create({
    screen: {
        flex: 1,
        padding: 16, // Spacing.md
    },
    container: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24, // BorderRadius.xl
        borderTopRightRadius: 24,
        padding: 24, // Spacing.xl
        minHeight: '50%',
    },
    modalTitle: {
        textAlign: 'center',
        marginBottom: 4, // Spacing.xs
    },
    modalSubtitle: {
        textAlign: 'center',
        marginBottom: 32, // Spacing.xl
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 16, // Spacing.md
        borderBottomWidth: 1,
    },
    settingLabel: {
    },
    settingValue: {
    },
    radarCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32, // Spacing.xl
    },
});

export default MatchCenterScreen;
