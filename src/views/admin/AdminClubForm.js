import { useNavigation, useRoute } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import {
  buildClubFormInitialValues,
  buildClubWritePayload,
  getClubInitials,
  getClubRelationLabel,
  getDocumentId,
  normalizeText,
  parseJsonObject,
} from '@/services/admin/adminClubContentModel';
import {
  useCreateAdminClubContent,
  useGetAdminClubContent,
  useSearchAdminClubRelations,
  useUpdateAdminClubContent,
  useUploadAdminClubLogo,
} from '@/services/admin/adminClubContentQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const RELATION_PICKERS = {
  activites: {
    isMany: true,
    label: 'Activités',
    targetUid: 'api::activity.activity',
  },
  parentMultisport: {
    isMany: false,
    label: 'Club multisport parent',
    targetUid: 'api::multisport-club.multisport-club',
  },
};

const EMPTY_FORM = buildClubFormInitialValues({});

const cloneWithoutSystemFields = (club = {}) => ({
  ...club,
  createdAt: undefined,
  documentId: undefined,
  id: undefined,
  updatedAt: undefined,
});

/**
 *
 */
function AdminClubForm() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId, duplicateFrom } = route.params || {};
  const sourceDocumentId = clubId || duplicateFrom;
  const isEditing = Boolean(clubId);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [initialSignature, setInitialSignature] = useState(JSON.stringify(EMPTY_FORM));
  const [showAdvancedAddress, setShowAdvancedAddress] = useState(false);
  const [relationPicker, setRelationPicker] = useState(null);
  const [relationQuery, setRelationQuery] = useState('');
  const [relationResults, setRelationResults] = useState([]);
  const [saveReason, setSaveReason] = useState('');

  const {
    data: sourceData,
    error,
    isLoading,
    refetch,
  } = useGetAdminClubContent(sourceDocumentId);
  const createMutation = useCreateAdminClubContent();
  const updateMutation = useUpdateAdminClubContent();
  const uploadLogoMutation = useUploadAdminClubLogo();
  const relationSearchMutation = useSearchAdminClubRelations();

  const sourceClub = sourceData?.data || sourceData;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDirty = JSON.stringify(formValues) !== initialSignature;
  const formTitle = (() => {
    if (isEditing) return 'Modifier le club';
    if (duplicateFrom) return 'Dupliquer le club';
    return 'Créer un club';
  })();

  useEffect(() => {
    if (!clubId && !duplicateFrom) {
      navigation.replace(RouteNames.AdminClubWizardIdentity);
    }
  }, [clubId, duplicateFrom, navigation]);

  useEffect(() => {
    if (!sourceDocumentId && !isEditing) {
      const signature = JSON.stringify(EMPTY_FORM);
      setFormValues(EMPTY_FORM);
      setInitialSignature(signature);
      return;
    }

    if (!sourceClub) return;
    const initialValues = buildClubFormInitialValues(
      duplicateFrom ? {
        ...cloneWithoutSystemFields(sourceClub),
        name: `${sourceClub?.name || ''} copie`.trim(),
      } : sourceClub,
    );
    const signature = JSON.stringify(initialValues);
    setFormValues(initialValues);
    setInitialSignature(signature);
  }, [duplicateFrom, isEditing, sourceClub, sourceDocumentId]);

  const setField = useCallback((field, value) => {
    setFormValues((previous) => ({ ...previous, [field]: value }));
  }, []);

  const updateSponsor = useCallback((index, field, value) => {
    setFormValues((previous) => {
      const nextSponsors = Array.isArray(previous.sponsor) ? [...previous.sponsor] : [];
      nextSponsors[index] = {
        ...(nextSponsors[index] || {}),
        [field]: value,
      };
      return { ...previous, sponsor: nextSponsors };
    });
  }, []);

  const addSponsor = useCallback(() => {
    setFormValues((previous) => ({
      ...previous,
      sponsor: [
        ...(Array.isArray(previous.sponsor) ? previous.sponsor : []),
        { link: '', title: '' },
      ],
    }));
  }, []);

  const removeSponsor = useCallback((index) => {
    setFormValues((previous) => ({
      ...previous,
      sponsor: (Array.isArray(previous.sponsor) ? previous.sponsor : []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const openRelationPicker = useCallback((key) => {
    setRelationPicker({ key, ...RELATION_PICKERS[key] });
    setRelationQuery('');
    setRelationResults([]);
  }, []);

  const closeRelationPicker = useCallback(() => {
    if (relationSearchMutation.isPending) return;
    setRelationPicker(null);
    setRelationQuery('');
    setRelationResults([]);
  }, [relationSearchMutation.isPending]);

  const searchRelations = useCallback(async () => {
    if (!relationPicker) return;
    try {
      const response = await relationSearchMutation.mutateAsync({
        payload: {
          page: 1,
          pageSize: 20,
          q: relationQuery,
        },
        targetUid: relationPicker.targetUid,
      });
      setRelationResults(Array.isArray(response?.data) ? response.data : []);
    } catch (searchError) {
      Alert.alert('Recherche impossible', getErrorMessage(searchError, 'generic'));
    }
  }, [relationPicker, relationQuery, relationSearchMutation]);

  const addRelationValue = useCallback((item) => {
    if (!relationPicker) return;
    setFormValues((previous) => {
      if (!relationPicker.isMany) {
        return { ...previous, [relationPicker.key]: item };
      }

      const current = Array.isArray(previous[relationPicker.key]) ? previous[relationPicker.key] : [];
      const documentId = getDocumentId(item);
      if (current.some((currentItem) => getDocumentId(currentItem) === documentId)) return previous;
      return { ...previous, [relationPicker.key]: [...current, item] };
    });
    closeRelationPicker();
  }, [closeRelationPicker, relationPicker]);

  const removeRelationValue = useCallback((key, item) => {
    setFormValues((previous) => {
      if (!Array.isArray(previous[key])) {
        return { ...previous, [key]: null };
      }

      const documentId = getDocumentId(item);
      return {
        ...previous,
        [key]: previous[key].filter((currentItem) => getDocumentId(currentItem) !== documentId),
      };
    });
  }, []);

  const pickLogo = useCallback(async () => {
    try {
      const uploaded = await uploadLogoMutation.mutateAsync();
      if (uploaded) {
        setField('logo', uploaded);
      }
    } catch (uploadError) {
      Alert.alert('Upload impossible', getErrorMessage(uploadError, 'generic'));
    }
  }, [setField, uploadLogoMutation]);

  const validateForm = useCallback(() => {
    if (!normalizeText(formValues.name)) {
      Alert.alert('Nom requis', 'Le nom du club est obligatoire.');
      return false;
    }

    if (showAdvancedAddress && normalizeText(formValues.addressJson)) {
      const parsed = parseJsonObject(formValues.addressJson, null);
      if (!parsed) {
        Alert.alert('JSON invalide', 'Le champ adresse JSON doit contenir un objet JSON valide.');
        return false;
      }
    }

    return true;
  }, [formValues.addressJson, formValues.name, showAdvancedAddress]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    const reason = normalizeText(saveReason) || (isEditing ? 'Mise à jour Club SuperAdmin' : 'Création Club SuperAdmin');
    const payload = buildClubWritePayload(formValues);
    if (formValues.logo === null) {
      payload.logo = { set: [] };
    }

    try {
      const result = isEditing
        ? await updateMutation.mutateAsync({ data: payload, documentId: clubId, reason })
        : await createMutation.mutateAsync({ data: payload, reason });
      const nextDocumentId = result?.data?.documentId || clubId;
      navigation.replace(RouteNames.AdminClubDetail, { clubId: nextDocumentId });
    } catch (saveError) {
      Alert.alert('Sauvegarde impossible', getErrorMessage(saveError, 'generic'));
    }
  }, [
    clubId,
    createMutation,
    formValues,
    isEditing,
    navigation,
    saveReason,
    updateMutation,
    validateForm,
  ]);

  const confirmCancel = useCallback(() => {
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Modifications non sauvegardées',
      'Quitter sans sauvegarder ?',
      [
        { style: 'cancel', text: "Continuer l'édition" },
        { onPress: () => navigation.goBack(), style: 'destructive', text: 'Quitter' },
      ],
    );
  }, [isDirty, navigation]);

  const renderInput = useCallback((label, field, options = {}) => (
    <View style={Spaces.gap[6]}>
      <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>{label}</Text>
      <TextInput
        keyboardType={options.keyboardType || 'default'}
        multiline={Boolean(options.multiline)}
        onChangeText={(value) => setField(field, value)}
        placeholder={options.placeholder || label}
        placeholderTextColor={Colors.neutral300}
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius16,
          Fonts.p1,
          Spaces.padding[12],
          {
            color: Colors.neutral00,
            minHeight: options.multiline ? 92 : undefined,
            textAlignVertical: options.multiline ? 'top' : 'center',
          },
        ]}
        value={formValues[field]}
      />
    </View>
  ), [ApplicationStyle, Colors, Fonts, Spaces, formValues, setField]);

  const renderToggle = useCallback((label, field) => (
    <TouchableOpacity
      onPress={() => setField(field, !formValues[field])}
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.padding[14],
      ]}
    >
      <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>{label}</Text>
      <View
        style={[
          Alignments.center,
          {
            backgroundColor: formValues[field] ? Colors.primary500 : Colors.primary900,
            borderRadius: 14,
            height: 28,
            width: 52,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
          {formValues[field] ? 'Oui' : 'Non'}
        </Text>
      </View>
    </TouchableOpacity>
  ), [Alignments, ApplicationStyle, Colors, Fonts, Spaces, formValues, setField]);

  if (!clubId && !duplicateFrom) {
    return (
      <AdminStateView
        description="Nous ouvrons le tunnel de création du club."
        isLoading
        title="Ouverture du tunnel"
      />
    );
  }

  if (sourceDocumentId && isLoading && !sourceClub) {
    return (
      <AdminStateView
        description="Nous préparons le formulaire Club."
        isLoading
        title="Chargement du club"
      />
    );
  }

  if (sourceDocumentId && error && !sourceClub) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(error, 'generic') || 'Impossible de charger ce club.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView contentContainerStyle={[Spaces.padding[16], Spaces.paddingBottom[32], Spaces.gap[14]]} showsVerticalScrollIndicator={false}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.h2, Fonts.neutral00]}>
              {formTitle}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              Formulaire dédié compatible Content Manager.
            </Text>
          </View>
          <Button onPress={confirmCancel} size="sm" title="Annuler" variant="Secondary" />
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[14], Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Identité</Text>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <View
              style={[
                Alignments.center,
                {
                  backgroundColor: Colors.primary900,
                  borderRadius: 16,
                  height: 74,
                  overflow: 'hidden',
                  width: 74,
                },
              ]}
            >
              {formValues.logo?.url ? (
                <Image resizeMode="cover" source={{ uri: formValues.logo.url }} style={{ height: 74, width: 74 }} />
              ) : (
                <Text style={[Fonts.h4Bold, { color: Colors.neutral100 }]}>{getClubInitials(formValues)}</Text>
              )}
            </View>
            <View style={[Spaces.gap[8], { flex: 1 }]}>
              <Button isLoading={uploadLogoMutation.isPending} onPress={pickLogo} size="sm" title="Changer logo" />
              <Button onPress={() => setField('logo', null)} size="sm" title="Retirer logo" variant="Secondary" />
            </View>
          </View>
          {renderInput('Nom du club', 'name')}
          {renderInput('Email', 'email', { keyboardType: 'email-address' })}
          {renderInput('Téléphone', 'phoneNumber', { keyboardType: 'phone-pad' })}
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[14], Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Statut et gouvernance</Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            Cette fiche pilote le partenariat, la vérification et la réservation. Les abonnements et la couverture Team se gerent dans les opérations abonnements.
          </Text>
          {renderToggle('Club partenaire', 'clubPartner')}
          {renderToggle('Club certifié', 'clubVerified')}
          {renderToggle('Fournisseur de réservation', 'isReservationProvider')}
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[14], Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Adresse</Text>
          {renderInput('Adresse affichée', 'addressLabel')}
          {renderInput('Ville', 'city')}
          {renderInput('Code postal', 'postcode')}
          {renderInput('Latitude', 'latitude', { keyboardType: 'numeric' })}
          {renderInput('Longitude', 'longitude', { keyboardType: 'numeric' })}
          {renderInput('Détails adresse', 'addressDetails')}
          {renderInput('Geohash', 'geohash')}
          <Button
            onPress={() => setShowAdvancedAddress((previous) => !previous)}
            title={showAdvancedAddress ? 'Masquer JSON avancé' : 'Adresse JSON avancée'}
            variant="Secondary"
          />
          {showAdvancedAddress ? renderInput('Adresse JSON', 'addressJson', { multiline: true }) : null}
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[14], Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Relations principales</Text>
          <Button onPress={() => openRelationPicker('activites')} title="Ajouter une activité" variant="Secondary" />
          {(formValues.activites || []).map((activity) => (
            <View key={getDocumentId(activity)} style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
              <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral100, flex: 1 }]}>{getClubRelationLabel(activity)}</Text>
              <TouchableOpacity onPress={() => removeRelationValue('activites', activity)}>
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>Retirer</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Button onPress={() => openRelationPicker('parentMultisport')} title="Choisir le parent multisport" variant="Secondary" />
          {formValues.parentMultisport ? (
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
              <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral100, flex: 1 }]}>
                {getClubRelationLabel(formValues.parentMultisport)}
              </Text>
              <TouchableOpacity onPress={() => removeRelationValue('parentMultisport', formValues.parentMultisport)}>
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>Retirer</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[14], Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Sponsors</Text>
          {(formValues.sponsor || []).map((sponsor, index) => (
            <View key={String(sponsor.id || sponsor.title || sponsor.name || index)} style={[Spaces.gap[8], Spaces.marginBottom[10]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>
                Sponsor
                {' '}
                {index + 1}
              </Text>
              <TextInput
                onChangeText={(value) => updateSponsor(index, 'title', value)}
                placeholder="Titre"
                placeholderTextColor={Colors.neutral300}
                style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Fonts.p1, Spaces.padding[12], { color: Colors.neutral00 }]}
                value={sponsor.title || sponsor.name || ''}
              />
              <TextInput
                onChangeText={(value) => updateSponsor(index, 'link', value)}
                placeholder="Lien"
                placeholderTextColor={Colors.neutral300}
                style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Fonts.p1, Spaces.padding[12], { color: Colors.neutral00 }]}
                value={sponsor.link || ''}
              />
              <Button onPress={() => removeSponsor(index)} size="sm" title="Supprimer sponsor" variant="SecondaryLight" />
            </View>
          ))}
          <Button onPress={addSponsor} title="Ajouter un sponsor" variant="Secondary" />
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[14], Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Audit</Text>
          <TextInput
            multiline
            onChangeText={setSaveReason}
            placeholder="Raison de modification"
            placeholderTextColor={Colors.neutral300}
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius16,
              Fonts.p1,
              Spaces.padding[12],
              { color: Colors.neutral00, minHeight: 86, textAlignVertical: 'top' },
            ]}
            value={saveReason}
          />
        </View>

        <Button isLoading={isSaving} onPress={handleSave} title={isEditing ? 'Sauvegarder' : 'Créer le club'} />
      </ScrollView>

      <BottomModal close={closeRelationPicker} isVisible={Boolean(relationPicker)} snapPoints={['78%']}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>
          {relationPicker?.label || 'Relation'}
        </Text>
        <TextInput
          onChangeText={setRelationQuery}
          placeholder="Rechercher"
          placeholderTextColor={Colors.neutral300}
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius16,
            Fonts.p1,
            Spaces.marginTop[12],
            Spaces.padding[12],
            { color: Colors.neutral00 },
          ]}
          value={relationQuery}
        />
        <Button
          isLoading={relationSearchMutation.isPending}
          onPress={searchRelations}
          style={Spaces.marginTop[12]}
          title="Rechercher"
        />
        <View style={[Spaces.gap[10], Spaces.marginTop[14]]}>
          {relationResults.map((item) => (
            <View key={getDocumentId(item)} style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
              <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral100, flex: 1 }]}>
                {getClubRelationLabel(item)}
              </Text>
              <Button onPress={() => addRelationValue(item)} size="sm" title="Choisir" />
            </View>
          ))}
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default AdminClubForm;
