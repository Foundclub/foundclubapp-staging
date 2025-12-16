import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
    Image,
    ImageBackground,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';
import { getImageUrl } from '@/utils/imageUrl';
import { formatDateWithDayPrefix } from '@/utils/date';
import { getShortAddress } from '@/utils/location';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import { RouteNames } from '@/navigation/routeNames';

// Assets
const BG_MATCH = require('@/assets/background-card-event/card-match.png');
const BG_TRAINING = require('@/assets/background-card-event/card-entrainement.png');
const BG_DETECTION = require('@/assets/background-card-event/card-detection.png');
const BG_RESERVATION = require('@/assets/background-card-event/card-reservation.png');
const BG_OTHER = require('@/assets/background-card-event/card-autre.png');



const getBackgroundImage = (typeName) => {
    const normalizedType = typeName?.toLowerCase() || '';
    if (normalizedType.includes('match')) return BG_MATCH;
    if (normalizedType.includes('entrainement') || normalizedType.includes('entraînement')) return BG_TRAINING;
    if (normalizedType.includes('detection') || normalizedType.includes('détection')) return BG_DETECTION;
    if (normalizedType.includes('réservation') || normalizedType.includes('reservation')) return BG_RESERVATION;
    return BG_OTHER;
};

const getHeaderTitle = (typeName) => {
    const normalizedType = typeName?.toLowerCase() || '';
    if (normalizedType.includes('match')) return 'MATCH';
    if (normalizedType.includes('entrainement') || normalizedType.includes('entraînement')) return 'ENTRAÎNEMENT';
    if (normalizedType.includes('detection') || normalizedType.includes('détection')) return 'DÉTECTION';
    if (normalizedType.includes('réservation') || normalizedType.includes('reservation')) return 'RÉSERVATION';
    return typeName?.toUpperCase() || 'ÉVÈNEMENT';
};

/**
 * Event Card component (New Design)
 * @param {object} props
 * @param {FCEvent} props.item
 * @param {Function} props.onPress
 * @param {Function} props.onJoin
 * @param {Function} props.onDecline
 * @param {Function} props.onParticipate
 * @param {Function} props.onLogin
 * @param {string} [props.actionLabel] - Custom label for the action button (used in reservations)
 */
function EventCardNew({
    item,
    onPress,
    onJoin,
    onDecline,
    onParticipate,
    onLogin,
    onValidate,
    onRefuse,
    actionLabel,
    showClubHeader = false,
}) {
    const {
        Alignments,
        ApplicationStyle,
        Colors,
        Fonts,
        Images,
        Spaces,
    } = useTheme();
    const { t } = useTranslation();
    const { getClubInitials } = useClub();

    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = () => {
        scale.value = withTiming(0.98, { duration: 100 });
        opacity.value = withTiming(0.9, { duration: 100 });
    };

    const handlePressOut = () => {
        scale.value = withTiming(1, { duration: 100 });
        opacity.value = withTiming(1, { duration: 100 });
    };

    const typeName = item?.type?.name || '';
    const isReservation = typeName.toLowerCase().includes('réservation') || typeName.toLowerCase().includes('reservation');
    const backgroundImage = getBackgroundImage(typeName);
    const headerTitle = getHeaderTitle(typeName);

    // Sponsors
    const sponsors = item?.club?.sponsor || item?.team?.club?.sponsor || [];

    // Location - check facility first (club installation), then other options
    const locationText = 
        item?.facility?.name ||
        getShortAddress(item?.locationDetails) ||
        getShortAddress(item?.club?.addressDetails) ||
        getShortAddress(item?.team?.club?.addressDetails) ||
        getShortAddress(item?.location) ||
        null;

    // Sport/Activity
    const sportName = item?.team?.activities?.map(({ name }) => name)?.join(', ') || item?.type?.name || 'Sport';

    const clubName = item?.team?.club?.name || item?.club?.name || 'FoundClub';
    const clubLogo = item?.team?.club?.logo?.url || item?.club?.logo?.url;
    const category = item?.team?.name || ''; // Using team name as category/level

    return (

        <Animated.View style={[styles.container, animatedStyle]}>
            {/* Background Image */}
            <ImageBackground
                source={backgroundImage}
                style={StyleSheet.absoluteFill}
                imageStyle={styles.backgroundImage}
                resizeMode="cover"
            />

            {/* Main Card Pressable (Background) */}
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => onPress?.(item)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            />

            {/* Content Container */}
            <View style={styles.contentContainer} pointerEvents="box-none">

                {/* Non-interactive Content (Passes touches to background Pressable) */}
                <View pointerEvents="none">
                    {/* Header: Event Type */}
                    <View style={styles.headerContainer}>
                        <Text style={styles.headerText}>{headerTitle}</Text>
                    </View>

                    {/* Club / Team Info */}
                    <View style={styles.clubInfoContainer}>
                        <View style={styles.clubLogoContainer}>
                            {clubLogo ? (
                                <ProfileAvatar
                                    imageUrl={clubLogo}
                                    size={40}
                                    style={{ borderRadius: 20 }}
                                    imageStyle={{ borderRadius: 20 }}
                                />
                            ) : (
                                <TeamShield
                                    initials={clubName ? getClubInitials(clubName) : ''}
                                    isSmall
                                    size={40}
                                />
                            )}
                        </View>
                        <View style={styles.clubTextContainer}>
                            <Text style={[styles.clubName, showClubHeader && { fontSize: 20 }]} numberOfLines={1}>{clubName}</Text>
                            {category ? <Text style={styles.category} numberOfLines={1}>{category}</Text> : null}
                        </View>
                    </View>

                    {/* Date + Time (Hidden for reservations as it's in details) */}
                    {item?.date && !isReservation && (
                        <View style={styles.dateTimeContainer}>
                            <Text style={styles.dateText}>
                                {format(new Date(item.date), 'EEE dd MMMM yyyy', { locale: fr }).toUpperCase()}
                            </Text>
                            <Text style={styles.timeText}>
                                {item.startTime && item.endTime
                                    ? `${item.startTime.substring(0, 5)} - ${item.endTime.substring(0, 5)}`
                                    : format(new Date(item.date), 'HH:mm')}
                            </Text>
                        </View>
                    )}

                    {/* Location + Sport (or Price for Reservation) */}
                    <View style={styles.detailsContainer}>
                        {isReservation ? (
                            <>
                                {/* Line 1: Price + Max Participants | Sport */}
                                <View style={styles.detailRow}>
                                    <View style={styles.detailLeft}>
                                        <Image source={Images.euroCircle} style={styles.icon} />
                                        <Text style={styles.detailText} numberOfLines={1}>
                                            {item.pricePerPerson !== undefined ? `${item.pricePerPerson}€` : ''}
                                            {item.totalPlayers ? ` - ${item.totalPlayers} personnes` : ''}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRight}>
                                        <Image source={Images.running} style={styles.icon} />
                                        <Text style={styles.detailText} numberOfLines={1}>
                                            {item.activity?.name || sportName}
                                        </Text>
                                    </View>
                                </View>

                                {/* Line 2: Time Range | Date */}
                                <View style={styles.detailRow}>
                                    <View style={styles.detailLeft}>
                                        <Image source={Images.clock} style={styles.icon} />
                                        <Text style={styles.detailText} numberOfLines={1}>
                                            {item.startTime && item.endTime ? `${item.startTime.substring(0, 5)} - ${item.endTime.substring(0, 5)}` : (item.startTime || '')}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRight}>
                                        <Image source={Images.calendar} style={styles.icon} />
                                        <Text style={styles.detailText} numberOfLines={1}>
                                            {item.date ? format(new Date(item.date), 'EEE dd MMMM yyyy', { locale: fr }).toUpperCase() : ''}
                                        </Text>
                                    </View>
                                </View>

                                {/* Line 3: Location */}
                                <View style={styles.detailRow}>
                                    <Image source={Images.pin} style={styles.icon} />
                                    <Text style={styles.detailText} numberOfLines={1}>
                                        {locationText || 'Lieu non défini'}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <>
                                {/* Standard Event Layout */}
                                <View style={styles.detailRow}>
                                    <View style={styles.detailLeft}>
                                        <Image source={Images.pin} style={styles.icon} />
                                        <Text style={styles.detailText} numberOfLines={1}>
                                            {locationText || 'Lieu non défini'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRightStandard}>
                                        <Image source={Images.running} style={styles.icon} />
                                        <Text style={[styles.detailText, { textAlign: 'right', flex: 0 }]} numberOfLines={1}>{sportName}</Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>

                    {/* Sponsors */}
                    {sponsors.length > 0 && (
                        <View style={styles.sponsorsContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sponsorsScroll}>
                                {sponsors.map((sponsor, index) => (
                                    <View key={sponsor.documentId || sponsor.id || index} style={styles.sponsorItem}>
                                        <View style={styles.sponsorLogoWrapper}>
                                            {sponsor.logo?.url ? (
                                                <Image
                                                    source={{ uri: getImageUrl(sponsor.logo.url) }}
                                                    style={styles.sponsorLogo}
                                                />
                                            ) : (
                                                <Text style={styles.sponsorInitial}>
                                                    {sponsor.title ? sponsor.title.charAt(0).toUpperCase() : '?'}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.sponsorName} numberOfLines={1}>
                                            {sponsor.title}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* CTA - Interactive (Captures touches) */}
                <View style={[styles.ctaContainer, { zIndex: 999, elevation: 999 }]} pointerEvents="auto">
                    {onValidate && onRefuse ? (
                        <View style={{ flexDirection: 'row', gap: 10, zIndex: 999, elevation: 999 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    console.log('Valider pressed for item:', item?.documentId);
                                    onValidate && onValidate(item);
                                }}
                                style={[styles.reservationButton, { flex: 1, backgroundColor: Colors.primary500 }]}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.reservationButtonText}>Valider</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    console.log('Refuser pressed for item:', item?.documentId);
                                    onRefuse && onRefuse(item);
                                }}
                                style={[
                                    styles.reservationButton,
                                    {
                                        flex: 1,
                                        backgroundColor: 'transparent',
                                        borderWidth: 1,
                                        borderColor: Colors.error500
                                    }
                                ]}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.reservationButtonText, { color: Colors.error500 }]}>Refuser</Text>
                            </TouchableOpacity>
                        </View>
                    ) : isReservation ? (
                        <Pressable
                            onPress={() => onParticipate?.(item)}
                            style={styles.reservationButton}
                        >
                            <Text style={styles.reservationButtonText}>
                                {actionLabel || t('reservation.actions.participate') || 'Réserver'}
                            </Text>
                        </Pressable>
                    ) : (
                        <EventAnswerButtons
                            event={item}
                            onAbout={() => onPress?.(item)}
                            onDecline={() => onDecline?.(item)}
                            onJoin={() => onJoin?.(item)}
                            onLogin={onLogin}
                            onParticipate={() => onParticipate?.(item)}
                        />
                    )}
                </View>

            </View>
        </Animated.View>
    );

}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#173844',
        borderRadius: 24,
        overflow: 'hidden',
        minHeight: 200, // Flexible height
    },
    backgroundImage: {
        opacity: 1,
        borderRadius: 24,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 8,
        // Add a dark overlay on top of the background image for better contrast
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        flex: 1,
    },
    headerContainer: {
        width: '100%',
        borderWidth: 3,
        borderColor: '#01B3F4',
        borderRadius: 7,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    headerText: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#01B3F4',
        textTransform: 'uppercase',
    },
    clubInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    clubLogoContainer: {
        // Optional: Add specific styling for the logo container if needed
    },
    clubTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    clubName: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 18, // Slightly larger
        fontWeight: '800', // Extra bold
        color: '#FFFFFF',
    },
    category: {
        fontFamily: 'Montserrat-Medium', // Medium weight
        fontSize: 14,
        color: '#E0E0E0', // Slightly lighter than white
    },
    dateTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 8,
    },
    dateText: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    timeText: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    detailsContainer: {
        gap: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'space-between',
    },
    detailLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    detailRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'flex-end',
    },
    detailRightStandard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'flex-end',
    },
    icon: {
        width: 18, // Slightly smaller icons
        height: 18,
        tintColor: '#FFFFFF',
        resizeMode: 'contain',
    },
    detailText: {
        fontFamily: 'Montserrat-Medium', // Medium weight
        fontSize: 13, // Slightly smaller
        color: '#F0F0F0',
        flex: 1,
    },
    sponsorsContainer: {
        marginTop: 8,
        borderTopWidth: 0,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
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
        marginTop: 12, // More space
        width: '100%',
    },
    reservationButton: {
        width: '100%',
        height: 40, // Reduced height
        backgroundColor: '#01B3F4',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reservationButtonText: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 13,
        fontWeight: 'bold',
        color: '#001218',
    },
});

export default EventCardNew;
