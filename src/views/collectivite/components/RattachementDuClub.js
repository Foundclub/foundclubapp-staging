import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  demandeCouranteDuClub,
  ligneDeDemandeDuClub,
  villeSujet,
} from '@/domains/collectivite/collectiviteRattachement';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import {
  useAnswerCollectiviteProposal,
  useClubCollectiviteRequests,
  useRequestClubAttach,
} from '@/services/collectivite/collectiviteRattachementQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 🏛️ LE RATTACHEMENT À LA VILLE, VU DU CLUB — VILLE-INVITER-CLUB (07/10/2026), dans l'espace du
 * dirigeant (le hub de la fiche du club).
 *
 * - « club A » d'Adel : la Ville a cherché le club et lui demande de le rattacher. La carte dit
 *   ce que ça change (une phrase : installations, créneaux, actualités), l'offre quand la Ville la
 *   donne, et « Accepter » (rattaché tout de suite) / « Refuser » (confirmé ; FINITIONS-VILLE :
 *   la Ville pourra la renvoyer, « refus B »).
 * - Constat du chef en prod (07/10) : le dirigeant voit aussi l'état de la demande qu'il a faite
 *   par le LIEN de la Ville — Adel avait cru son club rattaché alors qu'elle attendait.
 * - FINITIONS-VILLE (T20, 08/10) : la carte des états ne dit que l'état COURANT (jamais « ta
 *   demande attend » et « tu as refusé » ensemble) ; sa demande en attente s'annule (« Annuler ma
 *   demande », quand le serveur dit `canCancel`).
 * Le serveur est le juge (dirigeant de CE club) : un compte qui n'a pas le droit de lire ne voit
 * rien, sans message. Jamais la Ville de Démo (le serveur ne la rend pas). « tu » : le club.
 * @param {{ clubId: string | null, enabled: boolean }} props - Le club, et « ce compte le dirige ».
 * @returns {import('react').ReactElement | null} La carte, ou rien.
 */
function RattachementDuClub({ clubId, enabled }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const demandes = useClubCollectiviteRequests(clubId, { enabled: Boolean(enabled) });
  const repondre = useAnswerCollectiviteProposal();
  const annuler = useRequestClubAttach();
  const [aConfirmer, setAConfirmer] = useState(/** @type {string | null} */ (null));
  /** @type {[Record<string, string>, Function]} */
  const [erreurs, setErreurs] = useState({});

  const lignes = enabled && Array.isArray(demandes.data) ? demandes.data : [];
  if (lignes.length === 0) return null;

  const repondreA = (/** @type {any} */ demande, /** @type {boolean} */ accept) => {
    if (!clubId) return;
    setErreurs((/** @type {Record<string, string>} */ avant) => ({
      ...avant, [demande.documentId]: '',
    }));
    repondre.mutate({ accept, clubId, invitationId: demande.documentId }, {
      onError: (/** @type {any} */ erreur) => setErreurs(
        (/** @type {Record<string, string>} */ avant) => ({
          ...avant, [demande.documentId]: getErrorMessage(erreur),
        }),
      ),
      onSuccess: () => setAConfirmer(null),
    });
  };
  const enCours = (/** @type {any} */ demande, /** @type {boolean} */ accept) => repondre.isPending
    && repondre.variables?.invitationId === demande.documentId
    && repondre.variables?.accept === accept;

  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: Colors.primary500,
    borderWidth: 1,
  };
  const erreurDe = (/** @type {any} */ demande) => (erreurs[demande.documentId] ? (
    <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error300]}>
      {erreurs[demande.documentId]}
    </Text>
  ) : null);

  const renderProposition = (/** @type {any} */ demande) => {
    const nom = demande?.collectivite?.name;
    const valeurs = {
      sujet: villeSujet(nom),
      ville: formatCollectiviteOfferedBy(String(nom || '')),
      ...SANS_ECHAPPEMENT,
    };
    return (
      <View
        key={demande.documentId}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 8 }]}
        testID={`rattachement-proposition-${demande.documentId}`}
      >
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {t('collectiviteRattachement.club.kicker', 'Rattachement à la Ville').toUpperCase()}
        </Text>
        <Text accessibilityRole="header" style={[Fonts.p1Black, Fonts.neutral00]}>
          {t(
            'collectiviteRattachement.club.proposalTitle',
            '{{sujet}} propose de rattacher ton club',
            valeurs,
          )}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t(
            'collectiviteRattachement.club.proposalGains',
            // eslint-disable-next-line max-len
            'Rattaché, ton club voit les installations et les créneaux de la Ville, peut y demander des créneaux et reçoit ses actualités.',
          )}
        </Text>
        {demande?.offerIncluded ? (
          <Text style={[Fonts.p2Bold, Fonts.success200]}>
            {t(
              'collectiviteRattachement.club.proposalOffer',
              'Avec {{ville}}, ton club reçoit l’offre Club de FoundClub, offerte par la Ville.',
              valeurs,
            )}
          </Text>
        ) : null}
        {aConfirmer === demande.documentId ? (
          <View style={{ gap: 8 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'collectiviteRattachement.club.refuseConfirm',
                // eslint-disable-next-line max-len
                'Refuser la demande de {{ville}} ? Ton club ne sera pas rattaché ; elle pourra te la renvoyer plus tard.',
                valeurs,
              )}
            </Text>
            <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
              <Button
                isLoading={enCours(demande, false)}
                onPress={() => repondreA(demande, false)}
                size="sm"
                title={t('collectiviteRattachement.club.refuseYes', 'Oui, refuser')}
                variant="Danger"
              />
              <Button
                onPress={() => setAConfirmer(null)}
                size="sm"
                title={t('common.cancel', 'Annuler')}
                variant="Ghost"
              />
            </View>
          </View>
        ) : (
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Button
              isLoading={enCours(demande, true)}
              onPress={() => repondreA(demande, true)}
              size="sm"
              title={t('collectiviteRattachement.club.accept', 'Accepter')}
            />
            <Button
              onPress={() => setAConfirmer(demande.documentId)}
              size="sm"
              title={t('collectiviteRattachement.club.refuse', 'Refuser')}
              variant="Ghost"
            />
          </View>
        )}
        {erreurDe(demande)}
      </View>
    );
  };

  const aRepondre = (/** @type {any} */ demande) => (
    demande?.kind === 'proposal' && demande?.canAnswer
  );
  const propositions = lignes.filter(aRepondre);
  const courante = demandeCouranteDuClub(lignes.filter((demande) => !aRepondre(demande)));
  const annulerMaDemande = (/** @type {any} */ demande) => {
    if (!clubId || !demande?.collectiviteId) return;
    setErreurs((/** @type {Record<string, string>} */ avant) => ({
      ...avant, [demande.documentId]: '',
    }));
    annuler.mutate({ cancel: true, clubId, collectiviteId: demande.collectiviteId }, {
      onError: (/** @type {any} */ erreur) => setErreurs(
        (/** @type {Record<string, string>} */ avant) => ({
          ...avant, [demande.documentId]: getErrorMessage(erreur),
        }),
      ),
    });
  };

  return (
    <View style={{ gap: 12 }} testID="rattachement-du-club">
      {propositions.map(renderProposition)}
      {courante ? (
        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            {
              backgroundColor: `${Colors.primary700}73`,
              borderColor: `${Colors.primary500}80`,
              borderWidth: 1,
              gap: 6,
            },
          ]}
          testID="rattachement-etats"
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('collectiviteRattachement.club.kicker', 'Rattachement à la Ville').toUpperCase()}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{ligneDeDemandeDuClub(t, courante)}</Text>
          {courante.canCancel === true && courante.collectiviteId ? (
            <Button
              isLoading={annuler.isPending}
              onPress={() => annulerMaDemande(courante)}
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              title={t('collectiviteRattachement.club.cancelMine', 'Annuler ma demande')}
              variant="Ghost"
            />
          ) : null}
          {erreurDe(courante)}
        </View>
      ) : null}
    </View>
  );
}

export default RattachementDuClub;
