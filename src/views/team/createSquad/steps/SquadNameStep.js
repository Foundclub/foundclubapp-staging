import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';
import Input from '@/components/molecules/input/Input';
import Button from '@/components/atoms/button/Button';

const SquadNameStep = ({ data, updateData, onNext }) => {
  const { Colors, Fonts, Spaces } = useTheme();

  const isValid = useMemo(() => {
    return data.name?.length > 2;
  }, [data.name]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
       <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
          <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 40 }]}>
             Quel est le nom de votre squad ?
          </Text>

          <Input
            placeholder="Ex: FC Les Champions"
            value={data.name}
            onChangeText={(text) => updateData('name', text)}
            style={{ textAlign: 'center' }} 
            placeholderTextColor={Colors.neutral500}
            autoFocus
          />
       </View>

      <Button
        title="Continuer"
        onPress={onNext}
        disabled={!isValid}
        variant="Primary"
        style={{ marginBottom: 20 }}
      />
    </View>
  );
};

export default SquadNameStep;
