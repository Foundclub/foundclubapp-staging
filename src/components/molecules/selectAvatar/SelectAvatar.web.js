import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * SelectAvatar web variant.
 * Keeps the same API as native, but uses a browser file input instead of the mobile picker stack.
 * @param {object} props
 * @param {Avatar | undefined} props.currentAvatar
 * @param {(avatar: Avatar) => void} props.onAvatarSelected
 * @param {() => void} [props.onDelete]
 * @param {number} [props.size]
 * @param {'cover' | 'contain' | 'stretch' | 'center' | 'repeat'} [props.imageResizeMode]
 * @param {import('react-native').ViewStyle} [props.containerStyle]
 * @param {import('react-native').ImageStyle} [props.imageStyle]
 * @returns {import('react').ReactElement}
 */
function SelectAvatar({
  containerStyle,
  currentAvatar,
  imageResizeMode = 'cover',
  imageStyle,
  onAvatarSelected,
  onDelete,
  size = 95,
}) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [localError, setLocalError] = useState('');
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  /**
   * @param {File | undefined} file
   */
  const handleFileSelection = (file) => {
    if (!file) {
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      onAvatarSelected({
        file,
        fileName: file.name,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        name: file.name,
        path: objectUrl,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uri: objectUrl,
        url: '',
      });
      setLocalError('');
    } catch (error) {
      setLocalError(
        t(
          'profile.actions.avatarPickerUnavailable',
          'Le selecteur d image est indisponible sur ce navigateur.',
        ),
      );
    }
  };

  const handleOpenPicker = () => {
    inputRef.current?.click();
  };

  const handleDelete = () => {
    if (!onDelete) return;

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(t('profile.actions.confirmDeleteAvatar'));

    if (confirmed) {
      onDelete();
      setLocalError('');
    }
  };

  return (
    <View style={[Spaces.gap[12], Alignments.alignCenter]}>
      <input
        accept="image/*"
        onChange={(event) => {
          const nextFile = event.currentTarget.files?.[0];
          handleFileSelection(nextFile);
          event.currentTarget.value = '';
        }}
        ref={inputRef}
        style={{ display: 'none' }}
        type="file"
      />

      <View
        style={[
          ApplicationStyle.backgroundColor.neutral00,
          ApplicationStyle.borderRadius24,
          Alignments.relative,
          Alignments.alignCenter,
          Alignments.justifyCenter,
          { height: size, width: size },
          containerStyle,
        ]}
      >
        {currentAvatar?.url || currentAvatar?.path ? (
          <>
            <Image
              resizeMode={imageResizeMode}
              source={{ uri: currentAvatar.path || getImageUrl(currentAvatar.url) }}
              style={[
                ApplicationStyle.borderRadius24,
                { height: size, width: size },
                imageStyle,
              ]}
            />
            {onDelete ? (
              <TouchableOpacity
                accessibilityHint={t('profile.actions.confirmDeleteAvatar')}
                accessibilityLabel={t('common.actions.delete')}
                accessibilityRole="button"
                hitSlop={ApplicationStyle.hitSlop.min44From32}
                onPress={handleDelete}
                style={[
                  Alignments.absolute,
                  ApplicationStyle.backgroundColor.error700,
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[8],
                  {
                    bottom: -8,
                    right: -8,
                    zIndex: 10,
                  },
                ]}
              >
                <Image
                  source={Images.trash}
                  style={[
                    ApplicationStyle.icon16,
                    ApplicationStyle.tintColor.neutral00,
                  ]}
                />
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <Image
            source={Images.camera}
            style={[
              ApplicationStyle.icon48,
              Spaces.margin[24],
              ApplicationStyle.tintColor.primary500,
            ]}
          />
        )}

        <TouchableOpacity
          accessibilityLabel={t('common.actions.photoFromGallery')}
          accessibilityRole="button"
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={handleOpenPicker}
          style={[
            Alignments.absolute,
            ApplicationStyle.backgroundColor.primary500,
            ApplicationStyle.borderRadius32,
            Spaces.padding[12],
            { right: -12, top: -12 },
          ]}
        >
          <Image
            source={Images.plus}
            style={[
              ApplicationStyle.icon16,
              ApplicationStyle.tintColor.primary900,
            ]}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        accessibilityLabel={t('common.actions.photoFromGallery')}
        accessibilityRole="button"
        hitSlop={ApplicationStyle.hitSlop.min44From24}
        onPress={handleOpenPicker}
      >
        <Text style={[Fonts.p3Bold, Fonts.primary500]}>
          {t('common.actions.photoFromGallery', 'Choisir depuis la galerie')}
        </Text>
      </TouchableOpacity>

      {localError ? (
        <Text style={[Fonts.p2, Fonts.error700]}>
          {localError}
        </Text>
      ) : null}
    </View>
  );
}

export default SelectAvatar;
