import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, Image, RefreshControl, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetAdminClubs } from '@/services/admin/adminQueries';

/**
 *
 */
function AdminClubList() {
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
    isLoading,
    refetch,
  } = useGetAdminClubs({ q: debouncedSearch });

  const clubs = data?.data || data || [];

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate(RouteNames.AdminClubDetail, { clubId: item.documentId })}
      style={[
        ApplicationStyle.backgroundColor.neutral800,
        ApplicationStyle.borderRadius16,
        Spaces.padding[16],
        Spaces.marginBottom[12],
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter]}>
        {/* Club Logo */}
        <View style={[
          {
            backgroundColor: Colors.neutral700, borderRadius: 8, height: 50, overflow: 'hidden', width: 50,
          },
          Alignments.alignCenter,
          Alignments.justifyCenter,
        ]}
        >
          {item.logo?.url ? (
            <Image
              resizeMode="cover"
              source={{ uri: item.logo.url }}
              style={{ height: 50, width: 50 }}
            />
          ) : (
            <Text style={{ fontSize: 24 }}>🏟️</Text>
          )}
        </View>

        <View style={[Spaces.marginLeft[12], { flex: 1 }]}>
          <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
            {item.name}
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginTop[4], Spaces.gap[8]]}>
            {item.city && (
            <Text style={[Fonts.p2, { color: Colors.neutral300, fontSize: 12 }]}>
              📍
                          {' '}
              {item.city}
            </Text>
            )}
            {item.sport && (
            <View style={[
              Spaces.paddingHorizontal[8],
              Spaces.paddingVertical[4],
              { backgroundColor: `${Colors.primary500}30`, borderRadius: 4 },
            ]}
            >
              <Text style={[Fonts.p2, { color: Colors.primary500, fontSize: 12 }]}>
                        {item.sport.name}
                      </Text>
            </View>
            )}
          </View>
        </View>

        <Text style={{ color: Colors.neutral300, fontSize: 20 }}>›</Text>
      </View>
    </TouchableOpacity>
  ), [navigation, Colors, Fonts, Spaces, ApplicationStyle, Alignments]);

  return (
    <ScreenContainer bgImage="bg2">
      {/* Header */}
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[16]]}>
        <Text style={[Fonts.h2, Fonts.neutral00]}>Gestion Clubs</Text>
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
            placeholder="Rechercher un club..."
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
        data={clubs}
        keyExtractor={(item) => item.documentId}
        ListEmptyComponent={
                    !isLoading ? (
                      <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
                        <Text style={[Fonts.h4, { color: Colors.neutral200 }]}>Aucun club trouvé</Text>
                        <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8], { textAlign: 'center' }]}>
                          {searchQuery ? 'Essayez une autre recherche' : 'Les clubs apparaîtront ici'}
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

export default AdminClubList;
