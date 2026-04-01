import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetAdminUsers } from '@/services/admin/adminQueries';

/**
 *
 */
function AdminUserList() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
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
    error,
    isLoading,
    refetch,
  } = useGetAdminUsers({ q: debouncedSearch });

  const users = data?.data || data || [];

  if (isLoading && !users.length) {
    return (
      <AdminStateView
        description="Nous chargeons la liste des utilisateurs."
        isLoading
        title="Chargement des utilisateurs"
      />
    );
  }

  if (error && !users.length) {
    return (
      <AdminStateView
        actionLabel="R\u00E9essayer"
        description={error?.message || 'Impossible de charger les utilisateurs.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  const getRoleBadgeColor = (roleType) => {
    switch (roleType) {
      case 'admin': return Colors.error500;
      case 'dirigeant': return Colors.primary500;
      case 'entraîneur': return Colors.warning500;
      case 'joueur': return Colors.success500;
      case 'superadmin': return Colors.error500;
      default: return Colors.neutral300;
    }
  };

  const renderItem = useCallback(({ item }) => {
    const { role } = item;
    const { club } = item;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate(RouteNames.AdminUserDetail, {
          userId: item.documentId || item.id,
        })}
        style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.marginBottom[12],
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter]}>
          <ProfileAvatar imageUrl={item.avatar?.url} size={50} />

          <View style={[Spaces.marginLeft[12], { flex: 1 }]}>
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
              {item.firstname}
              {' '}
              {item.lastname}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {item.email}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginTop[4], Spaces.gap[8]]}>
              {role && (
              <View style={[
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
                { backgroundColor: getRoleBadgeColor(role.type), borderRadius: 4 },
              ]}
              >
                <Text style={[Fonts.p2, { color: 'white', fontSize: 12 }]}>{role.name}</Text>
              </View>
              )}
              {club && (
              <Text style={[Fonts.p2, { color: Colors.neutral300, fontSize: 12 }]}>
                🏟️
                      {' '}
                {club.name}
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
        ]}
        >
          <Text style={{ color: Colors.neutral300, marginRight: 8 }}>🔍</Text>
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor={Colors.neutral300}
            style={[
              Fonts.p1,
              { color: Colors.neutral00, flex: 1 },
            ]}
            value={searchQuery}
          />
          {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ color: Colors.neutral300, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        contentContainerStyle={[Spaces.paddingHorizontal[16]]}
        data={users}
        keyExtractor={(item) => item.id?.toString()}
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
        refreshControl={
          <RefreshControl onRefresh={refetch} refreshing={isLoading} tintColor={Colors.primary500} />
                }
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

export default AdminUserList;
