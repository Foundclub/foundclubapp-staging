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
 *
 * RESA-INSCRIPTION (19/10/2026) — `pourLeComplexe` : la même feuille pour un compte né « pour un
 * complexe » (aucun rôle sportif), ouverte par « Voir l'app en joueur » de l'accueil du complexe.
 * Même mise à jour du rôle ; il GARDE son complexe (relation `gestionnaires`, indépendante du
 * rôle) ; pas de mode parent à poser. Son parcours d'inscription de joueur reprend à l'accueil.
 * @param {object} props - Les propriétés.
 * @param {boolean} props.isVisible - La feuille est ouverte.
 * @param {() => void} props.onClose - « Pas maintenant », ou la fermeture.
 * @param {() => void} props.onDone - Le compte est passé en Joueur.
 * @param {boolean} [props.pourLeComplexe] - La variante du compte né « pour un complexe ».
 * @param {string[]} [props.prenoms] - Les prénoms de ses enfants (« Anissa et Martin »).
 * @returns {import('react').ReactElement} - La feuille.
 */
function FeuillePratiqueAussi({
  isVisible, onClose, onDone, pourLeComplexe = false, prenoms = [],
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const { refetchUserData, setDisplayMode } = useAuth();
  // Lue seulement feuille ouverte (`useGetRoles` déclare des options complètes, d'où le type).
  const { data: roles } = useGetRoles(/** @type {any} */ ({ enabled: isVisible }));
  const [erreur, setErreur] = useState(false);

  const passage = useMutation({
    meta: { preventToastError: true },
    mutationFn: updateMe,
    onError: () => setErreur(true),
    onSuccess: async () => {
      // Il reste en mode parent : écrit AVANT de relire le profil, sinon l'accueil joueur
      // passerait un instant à l'écran.
      if (!pourLeComplexe) setDisplayMode('parent');
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
    // La même mise à jour que `UserRole.js` : seul le rôle part (`updateMe` est typé « User »).
    passage.mutate(/** @type {any} */ ({ role: roleJoueur }));
  };

  const noms = (Array.isArray(prenoms) ? prenoms : []).filter(Boolean);
  const gardes = noms.length > 0 && noms.length <= 2
    ? t('playerMode.sheet.keepNamed', {
      count: noms.length,
      prenoms: noms.join(` ${t('playerMode.parent.and', 'et')} `),
      ...SANS_ECHAPPEMENT,
    })
    : t('playerMode.sheet.keepChildren');
  const lignes = pourLeComplexe
    ? [
      t('complexeGerant.joueurAussi.garde'),
      t('playerMode.sheet.joinTeam'),
      t('complexeGerant.creation.bouton'),
    ]
    : [
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
            title={t('playerMode.sheet.confirm')}
            variant="Primary"
          />
          <Button
            onPress={onClose}
            title={t('playerMode.sheet.later')}
            variant="Ghost"
          />
        </View>
      )}
      isVisible={isVisible}
    >
      <View style={{ gap: 12 }} testID="feuille-pratique-aussi">
        <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('playerMode.sheet.title')}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(pourLeComplexe ? 'complexeGerant.joueurAussi.sousTitre' : 'playerMode.sheet.subtitle')}
        </Text>
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
