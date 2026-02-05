import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Button from '@/components/atoms/button/Button';

const SquadLevelStep = ({ data, updateData, onNext, onPrev }) => {
  const { Colors, Fonts } = useTheme();

  const levels = [
      { label: 'Débutant (Amateur)', value: 'beginner' },
      { label: 'Intermédiaire (Habitué)', value: 'intermediate' },
      { label: 'Confirmé (Compétition)', value: 'advanced' },
      { label: 'Expert (Semi-Pro)', value: 'expert' }
  ];

  const isValid = useMemo(() => {
    return !!data.level;
  }, [data.level]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
       <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
          <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 16 }]}>
             Quel est votre niveau ?
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 40 }]}>
             Cela nous aidera à vous placer dans la bonne division intiale.
          </Text>

          <AutocompleteSelect
            placeholder="Sélectionner un niveau"
            options={levels}
            value={data.level?.label}
            setValue={(item) => updateData('level', item)}
            isSearchable={false}
          />
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

export default SquadLevelStep;
