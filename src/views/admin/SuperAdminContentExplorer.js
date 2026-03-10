import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetSuperadminContentTypes } from '@/services/admin/superadminQueries';

const rightIcon = require('@/assets/icons/arrowRight.png');
const closeIcon = require('@/assets/icons/close.png');
const searchIcon = require('@/assets/icons/search.png');

const sortByDisplayName = (a, b) => String(a?.displayName || '').localeCompare(String(b?.displayName || ''), 'fr');

const getKindLabel = (kind) => {
  if (kind === 'singleType') {
    return 'single type';
  }
  return 'collection type';
};

const getInitials = (label) => {
  const words = String(label || '')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return 'CM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

/**
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminContentExplorer({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const [query, setQuery] = useState('');

  const {
    data,
    isLoading,
    refetch,
  } = useGetSuperadminContentTypes();

  const normalizedQuery = query.trim().toLowerCase();
  const contentTypes = useMemo(
    () => (Array.isArray(data?.data) ? data.data : []),
    [data?.data],
  );

  const filtered = useMemo(() => {
    const sorted = [...contentTypes].sort(sortByDisplayName);
    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((item) => {
      const haystack = [
        item?.displayName,
        item?.uid,
        item?.kind,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [contentTypes, normalizedQuery]);

  return (
    <ScreenContainer bgImage="bg2">
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[16]]}>
        <Text style={[Fonts.h2, Fonts.neutral00]}>Explorer Content Manager</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[8]]}>
          Parcourez tous les content-types API Strapi
        </Text>
      </View>

      <View style={[Spaces.paddingHorizontal[16], Spaces.marginTop[12], Spaces.marginBottom[12]]}>
        <View
          style={[
            ApplicationStyle.card,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            Alignments.row,
            Alignments.alignCenter,
            {
              backgroundColor: 'rgba(0, 18, 24, 0.7)',
              justifyContent: 'space-between',
            },
          ]}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>
            Types:
            {' '}
            {contentTypes.length}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.primary200 }]}>
            Resultats:
            {' '}
            {filtered.length}
          </Text>
        </View>
      </View>

      <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[12]]}>
        <View
          style={[
            ApplicationStyle.card,
            Alignments.row,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: 'rgba(12, 12, 13, 0.6)',
            },
          ]}
        >
          <Image
            source={searchIcon}
            style={{
              height: 18,
              marginRight: 8,
              tintColor: Colors.neutral300,
              width: 18,
            }}
          />
          <TextInput
            onChangeText={setQuery}
            placeholder="Rechercher un content-type"
            placeholderTextColor={Colors.neutral300}
            style={[
              Fonts.p1,
              { color: Colors.neutral00, flex: 1 },
            ]}
            value={query}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              hitSlop={{
                bottom: 8,
                left: 8,
                right: 8,
                top: 8,
              }}
              onPress={() => setQuery('')}
            >
              <Image
                source={closeIcon}
                style={{
                  height: 14,
                  tintColor: Colors.neutral300,
                  width: 14,
                }}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[32]]}
        data={filtered}
        keyExtractor={(item) => item.uid}
        ListEmptyComponent={
          !isLoading ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Alignments.alignCenter, Spaces.marginTop[24]]}>
              <Text style={[Fonts.h4, { color: Colors.neutral100 }]}>Aucun content-type trouve</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8], { textAlign: 'center' }]}>
                Ajustez la recherche ou verifiez les permissions superadmin.
              </Text>
            </View>
          ) : null
        }
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
            tintColor={Colors.primary500}
          />
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.SuperAdminEntryList, {
              displayName: item?.displayName || item?.uid,
              uid: item?.uid,
            })}
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.marginBottom[12],
              {
                backgroundColor: 'rgba(0, 18, 24, 0.58)',
                borderColor: Colors.primary700,
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter]}>
              <View
                style={[
                  Alignments.center,
                  {
                    backgroundColor: Colors.primary900,
                    borderColor: Colors.primary500,
                    borderRadius: 22,
                    borderWidth: 1,
                    height: 44,
                    marginRight: 12,
                    width: 44,
                  },
                ]}
              >
                <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]}>{getInitials(item?.displayName)}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[Fonts.h4, { color: Colors.neutral00 }]}>
                  {item?.displayName || item?.uid}
                </Text>
                <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                  {item?.uid}
                </Text>
              </View>

              <Image
                source={rightIcon}
                style={{
                  height: 16,
                  tintColor: Colors.neutral300,
                  width: 16,
                }}
              />
            </View>

            <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginTop[12], Spaces.gap[8]]}>
              <View
                style={[
                  Spaces.paddingHorizontal[8],
                  Spaces.paddingVertical[4],
                  {
                    backgroundColor: Colors.primary700,
                    borderRadius: 6,
                  },
                ]}
              >
                <Text style={[Fonts.p2, { color: Colors.primary200, fontSize: 12 }]}>
                  {getKindLabel(item?.kind)}
                </Text>
              </View>
              {item?.draftAndPublish ? (
                <View
                  style={[
                    Spaces.paddingHorizontal[8],
                    Spaces.paddingVertical[4],
                    {
                      backgroundColor: Colors.warning900,
                      borderRadius: 6,
                    },
                  ]}
                >
                  <Text style={[Fonts.p2, { color: Colors.warning500, fontSize: 12 }]}>draft + publish</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

export default SuperAdminContentExplorer;
