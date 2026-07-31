import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { useTour } from '@/context/TourContext';

// Hauteur laissée sous le bandeau : dock flottant + marge de respiration.
const TOUR_BANNER_DOCK_CLEARANCE = 92;

/**
 * Bandeau flottant du tour guidé v2 : instruction de l'étape courante,
 * progression x/y, validation manuelle et message de succès. Monté une seule
 * fois au-dessus du navigateur (voir AppProviders).
 *
 * Il est en surimpression et ne réserve AUCUN espace dans les écrans : publier
 * sa hauteur mesurée décalait les 149 écrans à chaque changement de forme
 * (R03, audit 2026-07-31 §2.2). Il se replie en pastille pour ne pas masquer
 * les CTA des tunnels.
 *
 * Portes de sortie (décision Q2 du 2026-07-31) : « Quitter le tour » est
 * disponible dans tous les états interactifs (plein, pause, pastille), et les
 * étapes à signal automatique offrent toujours « Passer » — hors ligne, leur
 * signal n'arrive jamais (cas C3 de l'audit).
 * @returns {import('react').ReactElement | null}
 */
function TourBanner() {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    completeCurrentStep,
    currentStep,
    exitTour,
    isTourActive,
    resumeTour,
    stepIndex,
    totalSteps,
    tourStatus,
  } = useTour();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const isSignalStep = currentStep?.success?.type !== 'manual';
  const bannerBottomOffset = Math.max(insets.bottom, 12) + TOUR_BANNER_DOCK_CLEARANCE;

  // Etape a validation automatique (ex. tunnel equipe/evenement) : la page a ses
  // propres CTA — le bandeau se replie en pastille pour ne jamais les masquer.
  useEffect(() => {
    setIsCollapsed(false);
    // L'auto-repli ne concerne que les etapes actives a signal automatique ; le
    // bandeau « en pause » (Reprendre le tour) se replie uniquement a la main.
    if (!currentStep || currentStep.success?.type === 'manual' || tourStatus === 'paused') {
      return undefined;
    }
    const timer = setTimeout(() => setIsCollapsed(true), 3500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id, tourStatus]);

  if (!isTourActive || !currentStep) return null;

  const quitButton = (
    <TouchableOpacity
      accessibilityLabel="Quitter le tour"
      accessibilityRole="button"
      hitSlop={8}
      onPress={exitTour}
    >
      <Text style={[Fonts.p3Bold, Fonts.neutral400]}>Quitter le tour</Text>
    </TouchableOpacity>
  );

  // Pastille repliee (toucher pour rouvrir) — disponible depuis tous les etats,
  // y compris « en pause », pour liberer l'espace en bas de l'ecran.
  if (isCollapsed) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(4,31,44,0.97)',
          borderColor: `${Colors.primary500}33`,
          borderRadius: 999,
          borderWidth: 1,
          bottom: bannerBottomOffset,
          columnGap: 10,
          elevation: 6,
          flexDirection: 'row',
          left: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          position: 'absolute',
        }}
      >
        <TouchableOpacity
          accessibilityLabel="Afficher le tour guidé"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setIsCollapsed(false)}
          style={{ alignItems: 'center', columnGap: 6, flexDirection: 'row' }}
        >
          <View style={{
            backgroundColor: Colors.primary500, borderRadius: 999, height: 7, width: 7,
          }}
          />
          <Text style={[Fonts.p4Bold, Fonts.neutral100]}>
            {`Tour ${stepIndex + 1}/${totalSteps}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Quitter le tour"
          accessibilityRole="button"
          hitSlop={8}
          onPress={exitTour}
        >
          <Text style={[Fonts.p4Bold, Fonts.neutral400]}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // R02 : encadré allégé — moins de matière (padding, rayon, bordure, ombre)
  // pour la même lisibilité (texte inchangé sur fond sombre à 4,5:1).
  const containerStyle = {
    backgroundColor: 'rgba(4,31,44,0.97)',
    borderColor: `${Colors.primary500}33`,
    borderRadius: 16,
    borderWidth: 1,
    bottom: bannerBottomOffset,
    elevation: 6,
    left: 12,
    position: /** @type {'absolute'} */ ('absolute'),
    right: 12,
    shadowColor: '#000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  };

  if (tourStatus === 'paused') {
    return (
      <View style={[containerStyle, Spaces.padding[12], Spaces.gap[8]]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {`Ton tour guidé t'attend (étape ${stepIndex + 1}/${totalSteps})`}
          </Text>
          <TouchableOpacity
            accessibilityLabel="Réduire le tour"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setIsCollapsed(true)}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral400]}>—</Text>
          </TouchableOpacity>
        </View>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={resumeTour}
            style={{
              backgroundColor: Colors.primary500,
              borderRadius: 999,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary900]}>Reprendre le tour</Text>
          </TouchableOpacity>
          <View style={Alignments.fill} />
          {quitButton}
        </View>
      </View>
    );
  }

  if (tourStatus === 'success') {
    return (
      <View
        style={[
          containerStyle,
          Spaces.padding[12],
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[12],
          { borderColor: `${Colors.success500}66` },
        ]}
      >
        <View
          style={{
            alignItems: 'center',
            backgroundColor: `${Colors.success500}29`,
            borderRadius: 999,
            height: 30,
            justifyContent: 'center',
            width: 30,
          }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.success500 }]}>✓</Text>
        </View>
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
          {currentStep.successMessage}
        </Text>
      </View>
    );
  }

  return (
    <View style={[containerStyle, Spaces.padding[12], Spaces.gap[8]]}>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <Text
          style={[Fonts.p4Bold, Fonts.primary500, { letterSpacing: 1, textTransform: 'uppercase' }]}
        >
          {`Tour guidé · étape ${stepIndex + 1} sur ${totalSteps}`}
        </Text>
        <View style={Alignments.fill} />
        {isSignalStep ? (
          <TouchableOpacity
            accessibilityLabel="Réduire le tour"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setIsCollapsed(true)}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral400]}>—</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{currentStep.title}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{currentStep.instruction}</Text>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], Spaces.marginTop[4]]}>
        {currentStep.success?.type === 'manual' || currentStep.manualLabel ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => completeCurrentStep()}
            style={{
              backgroundColor: Colors.primary500,
              borderRadius: 999,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary900]}>
              {currentStep.manualLabel || 'Étape suivante'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {isSignalStep || currentStep.skipLabel ? (
          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => completeCurrentStep({ skipped: true })}
          >
            <Text style={[Fonts.p3Bold, Fonts.neutral400]}>
              {currentStep.skipLabel || 'Passer'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <View style={Alignments.fill} />
        {quitButton}
      </View>
    </View>
  );
}

export default TourBanner;
