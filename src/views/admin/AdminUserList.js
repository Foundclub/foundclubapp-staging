import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, RefreshControl, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import useTheme from '@/theme/themeContext';
import { RouteNames } from '@/navigation/routeNames';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import { useGetAdminUsers } from '@/services/admin/adminQueries';

const AdminUserList = () => {
    const { Colors, Fonts, Spaces, ApplicationStyle, Alignments } = useTheme();
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Simple debounce
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const {
        data,
        isLoading,
        refetch,
    } = useGetAdminUsers({ q: debouncedSearch });

    const users = data?.data || data || [];

    const getRoleBadgeColor = (roleType) => {
        switch (roleType) {
            case 'admin': return Colors.error500;
            case 'superadmin': return Colors.error500;
            case 'dirigeant': return Colors.primary500;
            case 'entraineur': return Colors.warning500;
            case 'joueur': return Colors.success500;
            default: return Colors.neutral300;
        }
    };

    const renderItem = useCallback(({ item }) => {
        const role = item.role;
        const club = item.club;
        
        return (
            <TouchableOpacity
                style={[
                    ApplicationStyle.backgroundColor.neutral800,
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[16],
                    Spaces.marginBottom[12],
                ]}
                onPress={() => navigation.navigate(RouteNames.AdminUserDetail, { userId: item.id })}
            >
                <View style={[Alignments.row, Alignments.alignCenter]}>
                    <ProfileAvatar size={50} imageUrl={item.avatar?.url} />
                    
                    <View style={[Spaces.marginLeft[12], { flex: 1 }]}>
                        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
                            {item.firstname} {item.lastname}
                        </Text>
                        <Text style={[Fonts.p2, { color: Colors.neutral300 }]} numberOfLines={1}>
                            {item.email}
                        </Text>
                        <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginTop[4], Spaces.gap[8]]}>
                            {role && (
                                <View style={[
                                    Spaces.paddingHorizontal[8],
                                    Spaces.paddingVertical[4],
                                    { backgroundColor: getRoleBadgeColor(role.type), borderRadius: 4 }
                                ]}>
                                    <Text style={[Fonts.p2, { color: 'white', fontSize: 12 }]}>{role.name}</Text>
                                </View>
                            )}
                            {club && (
                                <Text style={[Fonts.p2, { color: Colors.neutral300, fontSize: 12 }]}>
                                    🏟️ {club.name}
                                </Text>
                            )}
                        </View>
                    </View>
                    
                    <Text style={{ color: Colors.neutral300, fontSize: 20 }}>›</Text>
                </View>
            </TouchableOpacity>
        );
    }, [navigation, Colors, Fonts, Spaces, ApplicationStyle, Alignments]);

    return (
        <ScreenContainer bgImage="bg2">
            {/* Header */}
            <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[16]]}>
                <Text style={[Fonts.h2, Fonts.neutral00]}>Gestion Utilisateurs</Text>
            </View>

            {/* Search Bar */}
            <View style={[Spaces.padding[16]]}>
                <View style={[
                    ApplicationStyle.backgroundColor.neutral800,
                    ApplicationStyle.borderRadius16,
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[8],
                ]}>
                    <Text style={{ color: Colors.neutral300, marginRight: 8 }}>🔍</Text>
                    <TextInput
                        style={[
                            Fonts.p1,
                            { flex: 1, color: Colors.neutral00 },
                        ]}
                        placeholder="Rechercher un utilisateur..."
                        placeholderTextColor={Colors.neutral300}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={{ color: Colors.neutral300, fontSize: 18 }}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={users}
                renderItem={renderItem}
                keyExtractor={(item) => item.id?.toString()}
                contentContainerStyle={[Spaces.paddingHorizontal[16]]}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary500} />
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
                            <Text style={[Fonts.h4, { color: Colors.neutral200 }]}>Aucun utilisateur trouvé</Text>
                            <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8], { textAlign: 'center' }]}>
                                {searchQuery ? 'Essayez une autre recherche' : 'Les utilisateurs apparaîtront ici'}
                            </Text>
                        </View>
                    ) : null
                }
            />
        </ScreenContainer>
    );
};

export default AdminUserList;
