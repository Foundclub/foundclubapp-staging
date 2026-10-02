import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { CONVERSATION_CLUB } from '@/domains/collectivite/collectiviteCanaux';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { RouteNames } from '@/navigation/routeNames';

import { ouvrirConversationAvecLeClub } from '@/services/collectivite/collectiviteCanauxService';

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
 * Le serveur ouvre la conversation (ou la retrouve : deux appuis rendent la même), puis l'app
 * l'ouvre, au nom de la Ville. Un appel direct au service, sans react-query : le bouton se pose
 * sur des écrans (fiche du club, liste, planning) dont les témoins n'ont pas de client de
 * requêtes. « Demander au club de compléter sa fiche » ouvre la MÊME conversation, avec une
 * phrase prête à envoyer.
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
 *   collectiviteId: string | null | undefined, compact?: boolean, demanderFiche?: boolean,
 *   navigation?: { navigate: Function } | null, testID?: string }} props
 * @returns {import('react').ReactElement | null} Le bouton, ou rien sans club, Ville ou navigation.
 */
function EcrireAuxDirigeants({
  club, collectiviteId, compact = false, demanderFiche = false, navigation: navigationRecue = null,
  testID = 'ecrire-aux-dirigeants',
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const navigationDeLEcran = useNavigationSiPresente();
  const navigation = /** @type {any} */ (navigationRecue || navigationDeLEcran);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(/** @type {unknown} */ (null));
  if (!club?.documentId || !collectiviteId || !navigation) return null;

  const ecrire = async () => {
    if (enCours) return;
    setErreur(null);
    setEnCours(true);
    try {
      const reponse = await ouvrirConversationAvecLeClub({
        clubId: String(club.documentId),
        collectiviteId: String(collectiviteId),
      });
      const conversation = reponse?.data;
      if (!conversation?.documentId) return;
      navigation.navigate(RouteNames.Conversation, {
        chatId: conversation.documentId,
        chatType: CONVERSATION_CLUB,
        espace: 'ville',
        title: club.name || conversation.club?.name || '',
        ...(demanderFiche ? {
          brouillon: t(
            'collectiviteCanaux.privee.brouillonFiche',
            // eslint-disable-next-line max-len
            'Bonjour, pourriez-vous compléter les coordonnées de votre club sur sa fiche FoundClub ? Merci.',
          ),
        } : {}),
      });
    } catch (probleme) {
      setErreur(probleme);
    } finally {
      setEnCours(false);
    }
  };

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
      {erreur ? (
        <Text
          accessibilityRole="alert"
          style={[Fonts.p3, Fonts.error300]}
          testID={`${testID}-erreur`}
        >
          {getErrorMessage(/** @type {any} */ (erreur))}
        </Text>
      ) : null}
    </View>
  );
}

export default EcrireAuxDirigeants;
