import {
  Pressable, Text, useWindowDimensions, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import texteVideoCv from '@/components/molecules/videoCv/videoCvCopy';
import VideoCvPlayer from '@/components/molecules/videoCv/VideoCvPlayer';
import { parseYoutubeUrl } from '@/components/molecules/videoCv/youtubeUrl';

/**
 * VIDEOCV (28/10, planche validée par Adel, M1 à M5) — la carte « Ma vidéo » de Mon profil.
 * M1 vide : le champ, l'aide et la phrase de confidentialité. M2 lien collé : « Lien YouTube
 * reconnu », l'aperçu, « Retirer la vidéo ». M3 refus : l'erreur sous le champ et l'astuce de
 * partage. M4 retirée : le bandeau « La vidéo quittera ton profil ». M5 enregistrée : le lecteur
 * d'abord, puis le champ.
 * @param {object} props
 * @param {string} [props.error] - Message déjà traduit.
 * @param {() => void} [props.onBlur]
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.savedValue] - Le lien enregistré (forme canonique) ou vide.
 * @param {string} props.value
 * @returns {import('react').ReactElement}
 */
function VideoCvField({
  error, onBlur, onChange, savedValue = '', value,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const lu = parseYoutubeUrl(value);
  const valide = 'videoId' in lu;
  const lienEnregistre = parseYoutubeUrl(savedValue);
  const enregistree = valide && 'videoId' in lienEnregistre
    && lu.canonicalUrl === lienEnregistre.canonicalUrl;
  const retiree = 'empty' in lu && Boolean(String(savedValue || '').trim());
  // S1 (planche) : sur un écran d'au moins 1 024 px, le lecteur à gauche et le champ à droite.
  const coteACote = useWindowDimensions().width >= 1024 && valide;

  const lecteur = valide
    ? <VideoCvPlayer isOwner testID="video-cv-field-player" url={lu.canonicalUrl} />
    : null;
  const retirer = valide ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => onChange('')}
      style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
      testID="video-cv-field-remove"
    >
      <Text style={[Fonts.p2Bold, Fonts.error300]}>{texteVideoCv('form.remove')}</Text>
    </Pressable>
  ) : null;

  const champ = (
    <>
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        error={error}
        inputMode="url"
        keyboardType="url"
        label={texteVideoCv('form.label')}
        onBlur={onBlur}
        onChangeText={onChange}
        placeholder={texteVideoCv('form.placeholder')}
        testID="video-cv-field-input"
        value={String(value ?? '')}
      />
      {error ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {texteVideoCv('form.shareTip')}
        </Text>
      ) : null}
      {valide && !enregistree ? (
        <>
          <Text style={[Fonts.p3Bold, Fonts.success200]} testID="video-cv-field-recognized">
            {texteVideoCv('form.recognized')}
          </Text>
          {coteACote ? null : lecteur}
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {texteVideoCv('form.previewHint')}
          </Text>
        </>
      ) : null}
      {retirer}
      {retiree ? (
        <View
          accessibilityRole="text"
          style={[
            ApplicationStyle.borderRadius12,
            ApplicationStyle.borderWidth1,
            Spaces.padding[12],
            Spaces.gap[4],
            {
              backgroundColor: withAlpha(Colors.primary500, 0.12),
              borderColor: withAlpha(Colors.primary500, 0.45),
            },
          ]}
          testID="video-cv-field-removed"
        >
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {texteVideoCv('form.removedNotice')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {texteVideoCv('form.undoTip')}
          </Text>
        </View>
      ) : null}
      {'empty' in lu && !retiree ? (
        <>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {texteVideoCv('form.help')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {texteVideoCv('form.privacy')}
          </Text>
        </>
      ) : null}
    </>
  );

  return (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
        },
      ]}
      testID="video-cv-field"
    >
      {coteACote ? (
        <View style={[Spaces.gap[16], { alignItems: 'flex-start', flexDirection: 'row' }]}>
          <View style={{ flex: 3 }}>{lecteur}</View>
          <View style={[Spaces.gap[12], { flex: 2 }]}>
            {champ}
          </View>
        </View>
      ) : (
        <>
          {enregistree ? lecteur : null}
          {champ}
        </>
      )}
    </View>
  );
}

export default VideoCvField;
