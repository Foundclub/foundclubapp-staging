import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * « À RÉGLER SUR PLACE » — RESA-OPTIONS (12/11/2026), maquette section 4 bis : le terrain,
 * une ligne par option choisie, le total. Le même bloc au récapitulatif, dans « Ma réservation »
 * et dans la fiche du gérant (« À encaisser sur place », où une ligne « Options » remplace le
 * détail, déjà dit dans « Options à préparer »). Rien n'est encaissé dans l'app.
 * @param {object} props - Les propriétés.
 * @param {{ lignes: Array<{ cle: string, libelle: string, montant: string }>, options: string,
 *   total: string }} props.bloc - Le bloc de `lignesAReglerSurPlace`.
 * @param {{ libelle: string, onPress: () => void, testID: string } | null} [props.action] -
 *   RESA-OPTIONS-2 : un lien à droite du titre (« Modifier les options » dans Ma réservation).
 * @param {boolean} [props.indicatif] - « Indicatif : le complexe encaisse… » (récapitulatif).
 * @param {boolean} [props.resume] - Le terrain puis « Options » en une ligne (fiche du gérant).
 * @param {string} props.titre - « À régler sur place », « À encaisser sur place ».
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocReglerSurPlace({
  action = null, bloc, indicatif = false, resume = false, titre,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const lignes = resume
    ? [
      ...bloc.lignes.filter((ligne) => ligne.cle === 'terrain'),
      {
        cle: 'options',
        libelle: t('complexeOptions.lesOptions', 'Options'),
        montant: bloc.options,
      },
    ]
    : bloc.lignes;
  const ligne = (
    /** @type {string} */ cle,
    /** @type {string} */ gauche,
    /** @type {string} */ droite,
    gras = false,
  ) => (
    <View
      key={cle}
      style={[Alignments.row, Alignments.justifyBetween, { gap: 12 }]}
      testID={`regler-${cle}`}
    >
      <Text style={[gras ? Fonts.p1Bold : Fonts.p2, Fonts.neutral00, Alignments.fill]}>
        {gauche}
      </Text>
      <Text style={[gras ? Fonts.p1Bold : Fonts.p2Bold, Fonts.neutral00]}>{droite}</Text>
    </View>
  );
  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary800, 0.6),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
        padding: 16,
      }}
      testID="bloc-regler-sur-place"
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyBetween, { gap: 8 }]}>
        <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
          {titre.toUpperCase()}
        </Text>
        {action ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={action.onPress}
            style={{ justifyContent: 'center', minHeight: 44 }}
            testID={action.testID}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>{action.libelle}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {lignes.map((une) => ligne(une.cle, une.libelle, une.montant))}
      <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.12), height: 1 }} />
      {ligne('total', t('complexeOptions.total', 'Total'), bloc.total, true)}
      {indicatif ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'complexeOptions.indicatif',
            'Indicatif : le complexe encaisse sur place. L’app n’encaisse rien.',
          )}
        </Text>
      ) : null}
    </View>
  );
}

export default BlocReglerSurPlace;
