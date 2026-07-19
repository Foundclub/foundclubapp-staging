import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadLevelStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts } = useTheme();

  const levels = [
    { label: 'Débutant (Amateur)', value: 'beginner' },
    { label: 'Intermédiaire (Habitué)', value: 'intermediate' },
    { label: 'Confirmé (Compétition)', value: 'advanced' },
    { label: 'Expert (Semi-Pro)', value: 'expert' },
  ];

  const isValid = useMemo(() => !!data.level, [data.level]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 16, textAlign: 'center' }]}>
          Quel est ton niveau ?
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 40, textAlign: 'center' }]}>
          Cela nous aidera à te placer dans la bonne division intiale.
        </Text>

        <AutocompleteSelect
          isSearchable={false}
          options={levels}
          placeholder="Sélectionner un niveau"
          setValue={(item) => updateData('level', item)}
          value={data.level?.label}
        />
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

export default SquadLevelStep;
