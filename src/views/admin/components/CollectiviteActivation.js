import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import {
  usePreviewAdminCollectiviteActive,
  useSetAdminCollectiviteActive,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Les clubs d un verdict, par leur nom (l identifiant si le nom manque : un club ne disparait
 * jamais de la phrase, sinon le nombre mentirait).
 * @param {any[]} verdicts - `[{ clubDocumentId, name, offer }]` rendus par le serveur.
 * @param {string} offre - `granted`, `already-paid`, `revoked` ou `none`.
 * @returns {string[]} Les noms.
 */
const nommer = (verdicts, offre) => verdicts
  .filter((/** @type {any} */ club) => club?.offer === offre)
  .map((/** @type {any} */ club) => String(club?.name || club?.clubDocumentId || '').trim());

/**
 * Le compte rendu du serveur apres le geste : combien de clubs ont recu, gardent ou
 * perdent l offre (verdicts de `PUT /superadmin/collectivites/:id/active`), et LESQUELS
 * paient deja (TEXTES-COLLECTIVITES, 01/10 : le serveur nomme chaque club).
 * @param {any} response - La reponse du service.
 * @returns {{ alreadyPaid: number, alreadyPaidNames: string, granted: number, isActive: boolean,
 *   revoked: number }} Le bilan.
 */
const lireBilan = (response) => {
  const verdicts = Array.isArray(response?.data?.clubs) ? response.data.clubs : [];
  const compter = (/** @type {string} */ offre) => verdicts
    .filter((/** @type {any} */ club) => club?.offer === offre).length;
  // Les NOMS seulement (un serveur d avant le lot n en rend pas) : sans le nom de chacun, le
  // bilan reste chiffre — jamais un identifiant technique a l ecran.
  const payeurs = verdicts
    .filter((/** @type {any} */ club) => club?.offer === 'already-paid')
    .map((/** @type {any} */ club) => String(club?.name || '').trim());
  return {
    alreadyPaid: compter('already-paid'),
    alreadyPaidNames: payeurs.every(Boolean) ? payeurs.join(', ') : '',
    granted: compter('granted'),
    isActive: response?.data?.isActive === true,
    revoked: compter('revoked'),
  };
};

/**
 * Les verdicts de l APERCU, ou null si le serveur ne sait pas le faire (un serveur d avant
 * TEXTES-COLLECTIVITES refuse le corps de l apercu : 400, rien d ecrit).
 * @param {any} response - La reponse du service.
 * @returns {any[] | null} Les verdicts club par club.
 */
const lireApercu = (response) => (
  response?.data?.preview === true && Array.isArray(response?.data?.clubs)
    ? response.data.clubs
    : null
);

/**
 * 🏛️ ACTIVER / COUPER UNE COLLECTIVITE (D61, 2026-09-29) — le bouton, sa confirmation et
 * le compte rendu, pour la liste ET le detail de la console.
 *
 * TEXTES-COLLECTIVITES (01/10) — la fenetre annoncait « Les 3 clubs rattaches recevront
 * l offre », quand le serveur n en touchait que 2 (un payait deja). Elle demande desormais
 * au serveur son APERCU (meme juge que le geste, rien d ecrit) et dit, club par club et par
 * leur NOM, qui recoit, qui paie deja, qui perd, qui ne bouge pas. Sans apercu (serveur
 * ancien, panne), elle dit une phrase vraie sans detail, et le geste reste possible.
 * Apres le geste, la liste et le detail sont RELUS depuis le serveur
 * (useSetAdminCollectiviteActive) : l etat affiche est celui qu il rend.
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
  const apercu = usePreviewAdminCollectiviteActive();

  const activer = !collectivite.isActive;
  const count = Number(collectivite.clubsCount) || 0;
  const valeurs = {
    count,
    name: formatCollectiviteOfferedBy(collectivite.name),
    ...SANS_ECHAPPEMENT,
  };

  const messageSansClub = () => (activer
    ? t(
      'adminCollectivites.activation.activateMessageNone',
      // eslint-disable-next-line max-len
      'Aucun club n’est rattaché pour l’instant : chaque club que tu rattacheras recevra l’offre Club offerte.',
    )
    : t(
      'adminCollectivites.activation.deactivateMessageNone',
      'Aucun club n’est rattaché : rien d’autre ne change.',
    ));

  // Sans apercu : une phrase VRAIE, sans nombre de clubs touches (le serveur seul le sait).
  const messageSansApercu = () => (activer
    ? t('adminCollectivites.activation.activateMessage', valeurs)
    : t('adminCollectivites.activation.deactivateMessage', valeurs));

  /**
   * Une ligne par verdict, dans l ordre du geste, chaque club par son nom.
   * @param {any[]} verdicts - Les verdicts de l apercu.
   * @returns {string} Les lignes, ou '' si aucun club.
   */
  const messageApercu = (verdicts) => (activer ? ['granted', 'already-paid'] : ['revoked', 'none'])
    .map((offre) => {
      const noms = nommer(verdicts, offre);
      if (noms.length === 0) return null;
      const phrase = { clubs: noms.join(', '), count: noms.length, ...SANS_ECHAPPEMENT };
      switch (offre) {
        case 'already-paid': return t('adminCollectivites.activation.preview.alreadyPaid', phrase);
        case 'granted': return t('adminCollectivites.activation.preview.granted', phrase);
        case 'revoked': return t('adminCollectivites.activation.preview.revoked', phrase);
        default: return t('adminCollectivites.activation.preview.none', phrase);
      }
    })
    .filter(Boolean)
    .join('\n');

  const ouvrirFenetre = (/** @type {string} */ message) => {
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

  const confirmer = () => {
    setBilan(null);
    if (count === 0) {
      ouvrirFenetre(messageSansClub());
      return;
    }
    apercu.mutate({ collectiviteId: collectivite.documentId, isActive: activer }, {
      onError: () => ouvrirFenetre(messageSansApercu()),
      onSuccess: (/** @type {any} */ response) => {
        const verdicts = lireApercu(response);
        if (!verdicts) {
          ouvrirFenetre(messageSansApercu());
          return;
        }
        ouvrirFenetre(messageApercu(verdicts) || messageSansClub());
      },
    });
  };

  let compteRendu = null;
  if (mutation.error) {
    compteRendu = (
      <Text style={[Fonts.p3Bold, Fonts.error500]}>
        {getErrorMessage(/** @type {any} */ (mutation.error))}
      </Text>
    );
  } else if (bilan) {
    let texteBilan;
    if (!bilan.isActive) {
      texteBilan = t(
        'adminCollectivites.activation.doneDeactivated',
        'Coupée. Offre retirée : {{revoked}}',
        bilan,
      );
    } else if (bilan.alreadyPaidNames) {
      texteBilan = t(
        'adminCollectivites.activation.doneActivatedNamed',
        'Activée. Offre posée : {{granted}} · Club qui paie déjà : {{alreadyPaid}} ({{clubs}})',
        { ...bilan, clubs: bilan.alreadyPaidNames, ...SANS_ECHAPPEMENT },
      );
    } else {
      texteBilan = t(
        'adminCollectivites.activation.doneActivated',
        'Activée. Offre posée : {{granted}} · Club qui paie déjà : {{alreadyPaid}}',
        bilan,
      );
    }
    compteRendu = (
      <Text style={[Fonts.p3Bold, Fonts.success500]}>
        {texteBilan}
      </Text>
    );
  }

  const enCours = mutation.isPending || apercu.isPending;
  return (
    <View style={{ gap: 8 }}>
      <Button
        disabled={enCours}
        isLoading={enCours}
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
