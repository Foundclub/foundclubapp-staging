import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { gesteDeRecherche } from '@/domains/collectivite/collectiviteRattachement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import Input from '@/components/molecules/input/Input';

import {
  useAnswerCollectiviteAttachRequest,
  useCollectiviteClubSearch,
  useProposeCollectiviteClub,
} from '@/services/collectivite/collectiviteRattachementQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

// Le serveur cherche hors de la commune à partir de 2 caractères ; l'écran attend que la frappe
// se pose avant de lui demander.
const ATTENTE_DE_FRAPPE_MS = 300;
const LONGUEUR_MINIMALE = 2;

/**
 * 🏛️ « DÉJÀ SUR FOUNDCLUB » — VILLE-INVITER-CLUB (07/10/2026), le besoin d'Adel : « je
 * sélectionne le club, je l'ajoute à la collectivité, et ça lui envoie une demande pour rejoindre
 * la collectivité ».
 *
 * Une recherche parmi les clubs de FoundClub — sans texte, ceux de la commune ; avec texte, la
 * commune d'abord (le serveur range). Chaque ligne dit si le club a un DIRIGEANT sur FoundClub :
 * sans lui, personne ne pourrait accepter, et l'écran propose le lien de la Ville. Le geste de
 * chaque ligne vient de `gesteDeRecherche` (domaine pur, témoin VINV.rattachement).
 * « club A » : quand ses dirigeants acceptent, le club est rattaché tout de suite.
 * « vous » : la mairie. Jamais une personne : le serveur ne rend que des clubs.
 * @param {{ collectiviteId: string | null, onInviterParLien: () => void }} props - La Ville, et le
 *   passage à l'onglet du lien.
 * @returns {import('react').ReactElement} L'onglet.
 */
function AjouterUnClub({ collectiviteId, onInviterParLien }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [texte, setTexte] = useState('');
  const [q, setQ] = useState('');
  /** @type {[Record<string, string>, Function]} */
  const [erreurs, setErreurs] = useState({});

  useEffect(() => {
    const propre = texte.trim();
    const prochain = propre.length >= LONGUEUR_MINIMALE ? propre : '';
    const minuteur = setTimeout(() => setQ(prochain), ATTENTE_DE_FRAPPE_MS);
    return () => clearTimeout(minuteur);
  }, [texte]);

  const recherche = useCollectiviteClubSearch(collectiviteId, q);
  const proposer = useProposeCollectiviteClub();
  const repondre = useAnswerCollectiviteAttachRequest();
  const clubs = Array.isArray(recherche.data) ? recherche.data : [];

  const poserErreur = (/** @type {string} */ clubId, /** @type {any} */ erreur) => setErreurs(
    (/** @type {Record<string, string>} */ avant) => ({
      ...avant, [clubId]: erreur ? getErrorMessage(erreur) : '',
    }),
  );
  const envoyer = (/** @type {any} */ club) => {
    if (!collectiviteId) return;
    poserErreur(club.documentId, null);
    proposer.mutate({ clubId: club.documentId, collectiviteId }, {
      onError: (/** @type {any} */ erreur) => poserErreur(club.documentId, erreur),
    });
  };
  const accepterSaDemande = (/** @type {any} */ club) => {
    if (!collectiviteId || !club?.request?.documentId) return;
    poserErreur(club.documentId, null);
    repondre.mutate({ accept: true, collectiviteId, invitationId: club.request.documentId }, {
      onError: (/** @type {any} */ erreur) => poserErreur(club.documentId, erreur),
    });
  };

  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    borderWidth: 1,
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

  const renderGeste = (/** @type {any} */ club) => {
    const geste = gesteDeRecherche(club);
    const enCours = (/** @type {any} */ mutation) => mutation.isPending
      && (mutation.variables?.clubId === club.documentId
        || mutation.variables?.invitationId === club?.request?.documentId);
    if (geste === 'rattache') {
      return pastille(
        t('collectiviteRattachement.ajouter.attached', 'Déjà rattaché à la Ville'),
        Colors.success200,
      );
    }
    if (geste === 'ailleurs') {
      return (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('collectiviteRattachement.ajouter.elsewhere', 'Rattaché à une autre collectivité')}
        </Text>
      );
    }
    if (geste === 'envoyee') {
      return pastille(
        t('collectiviteRattachement.ajouter.sent', 'Demande envoyée'),
        Colors.primary200,
      );
    }
    if (geste === 'refusee') {
      return (
        <Text style={[Fonts.p3, Fonts.error300]}>
          {t('collectiviteRattachement.ajouter.refused', 'Le club a refusé votre demande')}
        </Text>
      );
    }
    if (geste === 'aRepondre') {
      return (
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t(
              'collectiviteRattachement.ajouter.requested',
              'Ce club demande déjà à vous rejoindre',
            )}
          </Text>
          <Button
            isLoading={enCours(repondre)}
            onPress={() => accepterSaDemande(club)}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('collectiviteRattachement.ajouter.acceptRequest', 'Accepter sa demande')}
          />
        </View>
      );
    }
    if (geste === 'sansDirigeant') {
      return (
        <Button
          onPress={onInviterParLien}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteRattachement.ajouter.inviteByLink', 'Inviter par le lien')}
          variant="Secondary"
        />
      );
    }
    return (
      <Button
        isLoading={enCours(proposer)}
        onPress={() => envoyer(club)}
        size="sm"
        style={{ alignSelf: 'flex-start' }}
        title={t('collectiviteRattachement.ajouter.send', 'Envoyer la demande')}
      />
    );
  };

  const renderClub = (/** @type {any} */ club) => {
    const lieu = [club?.postcode, club?.cityName].filter(Boolean).join(' ');
    const erreur = erreurs[club.documentId];
    return (
      <View
        key={club.documentId}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 8 }]}
        testID={`ajouter-club-${club.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
          <ClubLogoMark logoUrl={club?.logo?.url} name={club?.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>{club?.name}</Text>
            {lieu ? <Text style={[Fonts.p3, Fonts.neutral200]}>{lieu}</Text> : null}
          </View>
        </View>
        {club?.inCommune === false ? (
          <Text style={[Fonts.p3Bold, Fonts.warning500]}>
            {t('collectiviteRattachement.ajouter.outside', 'Hors de la commune')}
          </Text>
        ) : null}
        {club?.attached || club?.attachedElsewhere ? null : (
          <Text style={[Fonts.p3, club?.hasLeader ? Fonts.success200 : Fonts.neutral300]}>
            {club?.hasLeader
              ? t('collectiviteRattachement.ajouter.hasLeader', 'Un dirigeant est sur FoundClub')
              : t(
                'collectiviteRattachement.ajouter.noLeader',
                // eslint-disable-next-line max-len
                'Aucun dirigeant sur FoundClub : personne ne pourrait accepter. Invitez-le par le lien.',
              )}
          </Text>
        )}
        {renderGeste(club)}
        {erreur ? (
          <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error300]}>{erreur}</Text>
        ) : null}
      </View>
    );
  };

  let resultats;
  if (recherche.isLoading) {
    resultats = (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('collectiviteRattachement.ajouter.loading', 'Recherche…')}
      </Text>
    );
  } else if (recherche.error) {
    resultats = (
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="alert" style={[Fonts.p2, Fonts.error300]}>
          {getErrorMessage(/** @type {any} */ (recherche.error))}
        </Text>
        <Button
          isOption
          onPress={() => recherche.refetch?.()}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteClubs.list.retry', 'Réessayer')}
          variant="SecondaryLight"
        />
      </View>
    );
  } else if (clubs.length === 0) {
    resultats = (
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteRattachement.ajouter.empty',
            // eslint-disable-next-line max-len
            'Aucun club trouvé. Il n’est peut-être pas encore sur FoundClub : invitez-le par le lien.',
          )}
        </Text>
        <Button
          onPress={onInviterParLien}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteRattachement.ajouter.inviteByLink', 'Inviter par le lien')}
          variant="Secondary"
        />
      </View>
    );
  } else {
    resultats = <View style={{ gap: 12 }}>{clubs.map(renderClub)}</View>;
  }

  return (
    <View style={{ gap: 14 }}>
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {t(
          'collectiviteRattachement.ajouter.intro',
          // eslint-disable-next-line max-len
          'Cherchez le club par son nom. Ses dirigeants reçoivent votre demande et l’acceptent ou la refusent : accepté, il est rattaché à la Ville.',
        )}
      </Text>
      <View style={{ gap: 4 }}>
        <Input
          label={t('collectiviteRattachement.ajouter.searchLabel', 'Nom du club')}
          maxLength={100}
          onChangeText={(/** @type {string} */ valeur) => setTexte(valeur)}
          placeholder={t('collectiviteRattachement.ajouter.searchPlaceholder', 'Le nom du club')}
          testID="ajouter-club-recherche"
          value={texte}
        />
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteRattachement.ajouter.communeHint',
            'Sans texte : les clubs de votre commune.',
          )}
        </Text>
      </View>
      {resultats}
    </View>
  );
}

export default AjouterUnClub;
