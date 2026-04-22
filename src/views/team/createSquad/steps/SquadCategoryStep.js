import React from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadCategoryStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts } = useTheme();

  React.useEffect(() => {
    if (data.category?.label !== 'Senior') {
      updateData('category', { label: 'Senior', value: 'Senior' });
    }
  }, [data.category?.label, updateData]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 40, textAlign: 'center' }]}>
          Catégorie League
        </Text>

        <View
          style={{
            backgroundColor: 'rgba(250, 204, 21, 0.12)',
            borderColor: 'rgba(250, 204, 21, 0.45)',
            borderRadius: 18,
            borderWidth: 1,
            padding: 18,
          }}
        >
          <Text style={[Fonts.h3, { color: Colors.gold500, textAlign: 'center' }]}>Senior</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral100, marginTop: 10, textAlign: 'center' }]}>
            FoundClub League est réservé aux squads Senior. Les catégories jeunes ne sont pas disponibles dans ce mode.
          </Text>
        </View>
      </View>

      <View style={{ gap: 10, marginBottom: 20 }}>
        <Button
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

export default SquadCategoryStep;
