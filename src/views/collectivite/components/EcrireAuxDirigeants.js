import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Text, TouchableOpacity, View,
} from 'react-native';

import { CONVERSATION_CLUB } from '@/domains/collectivite/collectiviteCanaux';
import { nomQuiSElide } from '@/domains/collectivite/collectiviteDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import Input from '@/components/molecules/input/Input';

import { RouteNames } from '@/navigation/routeNames';

import {
  ecrireLePremierMessageAuClub,
  trouverConversationAvecLeClub,
} from '@/services/collectivite/collectiviteCanauxService';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * La navigation de l'écran, ou `null` hors navigation (une fenêtre du bas, voir plus bas).
 * L'appel reste INCONDITIONNEL — même motif que `useIsFocusedSafely` (hooks/useMarqueeLoop.js) :
 * l'absence de navigateur ne change pas pendant la vie du composant, ni l'ordre des crochets.
 * @returns {unknown} La navigation, ou null.
 */
const useNavigationSiPresente = () => {
  try {
    return useNavigation();
  } catch {
    return null;
  }
};

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
 *
 * Posé sur la fiche d'un club (côté mairie), sur chaque carte de « Clubs rattachés » et dans la
 * fiche d'un bloc du planning d'une installation de la Ville.
 *
 * 🐞 COLL-FIX-PLANNING (G4, tournée T9) : la fiche d'un bloc du planning est une fenêtre du bas
 * (BottomModal), affichée par un PORTAIL posé AU-DESSUS du NavigationContainer
 * (src/app/AppProviders.native.js). Là, `useNavigation()` JETTE (« Couldn't find a navigation
 * object ») : écran rouge en développement, plantage en production. L'écran qui le pose dans une
 * fenêtre lui passe donc SA navigation (`navigation`) ; sans navigation du tout, rien.
 * @param {{ club: { documentId?: string, name?: string } | null | undefined,
 *   collectiviteId: string | null | undefined, compact?: boolean, court?: boolean,
 *   demanderFiche?: boolean, icone?: boolean, navigation?: { navigate: Function } | null,
 *   testID?: string }} props
 *   `court` : le libellé court de « compléter sa fiche » (colonne du tableau, planche 36).
 *   `icone` : COLL-R-A6 (13/10, COL-001, D1 A′) — un bouton ROND, icône seule (44 px), nommé
 *   « Écrire aux dirigeants de <club> » pour le lecteur d'écran ; la saisie du premier message
 *   prend alors toute la largeur (elle passe sous la ligne du nom, dans « Clubs rattachés »).
 * @returns {import('react').ReactElement | null} Le bouton, ou rien sans club, Ville ou navigation.
 */
function EcrireAuxDirigeants({
  club, collectiviteId, compact = false, court = false, demanderFiche = false, icone = false,
  navigation: navigationRecue = null, testID = 'ecrire-aux-dirigeants',
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigationDeLEcran = useNavigationSiPresente();
  const navigation = /** @type {any} */ (navigationRecue || navigationDeLEcran);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(/** @type {unknown} */ (null));
  // null : le bouton ; un texte : le premier message, en cours d'écriture.
  const [premierMessage, setPremierMessage] = useState(/** @type {string | null} */ (null));
  if (!club?.documentId || !collectiviteId || !navigation) return null;

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
      <View
        style={{ alignSelf: 'stretch', gap: 8, ...(icone ? { width: '100%' } : {}) }}
        testID={`${testID}-saisie`}
      >
        {/* VILLE-T18C (07/10, tournée T18 G62) : « d’AS Montrivage », et la mairie VOUVOYÉE
            (ce bouton est celui de la Ville : fiche d'un club, clubs rattachés, son planning). */}
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {nomQuiSElide(club.name)
            ? t(
              'collectiviteCanaux.privee.premierMessageTitreElide',
              'Premier message aux dirigeants d’{{club}}',
              { club: club.name || '', ...SANS_ECHAPPEMENT },
            )
            : t(
              'collectiviteCanaux.privee.premierMessageTitre',
              'Premier message aux dirigeants de {{club}}',
              { club: club.name || '', ...SANS_ECHAPPEMENT },
            )}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'collectiviteCanaux.privee.premierMessageAide',
            'La conversation s’ouvre quand vous envoyez ce message.',
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
          title={t('collectiviteCanaux.privee.envoyer', 'Envoyer')}
          variant="Primary"
        />
        <Button
          disabled={enCours}
          isOption
          onPress={annuler}
          size="sm"
          title={t('collectiviteCanaux.privee.annuler', 'Annuler')}
          variant="SecondaryLight"
        />
        {ligneErreur}
      </View>
    );
  }

  if (icone) {
    const nomme = nomQuiSElide(club.name)
      ? t('collectiviteClubs.carte.ecrireElide', 'Écrire aux dirigeants d’{{club}}', {
        club: club.name || '', ...SANS_ECHAPPEMENT,
      })
      : t('collectiviteClubs.carte.ecrire', 'Écrire aux dirigeants de {{club}}', {
        club: club.name || '', ...SANS_ECHAPPEMENT,
      });
    return (
      <>
        <TouchableOpacity
          accessibilityLabel={nomme}
          accessibilityRole="button"
          accessibilityState={{ busy: enCours, disabled: enCours }}
          disabled={enCours}
          onPress={ecrire}
          style={{
            alignItems: 'center',
            borderColor: Colors.primary500,
            borderRadius: 22,
            borderWidth: 1,
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}
          testID={testID}
        >
          {enCours
            ? <ActivityIndicator color={Colors.primary500} size="small" />
            : <SvgIcon color={Colors.primary500} height={20} name="envelope" width={20} />}
        </TouchableOpacity>
        {ligneErreur ? <View style={{ width: '100%' }}>{ligneErreur}</View> : null}
      </>
    );
  }

  let titre = t('collectiviteCanaux.privee.ecrire', 'Écrire aux dirigeants');
  if (demanderFiche) {
    // VILLE-T18C (07/10, tournée T18 SITE_G60) : dans la colonne du tableau, le libellé de la
    // planche 36 ; le libellé entier y débordait de la carte.
    titre = court
      ? t('collectiviteCanaux.privee.demanderFicheCourt', 'Demander de compléter')
      : t('collectiviteCanaux.privee.demanderFiche', 'Demander au club de compléter sa fiche');
  }

  return (
    // VILLE-T18C : jamais plus large que sa place (une colonne de tableau, une carte).
    <View style={{ alignSelf: compact ? 'flex-start' : 'stretch', gap: 4, maxWidth: '100%' }}>
      <Button
        icon={demanderFiche ? undefined : 'send'}
        isLoading={enCours}
        isOption={compact}
        onPress={ecrire}
        size={compact ? 'sm' : undefined}
        testID={testID}
        title={titre}
        variant={compact ? 'SecondaryLight' : 'Primary'}
      />
      {ligneErreur}
    </View>
  );
}

export default EcrireAuxDirigeants;
