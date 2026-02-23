import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadImageStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  // Validate that we can proceed (images are optional, so always valid?)
  // User said "s'il y en a qui veulent", so optional.
  const isValid = true;

  const handleLogoSelect = (image) => {
    updateData('logo', image);
  };

  const handleCoverSelect = (image) => {
    updateData('cover', image);
  };

  const handleDeleteLogo = () => {
    updateData('logo', null);
  };

  const handleDeleteCover = () => {
    updateData('cover', null);
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 40, textAlign: 'center' }]}>
          Identité de l'équipe
        </Text>

        <View style={{ alignItems: 'center', gap: 30, marginBottom: 40 }}>
          {/* Logo Section */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
              Logo
            </Text>
            <SelectAvatar
              cropHeight={500}
              cropWidth={500}
              currentAvatar={data.logo}
              onAvatarSelected={handleLogoSelect}
              onDelete={data.logo ? handleDeleteLogo : undefined}
              size={120}
            />
            <Text style={[Fonts.p3, { color: Colors.primary500, marginTop: 8, textAlign: 'center' }]}>
              Apparaît sur les classements et profils
            </Text>
          </View>

          {/* Cover Section */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
              Photo de couverture
            </Text>
            <SelectAvatar
              containerStyle={{ borderRadius: 12, height: 140, width: 250 }}
              cropHeight={450} // 16:9 ratio approximately
              cropWidth={800}
              currentAvatar={data.cover}
              imageStyle={{ borderRadius: 12, height: 140, width: 250 }} // Custom rectangular style
              onAvatarSelected={handleCoverSelect}
              onDelete={data.cover ? handleDeleteCover : undefined}
              size={150}
            />
            <Text style={[Fonts.p3, { color: Colors.primary500, marginTop: 8, textAlign: 'center' }]}>
              Fond des cartes de l'équipe
            </Text>
          </View>
        </View>
      </ScrollView>

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

export default SquadImageStep;
