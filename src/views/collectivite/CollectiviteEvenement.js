import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import EvenementDeLaVilleForm from '@/components/organisms/evenementVille/EvenementVilleForm';
import VitrineEvenementVille from '@/components/organisms/evenementVille/VitrineEvenementVille';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useEvenementDeLaVille,
  useGestesEvenementDeLaVille,
} from '@/services/collectivite/collectiviteEvenementQueries';
import {
  useCollectiviteInstallations,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { useIsDesktop } from '@/responsive';

/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — « AJOUTER UN ÉVÉNEMENT DE LA VILLE » (et « Modifier »).
 * Au téléphone : le tunnel plein écran (planche P10-evenement-tel, P11-evenement-v2-tel) ; sur
 * l'ordinateur : le panneau au gabarit d'« Attribuer un créneau » (P10-evenement-ordi), ici sur sa
 * propre page (le planning de toutes les installations, qui l'accueillera à côté de la grille, est
 * un autre lot : R17-PLANNING-2). Portes : la 7ᵉ action de l'accueil de la Ville ; une case du
 * planning d'une installation (`facilityId`, `date`, `startTime` : les étapes connues sont
 * sautées) ;
 * « Modifier » sur la fiche (`evenementId`). Publié : la fiche de l'événement le remplace.
 * VILLEEVT-CODE (4B, 27/10) : une CRÉATION publiée montre d'abord la vitrine à partager ; « Voir la
 * fiche » remplace l'écran par la fiche. « Modifier » va droit à la fiche, comme avant.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteEvenement() {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const isDesktop = useIsDesktop();
  /**
   * @type {{ collectiviteId?: string, date?: string, endTime?: string, evenementId?: string,
      facilityId?: string, startTime?: string } | undefined} */
  const parametres = route?.params;
  const collectiviteId = parametres?.collectiviteId || null;
  const evenementId = parametres?.evenementId || null;

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const installations = useCollectiviteInstallations(collectiviteId);
  const existant = useEvenementDeLaVille(evenementId);
  const { modifier, publier } = useGestesEvenementDeLaVille(collectiviteId);
  const [publie, setPublie] = useState(/** @type {any} */ (null));

  const fermer = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate(RouteNames.CollectiviteHome, { collectiviteId });
  };
  const envoyer = async (/** @type {{ data: any }} */ corps) => {
    const reponse = evenementId
      ? await modifier.mutateAsync({ data: corps.data, evenementId })
      : await publier.mutateAsync(corps.data);
    const id = reponse?.data?.documentId || evenementId;
    if (!evenementId && id) setPublie(reponse.data);
    // CORR-COLLECTIVITES 97 (31/10, Adel A) : la fiche garde l'espace Ville (menu du site).
    else if (id) {
      navigation.replace(RouteNames.EvenementDeLaVille, { espace: 'ville', evenementId: id });
    }
    return reponse;
  };

  if (publie) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <VitrineEvenementVille
          evenement={publie}
          onVoirLaFiche={() => navigation.replace(RouteNames.EvenementDeLaVille, {
            espace: 'ville',
            evenementId: publie.documentId,
          })}
        />
      </ScreenContainer>
    );
  }

  const chargement = (evenementId && existant.isLoading) || installations.isLoading;
  if (chargement) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Loader />
      </ScreenContainer>
    );
  }
  // C05 (BUGHUNT P2, Q2-03) : « Modifier » sans l'événement lu (réseau, 403, 404) n'ouvre pas un
  // formulaire vide, dont « Publier » écraserait l'événement : une phrase et « Réessayer ».
  if (evenementId && !existant.data) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <View accessibilityRole="alert" style={{ gap: 12, padding: 24 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'collectiviteEvenement.illisible',
              'Cet événement n’a pas pu être lu : il ne peut pas être modifié pour l’instant.',
            )}
          </Text>
          <Button
            isOption
            onPress={() => existant.refetch?.()}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('collectiviteEvenement.panne.reessayer', 'Réessayer')}
            variant="SecondaryLight"
          />
        </View>
      </ScreenContainer>
    );
  }
  const formulaire = (/** @type {'tunnel' | 'panneau'} */ presentation) => (
    <EvenementDeLaVilleForm
      collectiviteId={String(collectiviteId || '')}
      collectiviteNom={String(collectivite?.name || '')}
      collectiviteVille={String(collectivite?.address?.city || '')}
      evenement={evenementId ? existant.data : null}
      initial={{
        date: parametres?.date,
        endTime: parametres?.endTime,
        facilityId: parametres?.facilityId,
        startTime: parametres?.startTime,
      }}
      installations={Array.isArray(installations.data) ? installations.data : []}
      key={existant.data?.documentId || 'nouveau'}
      onClose={fermer}
      onPublier={envoyer}
      presentation={presentation}
    />
  );
  if (!isDesktop) return formulaire('tunnel');
  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <View style={{ alignItems: 'center', flex: 1, paddingVertical: 24 }}>
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary800, 0.85),
            borderColor: withAlpha(Colors.primary500, 0.25),
            borderRadius: 24,
            borderWidth: 1,
            flex: 1,
            maxWidth: 460,
            padding: 20,
            width: '100%',
          }}
        >
          {collectivite?.name ? (
            <Text style={[Fonts.p4Bold, Fonts.primary200, { marginBottom: 4 }]}>
              {collectivite.name}
            </Text>
          ) : null}
          {formulaire('panneau')}
        </View>
      </View>
      {!collectivite && !mine.isLoading ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('collectiviteEvenement.horsVille', 'Cet espace est réservé à la Ville.')}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

export default CollectiviteEvenement;
