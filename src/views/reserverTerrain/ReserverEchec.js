import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, View,
} from 'react-native';

import { contenuDEchec, texteCreneau, texteJourCourt } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BlocDEchec from '@/views/reserverTerrain/components/BlocDEchec';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

import { useIsDesktop } from '@/responsive';

const COLONNE = 560;

/**
 * E-P13 — « LES MESSAGES D'ÉCHEC » — RESA-L6A (14/10/2026), planche EP13, plan E-P13. Un seul
 * écran, un même gabarit (BlocDEchec) ; la variante vient du CODE du refus du serveur
 * (`varianteDEchec`) ou de l'état de la réservation (`varianteDeLaReservation`) :
 * pris, fermé, trop tard ici, délai d'annulation passé, téléphone seulement, âge minimum (R2),
 * date de naissance absente, plafond, banni (⛔ RC-P08 : la phrase seule, jamais la raison du
 * complexe, pas d'« Écrire au complexe »), refusée (le motif tel quel), sans réponse, annulée par
 * le complexe, fermeture, annulée par toi, complexe ou terrain parti, panne, réseau.
 * « Fermer » ramène à l'écran précédent. Ordinateur : la colonne centrée.
 * Paramètres (`parametresDEchec`) : `variante`, `details`, `message`, `complexe`, `telephone`,
 * `slug`, `terrainId`, `terrain`, `date`, `from`, `to`, et `motif` / `fermeture` (une réservation).
 * ⛔ Pas dans ce lot : les variantes de la collecte (serveur L3), « Voir mes réservations » (E-P10,
 * L6b), « Écrire au complexe » (la conversation de la réservation, serveur L3). Caché par
 * `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverEchec() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {Record<string, any>} */
  const params = /** @type {any} */ (route?.params) || {};
  const surOrdinateur = useIsDesktop();

  const contenu = contenuDEchec(t, String(params.variante || 'panne'), {
    complexe: params.complexe,
    erreur: { details: params.details || {}, message: params.message || '' },
    fermeture: params.fermeture,
    motif: params.motif,
    telephone: params.telephone,
    terrain: params.terrain,
  });

  const retour = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.popToTop?.();
  };
  const agir = (/** @type {string} */ action) => {
    switch (action) {
      case 'ailleurs':
      case 'reserverUnTerrain':
        navigateToSearchHub(navigation, 'reservations');
        break;
      case 'appeler':
        if (contenu.telephone) Linking.openURL(`tel:${contenu.telephone}`).catch(() => {});
        break;
      case 'autreJour':
        navigation.navigate(RouteNames.ReserverCreneau, {
          slug: params.slug,
          terrainId: params.terrainId,
        });
        break;
      case 'autresCreneaux':
      case 'relancer':
        navigation.navigate(RouteNames.ReserverCreneau, {
          ...(params.date ? { date: params.date } : {}),
          slug: params.slug,
          terrainId: params.terrainId,
        });
        break;
      case 'mesReservations':
        navigation.navigate(RouteNames.ReserverMesReservations);
        break;
      case 'profil':
        navigation.navigate(RouteNames.ProfileStack, { screen: RouteNames.ProfileEdit });
        break;
      default:
        retour();
    }
  };
  // Sans terrain connu, « Voir d'autres créneaux » et « un autre jour » mènent à la recherche.
  const sansTerrain = !(params.slug && params.terrainId);
  const versLaRecherche = (/** @type {string} */ action) => (
    sansTerrain && ['autreJour', 'autresCreneaux', 'relancer'].includes(action)
  );
  // RESA-L6B-2 : « Écrire au complexe » ouvre la conversation d'UNE réservation ; cet écran, venu
  // d'un refus au moment de réserver, n'en a pas (l'en-tête de E-P07 la propose).
  const actions = contenu.actions
    .filter((action) => action !== 'ecrire')
    .map((action) => (versLaRecherche(action) ? 'ailleurs' : action));

  const aUnCreneau = Boolean(params.date && params.from);
  const carte = aUnCreneau || params.complexe ? (
    <View
      style={{
        alignSelf: 'stretch',
        backgroundColor: withAlpha(Colors.primary800, 0.6),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 20,
        borderWidth: 1,
        gap: 4,
        padding: 16,
      }}
    >
      {aUnCreneau ? (
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('reserverTerrain.resultat.resume', '{{jour}} · {{creneau}} · {{terrain}}', {
            creneau: texteCreneau(params.from, params.to),
            jour: texteJourCourt(t, params.date),
            terrain: String(params.terrain || ''),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      {params.complexe ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>{String(params.complexe)}</Text>
      ) : null}
    </View>
  ) : null;

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24,
          paddingTop: 48,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <BlocDEchec contenu={{ ...contenu, actions }} onAction={agir}>
          {carte}
        </BlocDEchec>
        <Button
          onPress={retour}
          title={t('reserverTerrain.telephone.fermer', 'Fermer')}
          variant="Ghost"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

export default ReserverEchec;
