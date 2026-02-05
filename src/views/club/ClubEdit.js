import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
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
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetClub } from '@/services/club/clubQueries';
import { updateClubInfo } from '@/services/club/clubService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
    name: '',
    email: '',
    phoneNumber: '',
    addressDetails: '',
};

const clubSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
    phoneNumber: Joi.string().allow('').optional(),
    addressDetails: Joi.string().allow('').optional(),
}).unknown(true);

/**
 * Club edit screen component. Allows admins to edit club information.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Club edit screen component
 */
function ClubEdit({ navigation, route }) {
    const { clubId } = route.params;

    // hooks
    const {
        Alignments, Spaces,
    } = useTheme();
    const { t } = useTranslation();

    const { data: clubData, refetch } = useGetClub(clubId);

    // local state
    const [logo, setLogo] = useState(
        /** @type {Avatar | undefined} */
        (undefined),
    );

    useEffect(() => {
        if (clubData?.logo?.url) {
            setLogo(clubData.logo);
        } else if (clubData?.sponsor?.[0]?.logo?.url) {
            // Fallback to first sponsor logo if no club logo? 
            // Or maybe we don't want that. 
            // Let's stick to club.logo.
        }
    }, [clubData]);

    const updateClubMutation = useMutation({
        mutationFn: updateClubInfo,
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
        defaultValues: {
            ...defaultValues,
        },
        mode: 'onBlur',
        resolver: joiResolver(clubSchema),
        shouldFocusError: false,
    });

    useEffect(() => {
        if (clubData) {
            reset({
                name: clubData.name || '',
                email: clubData.email || '',
                phoneNumber: clubData.phoneNumber || '',
                addressDetails: clubData.addressDetails ? JSON.parse(clubData.addressDetails)?.address : '',
            });
        }
    }, [clubData, reset]);

    /**
     * Handle form submit
     * @param {typeof defaultValues} data
     */
    const handleFormSubmit = (data) => {
        if (clubData) {
            updateClubMutation.mutate({
                documentId: clubData.documentId,
                ...data,
                logo,
                // We need to handle addressDetails specifically if we want to save it as JSON string
                addressDetails: data.addressDetails ? JSON.stringify({ address: data.addressDetails }) : undefined,
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
                >
                    <View style={[Alignments.fill, Spaces.gap[24]]}>
                        <View style={[Alignments.row, Spaces.marginVertical[24]]}>
                            <SelectAvatar
                                currentAvatar={logo}
                                onAvatarSelected={setLogo}
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
                                    label={t('club.fields.name.label') || 'Nom du club'}
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    onSubmitEditing={() => setFocus('email')}
                                    placeholder={t('club.fields.name.placeholder') || 'Nom du club'}
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
                                    label={t('club.fields.email.label') || 'Email'}
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    onSubmitEditing={() => setFocus('phoneNumber')}
                                    placeholder={t('club.fields.email.placeholder') || 'Email'}
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
                                    label={t('club.fields.phoneNumber.label') || 'Téléphone'}
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    onSubmitEditing={() => setFocus('addressDetails')}
                                    placeholder={t('club.fields.phoneNumber.placeholder') || 'Téléphone'}
                                    ref={ref}
                                    value={value}
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="addressDetails"
                            render={({
                                field: {
                                    name, onBlur, onChange, ref, value,
                                },
                            }) => (
                                <Input
                                    enterKeyHint="done"
                                    error={getFieldError({ errors: formErrors, fieldName: name })}
                                    label={t('club.fields.address.label') || 'Adresse'}
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    placeholder={t('club.fields.address.placeholder') || 'Adresse'}
                                    ref={ref}
                                    value={value}
                                />
                            )}
                        />
                    </View>
                </ScrollView>

                <View style={[Spaces.marginBottom[16]]}>
                    <Button
                        isLoading={updateClubMutation.isPending}
                        onPress={handleSubmit(handleFormSubmit)}
                        title={t('common.actions.save') || 'Enregistrer'}
                        variant="Primary"
                    />
                </View>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
}

export default ClubEdit;
