import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * AGE-OBLIGATOIRE ② (02/10/2026) - LES SORTIES DE COMPTE DU POINT DE CONTROLE
 * D'ENTREE.
 *
 * Un ancien compte sans date de naissance s'arrete sur « Qui es-tu ? » (puis, a
 * 13-14 ans, sur la declaration parentale) avant d'entrer. L'etape est
 * obligatoire, sans « Passer » : ces deux boutons sont la seule facon de repartir
 * pour qui ne veut pas, ou ne peut pas, repondre tout de suite. Aucun compte ne
 * reste enferme sur un ecran sans sortie.
 *
 * - « Changer de compte » : vers l'autre compte enregistre sur l'appareil ; s'il
 *   n'y en a pas, vers la connexion d'un autre compte (celle du Profil, dont le
 *   « Annuler » ramene ici).
 * - « Se deconnecter » : comme le Profil, en rendant le jeton de notifications.
 *
 * ponytail: un seul « Changer de compte », vers le PREMIER autre compte, et non
 * la liste du Profil. Au-dela de deux comptes on passe de l'un a l'autre ; la
 * liste complete reste dans le Profil une fois entre. Voie de sortie : extraire
 * le panneau de bascule de `Profile.js` en composant, et le monter ici.
 * @returns {import('react').ReactElement} Les deux sorties.
 */
function OnboardingAccountExits() {
  const { Spaces } = useTheme();
  const { t } = useTranslation();
  const [{ fcmToken }] = useAppContext();
  const {
    addAccount, authSessions, logoutMutation, switchAccount, userData,
  } = useAuth();

  const autreCompte = (Array.isArray(authSessions) ? authSessions : []).find(
    (/** @type {any} */ session) => Boolean(session?.user?.documentId)
      && session.user.documentId !== userData?.documentId,
  );

  const handleChangeAccount = () => {
    if (autreCompte) {
      switchAccount(autreCompte);
      return;
    }
    addAccount();
  };

  const handleLogout = () => {
    logoutMutation.mutate(fcmToken || '');
  };

  return (
    <View style={[Spaces.gap[8]]}>
      <Button
        onPress={handleChangeAccount}
        title={t('ageObligatoire.exits.switchAccount', 'Changer de compte')}
        variant="SecondaryLight"
      />
      <Button
        disabled={logoutMutation.isPending}
        isLoading={logoutMutation.isPending}
        onPress={handleLogout}
        title={t('ageObligatoire.exits.logout', 'Se déconnecter')}
        variant="SecondaryLight"
      />
    </View>
  );
}

export default OnboardingAccountExits;
