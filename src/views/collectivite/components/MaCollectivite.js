import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { deLaCommune } from '@/domains/collectivite/collectiviteDisplay';
import { gesteDuClub } from '@/domains/collectivite/collectiviteRattachement';
import { closureDay } from '@/domains/facilityClosure/facilityClosureDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import RattachementDuClub from '@/views/collectivite/components/RattachementDuClub';

import {
  useAnswerCollectiviteProposal,
  useClubCollectiviteRequests,
  useCollectivitesForClubSearch,
  useMaCollectivite,
  useNotifyMairie,
  useRequestClubAttach,
} from '@/services/collectivite/collectiviteRattachementQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const ATTENTE_DE_FRAPPE_MS = 300;
const LONGUEUR_MINIMALE = 2;

/**
 * 🏛️ « MA COLLECTIVITÉ » — VILLE-INVITER-CLUB, VOIE 3 (07/10/2026, « collectivité A » d'Adel),
 * la sous-page de « Gérer mon club » (paramètre `section: 'collectivite'` de la fiche du club).
 *
 * - Rattaché : « Ton club est rattaché à la Ville de X ».
 * - Sinon : la demande de la Ville, s'il y en a une, et l'état de ses demandes
 *   (RattachementDuClub) ; « Rechercher ma collectivité » parmi celles de FoundClub (celle de sa
 *   commune d'abord, jamais la démo) ⇒ « Demander le rattachement » : la Ville accepte ou refuse
 *   (« lien A ») ; une seule demande à la fois.
 * - Introuvable : « Prévenir ma mairie » ⇒ une piste pour l'équipe FoundClub (sa commune, celle de
 *   la fiche du club ; à défaut, celle qu'il donne). Personne n'est notifié : la console la lit.
 * ⛔ Le planning de la Ville reste privé : cet écran ne montre ni installation ni horaire.
 * Le serveur est le juge (dirigeant de CE club). « tu » : le club.
 * @param {{ clubId: string | null }} props - Le club.
 * @returns {import('react').ReactElement} La sous-page.
 */
function MaCollectivite({ clubId }) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [texte, setTexte] = useState('');
  const [q, setQ] = useState('');
  // FINITIONS-VILLE (T20) : null tant que le dirigeant n'a rien tapé — le champ montre alors la
  // commune que le serveur lit dans l'adresse du club (`communeSuggestion`).
  const [communeSaisie, setCommuneSaisie] = useState(/** @type {string | null} */ (null));
  /** @type {[Record<string, string>, Function]} */
  const [erreurs, setErreurs] = useState({});

  useEffect(() => {
    const propre = texte.trim();
    const prochain = propre.length >= LONGUEUR_MINIMALE ? propre : '';
    const minuteur = setTimeout(() => setQ(prochain), ATTENTE_DE_FRAPPE_MS);
    return () => clearTimeout(minuteur);
  }, [texte]);

  const ma = useMaCollectivite(clubId);
  const demandes = useClubCollectiviteRequests(clubId);
  const donnees = ma.data && !Array.isArray(ma.data) ? ma.data : null;
  const tenante = donnees?.attached || null;
  const lignes = Array.isArray(demandes.data) ? demandes.data : [];
  const demandeEnCours = lignes.some(
    (demande) => demande?.kind === 'attach_request' && demande?.state === 'pending',
  );
  const recherche = useCollectivitesForClubSearch(clubId, q, {
    enabled: !tenante && !demandeEnCours,
  });
  const demander = useRequestClubAttach();
  const prevenir = useNotifyMairie();
  const repondre = useAnswerCollectiviteProposal();
  const villes = Array.isArray(recherche.data) ? recherche.data : [];

  const poserErreur = (/** @type {string} */ cle, /** @type {any} */ erreur) => setErreurs(
    (/** @type {Record<string, string>} */ avant) => ({
      ...avant, [cle]: erreur ? getErrorMessage(erreur) : '',
    }),
  );
  const geste = (/** @type {any} */ mutation, /** @type {string} */ cle, /** @type {any} */ v) => {
    if (!clubId) return;
    poserErreur(cle, null);
    mutation.mutate({ clubId, ...v }, {
      onError: (/** @type {any} */ erreur) => poserErreur(cle, erreur),
    });
  };
  const erreurDe = (/** @type {string} */ cle) => (erreurs[cle] ? (
    <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error300]}>{erreurs[cle]}</Text>
  ) : null);

  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    borderWidth: 1,
  };
  const carte = [ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 8 }];

  const renderGeste = (/** @type {any} */ ville) => {
    const choix = gesteDuClub(ville);
    if (choix === 'rattache' || choix === 'ailleurs') {
      return (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {choix === 'rattache'
            ? t('collectiviteRattachement.ma.attachedHere', 'Ton club y est rattaché')
            : t(
              'collectiviteRattachement.ma.elsewhere',
              'Ton club est rattaché à une autre collectivité',
            )}
        </Text>
      );
    }
    if (choix === 'envoyee') {
      return (
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {t('collectiviteRattachement.ma.sent', 'Demande envoyée')}
        </Text>
      );
    }
    if (choix === 'refusee') {
      // « refus B » (Adel, 07/10 ~18h05) : le club peut redemander.
      return (
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p3, Fonts.error300]}>
            {t('collectiviteRattachement.ma.refused', 'Elle a refusé ta demande')}
          </Text>
          <Button
            isLoading={demander.isPending
              && demander.variables?.collectiviteId === ville.documentId}
            onPress={() => geste(demander, ville.documentId, { collectiviteId: ville.documentId })}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('collectiviteRattachement.ma.requestAgain', 'Demander de nouveau')}
            variant="Secondary"
          />
        </View>
      );
    }
    if (choix === 'aRepondre') {
      return (
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('collectiviteRattachement.ma.proposes', 'Elle te propose déjà le rattachement')}
          </Text>
          <Button
            isLoading={repondre.isPending
              && repondre.variables?.invitationId === ville?.proposal?.documentId}
            onPress={() => geste(repondre, ville.documentId, {
              accept: true, invitationId: ville.proposal.documentId,
            })}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('collectiviteRattachement.ma.acceptProposal', 'Accepter sa demande')}
          />
        </View>
      );
    }
    return (
      <Button
        isLoading={demander.isPending && demander.variables?.collectiviteId === ville.documentId}
        onPress={() => geste(demander, ville.documentId, { collectiviteId: ville.documentId })}
        size="sm"
        style={{ alignSelf: 'flex-start' }}
        title={t('collectiviteRattachement.ma.request', 'Demander le rattachement')}
      />
    );
  };

  const renderVille = (/** @type {any} */ ville) => (
    <View key={ville.documentId} style={carte} testID={`ma-collectivite-${ville.documentId}`}>
      <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>{ville?.name}</Text>
      {ville?.inCommune ? (
        <Text style={[Fonts.p3Bold, Fonts.success200]}>
          {t('collectiviteRattachement.ma.inCommune', 'Dans ta commune')}
        </Text>
      ) : null}
      {renderGeste(ville)}
      {erreurDe(ville.documentId)}
    </View>
  );

  let resultats = null;
  if (recherche.isLoading) {
    resultats = (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('collectiviteRattachement.ajouter.loading', 'Recherche…')}
      </Text>
    );
  } else if (recherche.error) {
    resultats = (
      <Text accessibilityRole="alert" style={[Fonts.p2, Fonts.error300]}>
        {getErrorMessage(/** @type {any} */ (recherche.error))}
      </Text>
    );
  } else if (villes.length === 0) {
    resultats = (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('collectiviteRattachement.ma.empty', 'Aucune collectivité trouvée.')}
      </Text>
    );
  } else {
    resultats = <View style={{ gap: 12 }}>{villes.map(renderVille)}</View>;
  }

  const commune = donnees?.commune || null;
  const piste = donnees?.lead || null;
  const communeAffichee = communeSaisie ?? String(donnees?.communeSuggestion || '');
  const communeDonnee = communeAffichee.trim();
  const renderPrevenir = () => (
    <View style={carte} testID="ma-collectivite-prevenir">
      <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('collectiviteRattachement.ma.missingTitle', 'Ta collectivité n’est pas sur FoundClub ?')}
      </Text>
      {piste ? (
        <Text style={[Fonts.p2, Fonts.success200]}>
          {t(
            'collectiviteRattachement.ma.leadDone',
            'Ta mairie {{deCommune}} est signalée à l’équipe FoundClub depuis le {{date}}.',
            {
              commune: piste.communeName || '',
              // FINITIONS-VILLE (T20) : « d’Agy », et la date LONGUE (« oct.. » : deux points).
              date: closureDay(piste.createdAt, { long: true }),
              deCommune: deLaCommune(piste.communeName),
              ...SANS_ECHAPPEMENT,
            },
          )}
        </Text>
      ) : (
        <>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'collectiviteRattachement.ma.leadIntro',
              'Préviens ta mairie : l’équipe FoundClub la contactera de ta part.',
            )}
          </Text>
          {commune ? null : (
            <Input
              label={t('collectiviteRattachement.ma.communeLabel', 'Ta commune')}
              maxLength={200}
              onChangeText={(/** @type {string} */ valeur) => setCommuneSaisie(valeur)}
              placeholder={t(
                'collectiviteRattachement.ma.communePlaceholder',
                'Le nom de ta commune',
              )}
              testID="ma-collectivite-commune"
              value={communeAffichee}
            />
          )}
          <Button
            disabled={!commune && !communeDonnee}
            isLoading={prevenir.isPending}
            onPress={() => geste(prevenir, 'prevenir', {
              communeName: commune ? null : communeDonnee,
            })}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('collectiviteRattachement.ma.notify', 'Prévenir ma mairie')}
            variant="Secondary"
          />
        </>
      )}
      {erreurDe('prevenir')}
    </View>
  );

  return (
    <View style={{ gap: 16 }} testID="ma-collectivite">
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={[Fonts.h3Black, Fonts.neutral00]}>
          {t('collectiviteRattachement.ma.title', 'Ma collectivité')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteRattachement.ma.intro',
            // eslint-disable-next-line max-len
            'Rattaché à sa Ville, ton club voit ses installations et ses créneaux, peut y demander des créneaux et reçoit ses actualités. Son planning reste entre la Ville et ses clubs.',
          )}
        </Text>
      </View>
      {tenante ? (
        <View style={carte} testID="ma-collectivite-rattache">
          <Text style={[Fonts.p1Bold, Fonts.success200]}>
            {t('collectiviteRattachement.club.attached', 'Ton club est rattaché à {{ville}}.', {
              ville: formatCollectiviteOfferedBy(String(tenante.name || '')),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
      ) : (
        <>
          <RattachementDuClub clubId={clubId} enabled />
          {demandeEnCours ? null : (
            <View style={{ gap: 12 }} testID="ma-collectivite-recherche">
              <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.neutral00]}>
                {t('collectiviteRattachement.ma.searchTitle', 'Rechercher ma collectivité')}
              </Text>
              <View style={{ gap: 4 }}>
                <Input
                  label={t('collectiviteRattachement.ma.searchLabel', 'Nom de la collectivité')}
                  maxLength={100}
                  onChangeText={(/** @type {string} */ valeur) => setTexte(valeur)}
                  placeholder={t(
                    'collectiviteRattachement.ma.searchPlaceholder',
                    'Ville, communauté…',
                  )}
                  testID="ma-collectivite-saisie"
                  value={texte}
                />
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t('collectiviteRattachement.ma.searchHint', 'Sans texte : celle de ta commune.')}
                </Text>
              </View>
              {resultats}
            </View>
          )}
          {renderPrevenir()}
        </>
      )}
    </View>
  );
}

export default MaCollectivite;
