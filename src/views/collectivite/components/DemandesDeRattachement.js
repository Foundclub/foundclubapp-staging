import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatCollectiviteDay } from '@/domains/collectivite/collectiviteDisplay';
import { etatDeDemandeVille } from '@/domains/collectivite/collectiviteRattachement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DecisionCreneauModal from '@/views/collectivite/components/DecisionCreneauModal';

import {
  useAnswerCollectiviteAttachRequest,
  useCancelCollectiviteProposal,
  useProposeCollectiviteClub,
  useRemindCollectiviteProposal,
} from '@/services/collectivite/collectiviteRattachementQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 🏛️ « DEMANDES DE RATTACHEMENT » — VILLE-INVITER-CLUB (07/10/2026), dans « Clubs rattachés ».
 *
 * Les deux sens, une carte par demande :
 *   - venue du LIEN de la Ville (« lien A » d'Adel) : la Ville l'accepte (le club est rattaché
 *     tout de suite, l'offre de la Ville comprise) ou la refuse, après confirmation ;
 *   - envoyée par la Ville à un club déjà inscrit (« club A ») : elle attend ses dirigeants ;
 *     « Relancer » (une fois par jour, le serveur le dit) et « Annuler » tant qu'elle attend.
 * FINITIONS-VILLE (T20, 08/10) : « Refuser » ouvre la fenêtre « Refuser la demande » des créneaux
 * (motifs fréquents + motif obligatoire, envoyé au club), plus une confirmation sans motif.
 * L'état et les gestes permis viennent du serveur (`state`, `canAnswer`, `canRemind`,
 * `canCancel`) : l'écran n'en déduit aucun. « vous » : la mairie.
 * COLL-R-A6 (13/10, COL-001, planche P7v4-clubs état 4) : seules restent les demandes EN ATTENTE
 * et les refus que la Ville peut renvoyer — une demande acceptée, rattachée ou refusée par la Ville
 * n'attend plus rien (« Rattaché · Il apparaît dans vos clubs. » doublait la liste). Ce qui est à
 * trancher passe en tête ; plusieurs demandes : la première, puis « Voir les N demandes ».
 * @param {{ collectiviteId: string | null, demandes: any[] }} props - La Ville et ses demandes.
 * @returns {import('react').ReactElement | null} La section, ou rien sans demande.
 */
function DemandesDeRattachement({ collectiviteId, demandes }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const repondre = useAnswerCollectiviteAttachRequest();
  const relancer = useRemindCollectiviteProposal();
  const annuler = useCancelCollectiviteProposal();
  const renvoyer = useProposeCollectiviteClub();
  // La décision de la fenêtre de refus, gardée telle quelle : un objet neuf à chaque rendu ferait
  // repartir la fenêtre à vide (motif et erreur effacés) dès que la page se redessine.
  const [aRefuser, setARefuser] = useState(/** @type {any} */ (null));
  /** @type {[Record<string, string>, Function]} */
  const [erreurs, setErreurs] = useState({});
  const [toutes, setToutes] = useState(false);

  const renvoyable = (/** @type {any} */ demande) => demande?.kind === 'proposal'
    && demande?.state === 'refused' && Boolean(demande?.club?.documentId);
  const enAttente = (Array.isArray(demandes) ? demandes : []).filter(
    (/** @type {any} */ demande) => demande?.state === 'pending' || renvoyable(demande),
  );
  const aMontrer = [
    ...enAttente.filter((/** @type {any} */ demande) => demande?.canAnswer),
    ...enAttente.filter((/** @type {any} */ demande) => !demande?.canAnswer),
  ];
  if (aMontrer.length === 0) return null;
  const visibles = toutes ? aMontrer : aMontrer.slice(0, 1);

  const tons = {
    cyan: Colors.primary200,
    neutre: Colors.neutral100,
    rouge: Colors.error300,
    vert: Colors.success200,
  };
  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    borderWidth: 1,
  };
  const geste = (
    /** @type {any} */ mutation,
    /** @type {string} */ id,
    /** @type {any} */ variables,
  ) => {
    if (!collectiviteId) return;
    setErreurs((/** @type {Record<string, string>} */ avant) => ({ ...avant, [id]: '' }));
    mutation.mutate({ collectiviteId, invitationId: id, ...variables }, {
      onError: (/** @type {any} */ erreur) => setErreurs(
        (/** @type {Record<string, string>} */ avant) => ({
          ...avant, [id]: getErrorMessage(erreur),
        }),
      ),
    });
  };
  const enCours = (/** @type {any} */ mutation, /** @type {string} */ id) => mutation.isPending
    && mutation.variables?.invitationId === id;

  // « Demande du club · jeu. 8 oct. » : le rappel de la fenêtre de refus.
  const ligneDuRappel = (/** @type {any} */ demande) => {
    const date = formatCollectiviteDay(demande?.createdAt);
    const sens = t('collectiviteRattachement.demandes.fromClub', 'Demande du club');
    return date ? `${sens} · ${date}` : sens;
  };

  const renderDemande = (/** @type {any} */ demande) => {
    const id = demande?.documentId;
    const etat = etatDeDemandeVille(t, demande);
    const date = formatCollectiviteDay(demande?.createdAt);
    const sens = demande?.kind === 'attach_request'
      ? t('collectiviteRattachement.demandes.fromClub', 'Demande du club')
      : t('collectiviteRattachement.demandes.fromCity', 'Votre demande');
    const relancee = Number(demande?.remindCount) || 0;
    const club = demande?.club?.name || '';
    return (
      <View
        key={id}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 6 }]}
        testID={`demande-rattachement-${id}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{club}</Text>
          <View
            style={[
              ApplicationStyle.borderRadius24,
              Spaces.paddingHorizontal[8],
              Spaces.paddingVertical[4],
              { backgroundColor: `${tons[etat.ton]}26` },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: tons[etat.ton] }]}>{etat.pastille}</Text>
          </View>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral300]}>{date ? `${sens} · ${date}` : sens}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{etat.ligne}</Text>
        {relancee ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteClubs.invitations.reminded', 'Relancée {{nombre}} fois.', {
              nombre: relancee,
            })}
          </Text>
        ) : null}
        {demande?.canAnswer ? (
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Button
              isLoading={enCours(repondre, id) && repondre.variables?.accept === true}
              onPress={() => geste(repondre, id, { accept: true })}
              size="sm"
              title={t('collectiviteRattachement.demandes.accept', 'Accepter')}
            />
            <Button
              onPress={() => setARefuser({ kind: 'refuse', request: demande })}
              size="sm"
              title={t('collectiviteRattachement.demandes.refuse', 'Refuser')}
              variant="Ghost"
            />
          </View>
        ) : null}
        {demande?.canRemind || demande?.canCancel ? (
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            {demande?.canRemind ? (
              <Button
                isLoading={enCours(relancer, id)}
                isOption
                onPress={() => geste(relancer, id)}
                size="sm"
                title={t('collectiviteRattachement.demandes.remind', 'Relancer')}
                variant="SecondaryLight"
              />
            ) : null}
            {demande?.canCancel ? (
              <Button
                isLoading={enCours(annuler, id)}
                onPress={() => geste(annuler, id)}
                size="sm"
                title={t('collectiviteRattachement.demandes.cancel', 'Annuler la demande')}
                variant="Ghost"
              />
            ) : null}
          </View>
        ) : null}
        {/* « refus B » (Adel, 07/10 ~18h05) : la Ville peut renvoyer une demande refusée. */}
        {renvoyable(demande) ? (
          <Button
            isLoading={renvoyer.isPending && renvoyer.variables?.clubId === demande.club.documentId}
            isOption
            onPress={() => {
              if (!collectiviteId) return;
              setErreurs((/** @type {Record<string, string>} */ avant) => ({ ...avant, [id]: '' }));
              renvoyer.mutate({ clubId: demande.club.documentId, collectiviteId }, {
                onError: (/** @type {any} */ erreur) => setErreurs(
                  (/** @type {Record<string, string>} */ avant) => ({
                    ...avant, [id]: getErrorMessage(erreur),
                  }),
                ),
              });
            }}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('collectiviteRattachement.demandes.resend', 'Renvoyer la demande')}
            variant="SecondaryLight"
          />
        ) : null}
        {erreurs[id] ? (
          <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error300]}>{erreurs[id]}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ gap: 12 }} testID="collectivite-demandes-rattachement">
      <Text accessibilityRole="header" style={[Fonts.h4Black, Fonts.neutral00]}>
        {t('collectiviteRattachement.demandes.title', 'Demandes de rattachement')}
      </Text>
      {visibles.map(renderDemande)}
      {visibles.length < aMontrer.length ? (
        <Button
          isOption
          onPress={() => setToutes(true)}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          testID="collectivite-demandes-voir-toutes"
          title={t('collectiviteAccueil.attente.voirToutes', 'Voir les {{nombre}} demandes', {
            nombre: aMontrer.length,
          })}
          variant="SecondaryLight"
        />
      ) : null}
      {aRefuser ? (
        <DecisionCreneauModal
          collectiviteId={collectiviteId}
          decision={aRefuser}
          onClose={() => setARefuser(null)}
          refusDeRattachement={{
            ligne: ligneDuRappel(aRefuser.request),
            onRefuse: (/** @type {string} */ motif) => new Promise((resoudre, rejeter) => {
              repondre.mutate({
                accept: false,
                collectiviteId,
                invitationId: aRefuser.request?.documentId,
                reason: motif,
              }, { onError: rejeter, onSuccess: resoudre });
            }),
          }}
        />
      ) : null}
    </View>
  );
}

export default DemandesDeRattachement;
