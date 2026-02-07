import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Alert, Modal, StyleSheet, ActivityIndicator, ImageBackground, Image, RefreshControl, FlatList, Dimensions } from 'react-native';
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

import ScreenContainer from '@/components/templates/ScreenContainer';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import LeagueCard from '../../../components/atoms/league/LeagueCard';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import EndGameModal from '@/components/organisms/endGameModal/EndGameModal';
import { RouteNames } from '@/navigation/routeNames'; // Import RouteNames

import Slider from '@react-native-community/slider';

import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import { updateMatch } from '@/services/league/MatchService';
import { createChatMessage } from '@/services/chat/chatService';
import NextMatchCard from './components/NextMatchCard';
import SearchCountdown from '@/components/organisms/league/SearchCountdown';

const MatchCenterScreen = () => {
    const navigation = useNavigation();
    const { userData } = useAuth();
    const { Colors, Fonts, Images, Alignments, Spaces, ApplicationStyle } = useTheme();
    
    // Data State
    const [mySquad, setMySquad] = useState(null);
    const [allSquads, setAllSquads] = useState([]); // Store all user squads
    const [viewState, setViewState] = useState('loading'); // loading, no_squad, locker_room, lobby, radar, match_found
    const [activeSlot, setActiveSlot] = useState(null);
    const [squadSlots, setSquadSlots] = useState([]); // Store all available slots for carousel
    const [matchRequest, setMatchRequest] = useState(null);
    const [currentMatch, setCurrentMatch] = useState(null);
    const [opponentDetails, setOpponentDetails] = useState(null);
    const screenWidth = React.useRef(Dimensions.get('window').width).current;
    
    // UI State
    const [loading, setLoading] = useState(false);
    const [isSquadSelectorVisible, setIsSquadSelectorVisible] = useState(false);
    const [isEndGameModalVisible, setIsEndGameModalVisible] = useState(false);
    const [isProposalModalVisible, setIsProposalModalVisible] = useState(false);

    // Search Config State
    const [searchRadius, setSearchRadius] = useState(20);
    const [tempSearchLocation, setTempSearchLocation] = useState(null);
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [searchStatus, setSearchStatus] = useState("Initialisation..."); // Dynamic status message
    const [selectedSlotIds, setSelectedSlotIds] = useState([]); // IDs of slots to include in search

    // DAY_MAP for display
    const DAY_MAP = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };

    // Robust Home Base Parsing (Memoized)
    const homeBase = React.useMemo(() => {
        let hb = mySquad?.home_base;
        if (typeof hb === 'string') {
            try { hb = JSON.parse(hb); } catch (e) { hb = null; }
        }
        return hb;
    }, [mySquad?.home_base]);

    // Initialize temp location from homeBase or User Location
    useEffect(() => {
        // console.log('[DEBUG] MatchCenter - Init Location', { homeBase, userLoc: userData?.location });
        if (!tempSearchLocation) {
             if (homeBase) {
                 // Check if homeBase is in { label, value: "lng|lat" } format from Autocomplete
                 if (homeBase.value && typeof homeBase.value === 'string' && homeBase.value.includes('|')) {
                    const parts = homeBase.value.split('|');
                    if (parts.length === 2) {
                        setTempSearchLocation({
                            lat: parseFloat(parts[1]),
                            lng: parseFloat(parts[0]),
                            address: homeBase.label,
                            city: homeBase.label ? homeBase.label.split('(')[0].trim() : '',
                            ...homeBase
                        });
                    } else {
                        setTempSearchLocation(homeBase);
                    }
                 } else {
                     setTempSearchLocation(homeBase);
                 }
             } else if (userData?.location) {
                 // Fallback to Captain's location if team has none
                 let userLoc = userData.location;
                 // Parse if string
                 if (typeof userLoc === 'string') {
                     try { userLoc = JSON.parse(userLoc); } catch(e) {}
                 }
                 if (userLoc?.lat && userLoc?.lng) {
                     setTempSearchLocation(userLoc);
                 }
             }
        }
    }, [homeBase, userData]);

    // Initialize searchRadius from homeBase
    useEffect(() => {
         if (homeBase?.radius) {
             setSearchRadius(homeBase.radius);
         }
    }, [homeBase]);

    const lastMatchRef = React.useRef(null);

    const fetchMatchData = useCallback(async (squad) => {
        setMySquad(squad);
        setLoading(true);
        try {
            // B. Check Active Matchmaking Request for THIS squad
            const activeReq = await MatchmakingService.getActiveRequest(squad.documentId);
            
            // activeReq is { state: 'idle' | 'searching' | 'matched', request?, match? }
            if (activeReq && (activeReq.state === 'searching' || activeReq.state === 'matched')) {
                setMatchRequest(activeReq.request);
                if (activeReq.state === 'matched') {
                    setViewState('match_found');
                    setCurrentMatch(activeReq.match);
                    lastMatchRef.current = activeReq.match; // Track match
                } else {
                    setViewState('radar');
                    setCurrentMatch(null);
                    // Match disappeared or switched to searching?
                    if (lastMatchRef.current) {
                        if (lastMatchRef.current.status === 'provisionary' || lastMatchRef.current.status === 'scheduled') {
                             Alert.alert("Match annulé", "Le match précédent a été annulé.");
                        }
                        lastMatchRef.current = null;
                    }
                }
            } else {
                // No active request/match
                if (lastMatchRef.current) {
                     // We had a match, now nothing. It was cancelled.
                     Alert.alert("Match annulé", "Votre match a été annulé par l'adversaire ou le système.");
                     lastMatchRef.current = null;
                     setCurrentMatch(null);
                }

                // C. Check Next Available Slot
                const slots = await getAvailableSlots(squad.documentId);
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
    }, [userData, searchRadius]);

    const loadMatchCenter = useCallback(async () => {
        if (!userData) return;
        setLoading(true);
        try {
            // A. Fetch User's LEAGUE Squads
            const squads = await getMyLeagueTeam(userData.documentId); 
            setAllSquads(squads);
            
            if (squads.length === 0) {
                setViewState('no_squad');
                setLoading(false);
                return;
            }

            // Select initial squad (either currently selected or first one)
            const initialSquad = mySquad && squads.find(s => s.documentId === mySquad.documentId) 
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

    const handleSquadSwitch = async (squad) => {
        setIsSquadSelectorVisible(false);
        if (squad.documentId !== mySquad?.documentId) {
            await fetchMatchData(squad);
        }
    };

    const handleLaunchLobby = () => {
        setViewState('lobby');
    };

    const handleConfirmSearch = async () => {
        if (!mySquad) return; 
        
        // 1. Show Loading Screen immediately (closes modal)
        setViewState('searching_start');
        
        // 2. Artificial Delay for UX (let user appreciate the transition)
        setTimeout(async () => {
            try {
                // Determine Location
                let searchLocation = { lat: 48.8566, lng: 2.3522 };


                if (tempSearchLocation && tempSearchLocation.lat && tempSearchLocation.lng) {
                     searchLocation = { lat: tempSearchLocation.lat, lng: tempSearchLocation.lng };
                } else {
                    // Fallback to Saved Squad Preference
                    let homeBase = mySquad.home_base;
                    if (typeof homeBase === 'string') {
                        try { homeBase = JSON.parse(homeBase); } catch (e) {}
                    }

                    if (homeBase && homeBase.lat && homeBase.lng) {
                         searchLocation = { lat: homeBase.lat, lng: homeBase.lng };
                    }
                    // Fix: Parse homeBase.value (lng|lat) if lat/lng not present directly
                    else if (homeBase && homeBase.value && homeBase.value.includes('|')) {
                        const parts = homeBase.value.split('|');
                        if (parts.length === 2) {
                            searchLocation = { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
                        }
                    }
                    else if (mySquad.address && mySquad.address.value) {
                        const parts = mySquad.address.value.split('|');
                        if (parts.length === 2) {
                            searchLocation = { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
                        }
                    }
                    // Fallback to User Location (Captain)
                    else if (userData?.location) {
                         let userLoc = userData.location;
                         if (typeof userLoc === 'string') {
                             try { userLoc = JSON.parse(userLoc); } catch(e) {}
                         }
                         if (userLoc?.lat && userLoc?.lng) {
                             searchLocation = { lat: userLoc.lat, lng: userLoc.lng };
                         }
                    }
                }

                const params = {
                    teamId: mySquad.documentId,
                    selectedSlotIds: selectedSlotIds, // Array of selected recurring slot IDs
                    radius: searchRadius, 
                    location: searchLocation,
                };

                const result = await MatchmakingService.triggerSearch(params.teamId, params.selectedSlotIds, params);

                
                if (result && result.status === 'matched') {
                     Alert.alert("🎯 Match Trouvé !", "Un adversaire a été trouvé instantanément !");
                     setViewState('match_found');
                } else {
                    setMatchRequest(result);
                    setViewState('radar');
                }
            } catch (error) {
                console.error(error);
                Alert.alert("Erreur", "Recherche échouée");
                setViewState('lobby'); // Go back to config on error
            }
        }, 2000); // 2 seconds delay
    };

    // POLLING: If in Radar mode, check status every 5 seconds AND update dynamic text
    useEffect(() => {
        let interval;
        let timerInterval;

        if ((viewState === 'radar' || viewState === 'locker_room') && mySquad) {
            // A. Status Check Logic (Backend)
            interval = setInterval(async () => {
                const statusData = await MatchmakingService.getActiveRequest(mySquad.documentId);
                
                // Case 1: Match Found
                if (statusData && statusData.state === 'matched') {
                    setMatchRequest(statusData.request);
                    setCurrentMatch(statusData.match);
                    setOpponentDetails(statusData.opponentDetails);
                    setViewState('match_found');
                    clearInterval(interval);
                    Alert.alert("🔔 Match Trouvé !", "Un adversaire a été trouvé.");
                }
                
                // Case 2: Auto-Start Detection (Transition from Locker to Radar)
                else if (viewState === 'locker_room' && statusData && statusData.state === 'searching') {
                    console.log("Auto-Start Detected! Switching to Radar.");
                    setMatchRequest(statusData.request);
                    setViewState('radar');
                    // Do not clear interval, let it continue for match detection
                }
            }, 5000);

            // B. Dynamic UI Text Logic (Frontend)
            const updateStatusText = () => {
                if (!matchRequest || !matchRequest.createdAt) return;
                
                const created = new Date(matchRequest.createdAt).getTime();
                const now = new Date().getTime();
                const diffMinutes = (now - created) / 1000 / 60;
                
                // Detailed Algorithm Feedback based on elapsed time (Tier Logic)
                if (diffMinutes < 5) {
                    setSearchStatus(`Recherche précise (ELO strict, Div ${mySquad.division || '?'})`);
                } else if (diffMinutes < 15) {
                    setSearchStatus("Élargissement : Division +/- 1...");
                } else if (diffMinutes < 30) {
                    setSearchStatus("Recherche étendue : Division +/- 2...");
                } else {
                    setSearchStatus("Recherche globale (Toutes divisions)...");
                }
            };

            // Run immediately and then every minute
            updateStatusText(); 
            timerInterval = setInterval(updateStatusText, 10000); 
        }
        return () => {
            if (interval) clearInterval(interval);
            if (timerInterval) clearInterval(timerInterval);
        };
    }, [viewState, mySquad, matchRequest]);

    // Ensure searchRadius is initialized from squad preferences 
    useEffect(() => {
         if (mySquad?.home_base?.radius) {
             setSearchRadius(mySquad.home_base.radius);
         }
    }, [mySquad]);

    // Initialize selectedSlotIds with ALL squad slots (pre-select all)
    // Initialize selectedSlotIds with ALL squad slots (pre-select all)
    useEffect(() => {
        if (squadSlots && squadSlots.length > 0) {
            setSelectedSlotIds(squadSlots.map(s => s.id || s.documentId));
        }
    }, [squadSlots]);

    // Toggle slot selection for matchmaking
    const toggleSlotSelection = (slotId) => {
        setSelectedSlotIds(prev => 
            prev.includes(slotId) 
                ? prev.filter(id => id !== slotId) 
                : [...prev, slotId]
        );
    };




    const handleCancelSearch = async () => {
        if (!matchRequest) return;
        setLoading(true);
        try {
            const reqId = matchRequest.documentId || matchRequest.id;
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

    const handleSendProposal = async (proposalData) => {
        if (!currentMatch) return;
        setLoading(true);
        try {
            const matchId = currentMatch.documentId || currentMatch.id;
            
            // 1. Update Match with Proposal
            await updateMatch(matchId, {
                proposed_venue: proposalData.venue,
                proposed_time: proposalData.date,
                location: proposalData.address // Store full address object if needed
            });

            // 2. Refresh Match Data Locally (Optimistic or fetch)
            const updatedMatch = { 
                ...currentMatch, 
                proposed_venue: proposalData.venue, 
                proposed_time: proposalData.date 
            };
            setCurrentMatch(updatedMatch);

            // 3. Send Formatted Message in Chat
            if (currentMatch.chat) {
                const chatId = currentMatch.chat.documentId || currentMatch.chat.id;
                const formattedDate = new Date(proposalData.date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                
                const messageText = `📍 **Proposition de Match**\n` +
                    `Je propose de jouer à :\n` +
                    `**${proposalData.venue}**\n` +
                    `📅 **${formattedDate}**\n\n` +
                    `Cela vous convient-il ?`;

                await createChatMessage({
                    chatId,
                    message: messageText,
                    composition: {
                        type: 'proposal',
                        venue: proposalData.venue,
                        date: proposalData.date,
                        status: 'pending',
                        matchId: matchId 
                    }
                });
                
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.neutral800, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                 <Image source={Images.shield} style={{ width: 40, height: 40, tintColor: Colors.neutral500 }} resizeMode="contain" />
            </View>
            <Text style={[Fonts.h2, { color: Colors.neutral00, marginBottom: 8 }]}>PAS D'ÉQUIPE</Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 24, paddingHorizontal: 40 }]}>
                Vous devez être capitaine d'une équipe de Ligue pour accéder au Match Center.
            </Text>
            <Button
                title="CRÉER UNE ÉQUIPE"
                onPress={() => navigation.navigate('LeagueSquadTab')}
                variant="Primary"
            />
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
                        borderColor: Colors.card || '#222',
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

        if (viewState === 'radar') {
            return (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                     <View style={[styles.radarCircle, { width: 80, height: 80, borderRadius: 40, marginBottom: 16, borderColor: Colors.gold500 }]}>
                        <Text style={{ fontSize: 24 }}>📡</Text>
                     </View>
                     <Text style={[Fonts.h3, { color: Colors.neutral00, marginBottom: 4 }]}>RECHERCHE EN COURS</Text>
                     <Text style={[Fonts.p2, { color: Colors.gold500, textAlign: 'center', marginBottom: 8, fontWeight: 'bold' }]}>
                         {searchStatus}
                     </Text>
                     <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 16 }]}>
                         Nous cherchons une équipe compatible dans votre zone.
                     </Text>
                     
                     {/* Timer Countdown */}
                     {matchRequest?.createdAt && (
                         <SearchCountdown 
                             createdAt={matchRequest.createdAt}
                             onExpired={handleCancelSearch}
                         />
                     )}
                     
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
            if (currentMatch && (currentMatch.status === 'scheduled' || currentMatch.status === 'pending_validation')) {
                // Navigate to standalone LeagueMatchDetails (no event dependency)
                return (
                    <NextMatchCard 
                        match={currentMatch}
                        event={currentMatch.event}
                        myTeamId={mySquad?.documentId}
                        onRefresh={loadMatchCenter}
                        onPress={() => navigation.navigate(RouteNames.LeagueMatchDetails, { matchId: currentMatch.documentId })}
                    />
                );
            }
            // Helpers for display
            const DAY_MAP = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };
            const formatHour = (h) => h ? h.substring(0, 5) : '?';
            const city = opponentDetails?.home_base?.label ? opponentDetails.home_base.label.split('(')[0].trim() : (opponentDetails?.location?.city || "Zone Inconnue");
            const division = opponentDetails?.division || '?';
            // Recurring slot display
            const recurringDay = DAY_MAP[opponentDetails?.recurring_day] || currentMatch?.recurring_day || '?';
            const recurringStart = formatHour(opponentDetails?.recurring_start_hour || currentMatch?.recurring_start_hour);
            const recurringEnd = formatHour(opponentDetails?.recurring_end_hour || currentMatch?.recurring_end_hour);
            // Sport/Category handling (Relation objects or strings)
            const sportLabel = opponentDetails?.sport?.label || opponentDetails?.sport?.name || "Sport"; 
            const catLabel = opponentDetails?.category?.label || opponentDetails?.category?.name || "Senior";

            return (
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                     {/* ANONYMOUS HEADER */}
                     <Text style={[Fonts.h3, { color: '#ccc', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 2 }]}>
                        ADVERSAIRE MYSTÈRE
                     </Text>

                     {/* MAIN CARD */}
                     <View style={{ 
                         backgroundColor: Colors.neutral800, 
                         borderRadius: 16, 
                         padding: 24, 
                         width: '100%',
                         alignItems: 'center',
                         borderWidth: 1,
                         borderColor: Colors.gold500,
                         marginBottom: 24
                     }}>
                        {/* Generic Identity */}
                        <View style={{ marginBottom: 16 }}>
                            <View style={{ 
                                width: 80, height: 80, borderRadius: 40, 
                                backgroundColor: Colors.neutral900, 
                                justifyContent: 'center', alignItems: 'center',
                                borderWidth: 2, borderColor: Colors.gold500,
                                marginBottom: 12
                            }}>
                                 <Text style={{ fontSize: 40 }}>⚔️</Text>
                            </View>
                            <View style={{ 
                                position: 'absolute', bottom: 8, right: -4, 
                                backgroundColor: Colors.gold500, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 
                            }}>
                                <Text style={[Fonts.p3Bold, { color: 'black' }]}>DIV {division}</Text>
                            </View>
                        </View>

                        {/* Stats / Context */}
                        <View style={{ alignItems: 'center', width: '100%' }}>
                            <Text style={[Fonts.h2, { color: 'white', marginBottom: 4 }]}>ÉQUIPE ADVERSE</Text>
                            <Text style={[Fonts.p2, { color: '#bbb', marginBottom: 16 }]}>{sportLabel} • {catLabel}</Text>
                            
                            <View style={{ width: '100%', height: 1, backgroundColor: Colors.neutral700, marginBottom: 16 }} />

                            {/* Details Grid */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Text style={{ fontSize: 20, marginBottom: 4 }}>📍</Text>
                                    <Text style={[Fonts.p2Bold, { color: 'white' }]}>
                                        {city || (opponentDetails?.home_base?.city) || (typeof opponentDetails?.home_base === 'string' ? opponentDetails.home_base : "Zone Inconnue")}
                                    </Text>
                                    <Text style={[Fonts.p3, { color: '#bbb' }]}>+/- {opponentDetails?.radius || '?'} km</Text>
                                </View>
                                <View style={{ width: 1, height: '100%', backgroundColor: Colors.neutral700 }} />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Text style={{ fontSize: 20, marginBottom: 4 }}>🕒</Text>
                                    <Text style={[Fonts.p2Bold, { color: 'white' }]}>
                                        {/* Translate Day */}
                                        {(() => {
                                            const dayMap = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };
                                            const rDay = recurringDay?.toLowerCase();
                                            return dayMap[rDay] || rDay || "Date Inconnue";
                                        })()}
                                    </Text>
                                    <Text style={[Fonts.p3, { color: '#bbb' }]}>{recurringStart} - {recurringEnd}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Common Slots Negotiation Text */}
                         {currentMatch?.common_slots && currentMatch.common_slots.length > 1 && (
                            <View style={{ marginTop: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                                <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
                                    ℹ️ {currentMatch.common_slots.length - 1} autre(s) créneau(x) commun(s) disponible(s)
                                </Text>
                            </View>
                        )}
                     </View>

                     <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 24, paddingHorizontal: 10 }]}>
                        Le match correspond à vos critères. Discutez pour valider le terrain.
                     </Text>

                    <Button
                        title="ACCÉDER AU CHAT"
                        variant="Primary"
                        onPress={() => {
                             if (currentMatch && currentMatch.chat) {
                                  const chatId = currentMatch.chat.documentId || currentMatch.chat.id;
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
                                  Alert.alert("Erreur", "Le chat n'est pas encore prêt. Réessayez dans quelques secondes.");
                             }
                        }}
                        style={{ width: '100%', backgroundColor: Colors.gold500 }}
                        textStyle={{ color: Colors.neutral900, fontWeight: 'bold', fontSize: 16 }}
                    />

                    {/* Cancel Button - Captain Only */}
                    {mySquad?.captain?.documentId === userData?.documentId && (
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    "Annuler le match ?",
                                    "Êtes-vous sûr de vouloir annuler ce match ? Votre équipe reviendra en mode recherche.",
                                    [
                                        { text: "Non", style: "cancel" },
                                        {
                                            text: "Annuler et Relancer",
                                            onPress: async () => {
                                                try {
                                                    if (currentMatch?.documentId) {
                                                        const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                                                        await cancelMatch(currentMatch.documentId, mySquad.documentId, 'captain_request');
                                                        
                                                        // Trigger new search immediately
                                                        setViewState('searching_start');
                                                        setTimeout(async () => {
                                                            try {
                                                                // Re-use current params if available or re-trigger logic
                                                                // Ideally we call handleConfirmSearch logic but access is tricky.
                                                                // Simpler: Trigger search with current params from squad
                                                                const userLoc = userData?.location ? (typeof userData.location === 'string' ? JSON.parse(userData.location) : userData.location) : { lat: 48.8566, lng: 2.3522 };
                                                                await MatchmakingService.triggerSearch(
                                                                    mySquad.documentId, 
                                                                    [], // Slots ? Ideally reuse previously selected. But empty = any available.
                                                                    { radius: searchRadius, location: userLoc }
                                                                );
                                                                loadMatchCenter(); // Refresh state to show searching
                                                            } catch(e) {
                                                                console.error("Restart search failed", e);
                                                                Alert.alert("Erreur", "Match annulé mais impossible de relancer la recherche.");
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
                                                    if (currentMatch?.documentId) {
                                                        const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                                                        await cancelMatch(currentMatch.documentId, mySquad.documentId, 'captain_request');
                                                        Alert.alert("Match annulé", "Vous pouvez relancer une recherche.");
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
        if (currentMatch && (currentMatch.status === 'scheduled' || currentMatch.status === 'pending_validation')) {
             // Navigate to standalone LeagueMatchDetails (no event dependency)
             return (
                 <NextMatchCard 
                    match={currentMatch}
                    event={currentMatch.event}
                    myTeamId={mySquad?.documentId}
                    onRefresh={loadMatchCenter}
                    onPress={() => navigation.navigate(RouteNames.LeagueMatchDetails, { matchId: currentMatch.documentId })}
                 />
             );
        }

        // DEFAULT: Locker Room / Ticket View
        return (
            <View>
                 {/* Carousel of Slots */}
                 <View>
                     <FlatList
                        data={squadSlots.length > 0 ? squadSlots : (activeSlot ? [activeSlot] : [])}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        snapToInterval={screenWidth - 40 + 16} // Card width + margin
                        decelerationRate="fast"
                        pagingEnabled={false} // Disable standard paging to allow custom snap
                        keyExtractor={(item) => item.id || item.documentId || Math.random().toString()}
                        onMomentumScrollEnd={(e) => {
                            const cardWidth = screenWidth - 40 + 16;
                            const index = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
                            if (squadSlots[index]) {
                                setActiveSlot(squadSlots[index]);
                            }
                        }}
                        contentContainerStyle={!squadSlots.length && !activeSlot ? {} : { paddingHorizontal: 0 }}
                        renderItem={({ item, index }) => {
                            const isActive = activeSlot && (activeSlot.id === item.id || activeSlot.documentId === item.documentId);
                            if (!item) return null;

                            return (
                                <View style={{ width: screenWidth - 40, marginRight: 16 }}>
                                    <View style={{ marginBottom: 8 }}>
                                            {/* Date & Time Display */}
                                           <View>
                                                <Text style={[Fonts.h2, { color: Colors.neutral00, textTransform: 'uppercase' }]}>
                                                   {item.recurrence_day ? (DAY_MAP[item.recurrence_day] || item.recurrence_day) : formatDate(item.start_time || item.date).split(' ')[0]}
                                                </Text>
                                                <Text style={[Fonts.p1, { color: Colors.primary500, marginTop: 2 }]}>
                                                    {item.start_hour ? 
                                                       `${item.start_hour.substring(0,5)} - ${item.end_hour.substring(0,5)}` 
                                                       : 
                                                       `${new Date(item.start_time || item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(new Date(item.start_time || item.date).getTime() + 60*60*1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                                                    }
                                                </Text>
                                           </View>
                                       </View>
                                       {/* Status Chip */}
                                        <View style={{ 
                                            position: 'absolute', right: 60, top: 0,
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
                            <View style={{ width: screenWidth - 40 }}>
                                 <View>
                                     <Text style={[Fonts.h2, { color: Colors.neutral500 }]}>Pas de match</Text>
                                     <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>Aucun créneau réservé</Text>
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
                                     ✅ Équipe complète
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
                                     Il manque {5 - (activeSlot.rsvp_count || 0)} joueurs pour être au complet.
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
    };

    const renderLockerRoom = () => (
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
                            <Text style={[Fonts.p3, { color: Colors.gold500, marginRight: 4 }]}>Changer</Text>
                            <Text style={[Fonts.p3, { color: Colors.gold500 }]}>▼</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <View style={{ 
                            backgroundColor: Colors.neutral800, paddingHorizontal: 8, paddingVertical: 2, 
                            borderRadius: 4, borderWidth: 1, borderColor: Colors.neutral700, marginRight: 8 
                        }}>
                             <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>DIV {mySquad?.division || 10}</Text>
                        </View>
                        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>{mySquad?.elo || 1200} PTS</Text>
                    </View>
                </View>
             </View>

            <SectionHeader title={viewState === 'radar' ? "RECHERCHE..." : (viewState === 'match_found' ? "ACTION REQUISE" : "PROCHAIN MATCH")} />
            
            <LeagueCard style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
                <View style={{ padding: 20 }}>
                     {renderMatchCardContent()}
                </View>
            </LeagueCard>

            {/* 3. SEASON STATS */}
            <SectionHeader title="SAISON EN COURS" />
            <LeagueCard>
                 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>{mySquad?.wins || 0}</Text>
                          <Text style={[Fonts.p3Bold, { color: Colors.neutral300, marginTop: 4 }]}>VICTOIRES</Text>
                      </View>
                      <View style={{ width: 1, height: 40, backgroundColor: Colors.neutral800 }} />
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>-</Text>
                          <Text style={[Fonts.p3Bold, { color: Colors.neutral300, marginTop: 4 }]}>SÉRIE</Text>
                      </View>
                      <View style={{ width: 1, height: 40, backgroundColor: Colors.neutral800 }} />
                       <View style={{ alignItems: 'center', flex: 1 }}>
                            <TouchableOpacity 
                                style={{ padding: 8, backgroundColor: Colors.neutral800, borderRadius: 8 }}
                                onPress={() => navigation.navigate(RouteNames.LeagueRanking)}
                            >
                                 <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>CLASSEMENT</Text>
                            </TouchableOpacity>
                       </View>
                 </View>
            </LeagueCard>
        </View>
    );

    const renderLobbyModal = () => {
        const sportLabel = mySquad?.activities?.[0]?.name || mySquad?.sport?.label || mySquad?.sport || "Sport indéfini";

        // Helper to extract string from string or object
        const getSafeLabel = (val) => {
            if (!val) return null;
            if (typeof val === 'string') return val;
            if (typeof val === 'object' && val.label) return val.label;
            return null;
        };

        // Display Label
        let displayLabel = "Zone indéfinie";
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
            isVisible={viewState === 'lobby'} 
            close={() => setViewState('locker_room')}
            snapPoints={['90%']}
            scrollable={true}
            headerComponent={
                <View>
                    <Text style={[Fonts.h3, { color: Colors.gold500, textAlign: 'center', letterSpacing: 1 }]}>CONFIGURATION</Text>
                     <Text style={[Fonts.p1, { color: Colors.textSecondary || '#aaa', textAlign: 'center', marginBottom: 8 }]}>
                        {activeSlot ? `Match du ${formatDate(activeSlot.start_time || activeSlot.date)}` : "Recherche immédiate"}
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
                            onSelect={(data) => {
                                // data: { label: "Address...", value: "lng|lat" }
                                if (data && data.value) {
                                    const parts = data.value.split('|');
                                    if (parts.length === 2) {
                                        const lng = parseFloat(parts[0]);
                                        const lat = parseFloat(parts[1]);
                                        setTempSearchLocation({
                                            lat: lat,
                                            lng: lng,
                                            address: data.label,
                                            city: data.label.split('(')[0].trim()
                                        });
                                    }
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
                            📍 {displayLabel}
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

            {/* SECTION: Sélection des Créneaux Récurrents */}
            <View style={{ marginBottom: 24 }}>
                <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 8 }]}>
                    Vos disponibilités ({selectedSlotIds.length}/{squadSlots.length || 0})
                </Text>

                {/* SECTION: Autres créneaux communs (Négociation) */}
                {currentMatch?.common_slots && currentMatch.common_slots.length > 1 && (
                    <View style={{ marginTop: 16, padding: 12, backgroundColor: Colors.neutral800, borderRadius: 8, borderWidth: 1, borderColor: Colors.neutral700 }}>
                        <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
                            🔄 Autres créneaux communs possibles :
                        </Text>
                        {currentMatch.common_slots.map((slot, index) => {
                             // Skip the currently selected slot
                             if (slot.day === (currentMatch.recurring_day || opponentDetails.recurring_day)) return null;

                             const dayName = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' }[slot.day] || slot.day;
                             return (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ fontSize: 14 }}>📅</Text>
                                    <Text style={[Fonts.p2, { color: Colors.neutral100, marginLeft: 8 }]}>
                                        {dayName} {slot.startHour}-{slot.endHour}
                                    </Text>
                                </View>
                             );
                        })}
                    </View>
                )}

                {(squadSlots || []).map((slot) => {
                    const slotId = slot.id || slot.documentId;
                    const isSelected = selectedSlotIds.includes(slotId);
                    const formatHour = (h) => h ? h.substring(0, 5) : '?';
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
                                {isSelected && <Text style={{ color: 'white', fontWeight: 'bold' }}>✓</Text>}
                            </View>
                            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                                {DAY_MAP[slot.recurrence_day] || slot.recurrence_day} {formatHour(slot.start_hour)} - {formatHour(slot.end_hour)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                {(!squadSlots || squadSlots.length === 0) && (
                    <Text style={[Fonts.p2, { color: Colors.neutral500, textAlign: 'center', padding: 16 }]}>
                        Aucun créneau défini. Ajoutez-en depuis la page d'équipe.
                    </Text>
                )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.neutral800, paddingBottom: 16, marginBottom: 24  }}>
                <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Durée Match</Text>
                 <View style={{ backgroundColor: Colors.neutral800, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                     <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>60 min</Text>
                 </View>
            </View>

             <Button 
                title={loading ? "Lancement..." : "CONFIRMER & SCANNER"} 
                variant="Primary"
                onPress={handleConfirmSearch}
                disabled={loading}
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
                    Changer d'équipe
                </Text>
            }
        >
            <View style={{ paddingBottom: 24 }}>
                {allSquads.map((squad) => (
                    <TouchableOpacity
                        key={squad.documentId}
                        onPress={() => handleSquadSwitch(squad)}
                        style={[
                            ApplicationStyle.backgroundColor.neutral800,
                            Spaces.padding[16],
                            ApplicationStyle.borderRadius12,
                            Spaces.marginBottom[12],
                            Alignments.row,
                            Alignments.alignCenter,
                            squad.documentId === mySquad?.documentId && { borderWidth: 1, borderColor: Colors.primary500 }
                        ]}
                    >
                         <View style={{ 
                            width: 40, height: 40, borderRadius: 20, 
                            backgroundColor: Colors.neutral900, borderWidth: 1, borderColor: Colors.gold500,
                            justifyContent: 'center', alignItems: 'center', marginRight: 16 
                        }}>
                             {squad.crest?.url ? (
                                  <Image source={{ uri: squad.crest.url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                             ) : (
                                  <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{squad.name.substring(0, 2).toUpperCase()}</Text>
                             )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{squad.name}</Text>
                            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                                {squad?.sport || "Sport"} • Div {squad?.division || 10}
                            </Text>
                        </View>
                         {squad.documentId === mySquad?.documentId && (
                             <Text style={{ color: Colors.primary500, fontSize: 16 }}>✓</Text>
                         )}
                    </TouchableOpacity>
                ))}
            </View>
        </BottomModal>
    );

    if (viewState === 'loading' && !mySquad) { // Only block on initial load
        return <View style={[styles.screen, {justifyContent:'center'}]}><ActivityIndicator color={Colors.gold500 || '#D4AF37'} /></View>;
    }
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
                
                <EndGameModal 
                    isVisible={isEndGameModalVisible}
                    onClose={() => setIsEndGameModalVisible(false)}
                    onSubmit={async (scoreA, scoreB) => {
                         // TODO: Call API
                         // await MatchmakingService.submitScore(currentMatch.id, scoreA, scoreB);
                         Alert.alert("Score envoyé", `Score A: ${scoreA} - Score B: ${scoreB}\n(Backend non connecté)`);
                    }}
                    teamNameA={currentMatch?.team_a?.name}
                    teamNameB={currentMatch?.team_b?.name}
                />
            </ScrollView>
            
            {/* MODALS OUTSIDE SCROLLVIEW */}
            {renderLobbyModal()}
            {renderSquadSelectorModal()}
            
            <VenueProposalModal
                isVisible={isProposalModalVisible}
                onClose={() => setIsProposalModalVisible(false)}
                onSend={handleSendProposal}
                onSkip={() => {
                    setIsProposalModalVisible(false);
                    if (currentMatch && currentMatch.chat) {
                        const chatId = currentMatch.chat.documentId || currentMatch.chat.id;
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
