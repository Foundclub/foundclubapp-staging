import React, { useLayoutEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Share,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteRecruitmentAd, getRecruitmentAd } from '@/services/recruitment/recruitmentService';

import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';
import { formatDateWithDayPrefix } from '@/utils/date';

import ScreenContainer from '@/components/templates/ScreenContainer';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import Tag from '@/components/atoms/tag/Tag';
import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

// Assets (Same as EventDetails/RecruitmentAdCard)
const BG_MATCH = require('@/assets/background-card-event/card-match.png');
const BG_TRAINING = require('@/assets/background-card-event/card-entrainement.png');
const BG_OTHER = require('@/assets/background-card-event/card-autre.png');

// Get background based on sport/context (simplified logic)
const getBackgroundImage = (sport) => {
    // Could eventually depend on sport
    return BG_MATCH; 
};

const RecruitmentAdDetails = () => {
    const { params } = useRoute();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { Colors, Fonts, Spaces, Alignments } = useTheme();
    const { userData } = useAuth();
    const { getClubInitials } = useClub();
    const queryClient = useQueryClient();
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

    // Get adId from params (handle both full object or just ID)
    const adId = params?.ad?.documentId || params?.adId || params?.ad?.id;

    // Fetch fresh ad details
    const { data: fetchedAd, isLoading } = useQuery({
        queryKey: ['recruitmentAd', adId],
        queryFn: () => getRecruitmentAd(adId),
        enabled: !!adId,
        initialData: params?.ad, // Show passed data immediately while fetching
    });

    const ad = fetchedAd || params?.ad;
    const isOwner = useMemo(() => {
        if (!userData || !ad) return false;
        
        // 1. Direct Author check
        if (ad.author?.documentId === userData.documentId || ad.author?.id === userData.id) return true;
        
        // 2. Team Managment check (Coach/Manager)
        const myTeams = userData.myTeams || [];
        const trainedTeams = userData.trainedTeams || [];
        const allUserTeams = [...myTeams, ...trainedTeams];
        
        const adTeamId = ad.team?.documentId || ad.team?.id;
        if (!adTeamId) return false;

        return allUserTeams.some(t => t.documentId === adTeamId || t.id === adTeamId);
    }, [userData, ad]);

    const deleteMutation = useMutation({
        mutationFn: deleteRecruitmentAd,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
            queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
            setIsDeleteModalVisible(false);
            navigation.goBack();
        },
        onError: (error) => {
            console.error("Error deleting ad:", error);
            setIsDeleteModalVisible(false);
        }
    });

    const confirmDelete = () => {
        deleteMutation.mutate(ad.documentId);
    };

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: '',
            headerTransparent: true,
            headerTintColor: Colors.neutral100,
        });
    }, [navigation, Colors]);

    if (!ad) {
        return (
            <ScreenContainer>
                <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
                    <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>Annonce introuvable</Text>
                </View>
            </ScreenContainer>
        );
    }

    // Data Extraction & Formatting
    const team = ad.team;
    const club = team?.club;
    const clubName = club?.name || team?.name || 'Club inconnu';
    // Simplified logic for audit fix - assuming club logo is enough or ad specific image
    const clubLogo = getImageUrl(club?.logo?.url);
    const positionLabel = ad.position || 'Poste non spécifié';
    const levelName = ad.level?.name || ad.minLevel || 'Niveau ?';
    const categoryName = ad.category?.name || ad.category || 'Catégorie ?';
    const address = getShortAddress(ad.city || club?.city || '');
    const sectionName = ad.section?.name || ad.section;
    const date = ad.createdAt ? formatDateWithDayPrefix(new Date(ad.createdAt)) : '';

    // Actions
    const handleViewCandidates = () => {
        Alert.alert("Candidatures", "Liste des candidats à venir.");
        // navigation.navigate('RecruitmentCandidates', { adId: ad.documentId });
    };

    const handleApply = () => {
        Alert.alert("Postuler", "Fonctionnalité en cours de développement (bientôt disponible !)");
    };

    const handleEdit = () => {
         navigation.navigate('RecruitmentAdEdit', { adId: ad.documentId, ad });
    };

    const handleDelete = () => {
        setIsDeleteModalVisible(true);
    };

    return (
        <ScreenContainer 
            bgImage="bg2" 
            contentContainerStyle={[Alignments.fill, Alignments.justifySpaceBetween]}
        >
             <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                 {/* Header Image */}
                <ImageBackground
                    source={getBackgroundImage(club?.sport)}
                    style={[
                        styles.headerImage, 
                        { 
                            borderColor: Colors.primary500, 
                            borderWidth: 1.5,
                            shadowColor: Colors.primary500,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.4,
                            shadowRadius: 10,
                            elevation: 10
                        }
                    ]}
                    resizeMode="cover"
                >
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                    <LinearGradient 
                        colors={['transparent', 'rgba(0,0,0,0.9)']} 
                        style={StyleSheet.absoluteFill} 
                    />

                    <View style={styles.headerContent}>
                         {/* Club Shield */}
                        <View style={[styles.shieldContainer, { shadowColor: Colors.primary500 }]}>
                             {clubLogo ? (
                                <ImageBackground
                                    source={{ uri: clubLogo }}
                                    style={styles.clubLogo}
                                    imageStyle={{ borderRadius: 50 }}
                                />
                            ) : (
                                <View style={{ transform: [{ scale: 1.5 }] }}>
                                    <TeamShield
                                        initials={getClubInitials(clubName)}
                                    />
                                </View>
                            )}
                        </View>

                        {/* Title & Club */}
                        <Text style={[Fonts.h1, { color: Colors.neutral100, textAlign: 'center', marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }]}>
                            {positionLabel}
                        </Text>
                        <Text style={[Fonts.h3, { color: Colors.primary500, textAlign: 'center', marginTop: 4, fontWeight: '700' }]}>
                            {clubName}
                        </Text>
                        {team?.name && (
                             <Text style={[Fonts.p1, { color: Colors.neutral300, textAlign: 'center', marginTop: 2 }]}>
                                {team.name} {sectionName ? `• ${sectionName}` : ''}
                            </Text>
                        )}
                        
                        {/* Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: ad.isActive ? 'rgba(0, 179, 244, 0.2)' : 'rgba(100,100,100,0.2)', borderColor: ad.isActive ? Colors.primary500 : Colors.neutral500 }]}>
                            <Text style={[Fonts.captionBold, { color: ad.isActive ? Colors.primary500 : Colors.neutral400 }]}>
                                {ad.isActive ? 'EN LIGNE' : 'INACTIF'}
                            </Text>
                        </View>
                    </View>
                </ImageBackground>

                {/* Info Bar */}

                {/* Info Bar */}
                {/* Info Bar */}
                <View style={[
                    styles.infoBar, 
                    { 
                        borderColor: Colors.primary500, 
                        borderWidth: 1.5,
                        shadowColor: Colors.primary500,
                        shadowOpacity: 0.5, 
                        shadowRadius: 12,
                        elevation: 10 
                    }
                ]}>
                    <View style={styles.infoItem}>
                        <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Publié le</Text>
                         <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>{date}</Text>
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.infoItem}>
                        <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Niveau</Text>
                         <Text 
                            style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}
                            numberOfLines={2}
                        >
                            {levelName}
                        </Text>
                    </View>
                    <View style={styles.separator} />
                     <View style={styles.infoItem}>
                        <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Catégorie</Text>
                         <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>{categoryName}</Text>
                    </View>
                </View>

                 {/* Main Content */}
                 <View style={[Spaces.paddingHorizontal[16], Spaces.paddingTop[24]]}>
                    
                    {/* Tags */}
                    <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8, marginBottom: 24 }]}>
                         {address && <Tag text={address} textColor="neutral100" textStyle={{ fontWeight: '600' }} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'transparent' }} />}
                    </View>

                    {/* Owner Section: Applications */}
                    {isOwner && (
                        <View style={{ marginBottom: 32 }}>
                            <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 16 }]}>
                                Candidatures ({ad.applications?.length || 0})
                            </Text>
                            {ad.applications?.length > 0 ? (
                                <View>
                                    {/* Preview of first few candidates could go here */}
                                    <Button 
                                        title="Voir les candidats" 
                                        variant="Primary" 
                                        onPress={handleViewCandidates}
                                        style={{ backgroundColor: Colors.primary500 }}
                                    />
                                </View>
                            ) : (
                                <View style={{ padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, alignItems: 'center' }}>
                                    <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Aucune candidature pour le moment.</Text>
                                </View>
                            )}
                        </View>
                    )}



                    {/* Description */}
                    <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 16 }]}>Description</Text>
                    <Text style={[Fonts.p1, { color: Colors.neutral300, lineHeight: 26 }]}>
                        {ad.description || "Aucune description fournie pour cette annonce."}
                    </Text>

                 </View>
             </ScrollView>

             {/* Footer Actions (Floating) */}
             <View style={styles.footer}>
                 {isOwner ? (
                     <View>
                         <View style={{ marginBottom: 12 }}>
                             <Button 
                                title="Modifier" 
                                variant="Primary" 
                                onPress={handleEdit}
                             />
                         </View>
                         <View>
                             <Button 
                                title="Supprimer" 
                                variant="Secondary" 
                                onPress={handleDelete}
                                textStyle={{ color: '#FF3B30' }}
                                style={{ 
                                    borderColor: '#FF3B30',
                                    borderWidth: 2, 
                                    backgroundColor: 'transparent',
                                    marginTop: 4
                                }}
                             />
                         </View>
                     </View>
                 ) : (
                     <Button 
                        title="Postuler"
                        variant="Primary" 
                        onPress={handleApply}
                     />
                 )}
             </View>

             <BottomModal
                isVisible={isDeleteModalVisible}
                close={() => setIsDeleteModalVisible(false)}
                height={250}
             >
                <View style={Spaces.gap[12]}>
                    <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 8, textAlign: 'center' }]}>
                        Supprimer l'annonce
                    </Text>
                    <Text style={[Fonts.p1, { color: Colors.neutral300, marginBottom: 24, textAlign: 'center' }]}>
                        Voulez-vous vraiment supprimer cette annonce ? Cette action est irréversible.
                    </Text>
                    
                    <View style={{ gap: 12 }}>
                        <Button 
                            title="Supprimer" 
                            variant="Primary" 
                            onPress={confirmDelete}
                            style={{ backgroundColor: '#FF3B30' }}
                            isLoading={deleteMutation.isPending}
                        />
                        <Button 
                            title="Annuler" 
                            variant="Secondary" 
                            onPress={() => setIsDeleteModalVisible(false)}
                        />
                    </View>
                </View>
             </BottomModal>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    headerImage: {
        width: '100%',
        height: 380, // slightly taller for better spacing
        justifyContent: 'flex-end',
        borderRadius: 32, // Large radius for modern look
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginTop: 4,
    },
    headerContent: {
        padding: 24,
        alignItems: 'center',
        paddingBottom: 40, // Space for overlap
    },
    shieldContainer: {
        // shadowColor set dynamically
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
        marginBottom: 16,
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.2)' // Subtle backing
    },
    clubLogo: {
        width: 100, // Larger logo
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#FFFFFF', // White border for pop
    },
    statusBadge: {
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    infoBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 24,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(20, 20, 20, 0.95)', // Deep dark with slight transparency
        marginBottom: 8,
        marginHorizontal: 16,
        borderRadius: 24, // softer corners
        marginTop: -30, // More overlap
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)', // Subtle highlight
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    infoItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    separator: {
        width: 1,
        height: '60%',
        backgroundColor: '#444',
        alignSelf: 'center',
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 0 : 20, // Adjust bottom padding since ScreenContainer handles safe area logic or flex
        // No background, no border, just padding/spacing
    },
    modalContent: {
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
    }
});

export default RecruitmentAdDetails;
