import React, { useCallback } from 'react';
import { FlatList, RefreshControl, View, Text, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import { RouteNames } from '@/navigation/routeNames';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { useGetClubClaimsRequestList } from '@/services/admin/adminQueries';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import Button from '@/components/atoms/button/Button';
import { useApproveClubClaim, useRefuseClubClaim } from '@/services/admin/adminQueries'; // Need mutations here

const AdminClaimList = () => {
    const { Colors, Fonts, Spaces, ApplicationStyle, Alignments } = useTheme();
    const navigation = useNavigation();
    const { t } = useTranslation();

    const {
        data,
        isLoading,
        refetch,
    } = useGetClubClaimsRequestList();

    const approveMutation = useApproveClubClaim();
    const refuseMutation = useRefuseClubClaim();

    const requests = data?.data || [];

    const handleApprove = (item) => {
        approveMutation.mutate(item.documentId, {
             onSuccess: () => refetch() // Refresh list
        });
    };

    const handleReject = (item) => {
         refuseMutation.mutate(item.documentId, {
             onSuccess: () => refetch()
         });
    };

    const renderItem = ({ item }) => {
        const user = item.user;
        const club = item.club;
        const date = new Date(item.createdAt).toLocaleDateString();
        
        return (
            <View
                style={[
                    ApplicationStyle.card,
                    Spaces.padding[16],
                    Spaces.marginBottom[16],
                    { borderLeftWidth: 4, borderLeftColor: Colors.warning500 }
                ]}
            >
                <TouchableOpacity 
                    onPress={() => navigation.navigate(RouteNames.AdminClaimDetail, { requestId: item.documentId })}
                    style={[Alignments.row, Alignments.alignStart]}
                >
                    {/* User Avatar */}
                    <ProfileAvatar
                        size={50}
                        imageUrl={user?.avatar?.url}
                    />
                    
                    <View style={[Spaces.marginLeft[12], { flex: 1 }]}>
                        <Text style={[Fonts.h4Black, { color: Colors.neutral00 }]}>
                            {user?.firstname} {user?.lastname}
                        </Text>
                        <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[4]]}>
                            Revendique : <Text style={[{ color: Colors.primary500, fontWeight: 'bold' }]}>{club?.name}</Text>
                        </Text>
                         <Text style={[Fonts.small, {color: Colors.neutral300, marginTop: 4}]}>
                             📅 {date} • {club?.city}
                         </Text>
                    </View>
                </TouchableOpacity>

                {/* Actions */}
                <View style={[Alignments.row, Spaces.gap[16], Spaces.marginTop[16]]}>
                    <View style={{ flex: 1 }}>
                        <Button
                            title="Refuser"
                            variant="Secondary"
                            onPress={() => handleReject(item)}
                            isLoading={refuseMutation.isPending && refuseMutation.variables === item.documentId}
                            style={{ borderColor: Colors.error500 }}
                            textStyle={{ color: Colors.error500 }}
                            size="small" // Assuming small size exists or fits better
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Button
                            title="Accepter"
                            variant="Primary"
                            onPress={() => handleApprove(item)}
                            isLoading={approveMutation.isPending && approveMutation.variables === item.documentId}
                            size="small"
                        />
                    </View>
                </View>
            </View>
        );
    };

    return (
        <ScreenContainer bgImage="bg2" title="Revendications en attente">
             <FlatList
                data={requests}
                renderItem={renderItem}
                keyExtractor={(item) => item.documentId}
                contentContainerStyle={[Spaces.padding[16]]}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary500} />
                }
                ListEmptyComponent={
                    !isLoading && (
                        <View style={[Alignments.center, Spaces.marginTop[40]]}>
                             <Text style={[Fonts.h4, Fonts.neutral200]}>Aucune demande en attente</Text>
                             <Text style={[Fonts.p2, Fonts.neutral500, Spaces.marginTop[8], {textAlign: 'center'}]}>
                                 Les demandes de revendication de club apparaîtront ici.
                             </Text>
                        </View>
                    )
                }
            />
        </ScreenContainer>
    );
};

export default AdminClaimList;
