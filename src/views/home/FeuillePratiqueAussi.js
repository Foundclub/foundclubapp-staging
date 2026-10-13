import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { getRoleDocumentIdByKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { useGetRoles } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * PAR-L12 (13/10, design parent E27, décision D6 A d'Adel du 12/10) — « TU PRATIQUES AUSSI UN
 * SPORT ? ».
 *
 * Le premier appui d'un compte PARENT sur « Basculer en mode joueur » ouvre cette feuille : le
 * compte passe de Parent à Joueur — la MÊME mise à jour que l'écran de choix du rôle
 * (`UserRole.js`, `updateMe({ role })` ; le serveur accepte qu'un compte change lui-même de
 * rôle entre Joueur, Entraîneur, Dirigeant et Parent, admin `firebase-auth.ts`). Il GARDE ses
 * enfants, leurs fiches et leurs demandes (elles tiennent au compte, pas au rôle), et il reste en
 * MODE PARENT : la bascule de l'accueil apparaît sur la position « Parent ».
 * Un échec ne change rien et le dit. Les questions de profil joueur (sport, niveau) ne sont PAS
 * reposées : elles restent dans « Modifier mon profil ».
 * @param {object} props - Les propriétés.
 * @param {boolean} props.isVisible - La feuille est ouverte.
 * @param {() => void} props.onClose - « Pas maintenant », ou la fermeture.
 * @param {() => void} props.onDone - Le compte est passé en Joueur.
 * @param {string[]} props.prenoms - Les prénoms de ses enfants (« Anissa et Martin »).
 * @returns {import('react').ReactElement} - La feuille.
 */
function FeuillePratiqueAussi({
  isVisible, onClose, onDone, prenoms,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const { refetchUserData, setDisplayMode } = useAuth();
  const { data: roles } = useGetRoles({ enabled: isVisible });
  const [erreur, setErreur] = useState(false);

  const passage = useMutation({
    meta: { preventToastError: true },
    mutationFn: updateMe,
    onError: () => setErreur(true),
    onSuccess: async () => {
      // Il reste en mode parent : écrit AVANT de relire le profil, sinon l'accueil joueur
      // passerait un instant à l'écran.
      setDisplayMode('parent');
      try {
        await refetchUserData?.();
      } catch {
        // Les écrans suivants relisent le profil.
      }
      onDone();
    },
  });

  const confirmer = () => {
    setErreur(false);
    const roleJoueur = getRoleDocumentIdByKey(roles, 'player');
    if (!roleJoueur) {
      setErreur(true);
      return;
    }
    passage.mutate({ role: roleJoueur });
  };

  const noms = (Array.isArray(prenoms) ? prenoms : []).filter(Boolean);
  const gardes = noms.length > 0 && noms.length <= 2
    ? t('playerMode.sheet.keepNamed', {
      count: noms.length,
      prenoms: noms.join(` ${t('playerMode.parent.and', 'et')} `),
      ...SANS_ECHAPPEMENT,
    })
    : t('playerMode.sheet.keepChildren');
  const lignes = [
    gardes,
    t('playerMode.sheet.joinTeam'),
    t('playerMode.sheet.switch'),
  ];

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View style={{ gap: 8 }}>
          <Button
            disabled={passage.isPending}
            isLoading={passage.isPending}
            onPress={confirmer}
            testID="feuille-pratique-aussi-oui"
            title={t('playerMode.sheet.confirm')}
            variant="Primary"
          />
          <Button
            onPress={onClose}
            testID="feuille-pratique-aussi-plus-tard"
            title={t('playerMode.sheet.later')}
            variant="Ghost"
          />
        </View>
      )}
      isVisible={isVisible}
    >
      <View style={{ gap: 12 }} testID="feuille-pratique-aussi">
        <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('playerMode.sheet.title')}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{t('playerMode.sheet.subtitle')}</Text>
        {lignes.map((ligne) => (
          <View key={ligne} style={[Alignments.row, { gap: 10 }]}>
            <Icone color={Colors.primary500} height={16} name="check" width={16} />
            <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>{ligne}</Text>
          </View>
        ))}
        {erreur ? (
          <Text accessibilityLiveRegion="polite" style={[Fonts.p2Bold, Fonts.error300]}>
            {t('playerMode.sheet.error')}
          </Text>
        ) : null}
      </View>
    </BottomModal>
  );
}

export default FeuillePratiqueAussi;
