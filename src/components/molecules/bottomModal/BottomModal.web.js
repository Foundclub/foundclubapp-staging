import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/** Les feuilles ouvertes, de la plus ancienne à celle du dessus (Échap ferme la dernière). */
/** @type {Array<() => void>} */
const FEUILLES_OUVERTES = [];

/**
 * Web replacement for the mobile bottom sheet.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {() => void} props.close
 * @param {import('react-native').ViewStyle} [props.contentContainerStyle]
 * @param {React.ReactNode} [props.headerComponent]
 * @param {React.ReactNode} [props.footerComponent]
 * @param {boolean} [props.hideCloseButton]
 * @param {boolean} props.isVisible
 * @param {boolean} [props.scrollable]
 * @param {boolean} [props.closeOnBackdropPress]
 * @param {(string|number)[]} [props.snapPoints]
 * @param {import('react-native').ViewStyle} [props.style]
 * @param {'sheet' | 'dialog'} [props.webPresentation]
 * @param {number} [props.webZIndex] - R17-QUAND-2-BIS : la couche de la feuille (1100 par defaut,
 *   sous les toasts et les invites). Une feuille ouverte DEPUIS un <Modal> de react-native-web
 *   (couche 9999, ex. le tunnel plein ecran) doit passer au-dessus de lui.
 * @returns {import('react').ReactElement | null}
 */
function BottomModal({
  children,
  close,
  closeOnBackdropPress = true,
  contentContainerStyle,
  footerComponent,
  headerComponent,
  hideCloseButton = true,
  isVisible,
  scrollable = true,
  snapPoints,
  style,
  webPresentation = 'sheet',
  webZIndex = 1100,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  // RESA-FIN-SITE (21/10/2026, décision du chef du 22/10) — au clavier, Échap ferme la feuille :
  // sans croix (`hideCloseButton` par défaut), on ne pouvait pas en sortir. Comme le fond : une
  // feuille que l'appelant garde ouverte (`closeOnBackdropPress={false}`) le reste. Deux feuilles
  // l'une sur l'autre : seule celle du dessus se ferme. Écoutée à la DESCENTE : un TextInput de
  // react-native-web arrête la touche avant le document (piège du 08/10).
  const fermerRef = useRef(close);
  useEffect(() => {
    fermerRef.current = close;
  }, [close]);
  useEffect(() => {
    if (!closeOnBackdropPress || !isVisible || typeof document === 'undefined') return undefined;
    const fermer = () => fermerRef.current?.();
    FEUILLES_OUVERTES.push(fermer);
    const surTouche = (/** @type {KeyboardEvent} */ evenement) => {
      const dessus = FEUILLES_OUVERTES[FEUILLES_OUVERTES.length - 1];
      if (evenement.key !== 'Escape' || dessus !== fermer) return;
      evenement.stopPropagation();
      fermer();
    };
    document.addEventListener('keydown', surTouche, true);
    return () => {
      document.removeEventListener('keydown', surTouche, true);
      const rang = FEUILLES_OUVERTES.indexOf(fermer);
      if (rang >= 0) FEUILLES_OUVERTES.splice(rang, 1);
    };
  }, [closeOnBackdropPress, isVisible]);

  // ⌨️ CLAVREGLE (23/10) — un champ touché reste au-dessus du clavier, comme dans l'app
  // (BottomModal.js). La feuille est fixée au bas de la PAGE ; sur un téléphone, le clavier ne
  // réduit que la zone VISIBLE (`visualViewport`) : la feuille restait dessous. Elle se pose au bas
  // de la zone visible. Un zoom au doigt réduit aussi cette zone : on ne suit qu'à l'échelle 1.
  // Témoin : __tests__/BottomModalWebCLAVREGLE.clavier.test.js.
  const [hauteurDuClavier, setHauteurDuClavier] = useState(0);
  useEffect(() => {
    const zoneVisible = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!isVisible || !zoneVisible) return undefined;
    const mesurer = () => {
      const recouvert = window.innerHeight - zoneVisible.height - zoneVisible.offsetTop;
      setHauteurDuClavier(Math.abs(zoneVisible.scale - 1) < 0.01 ? Math.max(0, Math.round(recouvert)) : 0);
    };
    mesurer();
    zoneVisible.addEventListener('resize', mesurer);
    zoneVisible.addEventListener('scroll', mesurer);
    return () => {
      zoneVisible.removeEventListener('resize', mesurer);
      zoneVisible.removeEventListener('scroll', mesurer);
      setHauteurDuClavier(0);
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const isDialog = webPresentation === 'dialog';
  const firstSnapPoint = Array.isArray(snapPoints) && snapPoints.length > 0 ? snapPoints[0] : undefined;
  const sheetSizeStyle = isDialog
    ? {
      maxHeight: 'calc(100vh - 48px)',
      maxWidth: 680,
      minHeight: 0,
      width: 'calc(100vw - 32px)',
    }
    : firstSnapPoint !== undefined
      ? {
        height: typeof firstSnapPoint === 'number' ? firstSnapPoint : firstSnapPoint,
        maxHeight: '92%',
      }
      : {
        maxHeight: '86%',
        minHeight: 220,
      };

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[
        Spaces.paddingHorizontal[24],
        Spaces.paddingTop[16],
        Spaces.paddingBottom[24],
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      style={[Alignments.fill, { maxHeight: isDialog ? 520 : 420 }]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        Spaces.paddingHorizontal[24],
        Spaces.paddingTop[16],
        Spaces.paddingBottom[24],
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  const modalContent = (
    <View
      style={[
        isDialog ? Alignments.justifyCenter : Alignments.justifyEnd,
        isDialog ? Alignments.alignCenter : null,
        {
          bottom: hauteurDuClavier,
          left: 0,
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: webZIndex,
        },
      ]}
    >
      <Pressable
        onPress={closeOnBackdropPress ? close : undefined}
        style={[
          Alignments.absolute,
          Alignments.fullSize,
          {
            backgroundColor: withAlpha(Colors.primary900, 0.72),
          },
        ]}
      />
      <View
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius32,
          {
            borderBottomLeftRadius: isDialog ? 32 : 0,
            borderBottomRightRadius: isDialog ? 32 : 0,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            boxShadow: `0 28px 60px ${withAlpha(Colors.primary900, 0.45)}`,
            overflow: 'hidden',
            paddingTop: hideCloseButton ? (isDialog ? 24 : 20) : 28,
            width: isDialog ? undefined : '100%',
          },
          sheetSizeStyle,
          style,
        ]}
      >
        {headerComponent ? (
          <View style={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[12]]}>
            {headerComponent}
          </View>
        ) : null}
        {content}
        {footerComponent ? (
          <View
            style={[
              Spaces.paddingHorizontal[24],
              Spaces.paddingTop[16],
              Spaces.paddingBottom[24],
              {
                backgroundColor: Colors.primary700,
                borderTopColor: withAlpha(Colors.neutral00, 0.1),
                borderTopWidth: 1,
              },
            ]}
          >
            {footerComponent}
          </View>
        ) : null}
        {!hideCloseButton ? (
          <TouchableOpacity
            accessibilityLabel={t('common.close')}
            accessibilityRole="button"
            hitSlop={ApplicationStyle.hitSlop.min44From28}
            onPress={close}
            style={[
              Alignments.absolute,
              {
                height: 28,
                right: 20,
                top: 20,
                width: 28,
              },
            ]}
          >
            <View
              style={[
                Alignments.fill,
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.08),
                  borderRadius: 14,
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>x</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}

export default BottomModal;
