import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

/**
 * RESA-JOUEUR (11/11/2026) — E-P04 « Ton groupe », maquette validée par Adel le 10/11
 * (« 232- ok », D50). Le joueur ne choisit plus un nombre de joueurs et ne coche plus rien (Adel :
 * « ce n'est pas au joueur de cocher ça ») : le terrain dit combien il en faut (le nombre fixé par
 * le complexe), et le joueur répond « On a assez de joueurs » ou « Il nous manque des joueurs ».
 * Dans le second cas : « On est combien, toi compris ? », ce qui manque, et le bandeau orange qui
 * dit ce qui va se passer (réservation « en construction », créneau encore ouvert aux autres).
 * Ce que paie le groupe est toujours écrit sous les choix.
 * @param {object} props - Les propriétés.
 * @param {'assez' | 'manque'} props.choix - La réponse du joueur.
 * @param {number} props.combien - « On est combien, toi compris ? ».
 * @param {(choix: 'assez' | 'manque') => void} props.onChoix - Répondre.
 * @param {(combien: number) => void} props.onCombien - Changer le nombre.
 * @param {string} props.paie - « Le groupe paie… » (ou '').
 * @param {number} props.requis - Le nombre fixé par le complexe.
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocTonGroupe({
  choix, combien, onChoix, onCombien, paie, requis,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const manque = Math.max(0, requis - combien);

  return (
    <View style={{ gap: 10 }} testID="reserver-ton-groupe">
      <Text accessibilityRole="header" style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('reserverTerrain.recapitulatif.tonGroupe', 'Ton groupe')}
      </Text>
      <View style={{ gap: 2 }}>
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {t(
            'reserverTerrain.recapitulatif.seReservePour',
            'Ce terrain se réserve pour {{nombre}} joueurs.',
            { nombre: requis },
          )}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('reserverTerrain.recapitulatif.nombreFixe', 'Nombre fixé par le complexe.')}
        </Text>
      </View>
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        <PuceChoix
          choisie={choix === 'assez'}
          libelle={t('reserverTerrain.recapitulatif.assezDeJoueurs', 'On a assez de joueurs')}
          onPress={() => onChoix('assez')}
          testID="groupe-assez"
        />
        <PuceChoix
          choisie={choix === 'manque'}
          libelle={t('reserverTerrain.recapitulatif.ilNousManque', 'Il nous manque des joueurs')}
          onPress={() => onChoix('manque')}
          testID="groupe-manque"
        />
      </View>
      {choix === 'manque' ? (
        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('reserverTerrain.recapitulatif.onEstCombien', 'On est combien, toi compris ?')}
          </Text>
          <InputStepper
            decrementLabel={t('reserverTerrain.recapitulatif.moins', 'Un joueur de moins')}
            incrementLabel={t('reserverTerrain.recapitulatif.plus', 'Un joueur de plus')}
            max={Math.max(1, requis - 1)}
            min={1}
            onDecrement={() => onCombien(Math.max(1, combien - 1))}
            onIncrement={() => onCombien(Math.min(Math.max(1, requis - 1), combien + 1))}
            tone="tunnel"
            value={combien}
          />
          <Text style={[Fonts.p2Bold, Fonts.warning500]}>
            {manque > 1
              ? t('reserverTerrain.recapitulatif.ilManqueN', 'Il manque {{nombre}} joueurs.', {
                nombre: manque,
              })
              : t('reserverTerrain.recapitulatif.ilManqueUn', 'Il manque {{nombre}} joueur.', {
                nombre: manque,
              })}
          </Text>
        </View>
      ) : null}
      {paie ? <Text style={[Fonts.p3, Fonts.neutral100]}>{paie}</Text> : null}
      {choix === 'manque' ? (
        <View
          style={{
            backgroundColor: withAlpha(Colors.warning500, 0.1),
            borderColor: withAlpha(Colors.warning500, 0.5),
            borderRadius: 16,
            borderWidth: 1,
            gap: 6,
            padding: 12,
          }}
          testID="groupe-en-construction"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'reserverTerrain.recapitulatif.enConstruction',
              'Ta réservation sera créée « en construction ».',
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral00]}>
            {t(
              'reserverTerrain.recapitulatif.creneauOuvert',
              'Tant que ce n’est pas confirmé, un autre groupe peut prendre ce créneau.',
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'reserverTerrain.recapitulatif.annoncePart',
              'Une annonce part dans « Recherche de joueurs ». Dis « On a assez de joueurs » '
                + 'quand vous êtes {{nombre}}, ou plus tôt si tu es sûr de ton groupe.',
              { nombre: requis },
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default BlocTonGroupe;
