import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { gesteDeLaVille } from '@/domains/collectivite/collectiviteRattachement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import {
  useAnswerCollectiviteAttachRequest,
  useCancelCollectiviteProposal,
  useCollectiviteClubRequests,
  useProposeCollectiviteClub,
} from '@/services/collectivite/collectiviteRattachementQueries';

import { getErrorMessage, getServerErrorCode } from '@/utils/errors/displayError';

// Les boutons « sm » font 39 px : la zone d'appui en garde 44 (règle des lots).
const BOUTON = { alignSelf: /** @type {'flex-start'} */ ('flex-start'), height: 44 };

/**
 * 🏛️ « CE CLUB FAIT PARTIE DE MA COLLECTIVITÉ » — R17-INVITER (19/10/2026, REC17-009). Adel,
 * Test 17/10 : « on prend la recherche de club comme elle est de base sur l'app, et dès qu'on
 * trouve le club on clique sur un bouton pour dire « ce club fait partie de ma collectivité », et
 * ça lui envoie une demande ».
 *
 * L'action d'UN club, posée par la Ville sous chaque carte de la recherche habituelle
 * (CollectiviteInviteClub → ClubListContent `actionDeCarte`) et sur la fiche du club qu'elle
 * ouvre (ClubDetails, `collectiviteId`). Elle envoie la demande existante
 * (`POST /collectivites/:id/club-proposals`) ; son état se lit dans les demandes de la Ville et
 * dans le refus du serveur (`gesteDeLaVille`, témoin R17INVIT.gesteDeLaVille).
 * 🔒 Seul un gestionnaire de CETTE Ville lit ses demandes (garde serveur
 * is-gestionnaire-collectivite) : sans cette lecture — joueur, dirigeant, lecture en cours —
 * l'action ne rend RIEN.
 * Remplace la recherche dédiée « Déjà sur FoundClub » (VILLE-INVITER-CLUB, 07/10).
 * « vous » : la mairie.
 * @param {{
 *   club: { documentId?: string, name?: string } | null | undefined,
 *   collectiviteId: string | null | undefined,
 *   onInviterParLien: () => void,
 * }} props - Le club, la Ville, et le passage au lien de la Ville.
 * @returns {import('react').ReactElement | null} L'action, ou rien.
 */
function AjouterUnClub({ club, collectiviteId, onInviterParLien }) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const demandes = useCollectiviteClubRequests(collectiviteId);
  const proposer = useProposeCollectiviteClub();
  const annuler = useCancelCollectiviteProposal();
  const repondre = useAnswerCollectiviteAttachRequest();
  const [refus, setRefus] = useState(/** @type {any} */ (null));

  const clubId = club?.documentId;
  if (!collectiviteId || !clubId || !Array.isArray(demandes.data)) return null;

  const lignes = demandes.data.filter((demande) => demande?.club?.documentId === clubId);
  const proposition = lignes.find((demande) => demande?.kind === 'proposal');
  const demandeDuClub = lignes.find((demande) => demande?.kind === 'attach_request');
  const geste = gesteDeLaVille(demandes.data, clubId, refus ? getServerErrorCode(refus) : '');
  const surErreur = { onError: (/** @type {any} */ erreur) => setRefus(erreur) };

  const envoyer = () => {
    setRefus(null);
    proposer.mutate({ clubId, collectiviteId }, surErreur);
  };
  const annulerLaDemande = () => {
    setRefus(null);
    annuler.mutate({ collectiviteId, invitationId: proposition?.documentId }, surErreur);
  };
  const accepterSaDemande = () => {
    setRefus(null);
    repondre.mutate(
      { accept: true, collectiviteId, invitationId: demandeDuClub?.documentId },
      surErreur,
    );
  };

  const pastille = (/** @type {string} */ libelle, /** @type {string} */ couleur) => (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        Spaces.paddingHorizontal[8],
        Spaces.paddingVertical[4],
        { alignSelf: 'flex-start', backgroundColor: `${couleur}26` },
      ]}
    >
      <Text style={[Fonts.p4Bold, { color: couleur }]}>{libelle}</Text>
    </View>
  );
  const parLeLien = (
    <Button
      onPress={onInviterParLien}
      size="sm"
      style={BOUTON}
      title={t('collectiviteRattachement.ajouter.inviteByLink', 'Inviter par le lien')}
      variant="Secondary"
    />
  );

  let contenu;
  if (geste === 'rattache') {
    contenu = pastille(
      t('collectiviteRattachement.ajouter.attached', 'Déjà rattaché à la Ville'),
      Colors.success200,
    );
  } else if (geste === 'ailleurs') {
    contenu = (
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t('collectiviteRattachement.ajouter.elsewhere', 'Rattaché à une autre collectivité')}
      </Text>
    );
  } else if (geste === 'envoyee') {
    contenu = pastille(
      t('collectiviteRattachement.ajouter.sent', 'Demande envoyée'),
      Colors.primary200,
    );
  } else if (geste === 'attendDirigeant') {
    contenu = (
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {t(
            'collectiviteRattachement.ajouter.awaitingLeader',
            'Demande enregistrée : elle attend le premier dirigeant du club',
          )}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            isLoading={annuler.isPending}
            onPress={annulerLaDemande}
            size="sm"
            style={BOUTON}
            title={t('collectiviteRattachement.demandes.cancel', 'Annuler la demande')}
            variant="Ghost"
          />
          {parLeLien}
        </View>
      </View>
    );
  } else if (geste === 'refusee') {
    // « refus B » (Adel, 07/10 ~18h05) : la Ville peut renvoyer sa demande.
    contenu = (
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p3, Fonts.error300]}>
          {t('collectiviteRattachement.ajouter.refused', 'Le club a refusé votre demande')}
        </Text>
        <Button
          isLoading={proposer.isPending}
          onPress={envoyer}
          size="sm"
          style={BOUTON}
          title={t('collectiviteRattachement.ajouter.resend', 'Renvoyer la demande')}
          variant="Secondary"
        />
      </View>
    );
  } else if (geste === 'aRepondre') {
    contenu = (
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {t(
            'collectiviteRattachement.ajouter.requested',
            'Ce club demande déjà à vous rejoindre',
          )}
        </Text>
        <Button
          isLoading={repondre.isPending}
          onPress={accepterSaDemande}
          size="sm"
          style={BOUTON}
          title={t('collectiviteRattachement.ajouter.acceptRequest', 'Accepter sa demande')}
        />
      </View>
    );
  } else if (geste === 'sansDirigeant') {
    // Le serveur d'avant R17-INVITER refuse encore un club sans dirigeant (409).
    contenu = (
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteRattachement.ajouter.noLeader',
            // eslint-disable-next-line max-len
            'Aucun dirigeant sur FoundClub : personne ne pourrait accepter. Invitez-le par le lien.',
          )}
        </Text>
        {parLeLien}
      </View>
    );
  } else {
    contenu = (
      <Button
        isLoading={proposer.isPending}
        onPress={envoyer}
        size="sm"
        style={BOUTON}
        title={t(
          'collectiviteRattachement.ajouter.belongs',
          'Ce club fait partie de ma collectivité',
        )}
      />
    );
  }

  const motDuRefus = refus && !['ailleurs', 'sansDirigeant'].includes(geste)
    ? getErrorMessage(refus)
    : '';
  return (
    <View style={{ gap: 8 }} testID={`ajouter-club-${clubId}`}>
      {contenu}
      {motDuRefus ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error300]}>{motDuRefus}</Text>
      ) : null}
    </View>
  );
}

export default AjouterUnClub;
