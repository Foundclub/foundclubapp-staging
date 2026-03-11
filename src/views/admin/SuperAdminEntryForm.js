import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCreateSuperadminEntry,
  useGetSuperadminContentMetadata,
  useGetSuperadminEntry,
  useSearchSuperadminRelations,
  useUpdateSuperadminEntry,
} from '@/services/admin/superadminQueries';
import client from '@/services/client';

const SYSTEM_KEYS = new Set([
  'createdAt',
  'createdBy',
  'documentId',
  'id',
  'locale',
  'localizations',
  'publishedAt',
  'updatedAt',
  'updatedBy',
]);

const TEXT_TYPES = new Set([
  'date',
  'datetime',
  'email',
  'richtext',
  'string',
  'text',
  'time',
  'uid',
]);

const NUMBER_TYPES = new Set(['biginteger', 'decimal', 'float', 'integer']);

const JSON_TYPES = new Set(['blocks', 'component', 'dynamiczone', 'json']);

const MEDIA_TYPE = 'media';

/** @type {any | null | undefined} */
let cachedDocumentPickerModule;

const getDocumentPickerModule = () => {
  if (cachedDocumentPickerModule !== undefined) return cachedDocumentPickerModule;

  try {
    // Lazy import: prevents native module crashes at bootstrap on unsupported builds.
    // eslint-disable-next-line global-require
    const maybeModule = require('@react-native-documents/picker');
    cachedDocumentPickerModule = maybeModule?.default || maybeModule;
    return cachedDocumentPickerModule;
  } catch (_error) {
    cachedDocumentPickerModule = null;
    return null;
  }
};

const normalizeMediaItem = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    return {
      documentId: normalized,
      name: normalized,
    };
  }

  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const rawId = value?.id;
  const normalizedId = (
    Number.isFinite(Number(rawId))
      ? Number(rawId)
      : String(rawId || '').trim()
  );
  const normalizedDocumentId = String(value?.documentId || '').trim();
  const normalizedUrl = String(value?.url || '').trim();

  if (!normalizedDocumentId && !normalizedId && !normalizedUrl) return null;

  return {
    documentId: normalizedDocumentId || undefined,
    id: normalizedId || undefined,
    mime: String(value?.mime || '').trim() || undefined,
    name: String(value?.name || value?.alternativeText || '').trim() || undefined,
    url: normalizedUrl || undefined,
  };
};

const normalizeMediaItems = (value) => {
  if (!value) return [];

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return [];
    const parsed = safeParseJson(normalized);
    if (parsed.ok) return normalizeMediaItems(parsed.value);
    const single = normalizeMediaItem(normalized);
    return single ? [single] : [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeMediaItem(item))
      .filter(Boolean);
  }

  const single = normalizeMediaItem(value);
  return single ? [single] : [];
};

const getMediaKey = (value) => String(
  value?.documentId
  || value?.id
  || value?.url
  || value?.name
  || '',
).trim();

const safeStringify = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return '{}';
  }
};

const safeParseJson = (value) => {
  try {
    return {
      ok: true,
      value: JSON.parse(value),
    };
  } catch (error) {
    return {
      error: error?.message || 'Invalid JSON',
      ok: false,
      value: null,
    };
  }
};

const extractEditableData = (entry = {}) => {
  if (!entry || typeof entry !== 'object') return {};
  return Object.entries(entry).reduce((accumulator, [key, value]) => {
    if (SYSTEM_KEYS.has(key)) return accumulator;
    accumulator[key] = value;
    return accumulator;
  }, {});
};

const normalizeRelationIds = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        return String(item?.documentId || item?.id || '').trim();
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  if (typeof value === 'object') {
    const documentId = String(value?.documentId || value?.id || '').trim();
    return documentId ? [documentId] : [];
  }

  return [];
};

const buildMediaSetValues = (value, isMultiple) => {
  const normalized = normalizeMediaItems(value);
  const limited = isMultiple ? normalized : normalized.slice(0, 1);

  return limited
    .map((item) => {
      const documentId = String(item?.documentId || '').trim();
      if (documentId) return { documentId };

      const rawId = item?.id;
      if (rawId === null || rawId === undefined || rawId === '') return null;

      return {
        id: Number.isFinite(Number(rawId)) ? Number(rawId) : String(rawId),
      };
    })
    .filter(Boolean);
};

const normalizeInitialValue = (attribute, sourceValue) => {
  const type = String(attribute?.type || '');
  const isMultipleRelation = type === 'relation' && Boolean(attribute?.multiple);

  if (type === 'relation') {
    const ids = normalizeRelationIds(sourceValue);
    return isMultipleRelation ? ids : (ids[0] || '');
  }

  if (type === MEDIA_TYPE) {
    const items = normalizeMediaItems(sourceValue);
    if (attribute?.multiple) return items;
    return items[0] || null;
  }

  if (type === 'boolean') {
    if (sourceValue === null || sourceValue === undefined) return null;
    return Boolean(sourceValue);
  }

  if (NUMBER_TYPES.has(type)) {
    if (sourceValue === null || sourceValue === undefined || sourceValue === '') return '';
    return String(sourceValue);
  }

  if (JSON_TYPES.has(type)) {
    if (sourceValue === null || sourceValue === undefined) return '';
    return safeStringify(sourceValue);
  }

  if (TEXT_TYPES.has(type) || type === 'enumeration') {
    if (sourceValue === null || sourceValue === undefined) return '';
    return String(sourceValue);
  }

  if (sourceValue === null || sourceValue === undefined) return '';
  if (typeof sourceValue === 'object') return safeStringify(sourceValue);
  return String(sourceValue);
};

const buildInitialFormValues = (attributes, sourceData) => (
  attributes.reduce((accumulator, attribute) => {
    accumulator[attribute.name] = normalizeInitialValue(attribute, sourceData?.[attribute.name]);
    return accumulator;
  }, {})
);

const parseNumberValue = (type, rawValue) => {
  const normalized = String(rawValue || '').trim();
  if (!normalized) return { ok: true, value: null };

  const parsed = type === 'integer' || type === 'biginteger'
    ? Number.parseInt(normalized, 10)
    : Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return { ok: false, value: null };
  }

  return { ok: true, value: parsed };
};

const buildPayloadFromForm = (attributes, formValues) => {
  const errors = [];

  const data = attributes.reduce((accumulator, attribute) => {
    const type = String(attribute?.type || '');
    const name = attribute?.name;
    const value = formValues?.[name];

    if (!name) return accumulator;

    if (type === 'relation') {
      if (attribute?.multiple) {
        const ids = Array.isArray(value)
          ? value.map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        accumulator[name] = {
          set: ids.map((documentId) => ({ documentId })),
        };
      } else {
        const relationId = String(value || '').trim();
        accumulator[name] = {
          set: relationId ? [{ documentId: relationId }] : [],
        };
      }
      return accumulator;
    }

    if (type === 'boolean') {
      accumulator[name] = value === null ? null : Boolean(value);
      return accumulator;
    }

    if (NUMBER_TYPES.has(type)) {
      const numeric = parseNumberValue(type, value);
      if (!numeric.ok) {
        errors.push(`Le champ "${name}" doit etre un nombre valide.`);
      } else {
        accumulator[name] = numeric.value;
      }
      return accumulator;
    }

    if (type === MEDIA_TYPE) {
      accumulator[name] = {
        set: buildMediaSetValues(value, Boolean(attribute?.multiple)),
      };
      return accumulator;
    }

    if (JSON_TYPES.has(type)) {
      const normalized = String(value || '').trim();
      if (!normalized) {
        accumulator[name] = null;
        return accumulator;
      }
      const parsed = safeParseJson(normalized);
      if (!parsed.ok) {
        errors.push(`Le champ "${name}" contient un JSON invalide.`);
      } else {
        accumulator[name] = parsed.value;
      }
      return accumulator;
    }

    if (TEXT_TYPES.has(type) || type === 'enumeration') {
      const normalized = String(value || '').trim();
      accumulator[name] = normalized || null;
      return accumulator;
    }

    const normalizedUnknown = String(value || '').trim();
    accumulator[name] = normalizedUnknown || null;
    return accumulator;
  }, {});

  return { data, errors };
};

const getFieldLabel = (attribute) => {
  const required = attribute?.required ? ' *' : '';
  return `${attribute?.name || 'field'}${required}`;
};

const getAttributeSection = (attribute) => {
  const type = String(attribute?.type || '');
  if (type === 'relation') return 'relations';
  if (type === MEDIA_TYPE) return 'media';
  if (type === 'boolean' || type === 'enumeration') return 'booleanEnum';
  if (JSON_TYPES.has(type) || type === 'richtext') return 'advanced';
  return 'scalars';
};

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminEntryForm({ navigation, route }) {
  const uid = route?.params?.uid;
  const uidDisplayName = route?.params?.uidDisplayName || uid;
  const mode = route?.params?.mode || 'create';
  const documentId = route?.params?.documentId;
  const { t } = useTranslation();

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const isEditMode = mode === 'edit';

  const [formValues, setFormValues] = useState({});
  const [reason, setReason] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [relationQueries, setRelationQueries] = useState({});
  const [relationResults, setRelationResults] = useState({});
  const [relationManualId, setRelationManualId] = useState({});
  const [relationLoadingField, setRelationLoadingField] = useState('');
  const [mediaUploadingField, setMediaUploadingField] = useState('');
  const [showRawFallback, setShowRawFallback] = useState(false);

  const metadataQuery = useGetSuperadminContentMetadata(uid);
  const entryQuery = useGetSuperadminEntry(uid, isEditMode ? documentId : undefined);
  const createMutation = useCreateSuperadminEntry();
  const updateMutation = useUpdateSuperadminEntry();
  const relationSearchMutation = useSearchSuperadminRelations();

  const allAttributes = useMemo(
    () => metadataQuery?.data?.data?.attributes || [],
    [metadataQuery?.data?.data?.attributes],
  );

  const editableAttributes = useMemo(
    () => allAttributes.filter((attribute) => attribute?.readOnly !== true && attribute?.private !== true),
    [allAttributes],
  );

  const unsupportedAttributes = useMemo(
    () => editableAttributes.filter((attribute) => {
      const type = String(attribute?.type || '');
      return !(
        type === 'relation'
        || type === MEDIA_TYPE
        || type === 'boolean'
        || type === 'enumeration'
        || TEXT_TYPES.has(type)
        || NUMBER_TYPES.has(type)
        || JSON_TYPES.has(type)
      );
    }),
    [editableAttributes],
  );

  const groupedAttributes = useMemo(() => (
    editableAttributes.reduce((accumulator, attribute) => {
      const sectionKey = getAttributeSection(attribute);
      if (!accumulator[sectionKey]) accumulator[sectionKey] = [];
      accumulator[sectionKey].push(attribute);
      return accumulator;
    }, {
      advanced: [],
      booleanEnum: [],
      media: [],
      relations: [],
      scalars: [],
    })
  ), [editableAttributes]);

  useEffect(() => {
    if (isHydrated) return;
    if (metadataQuery.isLoading) return;
    if (isEditMode && entryQuery.isLoading) return;

    const sourceData = isEditMode ? extractEditableData(entryQuery?.data?.data || {}) : {};
    const initialValues = buildInitialFormValues(editableAttributes, sourceData);
    setFormValues(initialValues);
    setIsHydrated(true);
  }, [
    editableAttributes,
    entryQuery?.data?.data,
    entryQuery.isLoading,
    isEditMode,
    isHydrated,
    metadataQuery.isLoading,
  ]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleFieldValue = (fieldName, value) => {
    setFormValues((previous) => ({
      ...previous,
      [fieldName]: value,
    }));
  };

  const handleRelationSearch = async (attribute) => {
    const fieldName = attribute?.name;
    const targetUid = attribute?.relation?.target;
    const q = String(relationQueries?.[fieldName] || '').trim();

    if (!fieldName || !targetUid) return;
    if (!q) {
      Alert.alert(
        t('superAdminContentManager.alerts.relationSearchTitle', 'Recherche relation'),
        t('superAdminContentManager.alerts.relationSearchMinChars', 'Merci de saisir au moins 1 caractere.'),
      );
      return;
    }

    setRelationLoadingField(fieldName);
    try {
      const response = await relationSearchMutation.mutateAsync({
        payload: {
          page: 1,
          pageSize: 10,
          q,
        },
        targetUid,
      });
      setRelationResults((previous) => ({
        ...previous,
        [fieldName]: response?.data || [],
      }));
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.alerts.relationSearchFailedTitle', 'Recherche impossible'),
        error?.message || t('superAdminContentManager.common.genericError', 'Une erreur est survenue.'),
      );
    } finally {
      setRelationLoadingField('');
    }
  };

  const addRelationId = (attribute, relationId) => {
    const fieldName = attribute?.name;
    const normalizedId = String(relationId || '').trim();
    if (!fieldName || !normalizedId) return;

    if (attribute?.multiple) {
      const current = Array.isArray(formValues?.[fieldName]) ? formValues[fieldName] : [];
      if (current.includes(normalizedId)) return;
      handleFieldValue(fieldName, [...current, normalizedId]);
    } else {
      handleFieldValue(fieldName, normalizedId);
    }
  };

  const removeRelationId = (attribute, relationId) => {
    const fieldName = attribute?.name;
    if (!fieldName) return;

    if (attribute?.multiple) {
      const current = Array.isArray(formValues?.[fieldName]) ? formValues[fieldName] : [];
      handleFieldValue(fieldName, current.filter((item) => item !== relationId));
    } else {
      handleFieldValue(fieldName, '');
    }
  };

  const addMediaToField = (attribute, mediaItem) => {
    const fieldName = attribute?.name;
    const normalized = normalizeMediaItem(mediaItem);
    if (!fieldName || !normalized) return;

    if (attribute?.multiple) {
      const current = normalizeMediaItems(formValues?.[fieldName]);
      const nextKey = getMediaKey(normalized);
      if (!nextKey) return;
      if (current.some((item) => getMediaKey(item) === nextKey)) return;
      handleFieldValue(fieldName, [...current, normalized]);
      return;
    }

    handleFieldValue(fieldName, normalized);
  };

  const removeMediaFromField = (attribute, mediaItem) => {
    const fieldName = attribute?.name;
    if (!fieldName) return;

    if (!attribute?.multiple) {
      handleFieldValue(fieldName, null);
      return;
    }

    const targetKey = getMediaKey(mediaItem);
    const current = normalizeMediaItems(formValues?.[fieldName]);
    handleFieldValue(
      fieldName,
      current.filter((item) => getMediaKey(item) !== targetKey),
    );
  };

  const uploadMediaAsset = async (attribute, asset) => {
    const fieldName = attribute?.name;
    if (!fieldName || !asset?.uri) return;

    setMediaUploadingField(fieldName);
    try {
      const uri = String(asset.uri || '').trim();
      const mime = String(asset.type || 'application/octet-stream').trim() || 'application/octet-stream';
      const extension = mime.includes('/') ? (mime.split('/')[1] || 'bin') : 'bin';
      const fallbackName = `upload_${Date.now()}.${extension}`;
      const fileName = String(asset.fileName || asset.name || fallbackName).trim() || fallbackName;

      const formData = new FormData();
      formData.append('files', /** @type {any} */ ({
        name: fileName,
        type: mime,
        uri,
      }));

      const response = await client.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedFiles = Array.isArray(response?.data) ? response.data : [];
      if (!uploadedFiles.length) {
        Alert.alert(
          t('superAdminContentManager.alerts.uploadFailedTitle', 'Upload impossible'),
          t('superAdminContentManager.alerts.uploadNoFile', 'Aucun fichier n a ete recu par le serveur.'),
        );
        return;
      }

      uploadedFiles.forEach((file) => addMediaToField(attribute, file));
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.alerts.uploadFailedTitle', 'Upload impossible'),
        error?.message || t('superAdminContentManager.common.genericError', 'Une erreur est survenue.'),
      );
    } finally {
      setMediaUploadingField('');
    }
  };

  const pickMediaFromLibrary = async (attribute) => {
    try {
      const response = await launchImageLibrary({
        includeBase64: false,
        mediaType: 'mixed',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (response?.didCancel) return;
      if (response?.errorCode) {
        Alert.alert(
          t('superAdminContentManager.media.gallery', 'Galerie'),
          response?.errorMessage || t('superAdminContentManager.alerts.openGalleryFailed', 'Impossible d ouvrir la galerie.'),
        );
        return;
      }

      const asset = response?.assets?.[0];
      if (!asset?.uri) return;
      await uploadMediaAsset(attribute, asset);
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.media.gallery', 'Galerie'),
        error?.message || t('superAdminContentManager.alerts.openGalleryFailed', 'Impossible d ouvrir la galerie.'),
      );
    }
  };

  const pickMediaFromCamera = async (attribute) => {
    try {
      const response = await launchCamera({
        cameraType: 'back',
        includeBase64: false,
        mediaType: 'photo',
        quality: 0.8,
      });

      if (response?.didCancel) return;
      if (response?.errorCode) {
        Alert.alert(
          t('superAdminContentManager.media.camera', 'Camera'),
          response?.errorMessage || t('superAdminContentManager.alerts.openCameraFailed', 'Impossible d ouvrir la camera.'),
        );
        return;
      }

      const asset = response?.assets?.[0];
      if (!asset?.uri) return;
      await uploadMediaAsset(attribute, asset);
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.media.camera', 'Camera'),
        error?.message || t('superAdminContentManager.alerts.takePhotoFailed', 'Impossible de prendre une photo.'),
      );
    }
  };

  const pickMediaFromDocument = async (attribute) => {
    const documentPicker = getDocumentPickerModule();
    const hasModernPick = typeof documentPicker?.pick === 'function';
    const hasLegacyPick = typeof documentPicker?.pickSingle === 'function';
    if (!hasModernPick && !hasLegacyPick) {
      Alert.alert(
        t('superAdminContentManager.media.file', 'Fichier'),
        t('superAdminContentManager.alerts.filePickerUnavailable', 'Le selecteur de fichiers est indisponible sur cette build.'),
      );
      return;
    }

    try {
      let selected;
      if (hasModernPick) {
        const selectedResult = await documentPicker.pick({
          type: documentPicker?.types?.allFiles ? [documentPicker.types.allFiles] : undefined,
        });
        selected = Array.isArray(selectedResult) ? selectedResult[0] : selectedResult;
      } else {
        selected = await documentPicker.pickSingle({
          copyTo: 'cachesDirectory',
          type: [documentPicker.types.allFiles],
        });
      }

      if (!selected) return;

      let selectedUri = selected?.fileCopyUri || selected?.uri;
      if (
        hasModernPick
        && typeof documentPicker?.keepLocalCopy === 'function'
        && selected?.uri
      ) {
        const [localCopyResult] = await documentPicker.keepLocalCopy({
          destination: 'cachesDirectory',
          files: [
            {
              fileName: selected.name || `file_${Date.now()}`,
              uri: selected.uri,
            },
          ],
        });
        if (localCopyResult?.status === 'success' && localCopyResult?.localUri) {
          selectedUri = localCopyResult.localUri;
        }
      }

      if (!selectedUri) {
        Alert.alert(
          t('superAdminContentManager.media.file', 'Fichier'),
          t('superAdminContentManager.alerts.fileResolveFailed', 'Impossible de recuperer ce fichier.'),
        );
        return;
      }

      await uploadMediaAsset(attribute, {
        fileName: selected?.name || `file_${Date.now()}`,
        type: selected?.type || 'application/octet-stream',
        uri: selectedUri,
      });
    } catch (error) {
      if (
        hasModernPick
        && typeof documentPicker?.isErrorWithCode === 'function'
        && documentPicker?.errorCodes?.OPERATION_CANCELED
        && documentPicker.isErrorWithCode(error)
        && error?.code === documentPicker.errorCodes.OPERATION_CANCELED
      ) return;
      if (typeof documentPicker?.isCancel === 'function' && documentPicker.isCancel(error)) return;
      Alert.alert(
        t('superAdminContentManager.media.file', 'Fichier'),
        error?.message || t('superAdminContentManager.alerts.fileSelectFailed', 'Impossible de selectionner ce fichier.'),
      );
    }
  };

  const handleSave = async () => {
    const { data, errors } = buildPayloadFromForm(editableAttributes, formValues);
    if (errors.length > 0) {
      Alert.alert(
        t('superAdminContentManager.alerts.validationTitle', 'Validation'),
        errors.join('\n'),
      );
      return;
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          data,
          documentId,
          reason: reason.trim() || undefined,
          uid,
        });
        navigation.goBack();
        return;
      }

      const result = await createMutation.mutateAsync({
        data,
        reason: reason.trim() || undefined,
        uid,
      });

      const newDocumentId = result?.data?.documentId;
      if (newDocumentId) {
        navigation.replace(RouteNames.SuperAdminEntryDetail, {
          documentId: newDocumentId,
          uid,
          uidDisplayName,
        });
      } else {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.alerts.saveFailedTitle', 'Enregistrement impossible'),
        error?.message || t('superAdminContentManager.common.genericError', 'Une erreur est survenue.'),
      );
    }
  };

  const renderRelationField = (attribute) => {
    const fieldName = attribute?.name;
    const isMultiple = Boolean(attribute?.multiple);
    let selected = [];
    if (isMultiple) {
      selected = Array.isArray(formValues?.[fieldName]) ? formValues[fieldName] : [];
    } else {
      selected = [String(formValues?.[fieldName] || '').trim()].filter(Boolean);
    }
    const results = relationResults?.[fieldName] || [];

    return (
      <View
        key={fieldName}
        style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[14],
          Spaces.marginBottom[12],
        ]}
      >
        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{getFieldLabel(attribute)}</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
          {t('superAdminContentManager.form.relationTo', 'Relation vers')}
          {' '}
          {attribute?.relation?.target || t('superAdminContentManager.common.unknown', 'inconnue')}
        </Text>

        <View style={[Spaces.marginTop[8], Spaces.gap[8]]}>
          {selected.map((relationId) => (
            <View
              key={relationId}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                ApplicationStyle.backgroundColor.neutral700,
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[10],
                Spaces.paddingVertical[8],
              ]}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral00, flex: 1 }]}>{relationId}</Text>
              <TouchableOpacity onPress={() => removeRelationId(attribute, relationId)}>
                <Text style={[Fonts.p2, { color: Colors.error500 }]}>
                  {t('superAdminContentManager.actions.remove', 'Retirer')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {!isMultiple ? (
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => handleFieldValue(fieldName, value)}
            placeholder={t('superAdminContentManager.form.relationDocumentId', 'documentId relation')}
            placeholderTextColor={Colors.neutral300}
            style={[
              ApplicationStyle.backgroundColor.neutral700,
              ApplicationStyle.borderRadius12,
              {
                color: Colors.neutral00,
                marginTop: 8,
                minHeight: 42,
                paddingHorizontal: 12,
                paddingVertical: 8,
              },
            ]}
            value={String(formValues?.[fieldName] || '')}
          />
        ) : (
          <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[8]]}>
            <TextInput
              autoCapitalize="none"
              onChangeText={(value) => setRelationManualId((previous) => ({ ...previous, [fieldName]: value }))}
              placeholder={t('superAdminContentManager.form.documentIdToAdd', 'documentId a ajouter')}
              placeholderTextColor={Colors.neutral300}
              style={[
                ApplicationStyle.backgroundColor.neutral700,
                ApplicationStyle.borderRadius12,
                {
                  color: Colors.neutral00,
                  flex: 1,
                  minHeight: 42,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                },
              ]}
              value={String(relationManualId?.[fieldName] || '')}
            />
            <TouchableOpacity
              onPress={() => {
                addRelationId(attribute, relationManualId?.[fieldName]);
                setRelationManualId((previous) => ({ ...previous, [fieldName]: '' }));
              }}
              style={[
                ApplicationStyle.backgroundColor.primary500,
                ApplicationStyle.borderRadius12,
                {
                  justifyContent: 'center',
                  minHeight: 42,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
                {t('superAdminContentManager.actions.addId', 'Ajouter ID')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[8]]}>
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => setRelationQueries((previous) => ({ ...previous, [fieldName]: value }))}
            placeholder={t('superAdminContentManager.form.searchRelationPlaceholder', 'Rechercher une relation...')}
            placeholderTextColor={Colors.neutral300}
            style={[
              ApplicationStyle.backgroundColor.neutral700,
              ApplicationStyle.borderRadius12,
              {
                color: Colors.neutral00,
                flex: 1,
                minHeight: 42,
                paddingHorizontal: 12,
                paddingVertical: 8,
              },
            ]}
            value={String(relationQueries?.[fieldName] || '')}
          />
          <TouchableOpacity
            onPress={() => handleRelationSearch(attribute)}
            style={[
              ApplicationStyle.backgroundColor.primary500,
              ApplicationStyle.borderRadius12,
              {
                justifyContent: 'center',
                minHeight: 42,
                paddingHorizontal: 12,
              },
            ]}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
              {relationLoadingField === fieldName
                ? '...'
                : t('superAdminContentManager.actions.search', 'Chercher')}
            </Text>
          </TouchableOpacity>
        </View>

        {results.length > 0 ? (
          <View style={[Spaces.marginTop[8], Spaces.gap[8]]}>
            {results.map((item) => (
              <TouchableOpacity
                key={item?.documentId}
                onPress={() => addRelationId(attribute, item?.documentId)}
                style={[
                  ApplicationStyle.backgroundColor.neutral700,
                  ApplicationStyle.borderRadius12,
                  Spaces.paddingHorizontal[10],
                  Spaces.paddingVertical[8],
                ]}
              >
                <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>{item?.label || item?.documentId}</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[2]]}>
                  {item?.subtitle || item?.documentId}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderMediaField = (attribute) => {
    const fieldName = attribute?.name;
    const selectedItems = normalizeMediaItems(formValues?.[fieldName]);
    const isMultiple = Boolean(attribute?.multiple);
    const isUploading = mediaUploadingField === fieldName;
    const allowedTypes = Array.isArray(attribute?.allowedTypes) ? attribute.allowedTypes : [];
    const allowedText = allowedTypes.length > 0 ? allowedTypes.join(', ') : null;

    return (
      <View
        key={fieldName}
        style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[14],
          Spaces.marginBottom[12],
        ]}
      >
        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{getFieldLabel(attribute)}</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
          {isMultiple
            ? t('superAdminContentManager.form.mediaMultipleAllowed', 'Media multiple autorise')
            : t('superAdminContentManager.form.mediaSingle', 'Media unique')}
        </Text>
        {allowedText ? (
          <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[2]]}>
            {t('superAdminContentManager.form.allowedTypes', 'Types autorises')}
            {': '}
            {' '}
            {allowedText}
          </Text>
        ) : null}

        <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8], Spaces.marginTop[8]]}>
          <TouchableOpacity
            disabled={isUploading}
            onPress={() => pickMediaFromLibrary(attribute)}
            style={[
              ApplicationStyle.backgroundColor.neutral700,
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
            ]}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
              {t('superAdminContentManager.media.gallery', 'Galerie')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isUploading}
            onPress={() => pickMediaFromCamera(attribute)}
            style={[
              ApplicationStyle.backgroundColor.neutral700,
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
            ]}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
              {t('superAdminContentManager.media.camera', 'Camera')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isUploading}
            onPress={() => pickMediaFromDocument(attribute)}
            style={[
              ApplicationStyle.backgroundColor.neutral700,
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
            ]}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
              {t('superAdminContentManager.media.file', 'Fichier')}
            </Text>
          </TouchableOpacity>
        </View>

        {isUploading ? (
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], Spaces.marginTop[8]]}>
            <ActivityIndicator color={Colors.primary500} />
            <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
              {t('superAdminContentManager.form.uploading', 'Upload en cours...')}
            </Text>
          </View>
        ) : null}

        {selectedItems.length === 0 ? (
          <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
            {t('superAdminContentManager.form.noMediaSelected', 'Aucun media selectionne.')}
          </Text>
        ) : (
          <View style={[Spaces.marginTop[8], Spaces.gap[8]]}>
            {selectedItems.map((item, index) => {
              const itemKey = `${getMediaKey(item) || 'media'}-${index}`;
              const itemLabel = item?.name || item?.url || item?.documentId || item?.id || 'Fichier';
              const itemSubtitle = item?.mime || item?.documentId || (item?.id ? `id ${item.id}` : '');
              return (
                <View
                  key={itemKey}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    ApplicationStyle.backgroundColor.neutral700,
                    ApplicationStyle.borderRadius12,
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[8],
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral00 }]}>
                      {itemLabel}
                    </Text>
                    {itemSubtitle ? (
                      <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[2]]}>
                        {itemSubtitle}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity disabled={isUploading} onPress={() => removeMediaFromField(attribute, item)}>
                    <Text style={[Fonts.p2, { color: Colors.error500 }]}>
                      {t('superAdminContentManager.actions.remove', 'Retirer')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderScalarField = (attribute) => {
    const fieldName = attribute?.name;
    const type = String(attribute?.type || '');
    const value = formValues?.[fieldName];

    if (type === 'relation') {
      return renderRelationField(attribute);
    }

    if (type === MEDIA_TYPE) {
      return renderMediaField(attribute);
    }

    if (type === 'boolean') {
      const current = value;
      const variants = [
        { label: t('superAdminContentManager.form.yes', 'Oui'), value: true },
        { label: t('superAdminContentManager.form.no', 'Non'), value: false },
        { label: t('superAdminContentManager.form.none', 'Aucun'), value: null },
      ];

      return (
        <View
          key={fieldName}
          style={[
            ApplicationStyle.backgroundColor.neutral800,
            ApplicationStyle.borderRadius16,
            Spaces.padding[14],
            Spaces.marginBottom[12],
          ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{getFieldLabel(attribute)}</Text>
          <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[8]]}>
            {variants.map((variant) => (
              <TouchableOpacity
                key={variant.label}
                onPress={() => handleFieldValue(fieldName, variant.value)}
                style={[
                  ApplicationStyle.borderRadius12,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  {
                    backgroundColor: current === variant.value ? Colors.primary500 : Colors.neutral700,
                  },
                ]}
              >
                <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>{variant.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (type === 'enumeration') {
      const options = Array.isArray(attribute?.enum) ? attribute.enum : [];
      return (
        <View
          key={fieldName}
          style={[
            ApplicationStyle.backgroundColor.neutral800,
            ApplicationStyle.borderRadius16,
            Spaces.padding[14],
            Spaces.marginBottom[12],
          ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{getFieldLabel(attribute)}</Text>
          <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8], Spaces.marginTop[8]]}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => handleFieldValue(fieldName, option)}
                style={[
                  ApplicationStyle.borderRadius12,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  {
                    backgroundColor: value === option ? Colors.primary500 : Colors.neutral700,
                  },
                ]}
              >
                <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    const multiline = type === 'text' || type === 'richtext' || JSON_TYPES.has(type);
    const keyboardType = NUMBER_TYPES.has(type) ? 'numeric' : 'default';

    return (
      <View
        key={fieldName}
        style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[14],
          Spaces.marginBottom[12],
        ]}
      >
        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{getFieldLabel(attribute)}</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
          {t('superAdminContentManager.form.type', 'Type')}
          {': '}
          {type}
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={(nextValue) => handleFieldValue(fieldName, nextValue)}
          placeholder={type === 'datetime' ? '2026-03-07T10:30:00.000Z' : ''}
          placeholderTextColor={Colors.neutral300}
          style={[
            ApplicationStyle.backgroundColor.neutral700,
            ApplicationStyle.borderRadius12,
            {
              color: Colors.neutral00,
              marginTop: 8,
              minHeight: multiline ? 120 : 42,
              paddingHorizontal: 12,
              paddingVertical: 8,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
          value={value === null || value === undefined ? '' : String(value)}
        />
      </View>
    );
  };

  const renderSection = (sectionKey, title, description) => {
    const attributes = groupedAttributes?.[sectionKey] || [];
    if (!attributes.length) return null;

    return (
      <View style={Spaces.marginBottom[16]}>
        <Text style={[Fonts.h4, Fonts.neutral00]}>{title}</Text>
        {description ? (
          <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[4]]}>{description}</Text>
        ) : null}
        <View style={Spaces.marginTop[10]}>
          {attributes.map((attribute) => renderScalarField(attribute))}
        </View>
      </View>
    );
  };

  if (!isHydrated) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
          <ActivityIndicator color={Colors.primary500} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[32]]}>
        <View style={[Spaces.marginTop[16], Spaces.marginBottom[12]]}>
          <Text style={[Fonts.h3, Fonts.neutral00]}>
            {isEditMode
              ? t('superAdminContentManager.form.titleEdit', 'Modifier une entree')
              : t('superAdminContentManager.form.titleCreate', 'Creer une entree')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
            {uidDisplayName}
          </Text>
          {isEditMode ? (
            <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[2]]}>
              {documentId}
            </Text>
          ) : null}
        </View>

        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[14],
          Spaces.marginBottom[12],
        ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>
            {`${t('superAdminContentManager.form.editableFields', 'Champs editables')} (${editableAttributes.length})`}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
            {editableAttributes.map((attribute) => attribute?.name).join(', ')
              || t('superAdminContentManager.form.noEditableFields', 'Aucun champ detecte')}
          </Text>
        </View>

        {renderSection(
          'scalars',
          t('superAdminContentManager.form.sections.scalars', 'Scalaires'),
          t('superAdminContentManager.form.sections.scalarsHint', 'Texte, nombres et dates.'),
        )}

        {renderSection(
          'booleanEnum',
          t('superAdminContentManager.form.sections.booleanEnum', 'Booleens / Enums'),
          t('superAdminContentManager.form.sections.booleanEnumHint', 'Valeurs a choix rapide.'),
        )}

        {renderSection(
          'relations',
          t('superAdminContentManager.form.sections.relations', 'Relations'),
          t('superAdminContentManager.form.sections.relationsHint', 'Associez des entrees liees.'),
        )}

        {renderSection(
          'media',
          t('superAdminContentManager.form.sections.media', 'Medias'),
          t('superAdminContentManager.form.sections.mediaHint', 'Ajoutez images ou fichiers.'),
        )}

        {renderSection(
          'advanced',
          t('superAdminContentManager.form.sections.advanced', 'Avance'),
          t('superAdminContentManager.form.sections.advancedHint', 'JSON, rich text et champs complexes.'),
        )}

        {unsupportedAttributes.length > 0 ? (
          <View style={[
            ApplicationStyle.backgroundColor.neutral800,
            ApplicationStyle.borderRadius16,
            Spaces.padding[14],
            Spaces.marginBottom[12],
          ]}
          >
            <TouchableOpacity
              onPress={() => setShowRawFallback((previous) => !previous)}
              style={[Alignments.row, Alignments.alignCenter, { justifyContent: 'space-between' }]}
            >
              <Text style={[Fonts.h4, { color: Colors.warning500 }]}>
                {`${t('superAdminContentManager.form.rawFallbackTitle', 'Fallback JSON avance')} (${unsupportedAttributes.length})`}
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>
                {showRawFallback
                  ? t('superAdminContentManager.actions.hide', 'Masquer')
                  : t('superAdminContentManager.actions.show', 'Afficher')}
              </Text>
            </TouchableOpacity>
            {showRawFallback ? (
              <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[8]]}>
                {t('superAdminContentManager.form.rawFallbackHint', 'Champs non totalement supportes en mode guide:')}
                {' '}
                {unsupportedAttributes.map((attribute) => attribute?.name).join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[14],
        ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>
            {t('superAdminContentManager.form.reasonLabel', 'Raison (optionnelle sauf regles sensibles)')}
          </Text>
          <TextInput
            onChangeText={setReason}
            placeholder={t('superAdminContentManager.form.reasonPlaceholder', 'Ajouter un contexte d audit')}
            placeholderTextColor={Colors.neutral300}
            style={[
              ApplicationStyle.backgroundColor.neutral700,
              ApplicationStyle.borderRadius12,
              {
                color: Colors.neutral00,
                minHeight: 44,
                paddingHorizontal: 12,
                paddingVertical: 10,
              },
            ]}
            value={reason}
          />
        </View>

        <TouchableOpacity
          disabled={isSubmitting}
          onPress={handleSave}
          style={[
            ApplicationStyle.backgroundColor.primary500,
            ApplicationStyle.borderRadius16,
            Spaces.paddingVertical[14],
            Spaces.marginTop[14],
          ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00, textAlign: 'center' }]}>
            {isSubmitting
              ? t('superAdminContentManager.actions.saving', 'Enregistrement...')
              : t('superAdminContentManager.actions.save', 'Enregistrer')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

export default SuperAdminEntryForm;
