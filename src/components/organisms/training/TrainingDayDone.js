import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';

/**
 * « SÉANCE TERMINÉE ✓ » — RETOUR-ONGLET (d), A22 de l'audit V1 (maquette validée
 * par Adel le 30/09).
 *
 * 🔴 AVANT : « Terminer la journée » empilait une fiche de la journée par-dessus
 * « Ma séance ». Sans flèche, avec UN seul bouton qui promettait « les 128 mesures »
 * prévues… et ouvrait un carnet vide. Une ligne d'arrivée avec une seule porte, et
 * la porte ne s'ouvrait pas.
 *
 * ✅ ICI : ce qui s'est vraiment passé (le nombre de mesures SAISIES, ou « aucune »),
 * la suite (la prochaine séance), et DEUX portes écrites. La flèche « ‹ Mon
 * programme » est posée par l'écran appelant (`TrainingDay`, en-tête de la pile).
 *
 * 🪤 Android 16 perd le DERNIER MOT d'un texte gras de plusieurs mots dans une boîte
 * à sa largeur mesurée : les textes sont donc ÉTIRÉS (colonne sans `alignItems`,
 * `textAlign: 'center'`), jamais resserrés sur leur contenu.
 * @param {object} props
 * @param {Record<string, any> | null} props.day la journée qui vient d'être faite
 * @param {number} props.mesuresFaites le nombre de mesures saisies pendant la séance
 * @param {Record<string, any> | null} props.nextSession la prochaine séance, s'il y en a une
 * @param {() => void} props.onBackToProgram « Revenir à mon programme »
 * @param {() => void} props.onSeeMeasures « Voir mes mesures » (le carnet)
 * @returns {import('react').ReactElement} l'écran de fin de séance
 */
function TrainingDayDone(props) {
  const {
    day, mesuresFaites, nextSession, onBackToProgram, onSeeMeasures,
  } = props;
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const avecMesures = mesuresFaites > 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={[Spaces.gap[16], { flex: 1, justifyContent: 'center' }]}>
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            backgroundColor: withAlpha(Colors.success500, 0.16),
            borderRadius: 999,
            height: 88,
            justifyContent: 'center',
            width: 88,
          }}
        >
          <GlyphIcon color={Colors.success500} name="circleCheck" size={48} />
        </View>
        <View style={Spaces.gap[4]}>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Bold, { color: Colors.neutral00, textAlign: 'center' }]}
          >
            {t('training.done.title')}
          </Text>
          {day?.title ? (
            <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>
              {day.title}
            </Text>
          ) : null}
          <Text
            style={[
              Fonts.p2Bold,
              { color: avecMesures ? Colors.success500 : Colors.neutral300, textAlign: 'center' },
            ]}
          >
            {avecMesures
              ? t('training.done.measures', { count: mesuresFaites })
              : t('training.done.noMeasures')}
          </Text>
        </View>
        {nextSession ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.primary500, 0.08),
              borderColor: withAlpha(Colors.primary500, 0.2),
              borderRadius: 12,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              {t('training.done.next', {
                date: formatSessionDate(nextSession.plannedDate),
                title: nextSession.day?.title || '',
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[Spaces.gap[8], { paddingTop: 12 }]}>
        {/* À 0 mesure, la porte du carnet ne promet pas « mes mesures » (partie c). */}
        <Button
          onPress={onSeeMeasures}
          title={avecMesures ? t('training.done.seeMeasures') : t('training.day.openLogbook')}
          variant="Primary"
        />
        <Button
          onPress={onBackToProgram}
          title={t('training.done.backToProgram')}
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default TrainingDayDone;
