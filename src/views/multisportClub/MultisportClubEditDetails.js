import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
    KeyboardAvoidingView, Platform, View, ScrollView
} from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { getMultisportClubById, updateMultisportClub } from '@/services/multisportClub/multisportClubService';

import { getFieldError } from '@/utils/form/formUtils';

/** @typedef {import('@/domains/auth/types').Avatar} Avatar */
/** @typedef {import('@/components/molecules/autocompleteSelect/types').Option} Option */
/**
 * @typedef {object} CMUpdatePayload
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [phoneNumber]
 * @property {Avatar | undefined} [logo]
 * @property {string} [addressLabel]
 * @property {string | number | null} [coordinates]
 */

const defaultValues = {
    name: '',
    email: '',
    phoneNumber: '',
};

const clubSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
    phoneNumber: Joi.string().allow('').optional(),
}).unknown(true);

/**
 * Multisport Club edit screen component. Allows admins to edit CM information.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Multisport Club edit screen component
 */
function MultisportClubEditDetails({ navigation, route }) {
    const { cmId } = route?.params ?? {};

    // hooks
    const {
        Alignments, Spaces, Fonts,
    } = useTheme();
    const { t } = useTranslation();

    const { data: cmData, refetch } = useQuery({
        queryKey: ['multisport-club', cmId],
        queryFn: () => getMultisportClubById(cmId),
        enabled: !!cmId,
    });

    // local state
    const [logo, setLogo] = useState(/** @type {Avatar | undefined} */ (undefined));
    const [address, setAddress] = useState(/** @type {Option | undefined} */ (undefined));

    useEffect(() => {
        if (cmData?.logo?.url) {
            setLogo({ url: cmData.logo.url });
        }
    }, [cmData]);

    // Pre-fill address
    useEffect(() => {
        if (cmData && !address) {
            if (cmData.address) {
                // If address object exists (Location Picker format from backend)
                setAddress({
                    label: cmData.addressDetails || cmData.address.label,
                    value: `${cmData.address.lng}|${cmData.address.lat}`,
                });
            } else if (cmData.addressDetails) {
                // Fallback text only
                setAddress({
                    label: cmData.addressDetails,
                    value: null, 
                });
            }
        }
    }, [cmData, address]);

    const updateCMMutation = useMutation({
        mutationFn: (/** @type {CMUpdatePayload} */ data) => updateMultisportClub(cmId, data),
        onSuccess: () => {
            refetch();
            navigation.goBack();
        },
    });

    const {
        control,
        formState: { errors: formErrors },
        handleSubmit,
        setFocus,
        reset,
    } = useForm({
        defaultValues,
        mode: 'onBlur',
        resolver: joiResolver(clubSchema),
        shouldFocusError: false,
    });

    useEffect(() => {
        if (cmData) {
            reset({
                name: cmData.name || '',
                email: cmData.email || '',
                phoneNumber: cmData.phoneNumber || '',
            });
        }
    }, [cmData, reset]);

    /**
     * Handle form submit
     * @param {typeof defaultValues} data
     */
    const handleFormSubmit = (data) => {
        if (cmData) {
            updateCMMutation.mutate({
                ...data,
                logo,
                addressLabel: address?.label,
                coordinates: address?.value, // "lon|lat" or null
            });
        }
    };

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[Spaces.paddingVertical[24]]}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={100}
                style={[Alignments.justifySpaceBetween, Alignments.fill]}
            >
                <ScrollView
                    contentContainerStyle={[
                        Spaces.gap[24],
                        Spaces.paddingBottom[40],
                    ]}
                    style={[Alignments.fill]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[Alignments.fill, Spaces.gap[24]]}>
                        <View style={[Alignments.row, Spaces.marginVertical[24]]}>
                            <SelectAvatar
                                currentAvatar={logo}
                                onAvatarSelected={(avatar) => setLogo(avatar)}
                                size={110}
                            />
                        </View>

                        <Controller
                            control={control}
                            name="name"
                            render={({
                                field: {
                                    name, onBlur, onChange, ref, value,
                                },
                            }) => (
                                <Input
                                    enterKeyHint="next"
                                    error={getFieldError({ errors: formErrors, fieldName: name })}
                                    label="Nom du club"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    onSubmitEditing={() => setFocus('email')}
                                    placeholder="Nom du club"
                                    ref={ref}
                                    value={value}
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="email"
                            render={({
                                field: {
                                    name, onBlur, onChange, ref, value,
                                },
                            }) => (
                                <Input
                                    enterKeyHint="next"
                                    error={getFieldError({ errors: formErrors, fieldName: name })}
                                    inputMode="email"
                                    keyboardType="email-address"
                                    label="Email"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    onSubmitEditing={() => setFocus('phoneNumber')}
                                    placeholder="Email"
                                    ref={ref}
                                    value={value}
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="phoneNumber"
                            render={({
                                field: {
                                    name, onBlur, onChange, ref, value,
                                },
                            }) => (
                                <Input
                                    enterKeyHint="next"
                                    error={getFieldError({ errors: formErrors, fieldName: name })}
                                    inputMode="tel"
                                    keyboardType="phone-pad"
                                    label="Téléphone"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    placeholder="Téléphone"
                                    ref={ref}
                                    value={value}
                                />
                            )}
                        />

                        <View style={[Spaces.gap[8]]}>
                            {/* Manual Label for consistency since AddressInput handles internal label differently sometimes */}
                             <AutocompleteAddressInput
                                label="Adresse / Ville"
                                address={address}
                                setAddress={(value) => setAddress(value)}
                                placeholder="Rechercher une adresse..."
                            />
                        </View>
                    </View>
                </ScrollView>

                <View style={[Spaces.marginBottom[16]]}>
                    <Button
                        isLoading={updateCMMutation.isPending}
                        onPress={handleSubmit(handleFormSubmit)}
                        title={t('common.actions.save') || 'Enregistrer'}
                        variant="Primary"
                    />
                </View>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
}

export default MultisportClubEditDetails;
