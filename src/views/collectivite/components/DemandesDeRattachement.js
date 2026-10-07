import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatCollectiviteDay } from '@/domains/collectivite/collectiviteDisplay';
import { etatDeDemandeVille } from '@/domains/collectivite/collectiviteRattachement';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

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
 * L'état et les gestes permis viennent du serveur (`state`, `canAnswer`, `canRemind`,
 * `canCancel`) : l'écran n'en déduit aucun. « vous » : la mairie.
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
  const [aConfirmer, setAConfirmer] = useState(/** @type {string | null} */ (null));
  /** @type {[Record<string, string>, Function]} */
  const [erreurs, setErreurs] = useState({});

  if (!Array.isArray(demandes) || demandes.length === 0) return null;

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
      onSuccess: () => setAConfirmer(null),
    });
  };
  const enCours = (/** @type {any} */ mutation, /** @type {string} */ id) => mutation.isPending
    && mutation.variables?.invitationId === id;

  const renderDemande = (/** @type {any} */ demande) => {
    const id = demande?.documentId;
    const etat = etatDeDemandeVille(t, demande);
    const date = formatCollectiviteDay(demande?.createdAt);
    const sens = demande?.kind === 'attach_request'
      ? t('collectiviteRattachement.demandes.fromClub', 'Demande du club')
      : t('collectiviteRattachement.demandes.fromCity', 'Votre demande');
    const relancee = Number(demande?.remindCount) || 0;
    const club = demande?.club?.name || '';
    const renvoyable = demande?.kind === 'proposal' && demande?.state === 'refused'
      && Boolean(demande?.club?.documentId);
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
        {demande?.canAnswer && aConfirmer !== id ? (
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Button
              isLoading={enCours(repondre, id) && repondre.variables?.accept === true}
              onPress={() => geste(repondre, id, { accept: true })}
              size="sm"
              title={t('collectiviteRattachement.demandes.accept', 'Accepter')}
            />
            <Button
              onPress={() => setAConfirmer(id)}
              size="sm"
              title={t('collectiviteRattachement.demandes.refuse', 'Refuser')}
              variant="Ghost"
            />
          </View>
        ) : null}
        {demande?.canAnswer && aConfirmer === id ? (
          <View style={{ gap: 8 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'collectiviteRattachement.demandes.refuseConfirm',
                'Refuser la demande de {{club}} ?',
                { club, ...SANS_ECHAPPEMENT },
              )}
            </Text>
            <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
              <Button
                isLoading={enCours(repondre, id) && repondre.variables?.accept === false}
                onPress={() => geste(repondre, id, { accept: false })}
                size="sm"
                title={t('collectiviteRattachement.demandes.refuseYes', 'Oui, refuser')}
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
        {renvoyable ? (
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
      {demandes.map(renderDemande)}
    </View>
  );
}

export default DemandesDeRattachement;
