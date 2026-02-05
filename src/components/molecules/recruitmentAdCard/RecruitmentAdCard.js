import React from 'react';
import {
    Image,
    ImageBackground,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Pressable
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { RouteNames } from '@/navigation/routeNames';

import useTheme from '@/theme/themeContext';
import useClub from '@/domains/club/useClub';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import Tag from '@/components/atoms/tag/Tag';

// Asset: Same as EventCardNew (fallback/other)
const CARD_BACKGROUND = require('@/assets/background-card-event/card-autre.png');

/**
 * RecruitmentAdCard component - Fully aligned with EventCardNew.js design
 * @param {object} props
 * @param {object} props.ad - The recruitment ad data
 * @param {Function} [props.onPress] - Callback when card is pressed
 * @param {boolean} [props.isOwner] - If true, shows owner actions
 */
import useAuth from '@/domains/auth/useAuth';
import MatchIndicator from '@/components/atoms/matchIndicator/MatchIndicator';

// ... (imports)

const RecruitmentAdCard = ({ ad, onPress, isOwner = false }) => {
    const navigation = useNavigation();
    const {
        Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
    } = useTheme();
    const { getClubInitials } = useClub();
    const { userData } = useAuth(); // Get user data for match calculation

    // Animation State
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const onPressIn = () => {
        scale.value = withTiming(0.98, { duration: 100 });
    };

    const onPressOut = () => {
        scale.value = withTiming(1, { duration: 100 });
    };

    // Data Extraction
    const team = ad.team;
    const club = team?.club;
    const clubName = club?.name || team?.name || 'Club inconnu';
    const clubLogo = getImageUrl(club?.logo?.url);
    
    // Position
    const positionLabel = ad.position || 'Poste non spécifié';

    // Level & Category
    const levelName = ad.level?.name || ad.minLevel || 'Niveau ?';
    const categoryName = ad.category?.name || ad.category || 'Catégorie ?';
    
    // Location
    const address = getShortAddress(ad.city || club?.city || '');
    
    // Section
    const sectionName = ad.section?.name || ad.section;

    // Sponsors
    const sponsors = club?.sponsor ? [club.sponsor] : [];

    // Owner specifics
    const candidatesCount = ad.candidates?.length || 0;
    const statusInfo = ad.isActive 
        ? { text: 'En ligne', color: Colors.primary500 }
        : { text: 'Inactif', color: Colors.neutral500 };

    // Match Score Calculation
    const calculateMatchScore = () => {
        if (isOwner || !userData) return 0;
        
        let score = 50; // Base score (Sport match assumed)

        // Level Match (+25%)
        const userLevelId = userData.bestLevel?.documentId || userData.bestLevel?.id;
        const adLevelId = ad.level?.documentId || ad.level?.id;
        if (userLevelId && adLevelId && userLevelId === adLevelId) {
            score += 25;
        } else if (userData.bestLevel?.name === ad.level?.name) {
             score += 25;
        }

        // Location Match (+15%)
        // Simple string match on City or Geohash prefix
        if (ad.city && userData.city && ad.city.toLowerCase() === userData.city.toLowerCase()) {
            score += 15;
        }

        // Position Match (+10%)
        // Check if user has this position in their profile
        if (userData.position && ad.position && userData.position.toLowerCase() === ad.position.toLowerCase()) {
            score += 10;
        }

        return Math.min(100, score);
    };

    const matchScore = calculateMatchScore();

    // ... (rest of code)

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <Pressable 
                onPress={() => {
                    if (onPress) {
                        onPress(ad);
                    } else {
                        navigation.navigate(RouteNames.RecruitmentAdDetails, { ad });
                    }
                }}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={{ flex: 1 }}
            >
                <ImageBackground
                    source={CARD_BACKGROUND}
                    style={[styles.backgroundImage, StyleSheet.absoluteFill]}
                    resizeMode="cover"
                />
                
                <View style={styles.contentContainer} pointerEvents="box-none">
                    
                    {/* Match Indicator (Top Right) - Only for Players */}
                    {!isOwner && matchScore > 0 && (
                         <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
                            <MatchIndicator score={matchScore} />
                         </View>
                    )}

                    <View pointerEvents="none">
                        {/* Header: Position */}
                        <View style={styles.headerContainer}>
                            <Text style={styles.headerText} numberOfLines={1}>
                                {positionLabel.toUpperCase()}
                            </Text>
                        </View>

                        {/* Club Info */}
                        <View style={styles.clubInfoContainer}>
                             <View style={styles.clubLogoContainer}>
                                {clubLogo ? (
                                    <ProfileAvatar
                                        imageUrl={clubLogo}
                                        size={48}
                                        style={{ borderRadius: 24, borderWidth: 1, borderColor: Colors.neutral200 }}
                                        imageStyle={{ borderRadius: 24 }}
                                    />
                                ) : (
                                    <TeamShield
                                        initials={clubName ? getClubInitials(clubName) : ''}
                                        isSmall
                                        size={48}
                                    />
                                )}
                            </View>
                            <View style={styles.clubTextContainer}>
                                <Text style={styles.clubName} numberOfLines={1}>{clubName}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {team?.name ? <Text style={styles.category} numberOfLines={1}>{team.name}</Text> : null}
                                    {/* Sport Badge if available */}
                                    <View style={{ backgroundColor: Colors.primary500 + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={[Fonts.p4Bold, { color: Colors.primary500, fontSize: 10, textTransform: 'uppercase' }]}>
                                            {ad.sport || team?.sport || 'Football'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Details Grid */}
                        <View style={styles.detailsContainer}>
                            
                            {/* Row 1: Level & Category/Section */}
                            <View style={styles.detailRow}>
                                 {/* Level (Left) */}
                                <View style={styles.detailItem}>
                                    <Image source={Images.filter} style={[styles.icon, { tintColor: Colors.primary500 }]} /> 
                                    <Text style={styles.detailText} numberOfLines={1}>
                                        {levelName}
                                    </Text>
                                </View>
                                {/* Category + Section (Right) */}
                                <View style={[styles.detailItem, { justifyContent: 'flex-end' }]}>
                                    <Image source={Images.users} style={[styles.icon, { tintColor: Colors.neutral300 }]} />
                                    <Text style={[styles.detailText, { textAlign: 'right', flex: 0 }]} numberOfLines={1}>
                                        {categoryName} {sectionName ? `• ${sectionName}` : ''}
                                    </Text>
                                </View>
                            </View>

                            {/* Row 2: Address (Full Width) */}
                             <View style={styles.detailRow}>
                                <View style={[styles.detailItem, { width: '100%' }]}>
                                    <Image source={Images.pin} style={[styles.icon, { tintColor: Colors.primary500 }]} />
                                    <Text style={[styles.detailText, { flex: 1 }]} numberOfLines={2}>
                                        {(typeof ad.address === 'object' ? ad.address?.label : ad.address) || address || 'Lieu non précisé'}
                                    </Text>
                                </View>
                            </View>

                        </View>
                    </View>

                    {/* Footer / CTA */}
                    <View style={[styles.ctaContainer, { zIndex: 999, elevation: 999 }]} pointerEvents="auto">
                        {isOwner ? (
                                <View style={{
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                padding: 8, // Reduced padding to fit height better
                                borderRadius: 12,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                height: 40
                            }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusInfo.color }} />
                                    <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{statusInfo.text}</Text>
                                </View>
                                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
                                    {candidatesCount} candidat{candidatesCount > 1 ? 's' : ''}
                                </Text>
                            </View>
                        ) : (
                            <View
                                style={[
                                    styles.reservationButton,
                                    { backgroundColor: Colors.primary500 }
                                ]}
                            >
                                <Text style={[styles.reservationButtonText, { color: Colors.neutral900 }]}>
                                    Postuler
                                </Text>
                            </View>
                        )}
                    </View>

                </View>
            </Pressable>
        </Animated.View>
    );
};

// Styles copied from EventCardNew.js
const styles = StyleSheet.create({
    container: {
        backgroundColor: '#173844',
        borderRadius: 24,
        overflow: 'hidden',
        minHeight: 200,
        marginVertical: 8,
        width: '100%',
        borderWidth: 1.5,
        borderColor: '#01B3F4', // Electric Blue
    },
    backgroundImage: {
        opacity: 1,
        borderRadius: 24,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        flex: 1,
    },
    headerContainer: {
        width: '100%',
        backgroundColor: '#01B3F4',
        borderRadius: 7,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    headerText: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF', // Colors.neutral00
        textTransform: 'uppercase',
    },
    clubInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8, // Added a bit of spacing
    },
    clubLogoContainer: {},
    clubTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    clubName: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    category: {
        fontFamily: 'Montserrat-Medium',
        fontSize: 14,
        color: '#E0E0E0',
    },
    detailsContainer: {
        gap: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Top align for address wrapping
        gap: 12,
        justifyContent: 'space-between',
        width: '100%',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center', // Icon center with first line of text
        gap: 8,
        flex: 1,
    },
    icon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
        marginTop: 1, // Visual adjustment for text alignment
    },
    detailText: {
        fontFamily: 'Montserrat-Medium',
        fontSize: 13,
        color: '#E0E0E0',
    },
    sponsorsContainer: {
        marginTop: 8,
    },
    sponsorsScroll: {
        gap: 20,
        alignItems: 'center',
    },
    sponsorItem: {
        width: 48,
        alignItems: 'center',
        gap: 4,
    },
    sponsorLogoWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    sponsorLogo: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    sponsorInitial: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#173844',
    },
    sponsorName: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        width: '100%',
    },
    ctaContainer: {
        marginTop: 12,
        width: '100%',
    },
    reservationButton: {
        width: '100%',
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reservationButtonText: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 13,
        fontWeight: 'bold',
    },
});

export default RecruitmentAdCard;
