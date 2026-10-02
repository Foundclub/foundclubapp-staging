import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { CONVERSATION_CLUB } from '@/domains/collectivite/collectiviteCanaux';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

import { RouteNames } from '@/navigation/routeNames';

import {
  ecrireLePremierMessageAuClub,
  trouverConversationAvecLeClub,
} from '@/services/collectivite/collectiviteCanauxService';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 🏛️ « ÉCRIRE AUX DIRIGEANTS » — COLL-C4A2 (02/10/2026), décision d'Adel « écrire A » (D73) :
 * une conversation PRIVÉE entre la Ville et les dirigeants de CE club (design HY521H1 page 3,
 * P3c-canal-tel écran 8). Ce qui concerne un seul club (sa fiche, ses demandes, son offre) n'a
 * pas à être lu par les autres : ce n'est pas le canal des dirigeants.
 *
 * 🧯 COLL-FIX-DEMANDES (02/10) — ELLE NAÎT AU PREMIER MESSAGE. L'appui créait la conversation
 * côté serveur avant tout message : un simple appui posait une conversation vide chez la Ville
 * ET chez le club. Désormais l'appui la RETROUVE (GET, sans rien créer) : si elle existe, elle
 * s'ouvre ; sinon le bouton devient, sur place, la saisie du premier message, et c'est l'envoi
 * qui la crée puis l'ouvre. Sur place plutôt qu'en feuille : le bouton vit aussi DANS la feuille
 * d'un bloc du planning, où une seconde feuille s'empilerait.
 *
 * Un appel direct au service, sans react-query : le bouton se pose sur des écrans (fiche du
 * club, liste, planning) dont les témoins n'ont pas de client de requêtes. « Demander au club de
 * compléter sa fiche » ouvre la MÊME conversation, avec une phrase prête à envoyer.
 * @param {{ club: { documentId?: string, name?: string } | null | undefined,
 *   collectiviteId: string | null | undefined, compact?: boolean, demanderFiche?: boolean,
 *   testID?: string }} props
 * @returns {import('react').ReactElement | null} Le bouton, ou rien sans club ni Ville.
 */
function EcrireAuxDirigeants({
  club, collectiviteId, compact = false, demanderFiche = false, testID = 'ecrire-aux-dirigeants',
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(/** @type {unknown} */ (null));
  // null : le bouton ; un texte : le premier message, en cours d'écriture.
  const [premierMessage, setPremierMessage] = useState(/** @type {string | null} */ (null));
  if (!club?.documentId || !collectiviteId) return null;

  const ids = { clubId: String(club.documentId), collectiviteId: String(collectiviteId) };
  const brouillon = demanderFiche ? t(
    'collectiviteCanaux.privee.brouillonFiche',
    // eslint-disable-next-line max-len
    'Bonjour, pourriez-vous compléter les coordonnées de votre club sur sa fiche FoundClub ? Merci.',
  ) : '';
  const ouvrir = (/** @type {any} */ conversation, /** @type {string} */ aEnvoyer) => {
    navigation.navigate(RouteNames.Conversation, {
      chatId: conversation.documentId,
      chatType: CONVERSATION_CLUB,
      espace: 'ville',
      title: club.name || conversation.club?.name || '',
      ...(aEnvoyer ? { brouillon: aEnvoyer } : {}),
    });
  };
  const agir = async (/** @type {() => Promise<void>} */ geste) => {
    if (enCours) return;
    setErreur(null);
    setEnCours(true);
    try {
      await geste();
    } catch (probleme) {
      setErreur(probleme);
    } finally {
      setEnCours(false);
    }
  };
  const ecrire = () => agir(async () => {
    const conversation = (await trouverConversationAvecLeClub(ids))?.data;
    if (conversation?.documentId) ouvrir(conversation, brouillon);
    else setPremierMessage(brouillon);
  });
  const envoyer = () => agir(async () => {
    const message = String(premierMessage || '').trim();
    if (!message) return;
    const conversation = (await ecrireLePremierMessageAuClub({ ...ids, message }))?.data;
    if (!conversation?.documentId) return;
    setPremierMessage(null);
    ouvrir(conversation, '');
  });
  const annuler = () => {
    setErreur(null);
    setPremierMessage(null);
  };

  const ligneErreur = erreur ? (
    <Text
      accessibilityRole="alert"
      style={[Fonts.p3, Fonts.error300]}
      testID={`${testID}-erreur`}
    >
      {getErrorMessage(/** @type {any} */ (erreur))}
    </Text>
  ) : null;

  if (premierMessage !== null) {
    return (
      <View style={{ alignSelf: 'stretch', gap: 8 }} testID={`${testID}-saisie`}>
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {t(
            'collectiviteCanaux.privee.premierMessageTitre',
            'Premier message aux dirigeants de {{club}}',
            { club: club.name || '', ...SANS_ECHAPPEMENT },
          )}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'collectiviteCanaux.privee.premierMessageAide',
            'La conversation s’ouvre quand tu envoies ce message.',
          )}
        </Text>
        <Input
          multiline
          onChangeText={setPremierMessage}
          testID={`${testID}-premier-message`}
          value={premierMessage}
        />
        <Button
          disabled={!premierMessage.trim()}
          icon="send"
          isLoading={enCours}
          onPress={envoyer}
          testID={`${testID}-envoyer`}
          title={t('collectiviteCanaux.privee.envoyer', 'Envoyer')}
          variant="Primary"
        />
        <Button
          disabled={enCours}
          isOption
          onPress={annuler}
          size="sm"
          testID={`${testID}-annuler`}
          title={t('collectiviteCanaux.privee.annuler', 'Annuler')}
          variant="SecondaryLight"
        />
        {ligneErreur}
      </View>
    );
  }

  return (
    <View style={{ alignSelf: compact ? 'flex-start' : 'stretch', gap: 4 }}>
      <Button
        icon={demanderFiche ? undefined : 'send'}
        isLoading={enCours}
        isOption={compact}
        onPress={ecrire}
        size={compact ? 'sm' : undefined}
        testID={testID}
        title={demanderFiche
          ? t('collectiviteCanaux.privee.demanderFiche', 'Demander au club de compléter sa fiche')
          : t('collectiviteCanaux.privee.ecrire', 'Écrire aux dirigeants')}
        variant={compact ? 'SecondaryLight' : 'Primary'}
      />
      {ligneErreur}
    </View>
  );
}

export default EcrireAuxDirigeants;
