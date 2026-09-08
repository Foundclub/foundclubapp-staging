import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * LA BARRE DE PROGRESSION de l'entraînement — une seule, pour toute la section.
 *
 * 🔎 POURQUOI ELLE SORT DE L'ÉCRAN OÙ ELLE EST NÉE : elle était dessinée à la main
 * dans « Mon entraînement », et le pack de design en demande une DEUXIÈME, à
 * l'identique, sur la fiche d'une journée. Deux barres recopiées divergent : l'une
 * garde ses coins arrondis quand l'autre les perd, et la section se met à ressembler
 * à deux applications différentes. Une brique, deux emplois.
 * @param {object} props Les propriétés de la barre.
 * @param {string} [props.color] La couleur du remplissage ; bleu par défaut.
 * @param {number} props.ratio L'avancement, entre 0 et 1 ; toute autre valeur est ramenée
 *   dans cet intervalle, parce qu'une largeur négative fait disparaître la barre en silence.
 * @returns {React.ReactElement} la barre remplie à hauteur du ratio
 */
function TrainingProgressBar({ color, ratio }) {
  const { Colors } = useTheme();
  const part = Math.round(Math.min(1, Math.max(0, Number(ratio) || 0)) * 100);

  return (
    <View style={{
      backgroundColor: Colors.neutral700,
      borderRadius: 3,
      height: 6,
      overflow: 'hidden',
    }}
    >
      <View
        style={{
          backgroundColor: color || Colors.primary500,
          height: 6,
          width: `${part}%`,
        }}
      />
    </View>
  );
}

export default TrainingProgressBar;
