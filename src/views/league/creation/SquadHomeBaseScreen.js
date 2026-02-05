
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Keyboard } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import useTheme from '@/theme/themeContext';
import { searchPlaces } from '@/services/places/placesService';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import Input from '@/components/molecules/input/Input';

/**
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} props.route
 */
export default function SquadHomeBaseScreen({ navigation, route }) {
    const { Colors, Fonts, Spaces } = useTheme();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [region, setRegion] = useState({
        latitude: 48.8566,
        longitude: 2.3522,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    });
    const mapRef = useRef(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 2 && !selectedPlace) {
                setLoading(true);
                try {
                    const places = await searchPlaces(query);
                    setResults(places.value || []);
                } catch (err) {
                    console.warn('Search failed', err);
                } finally {
                    setLoading(false);
                }
            } else if (query.length === 0) {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, selectedPlace]);

    const handleSelect = (place) => {
        const coords = place.geometry.coordinates;
        const lat = coords[1];
        const lon = coords[0];
        
        const newRegion = {
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };

        setSelectedPlace({
            label: place.properties.label,
            city: place.properties.city,
            postcode: place.properties.postcode,
            lat,
            lon
        });
        setRegion(newRegion);
        setQuery(place.properties.label);
        setResults([]);
        Keyboard.dismiss();

        mapRef.current?.animateToRegion(newRegion, 1000);
    };

    const handleNext = () => {
        if (!selectedPlace) return;
        
        const homeBase = {
            address: selectedPlace.label,
            city: selectedPlace.city,
            postcode: selectedPlace.postcode,
            lat: selectedPlace.lat,
            lng: selectedPlace.lon
        };

        navigation.navigate('SquadSummary', { ...route.params, homeBase });
    };

    return (
        <WizardStepLayout
            title="Where is your Home Base?"
            subtitle="Search for your city or stadium."
            onNext={handleNext}
            isNextDisabled={!selectedPlace}
            onBack={() => navigation.goBack()}
        >
            <View style={{ zIndex: 2 }}>
                <Input
                    placeholder="Search city, stadium..."
                    value={query}
                    onChangeText={(text) => {
                        setQuery(text);
                        if (selectedPlace && text !== selectedPlace.label) {
                            setSelectedPlace(null);
                        }
                    }}
                    icon="search"
                />
                
                {results.length > 0 && !selectedPlace && (
                    <View style={[styles.resultsList, { backgroundColor: Colors.neutral00, borderColor: Colors.neutral100 }]}>
                        {results.map((item, index) => (
                            <TouchableOpacity 
                                key={index}
                                style={[styles.resultItem, { borderBottomColor: Colors.neutral100 }]}
                                onPress={() => handleSelect(item)}
                            >
                                <Text style={[Fonts.p1, { color: Colors.neutral900 }]}>{item.properties.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <View style={[styles.mapContainer, { borderRadius: 12, overflow: 'hidden', marginTop: 20 }]}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    region={region}
                    onRegionChangeComplete={setRegion}
                    scrollEnabled={false}
                    zoomEnabled={false}
                >
                    {selectedPlace && (
                        <Marker
                            coordinate={{ latitude: selectedPlace.lat, longitude: selectedPlace.lon }}
                            title={selectedPlace.label}
                        />
                    )}
                </MapView>
            </View>
        </WizardStepLayout>
    );
}

const styles = StyleSheet.create({
    resultsList: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        maxHeight: 200,
        borderWidth: 1,
        borderRadius: 8,
        zIndex: 100,
        elevation: 5,
    },
    resultItem: { padding: 15, borderBottomWidth: 1 },
    mapContainer: { height: 300, width: '100%' },
    map: { width: '100%', height: '100%' },
});
