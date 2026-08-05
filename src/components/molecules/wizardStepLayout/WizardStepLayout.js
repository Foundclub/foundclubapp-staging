import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Grammaires d'en-tete disponibles.
 *
 * C'est un MODE, pas un remplacement : `default` rend EXACTEMENT ce que les
 * 59 ecrans du depot rendaient avant le lot D05. Les tunnels basculent un par
 * un sur `focus` (lots D06 a D10), sans que les autres bougent d'un pixel.
 * Le filet `__tests__/WizardStepLayout.test.js` le prouve : ses 25 tests de
 * caracterisation decrivent `default` et n'ont pas ete touches.
 *
 * `focus` est la grammaire des deux packs de design du 2026-08-05
 * (`claude design/export/tunnel-evenement` et `.../profil-amical-annonces`) :
 * titre-question en graisse 900, cibles tactiles de 44 pt, barre de progression
 * fine, sous-titre tenu sur une ligne.
 *
 * La maquette demande un titre de 25 pt : la rampe typographique saute de 24
 * (`h2*`) a 28 (`h1*`), sans rien entre les deux. Arbitrage d'Adel du
 * 2026-08-05 : on prend `h1Black` (28 pt / 36 d'interlignage / Montserrat-Black),
 * parce que la graisse 900 demandee existe deja et qu'ecrire `fontSize: 25` en
 * dur sortirait de la rampe sans qu'aucune porte ne le voie.
 * @type {Record<'default' | 'focus', {
 *   collapsedTitleFont: 'h2' | 'h2Black',
 *   progressHeight: number,
 *   roundButtonSize: number,
 *   subtitleLines: number | undefined,
 *   titleFont: 'h1' | 'h1Black',
 * }>}
 */
const HEADER_VARIANTS = {
  default: {
    collapsedTitleFont: 'h2',
    progressHeight: 8,
    roundButtonSize: 40,
    subtitleLines: undefined,
    titleFont: 'h1',
  },
  focus: {
    collapsedTitleFont: 'h2Black',
    progressHeight: 4,
    roundButtonSize: 44,
    subtitleLines: 1,
    titleFont: 'h1Black',
  },
};

/**
 * Bouton rond du header de tunnel (retour / fermer) — handoff decision 2.
 * @param {object} props
 * @param {'arrowLeft' | 'close'} props.icon
 * @param {string} props.label - Libelle accessibilite.
 * @param {() => void} [props.onPress]
 * @param {number} [props.size] - Cote de la cible tactile, en points.
 * @returns {import('react').ReactElement}
 */
function WizardRoundButton({
  icon, label, onPress, size = 40,
}) {
  const { Colors, Images } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={{
        bottom: 6, left: 6, right: 6, top: 6,
      }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        borderColor: 'rgba(1,179,244,0.45)',
        borderRadius: 999,
        borderWidth: 1,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      <Image
        source={Images[icon]}
        style={{ height: 16, tintColor: Colors.primary500, width: 16 }}
      />
    </TouchableOpacity>
  );
}

/**
 * Gabarit d'etape de tunnel v2 (handoff decision 2) : fleche ronde de retour en
 * haut a gauche, « Étape n/N » au centre, fermeture ronde a droite, barre de
 * progression, CTA pleine largeur en bas + ghost « Passer cette étape ».
 * @param {object} root0
 * @param {import('react').ReactNode} root0.children
 * @param {boolean} [root0.collapsibleHeader]
 * @param {'default' | 'focus'} [root0.headerVariant] - Grammaire d'en-tete, voir
 *   HEADER_VARIANTS. `default` (valeur par defaut) ne change rien a l'existant.
 * @param {boolean} [root0.isNextDisabled]
 * @param {boolean} [root0.isNextLoading]
 * @param {string} [root0.nextLabel]
 * @param {() => void} [root0.onBack]
 * @param {() => void} [root0.onClose]
 * @param {() => void} [root0.onNext]
 * @param {() => void} [root0.onSkip]
 * @param {boolean} [root0.showSkip]
 * @param {string} [root0.skipLabel]
 * @param {number} [root0.stepCount]
 * @param {number} [root0.stepIndex]
 * @param {string} [root0.subtitle]
 * @param {string} root0.title
 * @returns {import('react').ReactElement}
 */
function WizardStepLayout({
  children,
  collapsibleHeader = false,
  headerVariant = 'default',
  isNextDisabled = false,
  isNextLoading = false,
  nextLabel,
  onBack,
  onClose,
  onNext,
  onSkip,
  showSkip = false,
  skipLabel,
  stepCount,
  stepIndex,
  subtitle,
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  // Un nom de grammaire inconnu retombe sur l'existant : un tunnel ne peut pas
  // perdre son en-tete a cause d'une faute de frappe.
  const header = HEADER_VARIANTS[headerVariant] || HEADER_VARIANTS.default;

  const safeStepIndex = Number(stepIndex);
  const safeStepCount = Number(stepCount);
  const hasProgress = Number.isFinite(safeStepIndex)
    && Number.isFinite(safeStepCount)
    && safeStepCount > 0;
  const normalizedProgress = hasProgress
    ? Math.max(0, Math.min(1, safeStepIndex / safeStepCount))
    : 0;
  const handleScroll = useCallback((/** @type {any} */ event) => {
    if (!collapsibleHeader) return;

    const offsetY = Number(event?.nativeEvent?.contentOffset?.y || 0);
    setIsHeaderCollapsed((currentValue) => {
      const nextValue = offsetY > 24;
      return currentValue === nextValue ? currentValue : nextValue;
    });
  }, [collapsibleHeader]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !onNext || isNextDisabled || isNextLoading) {
      return undefined;
    }

    /**
     * @param {KeyboardEvent} event
     */
    const handleWindowKeyDown = (event) => {
      if (
        event.defaultPrevented
        || event.key !== 'Enter'
        || event.shiftKey
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) {
        return;
      }

      const { target } = event;
      const htmlElementCtor = typeof window !== 'undefined' ? window.HTMLElement : undefined;
      const htmlInputCtor = typeof window !== 'undefined' ? window.HTMLInputElement : undefined;
      const isElement = typeof htmlElementCtor !== 'undefined'
        && target instanceof htmlElementCtor;
      const tagName = isElement ? target.tagName.toLowerCase() : '';
      const isEditable = isElement && target.isContentEditable;
      const inputType = typeof htmlInputCtor !== 'undefined'
        && target instanceof htmlInputCtor
        ? target.type
        : '';

      if (
        isEditable
        || tagName === 'textarea'
        || tagName === 'button'
        || tagName === 'a'
        || tagName === 'select'
        || (tagName === 'input'
          && ['button', 'checkbox', 'file', 'radio', 'submit'].includes(inputType))
      ) {
        return;
      }

      event.preventDefault();
      onNext();
    };

    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [isNextDisabled, isNextLoading, onNext]);

  return (
    <ScreenContainer
      bgImage="bg2"
      // Ce gabarit applique deja lui-meme le retrait bas systeme sur son contenu
      // (paddingBottom ci-dessous) : on renonce au plancher du conteneur pour ne
      // pas cumuler deux fois insets.bottom sous les boutons du wizard.
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifySpaceBetween,
        { paddingBottom: insets.bottom + 28 },
      ]}
      contentWidth={/** @type {any} */ ('readable')}
      responsivePadding
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={[Alignments.fill]}
      >
        <View style={[Alignments.fill]}>
          <View
            style={[
              Spaces.marginTop[16],
              isHeaderCollapsed ? Spaces.marginBottom[12] : Spaces.marginBottom[24],
            ]}
          >
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.marginBottom[12],
              ]}
            >
              {onBack ? (
                <WizardRoundButton
                  icon="arrowLeft"
                  label={t('common.back', 'Retour')}
                  onPress={onBack}
                  size={header.roundButtonSize}
                />
              ) : (
                // La place est reservee meme sans bouton : c'est elle qui tient
                // « Étape n/N » au centre exact de l'ecran.
                <View style={{ width: header.roundButtonSize }} />
              )}
              {hasProgress ? (
                <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                  {t('eventWizard.common.stepCounter', {
                    current: stepIndex,
                    defaultValue: `Étape ${stepIndex}/${stepCount}`,
                    total: stepCount,
                  })}
                </Text>
              ) : <View />}
              {onClose ? (
                <WizardRoundButton
                  icon="close"
                  label={t('common.close', 'Fermer')}
                  onPress={onClose}
                  size={header.roundButtonSize}
                />
              ) : (
                <View style={{ width: header.roundButtonSize }} />
              )}
            </View>
            {hasProgress ? (
              <View
                style={[
                  isHeaderCollapsed ? Spaces.marginBottom[12] : Spaces.marginBottom[16],
                  ApplicationStyle.card,
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.08)',
                    borderColor: 'rgba(1, 179, 244, 0.22)',
                    borderRadius: 999,
                    height: isHeaderCollapsed ? 4 : header.progressHeight,
                    overflow: 'hidden',
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 999,
                    height: '100%',
                    width: `${normalizedProgress * 100}%`,
                  }}
                />
              </View>
            ) : null}

            <Text
              numberOfLines={isHeaderCollapsed ? 1 : undefined}
              style={[
                Fonts[isHeaderCollapsed ? header.collapsedTitleFont : header.titleFont],
                Fonts.neutral00,
                isHeaderCollapsed ? Spaces.marginBottom[4] : Spaces.marginBottom[8],
              ]}
            >
              {title}
            </Text>
            {subtitle && !isHeaderCollapsed ? (
              <Text
                numberOfLines={header.subtitleLines}
                style={[Fonts.p2, Fonts.neutral100, { lineHeight: 22, maxWidth: 720 }]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[Spaces.paddingBottom[40]]}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>

        <View style={[Spaces.gap[12], Spaces.marginTop[16]]}>
          {onNext ? (
            <Button
              disabled={isNextDisabled}
              isLoading={isNextLoading}
              onPress={onNext}
              submitOnEnter
              title={nextLabel || t('common.next', 'Suivant')}
              variant="Primary"
            />
          ) : null}
          {showSkip ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onSkip}
              style={Spaces.paddingVertical[8]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral300, Fonts.textCenter]}>
                {skipLabel || t('teamWizard.actions.skipStep', 'Passer cette étape')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default WizardStepLayout;
