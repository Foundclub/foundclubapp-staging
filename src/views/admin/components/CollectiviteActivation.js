import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import { PastilleAPoint } from '@/views/admin/components/CollectiviteBadges';
import ConsoleSheet from '@/views/admin/components/ConsoleSheet';

import {
  usePreviewAdminCollectiviteActive,
  useSetAdminCollectiviteActive,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Les clubs d un verdict, par leur nom (l identifiant si le nom manque : un club ne disparait
 * jamais de la liste, sinon le nombre mentirait).
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
 * (TEXTES-COLLECTIVITES, 01/10 : le serveur nomme chaque club ; COLL-CONSOLE, 02/10 : le
 * compte rendu les nomme tous, planche P2-fenetres etat 6).
 * @param {any} response - La reponse du service.
 * @returns {{ alreadyPaid: number, alreadyPaidNames: string, granted: number,
 *   grantedNames: string, isActive: boolean, revoked: number }} Le bilan.
 */
const lireBilan = (response) => {
  const verdicts = Array.isArray(response?.data?.clubs) ? response.data.clubs : [];
  const compter = (/** @type {string} */ offre) => verdicts
    .filter((/** @type {any} */ club) => club?.offer === offre).length;
  // Les NOMS seulement (un serveur d avant le lot n en rend pas) : sans le nom de chacun, le
  // bilan reste chiffre — jamais un identifiant technique a l ecran.
  const noms = (/** @type {string} */ offre) => {
    const liste = verdicts
      .filter((/** @type {any} */ club) => club?.offer === offre)
      .map((/** @type {any} */ club) => String(club?.name || '').trim());
    return liste.every(Boolean) ? liste.join(', ') : '';
  };
  return {
    alreadyPaid: compter('already-paid'),
    alreadyPaidNames: noms('already-paid'),
    granted: compter('granted'),
    grantedNames: noms('granted'),
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
 * COLL-CONSOLE (02/10) — ce que le bandeau dit de l offre, club par club, d apres l etat lu par
 * l apercu du serveur (useAdminCollectiviteOfferStates). Sans etat lu (serveur ancien, panne,
 * lecture en cours), une phrase VRAIE sans nombre.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @param {{ clubs?: Array<{ documentId: string, name: string }>, clubsCount: number,
 *   isActive: boolean }} collectivite - La collectivite.
 * @param {Record<string, string> | null | undefined} etats - L etat de l offre par club.
 * @returns {string} La phrase du bandeau.
 */
const phraseDuBandeau = (t, collectivite, etats) => {
  const actif = collectivite.isActive === true;
  if ((Number(collectivite.clubsCount) || 0) === 0) {
    return actif
      ? t('collectiviteConsole.fiche.bandeau.activeSansClub', {
        // eslint-disable-next-line max-len
        defaultValue: 'Aucun club n’est rattaché : chaque club que tu rattacheras recevra l’offre Club offerte.',
      })
      : t('collectiviteConsole.fiche.bandeau.inactiveSansClub', {
        // eslint-disable-next-line max-len
        defaultValue: 'Aucun club n’est rattaché : chaque club que tu rattacheras recevra l’offre Club offerte, une fois la Ville activée.',
      });
  }
  const clubs = Array.isArray(collectivite.clubs) ? collectivite.clubs : [];
  const connus = etats ? clubs.filter((club) => etats[club.documentId]) : [];
  if (connus.length === 0) {
    return actif
      ? t('collectiviteConsole.fiche.bandeau.activeSansDetail', {
        // eslint-disable-next-line max-len
        defaultValue: 'Ses clubs rattachés reçoivent l’offre Club offerte, sauf ceux qui paient déjà.',
      })
      : t('collectiviteConsole.fiche.bandeau.inactiveSansDetail', {
        // eslint-disable-next-line max-len
        defaultValue: 'L’activer offrira l’offre Club à ses clubs rattachés, sauf à ceux qui paient déjà.',
      });
  }
  const etatsLus = /** @type {Record<string, string>} */ (etats);
  const attendu = actif ? 'offered' : 'atActivation';
  const offerts = connus.filter((club) => etatsLus[club.documentId] === attendu);
  const payeurs = connus.filter((club) => etatsLus[club.documentId] === 'paysItself')
    .map((club) => club.name);
  const valeurs = { count: offerts.length, ...SANS_ECHAPPEMENT };
  const debut = actif
    ? t('collectiviteConsole.fiche.bandeau.recoivent', {
      ...valeurs,
      defaultValue_one: '{{count}} club reçoit l’offre Club offerte.',
      defaultValue_other: '{{count}} clubs reçoivent l’offre Club offerte.',
    })
    : t('collectiviteConsole.fiche.bandeau.offrira', {
      ...valeurs,
      defaultValue_one: 'L’activer offrira l’offre Club à {{count}} club.',
      defaultValue_other: 'L’activer offrira l’offre Club à {{count}} clubs.',
    });
  if (payeurs.length === 0) return debut;
  const noms = { count: payeurs.length, noms: payeurs.join(', '), ...SANS_ECHAPPEMENT };
  const suite = actif
    ? t('collectiviteConsole.fiche.bandeau.paieLuiMeme', {
      ...noms,
      defaultValue_one: '{{noms}} paie lui-même.',
      defaultValue_other: '{{noms}} paient eux-mêmes.',
    })
    : t('collectiviteConsole.fiche.bandeau.paieDeja', {
      ...noms,
      defaultValue_one: '{{noms}} paie déjà : rien ne change pour lui.',
      defaultValue_other: '{{noms}} paient déjà : rien ne change pour eux.',
    });
  return `${debut} ${suite}`;
};

/**
 * 🏛️ ACTIVER / COUPER UNE COLLECTIVITE (D61, 2026-09-29) — le bouton, sa confirmation et
 * le compte rendu.
 *
 * COLL-CONSOLE (02/10) — devient le BANDEAU D ETAT de la fiche (planche P2-fiche, bloc 1) :
 * la pastille « Active » / « Inactive », ce que l activation changera (ou ce que l offre
 * couvre), club par club quand le serveur l a dit, puis le bouton : « Activer » en bleu,
 * « Couper » en ROUGE, car il retire. Le compte rendu reste dans le bandeau.
 *
 * TEXTES-COLLECTIVITES (01/10) — la fenetre annoncait « Les 3 clubs rattaches recevront
 * l offre », quand le serveur n en touchait que 2 (un payait deja). Elle demande desormais
 * au serveur son APERCU (meme juge que le geste, rien d ecrit) et dit, club par club et par
 * leur NOM, qui recoit, qui paie deja, qui perd, qui ne bouge pas. Sans apercu (serveur
 * ancien, panne), elle dit une phrase vraie sans detail, et le geste reste possible.
 *
 * COLL-CONSOLE (02/10), planche P2-fenetres (ecran 5) — la confirmation est une FENETRE DE
 * L APP (ConsoleSheet), plus la fenetre systeme : elle LISTE les clubs, chacun avec ce qui
 * change pour lui ; son bouton dit le resultat (« Offrir l'offre Club à 2 clubs », « Retirer
 * l'offre à 2 clubs », en rouge) ; pendant l envoi ses boutons sont inertes ; un echec s ecrit
 * au-dessus des boutons, et « Réessayer » relance. Apres le geste, la fenetre se ferme et le
 * bandeau garde le compte rendu, avec les noms. La liste et la fiche sont RELUES depuis le
 * serveur (useSetAdminCollectiviteActive) : l etat affiche est celui qu il rend.
 * @param {{ collectivite: { clubs?: Array<{ documentId: string, name: string }>,
 *   clubsCount: number, documentId: string, isActive: boolean, name: string },
 *   etats?: Record<string, string> | null }} props - La collectivite telle que le serveur l a
 *   lue, et l etat de l offre de chacun de ses clubs (s il est connu).
 * @returns {import('react').ReactElement} Le bandeau, son bouton, sa fenetre et son compte rendu.
 */
function CollectiviteActivation({ collectivite, etats = null }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [bilan, setBilan] = useState(/** @type {ReturnType<typeof lireBilan> | null} */ (null));
  // La fenetre ouverte : les verdicts de l apercu (null : sans apercu), ou rien.
  const [fenetre, setFenetre] = useState(/** @type {{ verdicts: any[] | null } | null} */ (null));
  const mutation = useSetAdminCollectiviteActive({
    onSuccess: (/** @type {any} */ response) => {
      setFenetre(null);
      setBilan(lireBilan(response));
    },
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

  const confirmer = () => {
    setBilan(null);
    mutation.reset?.();
    if (count === 0) {
      setFenetre({ verdicts: [] });
      return;
    }
    apercu.mutate({ collectiviteId: collectivite.documentId, isActive: activer }, {
      onError: () => setFenetre({ verdicts: null }),
      onSuccess: (/** @type {any} */ response) => setFenetre({ verdicts: lireApercu(response) }),
    });
  };
  const faireLeGeste = () => mutation.mutate({
    collectiviteId: collectivite.documentId,
    isActive: activer,
  });

  // Les groupes de la fenetre, dans l ordre du geste : qui change, puis qui ne bouge pas.
  const verdicts = fenetre?.verdicts || [];
  const groupes = (activer ? ['granted', 'already-paid'] : ['revoked', 'none'])
    .map((offre) => ({
      clubs: verdicts.filter((/** @type {any} */ club) => club?.offer === offre),
      offre,
    }))
    .filter((groupe) => groupe.clubs.length > 0);
  const nbTouches = nommer(verdicts, activer ? 'granted' : 'revoked').length;

  const enTeteDeGroupe = (/** @type {string} */ offre, /** @type {number} */ nombre) => {
    const options = { count: nombre, ...SANS_ECHAPPEMENT };
    switch (offre) {
      case 'already-paid':
        return t('collectiviteConsole.fenetres.paientDeja', {
          ...options,
          defaultValue_one: '{{count}} club paie déjà son abonnement, rien ne change pour lui :',
          // eslint-disable-next-line max-len
          defaultValue_other: '{{count}} clubs paient déjà leur abonnement, rien ne change pour eux :',
        });
      case 'granted':
        return t('collectiviteConsole.fenetres.recevront', {
          ...options,
          defaultValue_one: '{{count}} club recevra l’offre Club offerte :',
          defaultValue_other: '{{count}} clubs recevront l’offre Club offerte :',
        });
      case 'revoked':
        return t('collectiviteConsole.fenetres.perdront', {
          ...options,
          defaultValue_one: '{{count}} club perdra l’offre Club offerte :',
          defaultValue_other: '{{count}} clubs perdront l’offre Club offerte :',
        });
      default:
        return t('collectiviteConsole.fenetres.sansOffre', {
          ...options,
          // eslint-disable-next-line max-len
          defaultValue_one: '{{count}} club n’a pas l’offre de la collectivité, rien ne change pour lui :',
          // eslint-disable-next-line max-len
          defaultValue_other: '{{count}} clubs n’ont pas l’offre de la collectivité, rien ne change pour eux :',
        });
    }
  };
  const pastilleDuVerdict = (/** @type {string} */ offre) => {
    if (offre === 'granted') {
      return {
        color: Colors.success500,
        label: t('collectiviteConsole.fenetres.offerte', 'Offerte'),
      };
    }
    if (offre === 'revoked') {
      return {
        color: Colors.error300,
        label: t('collectiviteConsole.fenetres.perd', 'Perd l’offre'),
      };
    }
    return {
      color: Colors.neutral300,
      label: t('collectiviteConsole.fiche.offrePaieLuiMeme', 'Paie lui-même'),
    };
  };

  /** @type {import('react').ReactNode} */
  let corps = <Text style={[Fonts.p2, Fonts.neutral100]}>{messageSansClub()}</Text>;
  if (fenetre?.verdicts === null) {
    corps = <Text style={[Fonts.p2, Fonts.neutral100]}>{messageSansApercu()}</Text>;
  } else if (groupes.length > 0) {
    corps = groupes.map((groupe) => (
      <View key={groupe.offre} style={{ gap: 8 }} testID={`collectivite-fenetre-${groupe.offre}`}>
        <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
          {enTeteDeGroupe(groupe.offre, groupe.clubs.length)}
        </Text>
        {groupe.clubs.map((/** @type {any} */ club) => {
          const nom = String(club?.name || club?.clubDocumentId || '');
          const pastille = pastilleDuVerdict(groupe.offre);
          return (
            <View
              key={club?.clubDocumentId || nom}
              style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
            >
              <ClubLogoMark name={nom} size={32} />
              <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                {nom}
              </Text>
              <PastilleAPoint color={pastille.color} label={pastille.label} />
            </View>
          );
        })}
      </View>
    ));
  }

  let libelleGeste = activer
    ? t('adminCollectivites.activation.activate', 'Activer')
    : t('adminCollectivites.activation.deactivate', 'Couper');
  if (nbTouches > 0) {
    libelleGeste = activer
      ? t('collectiviteConsole.fenetres.offrir', {
        count: nbTouches,
        defaultValue_one: 'Offrir l’offre Club à {{count}} club',
        defaultValue_other: 'Offrir l’offre Club à {{count}} clubs',
      })
      : t('collectiviteConsole.fenetres.retirer', {
        count: nbTouches,
        defaultValue_one: 'Retirer l’offre à {{count}} club',
        defaultValue_other: 'Retirer l’offre à {{count}} clubs',
      });
  }
  if (mutation.error) libelleGeste = t('adminCollectivites.list.retry', 'Réessayer');

  let compteRendu = null;
  if (bilan) {
    const entreParentheses = (/** @type {string} */ noms) => (noms ? ` (${noms})` : '');
    let texteBilan;
    if (!bilan.isActive) {
      texteBilan = t(
        'adminCollectivites.activation.doneDeactivated',
        'Coupée. Offre retirée : {{revoked}}',
        bilan,
      );
    } else {
      texteBilan = t('collectiviteConsole.fenetres.activee', {
        // eslint-disable-next-line max-len
        defaultValue: 'Activée. Offre posée : {{granted}}{{offerts}} · Club qui paie déjà : {{alreadyPaid}}{{payeurs}}',
        offerts: entreParentheses(bilan.grantedNames),
        payeurs: entreParentheses(bilan.alreadyPaidNames),
        ...bilan,
        ...SANS_ECHAPPEMENT,
      });
    }
    compteRendu = (
      <Text style={[Fonts.p3Bold, Fonts.success500]} testID="collectivite-compte-rendu">
        {texteBilan}
      </Text>
    );
  }

  const enCours = Boolean(mutation.isPending || apercu.isPending);
  const teinte = activer ? Colors.warning500 : Colors.success500;
  return (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(teinte, 0.1),
          borderColor: withAlpha(teinte, 0.45),
          borderWidth: 1,
          gap: 12,
        },
      ]}
      testID="collectivite-bandeau-etat"
    >
      <PastilleAPoint
        color={teinte}
        label={activer
          ? t('adminCollectivites.status.inactive', 'Inactive')
          : t('adminCollectivites.status.active', 'Active')}
      />
      <Text style={[Fonts.p2, Fonts.neutral100]}>{phraseDuBandeau(t, collectivite, etats)}</Text>
      {compteRendu}
      <Button
        disabled={enCours}
        isLoading={Boolean(apercu.isPending)}
        onPress={confirmer}
        title={activer
          ? t('adminCollectivites.activation.activate', 'Activer')
          : t('adminCollectivites.activation.deactivate', 'Couper')}
        variant={activer ? 'Primary' : 'Danger'}
      />
      <ConsoleSheet
        error={mutation.error ? getErrorMessage(/** @type {any} */ (mutation.error)) : null}
        onClose={() => {
          setFenetre(null);
          mutation.reset?.();
        }}
        primary={{
          isLoading: Boolean(mutation.isPending),
          label: libelleGeste,
          onPress: faireLeGeste,
          variant: activer ? 'Primary' : 'Danger',
        }}
        secondary={{ label: t('adminCollectivites.activation.cancel', 'Annuler') }}
        testID="collectivite-fenetre-etat"
        title={activer
          ? t('adminCollectivites.activation.activateTitle', 'Activer {{name}} ?', valeurs)
          : t('adminCollectivites.activation.deactivateTitle', 'Couper {{name}} ?', valeurs)}
        visible={Boolean(fenetre)}
      >
        {corps}
      </ConsoleSheet>
    </View>
  );
}

export default CollectiviteActivation;
