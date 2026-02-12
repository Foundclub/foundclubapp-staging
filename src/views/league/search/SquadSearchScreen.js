import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import { searchSquads } from '@/services/leagueTeam/leagueTeamService';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

const readFilterValue = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value.label || value.value || null;
  return value;
};

function SquadSearchScreen() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [{ squadFilters }] = useAppContext();

  const [query, setQuery] = useState('');
  const [squads, setSquads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
    try {
      const results = await searchSquads({
        ...squadFilters,
        query: query.trim(),
      });
      setSquads(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error('[SquadSearch] search failed:', error);
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

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate(RouteNames.SquadDetails, { teamId: item.documentId })}
      style={{
        backgroundColor: Colors.neutral800,
        borderColor: 'rgba(1, 179, 244, 0.20)',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
        padding: 14,
      }}
    >
      <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{item.name}</Text>
      <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 4 }]}>
        {(item?.home_base?.city || 'Ville inconnue')}
        {' - '}
        {(item?.sport || 'Sport')}
        {' - '}
        {(item?.category || 'Categorie')}
        {' - '}
        {`Div ${item?.division || '?'}`}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Retour</Text>
        </TouchableOpacity>
        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
          {t('squad.search.title', 'Trouver une Squad')}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('SquadFilters')}>
          <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Filtres</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        <TextInput
          placeholder="Nom de squad ou ville"
          placeholderTextColor={Colors.neutral500}
          value={query}
          onChangeText={setQuery}
          style={{
            ...Fonts.p2,
            backgroundColor: Colors.neutral800,
            borderColor: 'rgba(1, 179, 244, 0.25)',
            borderRadius: 10,
            borderWidth: 1,
            color: Colors.neutral00,
            marginBottom: 10,
            padding: 12,
          }}
        />

        {activeFiltersLabel ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Filtres actifs: {activeFiltersLabel}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Button
            title="Rechercher"
            onPress={handleSearch}
            variant="Primary"
            style={{ width: 140 }}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary500} size="large" style={{ marginTop: 28 }} />
        ) : (
          <FlatList
            data={squads}
            renderItem={renderItem}
            keyExtractor={(item) => item.documentId}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={(
              <View style={{ marginTop: 40 }}>
                <Text style={[Fonts.p1, { color: Colors.neutral300, textAlign: 'center' }]}>Aucune squad trouvee avec ces criteres.</Text>
              </View>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

export default SquadSearchScreen;
