import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import { useGetAdminUser, useUpdateAdminUser } from '@/services/admin/adminQueries';
import { useGetRoles } from '@/services/auth/authQueries';

const AdminUserDetail = () => {
    const { Colors, Fonts, Spaces, ApplicationStyle, Alignments } = useTheme();
    const route = useRoute();
    const navigation = useNavigation();
    const { userId } = route.params || {};

    console.log('[AdminUserDetail] userId received:', userId);

    const { data: userData, isLoading, error } = useGetAdminUser(userId);
    const { data: rolesData } = useGetRoles();
    const updateMutation = useUpdateAdminUser();

    console.log('[AdminUserDetail] userData:', userData, 'error:', error);

    const user = userData;  // users-permissions returns user directly, not wrapped in data
    const roles = rolesData?.roles || rolesData || [];

    const [selectedRole, setSelectedRole] = useState(null);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        if (user) {
            setSelectedRole(user.role?.id || user.role);
            setIsBlocked(user.blocked || false);
        }
    }, [user]);

    const handleSave = () => {
        Alert.alert(
            "Confirmer",
            "Voulez-vous sauvegarder les modifications ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Sauvegarder",
                    onPress: () => {
                        updateMutation.mutate(
                            {
                                documentId: userId,
                                data: {
                                    role: selectedRole,
                                    blocked: isBlocked,
                                },
                            },
                            {
                                onSuccess: () => {
                                    Alert.alert("Succès", "Utilisateur mis à jour");
                                    navigation.goBack();
                                },
                                onError: (err) => {
                                    Alert.alert("Erreur", err?.message || "Une erreur est survenue");
                                },
                            }
                        );
                    },
                },
            ]
        );
    };

    if (isLoading) return <Loader />;

    if (!user) {
        return (
            <ScreenContainer bgImage="bg2">
                <View style={[Alignments.alignCenter, Alignments.justifyCenter, { flex: 1 }]}>
                    <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>Utilisateur introuvable</Text>
                </View>
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer bgImage="bg2">
            <ScrollView contentContainerStyle={[Spaces.padding[16]]} showsVerticalScrollIndicator={false}>
                {/* User Info Card */}
                <View style={[
                    ApplicationStyle.backgroundColor.neutral800,
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[24],
                    Spaces.marginBottom[16]
                ]}>
                    <View style={[Alignments.row, Alignments.alignCenter]}>
                        <ProfileAvatar size={80} imageUrl={user.avatar?.url} />
                        <View style={[Spaces.marginLeft[16], { flex: 1 }]}>
                            <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
                                {user.firstname} {user.lastname}
                            </Text>
                            <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>{user.email}</Text>
                            {user.phoneNumber && (
                                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{user.phoneNumber}</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Club Info */}
                {user.club && (
                    <View style={[
                        ApplicationStyle.backgroundColor.neutral800,
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[16],
                        Spaces.marginBottom[16]
                    ]}>
                        <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>Club Associé</Text>
                        <View style={[Alignments.row, Alignments.alignCenter]}>
                            <ProfileAvatar size={40} imageUrl={user.club.logo?.url} />
                            <Text style={[Fonts.p1, { color: Colors.neutral00 }, Spaces.marginLeft[12]]}>
                                {user.club.name}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Role Selection */}
                <View style={[
                    ApplicationStyle.backgroundColor.neutral800,
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[16],
                    Spaces.marginBottom[16]
                ]}>
                    <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>Rôle</Text>
                    <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
                        {Array.isArray(roles) && roles.map((role) => (
                            <TouchableOpacity
                                key={role.id}
                                style={[
                                    Spaces.paddingVertical[8],
                                    Spaces.paddingHorizontal[12],
                                    { 
                                        borderRadius: 8,
                                        backgroundColor: selectedRole === role.id ? Colors.primary500 : 'transparent',
                                        borderWidth: 1,
                                        borderColor: selectedRole === role.id ? Colors.primary500 : Colors.neutral300,
                                    },
                                ]}
                                onPress={() => setSelectedRole(role.id)}
                            >
                                <Text style={{ color: selectedRole === role.id ? 'white' : Colors.neutral300 }}>
                                    {role.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Block/Unblock */}
                <View style={[
                    ApplicationStyle.backgroundColor.neutral800,
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[16],
                    Spaces.marginBottom[24]
                ]}>
                    <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[12]]}>Statut du Compte</Text>
                    <View style={[Alignments.row, Spaces.gap[12]]}>
                        <TouchableOpacity
                            style={[
                                Spaces.paddingVertical[12],
                                Spaces.paddingHorizontal[16],
                                { 
                                    borderRadius: 8, 
                                    flex: 1, 
                                    alignItems: 'center',
                                    backgroundColor: !isBlocked ? Colors.success500 : 'transparent',
                                    borderWidth: 1,
                                    borderColor: !isBlocked ? Colors.success500 : Colors.neutral300,
                                },
                            ]}
                            onPress={() => setIsBlocked(false)}
                        >
                            <Text style={{ color: !isBlocked ? 'white' : Colors.neutral300, fontWeight: 'bold' }}>
                                ✓ Actif
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                Spaces.paddingVertical[12],
                                Spaces.paddingHorizontal[16],
                                { 
                                    borderRadius: 8, 
                                    flex: 1, 
                                    alignItems: 'center',
                                    backgroundColor: isBlocked ? Colors.error500 : 'transparent',
                                    borderWidth: 1,
                                    borderColor: isBlocked ? Colors.error500 : Colors.neutral300,
                                },
                            ]}
                            onPress={() => setIsBlocked(true)}
                        >
                            <Text style={{ color: isBlocked ? 'white' : Colors.neutral300, fontWeight: 'bold' }}>
                                ✕ Bloqué
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Save Button */}
                <Button
                    title="Sauvegarder"
                    variant="Primary"
                    onPress={handleSave}
                    isLoading={updateMutation.isPending}
                />
            </ScrollView>
        </ScreenContainer>
    );
};

export default AdminUserDetail;
