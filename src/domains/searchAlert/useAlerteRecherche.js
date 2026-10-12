import { useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
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
import { lireLeRefus, phraseDuRefus } from '@/domains/searchAlert/refusAlerte';
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
 *
 * PAR-L10 (12/10) — un refus dit POURQUOI (`refusAlerte.js`) : la raison part dans
 * la bannière et reste lisible dans `raisonDuRefus` pour la feuille ouverte, qui
 * couvre la bannière. Un appui pendant un envoi ne crée rien de plus : il rend ''.
 * @param {string} sorte `SorteAlerte.evenement` ou `SorteAlerte.annonce`.
 * @returns {{
 *   creer: (filtres: Record<string, any> | undefined, publicChoisi?: string) => Promise<string>;
 *   enCours: boolean;
 *   estDejaCreee: (filtres: Record<string, any> | undefined, publicChoisi?: string) => boolean;
 *   raisonDuRefus: string;
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
  const [raisonDuRefus, setRaisonDuRefus] = useState('');
  // Un état ne protège pas de deux appuis dans la même image : la référence, si.
  const envoiEnCoursRef = useRef(false);
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
    if (envoiEnCoursRef.current) return '';

    envoiEnCoursRef.current = true;
    setEnCours(true);
    setRaisonDuRefus('');
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
      // Le serveur dit POURQUOI il refuse (le droit, la limite de 10 alertes…) :
      // on le dit plutôt qu'un message générique.
      const phrase = phraseDuRefus(lireLeRefus(erreur), t);
      setRaisonDuRefus(phrase);
      showBanner({
        body: phrase,
        title: t('searchAlerts.refus.titre', 'L\'alerte n\'a pas été créée.'),
        tone: 'error',
      });
      return StatutAlerte.erreur;
    } finally {
      envoiEnCoursRef.current = false;
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
    raisonDuRefus,
    sports,
  };
}

export default useAlerteRecherche;
