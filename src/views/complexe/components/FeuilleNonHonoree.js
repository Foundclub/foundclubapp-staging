import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * LA CONFIRMATION « NON HONORÉE » — RESA-L5B-1 (20/10/2026), planche EG04 état 3 (et le pied de
 * EG05 état 6) : « Marquer la réservation de Julien M. (jeudi 19 h) comme non honorée ? Il en
 * sera prévenu. » · Annuler · Marquer. Le réserveur est prévenu (N-17) ; au x-ième marquage, il
 * est banni automatiquement ici (N-12, au gérant). Le refus du serveur s'écrit dans la feuille,
 * qui reste ouverte.
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.enCours] - L'envoi est en cours.
 * @param {string} [props.erreur] - Le refus du serveur, déjà rédigé.
 * @param {string} props.nom - Le nom court du réserveur (« Julien M. »).
 * @param {() => void} props.onConfirmer - « Marquer ».
 * @param {() => void} props.onFermer - Fermer sans rien faire.
 * @param {string} props.quand - « jeudi 19 h ».
 * @param {boolean} props.visible - Ouverte ou non.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleNonHonoree({
  enCours = false, erreur = '', nom, onConfirmer, onFermer, quand, visible,
}) {
  const { t } = useTranslation();
  const { Alignments, Fonts } = useTheme();
  return (
    <BottomModal close={onFermer} isVisible={visible} webPresentation="dialog">
      <View style={{ gap: 16 }} testID="feuille-non-honoree">
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t(
              'complexeReservations.nonHonoree.question',
              'Marquer la réservation de {{nom}} ({{quand}}) comme non honorée ?',
              { nom, quand, ...SANS_ECHAPPEMENT },
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('complexeReservations.nonHonoree.prevenu', 'Il en sera prévenu.')}
          </Text>
        </View>
        {erreur ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreur}</Text>
        ) : null}
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          <View style={{ flexBasis: 140, flexGrow: 1 }}>
            <Button
              onPress={onFermer}
              title={t('complexeReservations.feuille.annuler', 'Annuler')}
              variant="Ghost"
            />
          </View>
          <View style={{ flexBasis: 140, flexGrow: 1 }} testID="feuille-non-honoree-marquer">
            <Button
              disabled={enCours}
              icon="flag"
              iconPosition="before"
              isLoading={enCours}
              onPress={onConfirmer}
              title={t('complexeReservations.nonHonoree.marquer', 'Marquer')}
              variant="DangerFilled"
            />
          </View>
        </View>
      </View>
    </BottomModal>
  );
}

export default FeuilleNonHonoree;
