import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * ⚠️ LES PROPRIETES SONT DECRITES DANS UN `typedef`, ET C'EST DELIBERE.
 * Destructurer dans la signature fait nommer le parametre `root0` par
 * TypeScript, qui exige alors `@param {object} root0` — et ce type-la, trop
 * large, fait apparaitre une erreur PAR propriete au lieu de la retirer (piege
 * mesure et consigne dans `EventDetectionSlots.js`). Un `typedef` nomme donne
 * un vrai type a chaque propriete : zero erreur, et la forme est lisible.
 * @typedef {object} RailProps
 * @property {string} [note] - Une precision sous le fil, quand il y en a une a
 *   dire (« 2 inscriptions à vérifier »). Absente, rien ne s'affiche.
 * @property {{done?: boolean, label: string}[]} [steps] - Les etapes, dans
 *   l'ordre. Le rang affiche est la POSITION : il n'est pas passe, pour qu'on ne
 *   puisse pas le desynchroniser de l'ordre du tableau.
 * @property {string} title - Le titre du bloc.
 */

/**
 * 🧭 « OÙ EN EST LE TOURNOI » — le fil des cinq etapes (planche 04, cadre 4E).
 *
 * Un tournoi se monte en cinq gestes : on regle, on rassemble les equipes, on
 * fait les poules, on genere les matchs, on publie. La page n'en disait rien —
 * elle affichait « Compétition en brouillon » et laissait l'organisateur
 * deviner ce qui manquait pour sortir du brouillon.
 *
 * ⛔ CE COMPOSANT NE DECIDE RIEN ET NE CALCULE RIEN. Il recoit des etapes deja
 * jugees et les dessine. C'est ce qui le rend lisible d'un coup d'oeil et
 * testable sans monter la page de l'evenement.
 *
 * ⛔ ET CE N'EST PAS UNE BARRE DE PROGRESSION : un pourcentage dirait « 40 % »
 * sans dire de quoi. Le fil nomme chaque etape, donc il dit AUSSI laquelle
 * bloque.
 * @param {RailProps} props - Ce que le fil doit dessiner.
 * @returns {any} Le fil, ou `null` quand il n'y a aucune etape a montrer.
 */
function TournamentProgressRail(props) {
  const { note = '', steps = [], title } = props;
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  if (!steps.length) return null;

  return (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: withAlpha(Colors.primary500, 0.08),
          borderColor: withAlpha(Colors.primary500, 0.24),
        },
      ]}
      testID="tournament-progress-rail"
    >
      <Text style={[Fonts.p4Bold, Fonts.primary500]}>{title}</Text>

      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {steps.map((step, index) => (
          <View
            key={step.label}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[8],
              ApplicationStyle.borderRadius100,
              ApplicationStyle.borderWidth1,
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
              {
                backgroundColor: withAlpha(
                  step.done ? Colors.success500 : Colors.primary500,
                  step.done ? 0.16 : 0.06,
                ),
                borderColor: withAlpha(
                  step.done ? Colors.success500 : Colors.primary500,
                  step.done ? 0.5 : 0.24,
                ),
              },
            ]}
            testID={`tournament-rail-step-${index + 1}`}
          >
            {/* ✓ pour ce qui est fait, le RANG pour ce qui reste : l'etape en
                cours se trouve donc sans compter, c'est la premiere chiffree. */}
            <Text style={[Fonts.p4Bold, step.done ? Fonts.neutral00 : Fonts.neutral300]}>
              {step.done ? '✓' : String(index + 1)}
            </Text>
            <Text style={[Fonts.p4Bold, step.done ? Fonts.neutral00 : Fonts.neutral200]}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      {note ? <Text style={[Fonts.p4, Fonts.neutral300]}>{note}</Text> : null}
    </View>
  );
}

export default TournamentProgressRail;
