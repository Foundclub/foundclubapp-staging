import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import { searchSquads } from '@/services/leagueTeam/leagueTeamService';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';
import { normalizeLocationInput } from '@/utils/location';

const readFilterValue = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value.label || value.value || null;
  return value;
};

const getSectionLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'male' || normalized === 'masculin') return 'Masculin';
  if (normalized === 'female' || normalized === 'feminin' || normalized === 'féminin') return 'Feminin';
  if (normalized === 'mixed' || normalized === 'mixte') return 'Mixte';
  return value;
};

function SquadSearchScreen() {
  const { Colors, Fonts, Images } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [{ squadFilters }] = useAppContext();

  const [query, setQuery] = useState('');
  const [squads, setSquads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const activeFiltersLabel = useMemo(() => {
    const chips = [];
    const city = readFilterValue(squadFilters?.city);
    const sport = readFilterValue(squadFilters?.sport);
    const category = readFilterValue(squadFilters?.category);
    const section = readFilterValue(squadFilters?.section);
    const division = readFilterValue(squadFilters?.division);
    const radius = squadFilters?.radius;

    if (city) chips.push(city);
    if (sport) chips.push(sport);
    if (category) chips.push(category);
    if (section) chips.push(section);
    if (division) chips.push(`Div ${division}`);
    if (city && radius) chips.push(`${radius} km`);

    return chips.join(' - ');
  }, [squadFilters]);

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const results = await searchSquads({
        ...squadFilters,
        query: query.trim(),
      });
      setSquads(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error('[SquadSearch] search failed:', error);
      setErrorMessage('Erreur de recherche. Reessayez.');
      setSquads([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, squadFilters]);

  useFocusEffect(
    useCallback(() => {
      handleSearch();
    }, [handleSearch]),
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length >= 2 || query.trim().length === 0) {
        handleSearch();
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, handleSearch]);

  const renderItem = ({ item }) => {
    const teamId = item?.documentId || item?.id;
    const normalizedHomeBase = normalizeLocationInput(item?.home_base);
    const cityLabel = normalizedHomeBase?.city
      || normalizedHomeBase?.label
      || normalizedHomeBase?.address
      || 'Ville inconnue';
    const sportLabel = item?.sport || 'Sport';
    const categoryLabel = item?.category || 'Categorie';
    const sectionLabel = getSectionLabel(item?.section);
    const divisionLabel = `Div ${item?.division || '?'}`;

    return (
      <TouchableOpacity
        onPress={() => {
          if (!teamId) return;
          navigation.navigate(RouteNames.SquadDetails, { teamId });
        }}
        style={{
          backgroundColor: 'rgba(10, 28, 43, 0.86)',
          borderColor: 'rgba(1, 179, 244, 0.28)',
          borderRadius: 14,
          borderWidth: 1,
          marginBottom: 12,
          padding: 14,
        }}
      >
        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{item?.name || 'Squad'}</Text>

        <View style={{ alignItems: 'center', flexDirection: 'row', marginTop: 8 }}>
          <Image
            source={Images.pin}
            style={{ height: 13, marginRight: 6, tintColor: Colors.primary500, width: 13 }}
          />
          <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}>
            {cityLabel}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          <View style={{
            backgroundColor: 'rgba(1, 179, 244, 0.10)',
            borderColor: 'rgba(1, 179, 244, 0.35)',
            borderRadius: 999,
            borderWidth: 1,
            marginBottom: 6,
            marginRight: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>{sportLabel}</Text>
          </View>

          <View style={{
            backgroundColor: 'rgba(1, 179, 244, 0.10)',
            borderColor: 'rgba(1, 179, 244, 0.35)',
            borderRadius: 999,
            borderWidth: 1,
            marginBottom: 6,
            marginRight: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>{categoryLabel}</Text>
          </View>

          {sectionLabel ? (
            <View style={{
              backgroundColor: 'rgba(1, 179, 244, 0.10)',
              borderColor: 'rgba(1, 179, 244, 0.35)',
              borderRadius: 999,
              borderWidth: 1,
              marginBottom: 6,
              marginRight: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>{sectionLabel}</Text>
            </View>
          ) : null}

          <View style={{
            backgroundColor: 'rgba(250, 204, 21, 0.12)',
            borderColor: 'rgba(250, 204, 21, 0.45)',
            borderRadius: 999,
            borderWidth: 1,
            marginBottom: 6,
            marginRight: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{divisionLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ marginTop: 8 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
            {t('squad.search.title', 'Trouver une Squad')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.SquadFilters)}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(1, 179, 244, 0.12)',
              borderColor: 'rgba(1, 179, 244, 0.40)',
              borderRadius: 999,
              borderWidth: 1,
              flexDirection: 'row',
              justifyContent: 'center',
              minWidth: 92,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Image
              source={Images.filter}
              style={{ height: 14, marginRight: 6, tintColor: Colors.primary500, width: 14 }}
            />
            <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Filtres</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: 20 }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(9, 27, 42, 0.84)',
            borderColor: 'rgba(1, 179, 244, 0.25)',
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Image source={Images.search} style={{ height: 18, tintColor: Colors.primary500, width: 18 }} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Nom de squad ou ville"
            placeholderTextColor={Colors.neutral500}
            style={[Fonts.p2, { color: Colors.neutral00, flex: 1, marginLeft: 10, minHeight: 46 }]}
            value={query}
          />
        </View>

        {activeFiltersLabel ? (
          <View style={{
            backgroundColor: 'rgba(1, 179, 244, 0.12)',
            borderColor: 'rgba(1, 179, 244, 0.30)',
            borderRadius: 10,
            borderWidth: 1,
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
              Filtres actifs: {activeFiltersLabel}
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={{
            backgroundColor: 'rgba(239, 68, 68, 0.16)',
            borderColor: 'rgba(239, 68, 68, 0.45)',
            borderRadius: 10,
            borderWidth: 1,
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          >
            <Text style={[Fonts.p3, { color: Colors.error500 }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Button
          onPress={handleSearch}
          style={{ marginTop: 14, width: '100%' }}
          title="Rechercher"
          variant="Primary"
        />

        {isLoading ? (
          <View style={{ alignItems: 'center', marginTop: 28 }}>
            <ActivityIndicator color={Colors.primary500} size="large" />
            <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 10 }]}>
              Recherche des squads...
            </Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: 28, paddingTop: 16 }}
            data={squads}
            keyExtractor={(item, index) => String(item?.documentId || item?.id || `squad-${index}`)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={(
              <View style={{
                alignItems: 'center',
                backgroundColor: 'rgba(9, 27, 42, 0.78)',
                borderColor: 'rgba(1, 179, 244, 0.20)',
                borderRadius: 14,
                borderWidth: 1,
                marginTop: 8,
                paddingHorizontal: 16,
                paddingVertical: 20,
              }}
              >
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
                  Aucune squad trouvee
                </Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 6, textAlign: 'center' }]}>
                  Essaie avec d'autres filtres ou un autre nom de squad.
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate(RouteNames.SquadFilters)}
                  style={{
                    backgroundColor: 'rgba(1, 179, 244, 0.10)',
                    borderColor: 'rgba(1, 179, 244, 0.40)',
                    borderRadius: 999,
                    borderWidth: 1,
                    marginTop: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Modifier les filtres</Text>
                </TouchableOpacity>
              </View>
            )}
            renderItem={renderItem}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

export default SquadSearchScreen;
