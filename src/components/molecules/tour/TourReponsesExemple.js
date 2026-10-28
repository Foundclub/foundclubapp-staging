import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Text, View } from 'react-native';

import { emitGuidanceAction } from '@/domains/guidance/guidanceRuntime';
import { exampleResponders } from '@/domains/tour/tourExamples';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { useTour } from '@/context/useTour';

// Un profil toutes les 0,6 s, puis 2,4 s à l'écran, puis le tout s'efface.
const ECART_MS = 600;
const VISIBLE_MS = 2400;
const FONDU_MS = 400;

/**
 * Bonus B1 du guide Entraîneur avec une équipe vide (GUIDE-BONUS, décision
 * d'Adel « 2- A », 28/10), sous le titre « Participants » de la séance :
 *   · sur b1-relance, signale au guide qu'il n'y a personne à relancer ;
 *   · sur b1-vide, fait répondre « présent » trois faux profils d'exemple, puis
 *     les efface. Animation locale : aucune requête, rien n'est gardé.
 * @param {{ equipeVide: boolean }} props - `equipeVide` : la séance n'a personne.
 * @returns {import('react').ReactElement | null}
 */
function TourReponsesExemple({ equipeVide }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { currentStep, isGuide, isTourActive } = useTour();
  const stepId = isGuide && isTourActive ? currentStep?.id : null;

  const signaleRef = useRef(false);
  useEffect(() => {
    if (stepId !== 'b1-relance' || !equipeVide || signaleRef.current) return;
    signaleRef.current = true;
    emitGuidanceAction('event.participants.empty');
  }, [equipeVide, stepId]);

  const [profils] = useState(exampleResponders);
  const opacites = useRef(profils.map(() => new Animated.Value(0))).current;
  const [fini, setFini] = useState(false);
  const enCours = stepId === 'b1-vide' && !fini;
  useEffect(() => {
    if (!enCours) return undefined;
    const entree = Animated.stagger(ECART_MS, opacites.map((opacite) => Animated.timing(opacite, {
      duration: FONDU_MS, toValue: 1, useNativeDriver: true,
    })));
    entree.start();
    const fin = ECART_MS * profils.length + VISIBLE_MS;
    const fondu = setTimeout(() => {
      Animated.parallel(opacites.map((opacite) => Animated.timing(opacite, {
        duration: FONDU_MS, toValue: 0, useNativeDriver: true,
      }))).start();
    }, fin);
    const efface = setTimeout(() => setFini(true), fin + FONDU_MS);
    return () => {
      entree.stop();
      clearTimeout(fondu);
      clearTimeout(efface);
    };
  }, [enCours, opacites, profils.length]);

  if (!enCours) return null;
  return (
    <View style={[Spaces.gap[8]]} testID="guide-reponses-exemple">
      <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
        {t('tourExamples.responders.label', 'Exemple · rien n’est envoyé')}
      </Text>
      {profils.map((profil, index) => (
        <Animated.View
          key={profil.documentId}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[12],
            { opacity: opacites[index] },
          ]}
        >
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.2),
                borderRadius: 18,
                height: 36,
                width: 36,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
              {`${profil.firstname[0]}${profil.lastname[0]}`}
            </Text>
          </View>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Alignments.fill]}>
            {`${profil.firstname} ${profil.lastname}`}
          </Text>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t('tourExamples.responders.present', 'Présent·e')}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

export default TourReponsesExemple;
