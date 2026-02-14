import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';
import usePlaces from '@/domains/places/usePlaces';

/**
 * User address input screen component.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User address screen component
 */
function UserAddress({ navigation }) {
  const { Alignments, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { getNextOnboardingRoute } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Local state for address object { label: string, value: string }
  const [address, setAddress] = useState(userData?.address || null);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre a jour votre profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserAddress)
        || RouteNames.UserAvatar);
    },
  });

  const handleNext = () => {
    if (userData && address) {
      let geohash = null;
      // @ts-ignore
      if (address.value) {
        // @ts-ignore
        const coords = address.value.split('|');
        if (coords.length === 2) {
           // Value is "lon|lat" (from AutocompleteAddressInput usage)
           geohash = getGeohashForPointAndRadius(
             parseFloat(coords[1]), // lat
             parseFloat(coords[0]), // lon
             0.001 // High precision
           );
        }
      }

      updateUserMutation.mutate({ 
        address,
        geohash
      });
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserAddress)
      || RouteNames.UserAvatar);
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.fill,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={110}
        style={[Alignments.justifySpaceBetween, Alignments.fill]}
      >
        <View style={[Spaces.gap[40]]}>
          <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>
              {t('profile.titles.address', 'Où habites-tu ?')}
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral00]}>
              {t('profile.subtitles.address', 'Renseigne ta ville ou ton code postal')}
            </Text>
          </View>

          <View style={[Spaces.gap[16]]}>
             <AutocompleteAddressInput
                address={address}
                label={t('profile.fields.city.label', 'Ville')}
                placeholder={t('profile.fields.city.placeholder', 'Rechercher une ville')}
                setAddress={setAddress}
             />
          </View>
        </View>
        
        <View style={[Spaces.gap[16]]}>
          <Button
            disabled={!address || updateUserMutation.isPending}
            isLoading={updateUserMutation.isPending}
            onPress={handleNext}
            title={t('common.actions.next', 'Suivant')}
            variant="Primary"
          />
          <TouchableOpacity onPress={handleSkip} style={[Alignments.alignCenter]}>
            <Text style={[Fonts.p1, Fonts.neutral300, Fonts.underlineText]}>
              {t('profile.actions.ignore', 'Ignorer')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default UserAddress;
