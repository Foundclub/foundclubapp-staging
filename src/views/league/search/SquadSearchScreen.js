
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useTranslation } from 'react-i18next';
import { RouteNames } from '@/navigation/routeNames';
import Button from '@/components/atoms/button/Button';
import { searchSquads } from '@/services/leagueTeam/leagueTeamService';

import { useAppContext } from '@/store/appContext';


const SquadSearchScreen = () => {
    const { Colors, Fonts, Spaces } = useTheme();
    const navigation = useNavigation();
    const { t } = useTranslation();
    
    // Filters State
    const [{ squadFilters }, appDispatch] = useAppContext();
    const [city, setCity] = useState('');
    const [squads, setSquads] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Sync local city state with global filters or route params if needed
    useEffect(() => {
        if (squadFilters?.city?.label) {
            setCity(squadFilters.city.label);
        }
    }, [squadFilters]);

    // Initial load or search effect
    useEffect(() => {
        handleSearch();
    }, [squadFilters]);

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            // Combine local city input with global filters
            const searchFilters = {
                ...squadFilters,
                city: city || squadFilters?.city?.value
            };
            
            const results = await searchSquads(searchFilters);
            setSquads(results);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            onPress={() => navigation.navigate(RouteNames.SquadDetails, { teamId: item.documentId })}
            style={{ 
                padding: 16, 
                backgroundColor: Colors.neutral800, 
                marginBottom: 10, 
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}
        >
            <View>
                <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{item.name}</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral400 }]}>
                    {item.home_base?.city || 'Ville inconnue'} • {item.category || 'Senior'} • Div {item.division || '?'}
                </Text>
            </View>
            <View style={{ backgroundColor: Colors.primary500, padding: 8, borderRadius: 8 }}>
                <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>Voir</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenContainer bgImage="bg2">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Retour</Text>
                </TouchableOpacity>
                <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{t('squad.search.title', 'Trouver une Squad')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('SquadFilters')}>
                     <Text style={[Fonts.h4, { color: Colors.primary500 }]}>Filtres</Text>
                </TouchableOpacity>
            </View>
            
            <View style={{ padding: 16, flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput 
                            placeholder="Rechercher par ville..."
                            placeholderTextColor={Colors.neutral400}
                            value={city}
                            onChangeText={setCity}
                            onSubmitEditing={handleSearch}
                            style={{
                                backgroundColor: Colors.neutral800,
                                color: Colors.neutral00,
                                borderRadius: 8,
                                padding: 12,
                                ...Fonts.p2
                            }}
                        />
                    </View>
                    <Button 
                        title="Chercher" 
                        onPress={handleSearch} 
                        style={{ width: 100 }}
                        variant="Primary"
                    />
                </View>

                {isLoading ? (
                    <ActivityIndicator color={Colors.primary500} size="large" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={squads}
                        renderItem={renderItem}
                        keyExtractor={item => item.documentId}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={() => (
                            <Text style={[Fonts.p1, { color: Colors.neutral400, textAlign: 'center', marginTop: 50 }]}>
                                Aucune squad trouvée. Modifiez vos filtres.
                            </Text>
                        )}
                    />
                )}
            </View>
        </ScreenContainer>
    );
};

export default SquadSearchScreen;
