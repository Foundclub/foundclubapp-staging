import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import HomeActionCard from '@/components/molecules/homeActionCard/HomeActionCard';
import SuperAdminEmptyState from '@/components/molecules/superAdmin/SuperAdminEmptyState';
import superAdminLayout from '@/components/molecules/superAdmin/superAdminLayout';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetSuperadminContentTypes } from '@/services/admin/superadminQueries';

const closeIcon = require('@/assets/icons/close.png');
const searchIcon = require('@/assets/icons/search.png');

const sortByDisplayName = (a, b) => String(a?.displayName || '').localeCompare(String(b?.displayName || ''), 'fr');

const getKindLabel = (kind, t) => {
  if (kind === 'singleType') {
    return t('superAdminContentManager.explorer.singleType', 'single type');
  }
  return t('superAdminContentManager.explorer.collectionType', 'collection type');
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
  const { width: screenWidth } = useWindowDimensions();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetSuperadminContentTypes();

  const normalizedQuery = query.trim().toLowerCase();
  const isCompactScreen = screenWidth <= 340;
  const numColumns = isCompactScreen ? 1 : 2;
  const pageHorizontalPadding = superAdminLayout.pageHorizontal;

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

  if (isLoading && !contentTypes.length) {
    return (
      <AdminStateView
        description="Nous chargeons les content-types du Content Manager."
        isLoading
        title="Chargement du contenu superadmin"
      />
    );
  }

  if (error && !contentTypes.length) {
    return (
      <AdminStateView
        actionLabel="R\u00E9essayer"
        description={error?.message || 'Impossible de charger les content-types superadmin.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <View style={[{ paddingHorizontal: pageHorizontalPadding }, Spaces.marginTop[superAdminLayout.pageTop]]}>
        <Text style={[Fonts.h2, Fonts.neutral00]}>
          {t('superAdminContentManager.explorer.title', 'Explorer Content Manager')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
          {t('superAdminContentManager.explorer.subtitle', 'Parcourez tous les content-types API Strapi.')}
        </Text>
      </View>

      <View
        style={[
          { paddingHorizontal: pageHorizontalPadding },
          Spaces.marginTop[12],
          Spaces.marginBottom[12],
          Spaces.gap[superAdminLayout.sectionGap],
        ]}
      >
        <View
          style={[
            ApplicationStyle.card,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            Alignments.row,
            Alignments.alignCenter,
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.primary700,
              borderWidth: 1,
              justifyContent: 'space-between',
            },
          ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('superAdminContentManager.explorer.types', 'Types')}
            {': '}
            {contentTypes.length}
          </Text>
          <Text style={[Fonts.p2, Fonts.primary200]}>
            {t('superAdminContentManager.explorer.results', 'Résultats')}
            {': '}
            {filtered.length}
          </Text>
        </View>

        <View
          style={[
            ApplicationStyle.card,
            Alignments.row,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.primary500,
              borderWidth: 1,
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
            placeholder={t('superAdminContentManager.explorer.searchPlaceholder', 'Rechercher un content-type')}
            placeholderTextColor={Colors.neutral300}
            style={[Fonts.p1, { color: Colors.neutral00, flex: 1 }]}
            value={query}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              hitSlop={{
                bottom: 8, left: 8, right: 8, top: 8,
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
        columnWrapperStyle={numColumns === 2 ? { justifyContent: 'space-between' } : undefined}
        contentContainerStyle={[{ paddingHorizontal: pageHorizontalPadding }, Spaces.paddingBottom[32]]}
        data={filtered}
        key={numColumns}
        keyExtractor={(item) => item.uid}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ width: '100%' }}>
              <SuperAdminEmptyState
                description={t('superAdminContentManager.empty.explorerDescription', 'Ajustez la recherche ou vérifiez les permissions Super Admin.')}
                title={t('superAdminContentManager.empty.explorerTitle', 'Aucun content-type trouvé')}
              />
            </View>
          ) : null
        }
        numColumns={numColumns}
        onRefresh={refetch}
        refreshing={isLoading}
        renderItem={({ item }) => {
          const subtitleParts = [
            item?.uid || '',
            getKindLabel(item?.kind, t),
          ].filter(Boolean);

          if (item?.draftAndPublish) {
            subtitleParts.push(t('superAdminContentManager.explorer.draftPublish', 'draft + publish'));
          }

          const subtitle = subtitleParts.join('\n');

          return (
            <View
              style={{
                marginBottom: 12,
                width: numColumns === 1 ? '100%' : '48.5%',
              }}
            >
              <HomeActionCard
                accentColor={item?.draftAndPublish ? Colors.warning500 : Colors.primary500}
                icon={item?.kind === 'singleType' ? 'edit' : 'users'}
                layout="half"
                onPress={() => navigation.navigate(RouteNames.SuperAdminEntryList, {
                  displayName: item?.displayName || item?.uid,
                  uid: item?.uid,
                })}
                subtitle={subtitle}
                subtitleLines={2}
                title={item?.displayName || getInitials(item?.uid)}
              />
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

export default SuperAdminContentExplorer;
