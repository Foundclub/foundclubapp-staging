import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Alert, Modal, StyleSheet, ActivityIndicator, ImageBackground, Image, RefreshControl } from 'react-native';
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
    const [matchRequest, setMatchRequest] = useState(null);
    const [currentMatch, setCurrentMatch] = useState(null);
    const [opponentDetails, setOpponentDetails] = useState(null);
    
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

    // 1. Load Squads & State on Focus
    useFocusEffect(
        useCallback(() => {
            loadMatchCenter();
        }, [userData])
    );

    const loadMatchCenter = async () => {
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
    };

    const fetchMatchData = async (squad) => {
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
                } else {
                    setViewState('radar');
                    setCurrentMatch(null);
                }
            } else {
                // C. Check Next Available Slot
                const slots = await getAvailableSlots(squad.documentId);
                
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
    };

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
                // Fix: Use start_time from Strapi object, fallback to date if mapped, else Now
                const slotTime = activeSlot ? (activeSlot.start_time || activeSlot.date) : null;
                const startTime = slotTime ? slotTime : new Date().toISOString();
                
                const endTime = activeSlot 
                    ? new Date(new Date(startTime).getTime() + 60*60*1000) 
                    : new Date(new Date().getTime() + 60*60*1000);

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
                    slotId: activeSlot ? activeSlot.id : null,
                    radius: searchRadius, 
                    location: searchLocation,
                    firstName: mySquad.name,
                    startTime: startTime,
                    endTime: endTime,
                    elo: mySquad.elo || 1200
                };

                const result = await MatchmakingService.triggerSearch(params.teamId, params.slotId, params);
                
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

        if (viewState === 'radar' && mySquad) {
            // A. Status Check Logic (Backend)
            interval = setInterval(async () => {
                const statusData = await MatchmakingService.getActiveRequest(mySquad.documentId);
                if (statusData && statusData.state === 'matched') {
                    setMatchRequest(statusData.request);
                    setCurrentMatch(statusData.match);
                    setOpponentDetails(statusData.opponentDetails);
                    setViewState('match_found');
                    clearInterval(interval);
                    Alert.alert("🔔 Match Trouvé !", "Un adversaire a été trouvé.");
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


    const handleCancelSearch = async () => {
        if (!matchRequest) return;
        setLoading(true);
        try {
            const reqId = matchRequest.documentId || matchRequest.id;
            await MatchmakingService.cancelRequest(reqId);
            setMatchRequest(null);
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
            const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
            const city = opponentDetails?.home_base?.label ? opponentDetails.home_base.label.split('(')[0].trim() : (opponentDetails?.location?.city || "Zone Inconnue");
            const division = opponentDetails?.division || '?';
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
                                    <Text style={[Fonts.p2Bold, { color: 'white' }]}>{city}</Text>
                                    <Text style={[Fonts.p3, { color: '#bbb' }]}>+/- {opponentDetails?.radius || '?'} km</Text>
                                </View>
                                <View style={{ width: 1, height: '100%', backgroundColor: Colors.neutral700 }} />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Text style={{ fontSize: 20, marginBottom: 4 }}>🕒</Text>
                                    <Text style={[Fonts.p2Bold, { color: 'white' }]}>
                                        {formatTime(opponentDetails?.start_time)}
                                    </Text>
                                    <Text style={[Fonts.p3, { color: '#bbb' }]}>à {formatTime(opponentDetails?.end_time)}</Text>
                                </View>
                            </View>
                        </View>
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
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View>
                         {/* Date & Time Display */}
                         {activeSlot ? (
                            <View>
                                 <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>
                                    {formatDate(activeSlot.start_time || activeSlot.date).split(' ')[0]}
                                 </Text>
                                 <Text style={[Fonts.p1, { color: Colors.primary500, marginTop: 2 }]}>
                                     {new Date(activeSlot.start_time || activeSlot.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(new Date(activeSlot.start_time || activeSlot.date).getTime() + 60*60*1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </Text>
                            </View>
                         ) : (
                             <View>
                                 <Text style={[Fonts.h2, { color: Colors.neutral500 }]}>Pas de match</Text>
                                 <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>Aucun créneau réservé</Text>
                             </View>
                         )}
                    </View>
                    {/* Status Chip */}
                     <View style={{ 
                         backgroundColor: activeSlot ? 'rgba(1, 179, 244, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                         paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 
                    }}>
                          <Text style={[Fonts.p3Bold, { color: activeSlot ? Colors.primary500 : Colors.neutral500 }]}>
                              {activeSlot ? "CONFIRMÉ" : "VIDE"}
                          </Text>
                     </View>
                 </View>

                 {/* Visual Roster */}
                 <View style={{ marginTop: 16 }}>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, textTransform: 'uppercase' }]}>
                        EFFECTIF {activeSlot?.rsvp_count || 0}/5
                    </Text>
                    <VisualRoster rsvpCount={activeSlot?.rsvp_count || 0} />
                 </View>

                 <View style={{ height: 1, backgroundColor: Colors.neutral800, marginVertical: 16 }} />

                 {/* Actions */}
                 {activeSlot ? (
                    <View>
                        {activeSlot.rsvp_count >= 5 ? (
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
                                     Il manque {5 - activeSlot.rsvp_count} joueurs pour lancer la recherche.
                                 </Text>
                                 <Button 
                                    title="INVITER DES JOUEURS" 
                                    variant="Primary"
                                    onPress={() => navigation.navigate('LeagueSquadTab')}
                                    style={{ backgroundColor: Colors.neutral800, borderColor: Colors.primary500, borderWidth: 1 }}
                                    textStyle={{ color: Colors.primary500 }}
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
            close={() => {
                // Only go back to locker_room if we are effectively canceling (i.e. still in lobby or closing from lobby)
                // If we switched to 'radar', this onDismiss event fires because visible becomes false,
                // but we DO NOT want to override 'radar' state.
                if (viewState === 'lobby') {
                    setViewState('locker_room');
                }
            }}
            snapPoints={['55%']} // Slightly taller for search config
            scrollable={true}
            headerComponent={
                <View>
                    <Text style={[Fonts.h2, { color: Colors.gold500 || '#D4AF37', textAlign: 'center' }]}>CONFIGURATION</Text>
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
