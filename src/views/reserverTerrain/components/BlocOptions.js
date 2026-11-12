import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { maxDeLOption, minDeLOption, texteDUneOption } from '@/domains/complexe/optionsTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import InputStepper from '@/components/molecules/inputStepper/InputStepper';

/**
 * E-P04, LE BLOC « OPTIONS » — RESA-OPTIONS (12/11/2026), maquette section 4 bis : sous « Ton
 * groupe », les options que CE terrain propose, un compteur chacune — de 0 à 9 par unité,
 * 0 ou 1 par réservation ; une option obligatoire ne descend pas sous 1. Absent sans option.
 * @param {object} props - Les propriétés.
 * @param {Array<any>} props.offertes - Les options du récapitulatif (`apercu.options`).
 * @param {(id: string, quantite: number) => void} props.onQuantite - Un compteur a changé.
 * @param {Record<string, number>} props.quantites - Les compteurs.
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocOptions({ offertes, onQuantite, quantites }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary800, 0.6),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 20,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
      testID="recap-options"
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
        {t('complexeOptions.titre', 'Options').toUpperCase()}
      </Text>
      {offertes.map((option) => {
        const min = minDeLOption(option);
        const max = maxDeLOption(option);
        const valeur = Number(quantites[option.id]) || 0;
        return (
          <View
            key={option.id}
            style={[Alignments.row, Alignments.alignCenter, Alignments.justifyBetween, { gap: 12 }]}
            testID={`recap-option-${option.id}`}
          >
            <View style={[Alignments.fill, { gap: 2 }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{option.name}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>{texteDUneOption(t, option)}</Text>
            </View>
            <InputStepper
              decrementLabel={t('complexeOptions.moins', 'Un de moins : {{nom}}', {
                nom: option.name, ...SANS_ECHAPPEMENT,
              })}
              incrementLabel={t('complexeOptions.plus', 'Un de plus : {{nom}}', {
                nom: option.name, ...SANS_ECHAPPEMENT,
              })}
              max={max}
              min={min}
              onDecrement={() => onQuantite(option.id, Math.max(min, valeur - 1))}
              onIncrement={() => onQuantite(option.id, Math.min(max, valeur + 1))}
              tone="tunnel"
              value={valeur}
            />
          </View>
        );
      })}
    </View>
  );
}

export default BlocOptions;
