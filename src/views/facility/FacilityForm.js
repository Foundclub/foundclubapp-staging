import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import Select from '@/components/molecules/select/Select';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import { createFacility, updateFacility } from '@/services/facility/facilityService';
import useAuth from '@/domains/auth/useAuth';

const schema = Joi.object({
    name: Joi.string().required().messages({
        'string.empty': 'Le nom est requis',
    }),
    type: Joi.string().required().messages({
        'string.empty': 'Le type est requis',
    }),
    address: Joi.string().allow('').optional(),
    maxSlots: Joi.number().min(1).required().messages({
        'number.min': 'La capacité doit être d\'au moins 1',
        'any.required': 'La capacité est requise',
    }),
});

const FACILITY_TYPES = [
    { label: 'Terrain', value: 'Terrain' },
    { label: 'Gymnase', value: 'Gymnase' },
    { label: 'Salle vidéo', value: 'Salle vidéo' },
    { label: 'Vestiaire', value: 'Vestiaire' },
    { label: 'Club House', value: 'Club House' },
];

const FacilityForm = () => {
    const { t } = useTranslation();
    const {
        Spaces, Fonts, Alignments, Colors,
    } = useTheme();
    const navigation = useNavigation();
    const route = useRoute();
    const { userData } = useAuth();
    const facility = route.params?.facility;
    const isEdit = !!facility;

    const { control, handleSubmit, formState: { errors } } = useForm({
        resolver: joiResolver(schema),
        defaultValues: {
            name: facility?.name || '',
            type: facility?.type || 'Terrain',
            address: facility?.address || '',
            maxSlots: facility?.maxSlots || 1,
        },
    });

    const [loading, setLoading] = useState(false);

    const onSubmit = async (data) => {
        console.log('onSubmit triggered', data);
        console.log('userData:', userData);
        const clubId = userData?.club?.documentId || userData?.club?.id;
        console.log('clubId:', clubId);

        if (!clubId) {
            console.error('Club ID missing', userData);
            Alert.alert('Erreur', 'Impossible de récupérer les informations du club.');
            return;
        }

        setLoading(true);
        try {
            if (isEdit) {
                await updateFacility(facility.documentId, data);
            } else {
                await createFacility({ ...data, club: clubId });
            }
            navigation.goBack();
        } catch (error) {
            console.error('Error saving facility:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de l\'enregistrement.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[Spaces.paddingVertical[24], Spaces.paddingHorizontal[16], Alignments.fill]}
        >
            <View style={[Spaces.marginBottom[24]]}>
                <Text style={[Fonts.h1, Fonts.neutral00]}>
                    {isEdit ? 'Modifier l\'installation' : 'Nouvelle installation'}
                </Text>
            </View>

            <View style={[Spaces.gap[16]]}>
                <Controller
                    control={control}
                    name="name"
                    render={({ field: { onChange, value } }) => (
                        <Input
                            label="Nom de l'installation"
                            placeholder="Ex: Terrain Honneur, Salle A..."
                            value={value}
                            onChangeText={onChange}
                            error={errors.name?.message}
                        />
                    )}
                />

                <Controller
                    control={control}
                    name="type"
                    render={({ field: { onChange, value } }) => (
                        <Select
                            label="Type"
                            options={FACILITY_TYPES}
                            value={value}
                            onSelect={onChange}
                            error={errors.type?.message}
                        />
                    )}
                />

                <Controller
                    control={control}
                    name="address"
                    render={({ field: { onChange, value } }) => (
                        <Input
                            label="Adresse (Lieu exact)"
                            placeholder="Ex: 12 Rue du Stade..."
                            value={value}
                            onChangeText={onChange}
                            error={errors.address?.message}
                        />
                    )}
                />

                <Controller
                    control={control}
                    name="maxSlots"
                    render={({ field: { onChange, value } }) => (
                        <InputStepper
                            label="Capacité (Nombre d'équipes simultanées)"
                            value={value}
                            onIncrement={() => onChange(value + 1)}
                            onDecrement={() => onChange(Math.max(1, value - 1))}
                            min={1}
                            max={10}
                        />
                    )}
                />

                <Button
                    onPress={handleSubmit(onSubmit)}
                    title={isEdit ? 'Enregistrer' : 'Créer'}
                    variant="Primary"
                    isLoading={loading}
                    style={[Spaces.marginTop[24]]}
                />
            </View>
        </ScreenContainer>
    );
};

export default FacilityForm;
