import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * « RETIRER DES FAVORIS ? » — RESA-L6B-2 (20/10/2026), planches EP02 état 4 et EP11 état 2 (Q5,
 * AT-11 A) : retirer le favori GARDE le canal ; la case « Quitter aussi le canal » (décochée) le
 * fait quitter aussi. « Garder » referme. Montée par E-P02 et E-P11 (chacune sa phrase).
 * @param {object} props - Les propriétés.
 * @param {boolean} props.enCours - Le serveur répond.
 * @param {string} props.explication - La phrase sous la question (le canal gardé).
 * @param {() => void} props.onFermer - « Garder », ou la feuille fermée.
 * @param {(quitterCanal: boolean) => void} props.onRetirer - « Retirer », avec la case.
 * @param {string | null} [props.refus] - La phrase d'un refus du serveur.
 * @param {boolean} props.visible - Ouverte.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleRetirerFavori({
  enCours, explication, onFermer, onRetirer, refus = null, visible,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const [quitterCanal, setQuitterCanal] = useState(false);
  const libelleDeLaCase = t('reserverTerrain.favoris.quitterCanal', 'Quitter aussi le canal');

  return (
    <BottomModal
      close={() => {
        setQuitterCanal(false);
        onFermer();
      }}
      isVisible={visible}
      webPresentation="dialog"
    >
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('reserverTerrain.favoris.retirerQuestion', 'Retirer des favoris ?')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>{explication}</Text>
        <TouchableOpacity
          accessibilityLabel={libelleDeLaCase}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: quitterCanal }}
          onPress={() => setQuitterCanal((avant) => !avant)}
          style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
          testID="favori-quitter-canal"
        >
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: quitterCanal ? Colors.primary500 : 'transparent',
                borderColor: quitterCanal ? Colors.primary500 : Colors.primary200,
                borderRadius: 6,
                borderWidth: 2,
                height: 24,
                width: 24,
              },
            ]}
          >
            {quitterCanal ? (
              <SvgIcon color={Colors.primary900} height={16} name="check" width={16} />
            ) : null}
          </View>
          <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>{libelleDeLaCase}</Text>
        </TouchableOpacity>
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ busy: enCours }}
          disabled={enCours}
          onPress={() => onRetirer(quitterCanal)}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.error500,
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 48,
          }}
          testID="favori-retirer-confirme"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('reserverTerrain.favoris.retirer', 'Retirer')}
          </Text>
        </TouchableOpacity>
        <Button
          onPress={() => {
            setQuitterCanal(false);
            onFermer();
          }}
          title={t('reserverTerrain.maReservation.garder', 'Garder')}
          variant="Ghost"
        />
      </View>
    </BottomModal>
  );
}

export default FeuilleRetirerFavori;
