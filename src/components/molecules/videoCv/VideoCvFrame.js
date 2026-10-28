import { Pressable, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import texteVideoCv from '@/components/molecules/videoCv/videoCvCopy';

/** Largeur maximale du lecteur sur un grand écran (planche, repli S2 : 720 px). */
export const VIDEO_CV_MAX_WIDTH = 720;

/** Les trois échecs de la planche M9 → le préfixe de leurs textes. */
const ERROR_STATES = ['embed', 'network', 'unavailable'];

/**
 * VIDEOCV — le cadre commun au téléphone et au site : la zone 16/9 (miniature, lecteur ou
 * message d'échec, planche M9) puis le lien « Ouvrir dans YouTube », toujours présent.
 * @param {object} props
 * @param {string} props.canonicalUrl
 * @param {boolean} props.isOwner
 * @param {import('react').ReactNode} props.media - Miniature ou lecteur ; ignoré sur un échec.
 * @param {() => void} props.onOpenYoutube
 * @param {() => void} props.onRetry
 * @param {'idle' | 'playing' | 'unavailable' | 'embed' | 'network'} props.state
 * @param {string} props.testID
 * @returns {import('react').ReactElement}
 */
function VideoCvFrame({
  canonicalUrl, isOwner, media, onOpenYoutube, onRetry, state, testID,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const echec = ERROR_STATES.includes(state);

  return (
    <View style={[Spaces.gap[12], { maxWidth: VIDEO_CV_MAX_WIDTH, width: '100%' }]} testID={testID}>
      <View
        style={[
          ApplicationStyle.borderRadius12,
          ApplicationStyle.borderWidth1,
          {
            aspectRatio: 16 / 9,
            backgroundColor: Colors.primary800,
            borderColor: withAlpha(Colors.neutral00, 0.12),
            overflow: 'hidden',
            width: '100%',
          },
        ]}
      >
        {echec ? (
          <View
            style={[Spaces.padding[16], Spaces.gap[8], { flex: 1, justifyContent: 'center' }]}
            testID={`${testID}-error-${state}`}
          >
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {texteVideoCv(/** @type {any} */ (`errors.${state}.title`))}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {texteVideoCv(/** @type {any} */ (`errors.${state}.body`))}
            </Text>
            {state === 'unavailable' && isOwner ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {texteVideoCv('errors.unavailable.owner')}
              </Text>
            ) : null}
            {state === 'network' ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
                testID={`${testID}-retry`}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary200]}>{texteVideoCv('retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : media}
      </View>
      <Pressable
        accessibilityHint={canonicalUrl}
        accessibilityRole="link"
        onPress={onOpenYoutube}
        style={[Spaces.gap[8], {
          alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', minHeight: 44,
        }]}
        testID={`${testID}-open-youtube`}
      >
        <Svg fill="none" height={16} viewBox="0 0 24 24" width={16}>
          <Path
            d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
            stroke={Colors.primary200}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </Svg>
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>{texteVideoCv('openInYoutube')}</Text>
      </Pressable>
    </View>
  );
}

export default VideoCvFrame;
