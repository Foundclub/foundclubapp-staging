import Slider from '@react-native-community/slider';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { hasValidLocationCoordinates, normalizeLocationInput } from '@/utils/location';

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadLocationStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const [sliderWidth, setSliderWidth] = React.useState(0);

  const radius = data.radius || 20;

  const isValid = useMemo(() => hasValidLocationCoordinates(data.address), [data.address]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 40, textAlign: 'center' }]}>
          Où joues-tu ?
        </Text>

        <View style={{ marginBottom: 30 }}>
          <AutocompleteAddressInput
            address={data.address}
            placeholder="Rechercher une ville..."
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
            C'est la distance max que tu es prêt à parcourir pour un match.
          </Text>

          <View
            onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
            style={{ alignItems: 'center' }}
          >
            <Slider
              maximumTrackTintColor={Colors.neutral600}
              maximumValue={100}
              minimumTrackTintColor={Colors.primary500}
              minimumValue={5}
              onValueChange={(val) => updateData('radius', val)}
              step={5}
              style={{ height: 40, width: '100%' }}
              thumbTintColor={Colors.primary500}
              value={radius}
            />

            {/* Dynamic Label */}
            <View style={{
              left: sliderWidth ? ((radius - 5) / (95)) * (sliderWidth - 30) + 15 : 0, // -30 + 15 to account for padding/thumb roughly
              position: 'absolute',
              top: 30, // Adjust based on slider height
              transform: [{ translateX: -20 }], // Center roughly (assuming width of text ~40)
            }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary500, textAlign: 'center', width: 60 }]}>
                {radius}
                {' '}
                km
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

      <View style={{ gap: 10, marginBottom: 20 }}>
        <Button
          disabled={!isValid}
          onPress={onNext}
          title="Continuer"
          variant="Primary"
        />
        <Button
          onPress={onPrev}
          title="Retour"
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default SquadLocationStep;
