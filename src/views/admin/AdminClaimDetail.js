import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import { useGetClubClaimRequest, useApproveClubClaim, useRefuseClubClaim } from '@/services/admin/adminQueries';
import Loader from '@/components/atoms/loader/Loader';

const AdminClaimDetail = () => {
    const { Colors, Fonts, Spaces, ApplicationStyle, Alignments } = useTheme();
    const route = useRoute();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { requestId } = route.params || {};

    const { data: request, isLoading } = useGetClubClaimRequest(requestId);
    const approveMutation = useApproveClubClaim();
    const refuseMutation = useRefuseClubClaim();

    const user = request?.data?.user;
    const club = request?.data?.club;

    const handleApprove = () => {
        Alert.alert(
            "Confirmer",
            "Voulez-vous vraiment accepter cette demande ? L'utilisateur deviendra PROPRIÉTAIRE du club.",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Accepter", 
                    onPress: () => {
                        approveMutation.mutate(requestId, {
                            onSuccess: () => {
                                Alert.alert("Succès", "Demande acceptée.");
                                navigation.goBack();
                            },
                            onError: (err) => {
                                Alert.alert("Erreur", err.message || "Une erreur est survenue");
                            }
                        });
                    } 
                }
            ]
        );
    };

    const handleRefuse = () => {
        Alert.alert(
            "Refuser",
            "Voulez-vous rejeter cette demande ?",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Rejeter", 
                    style: "destructive",
                    onPress: () => {
                        refuseMutation.mutate(requestId, {
                            onSuccess: () => {
                                Alert.alert("Succès", "Demande rejetée.");
                                navigation.goBack();
                            },
                            onError: (err) => {
                                Alert.alert("Erreur", err.message || "Une erreur est survenue");
                            }
                        });
                    } 
                }
            ]
        );
    };

    if (isLoading) return <Loader />;

    if (!request) return (
        <ScreenContainer>
            <View style={Alignments.center}>
                <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>Demande introuvable</Text>
            </View>
        </ScreenContainer>
    );

    return (
        <ScreenContainer bgImage="bg2" title="Détails de la demande" contentContainerStyle={Spaces.padding[16]}>
            <ScrollView>
                {/* User Section */}
                <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
                    <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>Demandeur</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ProfileAvatar size={60} imageUrl={user?.avatar?.url} />
                        <View style={Spaces.marginLeft[16]}>
                            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{user?.firstname} {user?.lastname}</Text>
                            <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>{user?.email}</Text>
                            <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>{user?.phoneNumber}</Text>
                        </View>
                    </View>
                </View>

                {/* Club Section */}
                <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.marginBottom[16]]}>
                    <Text style={[Fonts.h3, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>Club Revendiqué</Text>
                     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ProfileAvatar size={60} imageUrl={club?.logo?.url} />
                        <View style={Spaces.marginLeft[16]}>
                            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{club?.name}</Text>
                            <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>{club?.city} ({club?.postalCode})</Text>
                        </View>
                    </View>
                </View>

                {/* Actions */}
                <View style={[Spaces.marginTop[24]]}>
                    <TouchableOpacity
                        style={[ApplicationStyle.button.primary, Spaces.marginBottom[12], { backgroundColor: Colors.success500 }]}
                        onPress={handleApprove}
                        disabled={approveMutation.isPending}
                    >
                         <Text style={[Fonts.button, { color: 'white' }]}>
                             {approveMutation.isPending ? "Traitement..." : "Accepter la demande"}
                         </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[ApplicationStyle.button.secondary, { borderColor: Colors.error500 }]}
                        onPress={handleRefuse}
                        disabled={refuseMutation.isPending}
                    >
                        <Text style={[Fonts.button, { color: Colors.error500 }]}>Refuser</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
};

export default AdminClaimDetail;
