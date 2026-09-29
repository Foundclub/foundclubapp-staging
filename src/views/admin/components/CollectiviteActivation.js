import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useSetAdminCollectiviteActive } from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Le compte rendu du serveur apres le geste : combien de clubs ont recu, gardent ou
 * perdent l offre (verdicts de `PUT /superadmin/collectivites/:id/active`).
 * @param {any} response - La reponse du service.
 * @returns {{ alreadyPaid: number, granted: number, isActive: boolean, revoked: number }} Le bilan.
 */
const lireBilan = (response) => {
  const verdicts = Array.isArray(response?.data?.clubs) ? response.data.clubs : [];
  const compter = (/** @type {string} */ offre) => verdicts
    .filter((/** @type {any} */ club) => club?.offer === offre).length;
  return {
    alreadyPaid: compter('already-paid'),
    granted: compter('granted'),
    isActive: response?.data?.isActive === true,
    revoked: compter('revoked'),
  };
};

/**
 * 🏛️ ACTIVER / COUPER UNE COLLECTIVITE (D61, 2026-09-29) — le bouton, sa confirmation et
 * le compte rendu, pour la liste ET le detail de la console.
 *
 * La confirmation dit ce qui va se passer, club compris (« Les 3 clubs rattaches recevront
 * l offre Club offerte ; un club qui paie deja n est pas touche »). Apres le geste, la
 * liste et le detail sont RELUS depuis le serveur (useSetAdminCollectiviteActive) : l etat
 * affiche est celui qu il rend. Le bilan sous le bouton vient de sa reponse.
 * @param {{ collectivite: { clubsCount: number, documentId: string, isActive: boolean,
 *   name: string } }} props - La collectivite telle que le serveur l a lue.
 * @returns {import('react').ReactElement} Le bouton et son compte rendu.
 */
function CollectiviteActivation({ collectivite }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const [bilan, setBilan] = useState(/** @type {ReturnType<typeof lireBilan> | null} */ (null));
  const mutation = useSetAdminCollectiviteActive({
    onSuccess: (/** @type {any} */ response) => setBilan(lireBilan(response)),
  });

  const activer = !collectivite.isActive;
  const count = Number(collectivite.clubsCount) || 0;
  const valeurs = {
    count,
    name: formatCollectiviteOfferedBy(collectivite.name),
    ...SANS_ECHAPPEMENT,
  };

  const confirmer = () => {
    setBilan(null);
    let message;
    if (count === 0) {
      message = activer
        ? t(
          'adminCollectivites.activation.activateMessageNone',
          // eslint-disable-next-line max-len
          'Aucun club n’est rattaché pour l’instant : chaque club que tu rattacheras recevra l’offre Club offerte.',
        )
        : t(
          'adminCollectivites.activation.deactivateMessageNone',
          'Aucun club n’est rattaché : rien d’autre ne change.',
        );
    } else {
      message = activer
        ? t('adminCollectivites.activation.activateMessage', valeurs)
        : t('adminCollectivites.activation.deactivateMessage', valeurs);
    }
    Alert.alert(
      activer
        ? t('adminCollectivites.activation.activateTitle', 'Activer {{name}} ?', valeurs)
        : t('adminCollectivites.activation.deactivateTitle', 'Couper {{name}} ?', valeurs),
      message,
      [
        { style: 'cancel', text: t('adminCollectivites.activation.cancel', 'Annuler') },
        {
          onPress: () => mutation.mutate({
            collectiviteId: collectivite.documentId,
            isActive: activer,
          }),
          style: activer ? 'default' : 'destructive',
          text: activer
            ? t('adminCollectivites.activation.activate', 'Activer')
            : t('adminCollectivites.activation.deactivate', 'Couper'),
        },
      ],
    );
  };

  let compteRendu = null;
  if (mutation.error) {
    compteRendu = (
      <Text style={[Fonts.p3Bold, Fonts.error500]}>
        {getErrorMessage(/** @type {any} */ (mutation.error))}
      </Text>
    );
  } else if (bilan) {
    compteRendu = (
      <Text style={[Fonts.p3Bold, Fonts.success500]}>
        {bilan.isActive
          ? t(
            'adminCollectivites.activation.doneActivated',
            'Activée. Offre posée : {{granted}} · Club qui paie déjà : {{alreadyPaid}}',
            bilan,
          )
          : t(
            'adminCollectivites.activation.doneDeactivated',
            'Coupée. Offre retirée : {{revoked}}',
            bilan,
          )}
      </Text>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Button
        disabled={mutation.isPending}
        isLoading={mutation.isPending}
        onPress={confirmer}
        size="sm"
        title={activer
          ? t('adminCollectivites.activation.activate', 'Activer')
          : t('adminCollectivites.activation.deactivate', 'Couper')}
        variant={activer ? 'Primary' : 'Secondary'}
      />
      {compteRendu}
    </View>
  );
}

export default CollectiviteActivation;
