import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import { clubDeLaDemande } from '@/views/profile/parent/demandesDeLEnfant';

/**
 * L equipe d une demande, a nommer dans une phrase (son club, a defaut).
 * @param {any} demande - La demande.
 * @returns {string} - Le nom de l equipe, ou celui du club.
 */
export const equipeDeLaDemande = (demande) => (
  String(demande?.team?.name || '').trim() || clubDeLaDemande(demande)
);

/**
 * PAR-L8 (13/10, design parent E19, planche 8) — « ANNULER LA DEMANDE POUR LEA ? »
 *
 * Une feuille, pas une fenetre systeme : sur le site, `Alert` devient `window.confirm`, qui n a
 * que deux choix et ne se met pas en forme. Elle nomme l enfant ET l equipe, dit ce qui va se
 * passer (« Les responsables de U11 ne la verront plus. Lea pourra faire une nouvelle demande. »),
 * puis « Annuler la demande » (Danger) et « Garder la demande » (Ghost).
 * @param {object} props - Les proprietes.
 * @param {any | null} props.demande - La demande a annuler ; rien = fermee.
 * @param {any} props.enfant - La fiche de l enfant.
 * @param {() => void} props.onClose - Ferme la feuille (« Garder la demande »).
 * @param {(demande: any) => void} props.onConfirm - « Annuler la demande ».
 * @returns {import('react').ReactElement} - La feuille.
 */
function FeuilleDAnnulation({
  demande, enfant, onClose, onConfirm,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const valeurs = {
    firstname: enfant?.firstname || '',
    team: equipeDeLaDemande(demande),
    ...SANS_ECHAPPEMENT,
  };

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View style={{ gap: 8 }}>
          <Button
            onPress={() => onConfirm(demande)}
            title={t('myChildren.cancelRequest.confirm')}
            variant="Danger"
          />
          <Button onPress={onClose} title={t('myChildren.cancelRequest.keep')} variant="Ghost" />
        </View>
      )}
      isVisible={Boolean(demande)}
    >
      <View style={{ gap: 4 }} testID="cancel-request-sheet">
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('myChildren.cancelRequest.confirmTitle', valeurs)}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('myChildren.cancelRequest.confirmMessage', valeurs)}
        </Text>
      </View>
    </BottomModal>
  );
}

export default FeuilleDAnnulation;
