import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import useTheme from '@/theme/themeContext';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import Button from '@/components/atoms/button/Button';

const SquadImageStep = ({ data, updateData, onNext, onPrev }) => {
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
          <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 40 }]}>
             Identité de l'équipe
          </Text>

          <View style={{ alignItems: 'center', marginBottom: 40, gap: 30 }}>
            {/* Logo Section */}
            <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
                    Logo
                </Text>
                <SelectAvatar
                    currentAvatar={data.logo}
                    onAvatarSelected={handleLogoSelect}
                    onDelete={data.logo ? handleDeleteLogo : undefined}
                    size={120}
                    cropWidth={500}
                    cropHeight={500}
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
                    currentAvatar={data.cover}
                    onAvatarSelected={handleCoverSelect}
                    onDelete={data.cover ? handleDeleteCover : undefined}
                    size={150} // Use a larger size container
                    imageStyle={{ width: 250, height: 140, borderRadius: 12 }} // Custom rectangular style
                    containerStyle={{ width: 250, height: 140, borderRadius: 12 }}
                    cropWidth={800}
                    cropHeight={450} // 16:9 ratio approximately
                />
                <Text style={[Fonts.p3, { color: Colors.primary500, marginTop: 8, textAlign: 'center' }]}>
                    Fond des cartes de l'équipe
                </Text>
            </View>
          </View>
       </ScrollView>

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

export default SquadImageStep;
