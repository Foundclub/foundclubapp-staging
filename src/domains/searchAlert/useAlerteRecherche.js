import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import usePlaces from '@/domains/places/usePlaces';
import {
  filtresDeLAlerteAnnonce,
  libelleDeLAlerteAnnonce,
} from '@/domains/searchAlert/alerteAnnonce';
import {
  filtresDeLAlerte,
  libelleDeLAlerte,
  signatureDeLAlerte,
  SorteAlerte,
  StatutAlerte,
} from '@/domains/searchAlert/alerteEvenement';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import coordonneesDeLaVille from '@/components/organisms/filtersSheet/cityCoordinates';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { createSearchAlert, getSearchAlerts } from '@/services/searchAlert/searchAlertService';

import { useAppFeedback } from '@/context/AppFeedbackContext';

/**
 * ALERTES (audit V1, A20) puis ALERTES-ANNONCES (30/09) — LE SEUL CHEMIN qui crée
 * une alerte depuis la recherche, pour les deux sortes :
 *   · `evenement` : Rechercher › Événement (carte « Me prévenir », étoile de la
 *     feuille « Filtrer », proposition de première ouverture) ;
 *   · `annonce` : Rechercher › Recrutement (carte et étoile), pour les joueurs ET
 *     les entraîneurs — décision d'Adel du 30/09.
 * Une règle (ville obligatoire, nom unique), un appel serveur, un seul message.
 *
 * Pour les événements, le calcul de la zone et du nom est celui de l'écran plein
 * `EventFilters` (`handleCreateAlert`, `handleSaveAlert`), qui reste en place pour
 * « Gérer mes alertes ». Une alerte d'annonces n'a pas de zone : la recherche
 * d'annonces ne connaît qu'une ville en texte (`alerteAnnonce.js`).
 * @param {string} sorte `SorteAlerte.evenement` ou `SorteAlerte.annonce`.
 * @returns {{
 *   creer: (filtres: Record<string, any> | undefined, publicChoisi?: string) => Promise<string>;
 *   enCours: boolean;
 *   estDejaCreee: (filtres: Record<string, any> | undefined, publicChoisi?: string) => boolean;
 *   sports: any[] | undefined;
 * }} Ce que la recherche en utilise. `publicChoisi` ne sert qu'aux annonces.
 */
function useAlerteRecherche(sorte) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { showBanner } = /** @type {any} */ (useAppFeedback());
  const { getGeohashForPointAndRadius } = usePlaces();
  const { data: sports } = useGetActivities();
  const [enCours, setEnCours] = useState(false);
  const [signatureCreee, setSignatureCreee] = useState('');
  const pourAnnonces = sorte === SorteAlerte.annonce;

  const versAlerte = useCallback((
    /** @type {Record<string, any> | undefined} */ filtres,
    /** @type {string | undefined} */ publicChoisi,
  ) => (
    pourAnnonces
      ? filtresDeLAlerteAnnonce(filtres, publicChoisi || 'all')
      : filtresDeLAlerte(filtres)
  ), [pourAnnonces]);

  const creer = useCallback(async (
    /** @type {Record<string, any> | undefined} */ filtres,
    /** @type {string | undefined} */ publicChoisi,
  ) => {
    const alerte = /** @type {any} */ (versAlerte(filtres, publicChoisi));
    if (!alerte) return StatutAlerte.villeManquante;

    setEnCours(true);
    try {
      // Le nom dépend des alertes déjà rangées ; les lire ne doit jamais
      // empêcher de créer (même repli que l'écran plein).
      let existantes = [];
      try {
        existantes = (await getSearchAlerts())?.data || [];
      } catch {
        existantes = [];
      }

      if (pourAnnonces) {
        await createSearchAlert({
          filters: alerte,
          isActive: true,
          label: libelleDeLAlerteAnnonce(
            alerte,
            existantes,
            t('searchAlerts.ads.labelPrefix', 'Annonces'),
          ),
          type: 'recruitment',
        });
      } else {
        const coordonnees = coordonneesDeLaVille(alerte.city);
        const geohash = coordonnees
          ? getGeohashForPointAndRadius(coordonnees.lat, coordonnees.lon, alerte.radius)
          : undefined;
        const libelleSansSport = t('eventFilters.event', 'Événement · {{cityName}}', {
          cityName: alerte.city.label || t('eventFilters.search', 'Recherche'),
          ...SANS_ECHAPPEMENT,
        });
        await createSearchAlert({
          filters: { ...alerte, ...(geohash ? { geohash } : {}) },
          isActive: true,
          label: libelleDeLAlerte(alerte, sports, existantes, libelleSansSport),
          type: 'event',
        });
      }

      setSignatureCreee(signatureDeLAlerte(alerte));
      showBanner({
        actionLabel: t('profile.actions.manageAlerts', 'Gérer mes alertes'),
        body: pourAnnonces
          ? t(
            'searchAlerts.created.bodyAds',
            'Tu seras prévenu·e dès qu\'une nouvelle annonce comme celles-ci est publiée.',
          )
          : t(
            'searchAlerts.created.body',
            'Tu seras prévenu·e dès qu\'un nouvel événement comme ceux-ci est publié.',
          ),
        onAction: () => navigation.navigate(/** @type {never} */ (RouteNames.SearchAlerts)),
        title: t('searchAlerts.created.title', 'Alerte créée'),
        tone: 'success',
      });
      return StatutAlerte.creee;
    } catch (erreur) {
      // Le serveur dit POURQUOI il refuse (la limite de 10 alertes, par exemple) :
      // on le répète tel quel plutôt qu'un message générique.
      const motif = /** @type {any} */ (erreur)?.response?.data?.error?.message;
      showBanner({
        body: motif || t('eventFilters.errorWhileSaving', 'Erreur lors de la sauvegarde'),
        title: t('common.error', 'Erreur'),
        tone: 'error',
      });
      return StatutAlerte.erreur;
    } finally {
      setEnCours(false);
    }
  }, [getGeohashForPointAndRadius, navigation, pourAnnonces, showBanner, sports, t, versAlerte]);

  const estDejaCreee = useCallback((
    /** @type {Record<string, any> | undefined} */ filtres,
    /** @type {string | undefined} */ publicChoisi,
  ) => {
    const signature = signatureDeLAlerte(/** @type {any} */ (versAlerte(filtres, publicChoisi)));
    return Boolean(signature) && signature === signatureCreee;
  }, [signatureCreee, versAlerte]);

  return {
    creer,
    enCours,
    estDejaCreee,
    sports,
  };
}

export default useAlerteRecherche;
