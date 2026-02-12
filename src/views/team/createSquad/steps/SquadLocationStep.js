import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import Button from '@/components/atoms/button/Button';
import Slider from '@react-native-community/slider';
import { hasValidLocationCoordinates, normalizeLocationInput } from '@/utils/location';

const SquadLocationStep = ({ data, updateData, onNext, onPrev }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const [sliderWidth, setSliderWidth] = React.useState(0);

  const radius = data.radius || 20;

  const isValid = useMemo(() => {
    return hasValidLocationCoordinates(data.address);
  }, [data.address]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
       <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
          <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 40 }]}>
             Où jouez-vous ?
          </Text>

          <View style={{ marginBottom: 30 }}>
            <AutocompleteAddressInput
                placeholder="Rechercher une ville..."
                address={data.address}
                setAddress={(addr) => {
                  updateData('address', addr);
                  const normalized = normalizeLocationInput(addr);
                  updateData('city', normalized?.city || '');
                }}
            />
          </View>

          {data.address && (
              <View>
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 4 }]}>
                      Rayon de recherche
                  </Text>
                  <Text style={[Fonts.p2, { color: Colors.neutral00, marginBottom: 24 }]}>
                      C'est la distance max que vous êtes prêt à parcourir pour un match.
                  </Text>
                  
                  <View 
                    style={{ alignItems: 'center' }} 
                    onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
                  >
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={5}
                        maximumValue={100}
                        step={5}
                        value={radius}
                        onValueChange={(val) => updateData('radius', val)}
                        minimumTrackTintColor={Colors.primary500}
                        maximumTrackTintColor={Colors.neutral600}
                        thumbTintColor={Colors.primary500}
                    />
                    
                    {/* Dynamic Label */}
                    <View style={{
                        position: 'absolute',
                        top: 30, // Adjust based on slider height
                        left: sliderWidth ? ((radius - 5) / (95)) * (sliderWidth - 30) + 15 : 0, // -30 + 15 to account for padding/thumb roughly
                        transform: [{ translateX: -20 }] // Center roughly (assuming width of text ~40)
                    }}>
                        <Text style={[Fonts.p3Bold, { color: Colors.primary500, width: 60, textAlign: 'center' }]}>
                            {radius} km
                        </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                      <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>5 km</Text>
                      <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>100 km</Text>
                  </View>
              </View>
          )}
       </View>

      <View style={{ marginBottom: 20, gap: 10 }}>
        <Button
            title="Continuer"
            onPress={onNext}
            disabled={!isValid}
            variant="Primary"
        />
         <Button
            title="Retour"
            onPress={onPrev}
            variant="Secondary"
        />
      </View>
    </View>
  );
};

export default SquadLocationStep;
