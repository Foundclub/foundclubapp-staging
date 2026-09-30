import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import usePlaces from '@/domains/places/usePlaces';
import {
  filtresDeLAlerte,
  libelleDeLAlerte,
  signatureDeLAlerte,
  StatutAlerte,
} from '@/domains/searchAlert/alerteEvenement';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import coordonneesDeLaVille from '@/components/organisms/filtersSheet/cityCoordinates';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { createSearchAlert, getSearchAlerts } from '@/services/searchAlert/searchAlertService';

import { useAppFeedback } from '@/context/AppFeedbackContext';

/**
 * ALERTES (audit V1, A20) — LE SEUL CHEMIN qui crée une alerte d'événements depuis
 * la recherche. La carte « Me prévenir » sous les résultats, l'étoile de la feuille
 * « Filtrer » et la proposition de première ouverture passent TOUTES par ici : une
 * règle (ville obligatoire, zone, nom unique), un appel serveur, un seul message.
 *
 * Le calcul de la zone et du nom est celui de l'écran plein `EventFilters`
 * (`handleCreateAlert`, `handleSaveAlert`), qui reste en place pour « Gérer mes
 * alertes » : on le reproduit à l'identique au lieu de l'inventer.
 * @returns {{
 *   creer: (filtres: Record<string, any> | undefined) => Promise<string>;
 *   enCours: boolean;
 *   estDejaCreee: (filtres: Record<string, any> | undefined) => boolean;
 *   sports: any[] | undefined;
 * }} Ce que la recherche en utilise.
 */
function useAlerteEvenement() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { showBanner } = /** @type {any} */ (useAppFeedback());
  const { getGeohashForPointAndRadius } = usePlaces();
  const { data: sports } = useGetActivities();
  const [enCours, setEnCours] = useState(false);
  const [signatureCreee, setSignatureCreee] = useState('');

  const creer = useCallback(async (/** @type {Record<string, any> | undefined} */ filtres) => {
    const alerte = filtresDeLAlerte(filtres);
    if (!alerte) return StatutAlerte.villeManquante;

    setEnCours(true);
    try {
      const coordonnees = coordonneesDeLaVille(alerte.city);
      const geohash = coordonnees
        ? getGeohashForPointAndRadius(coordonnees.lat, coordonnees.lon, alerte.radius)
        : undefined;

      // Le nom dépend des alertes déjà rangées ; les lire ne doit jamais
      // empêcher de créer (même repli que l'écran plein).
      let existantes = [];
      try {
        existantes = (await getSearchAlerts())?.data || [];
      } catch {
        existantes = [];
      }
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

      setSignatureCreee(signatureDeLAlerte(alerte));
      showBanner({
        actionLabel: t('profile.actions.manageAlerts', 'Gérer mes alertes'),
        body: t(
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
  }, [getGeohashForPointAndRadius, navigation, showBanner, sports, t]);

  const estDejaCreee = useCallback((/** @type {Record<string, any> | undefined} */ filtres) => {
    const signature = signatureDeLAlerte(filtresDeLAlerte(filtres));
    return Boolean(signature) && signature === signatureCreee;
  }, [signatureCreee]);

  return {
    creer,
    enCours,
    estDejaCreee,
    sports,
  };
}

export default useAlerteEvenement;
