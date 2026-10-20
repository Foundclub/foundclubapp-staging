import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { epinglesDesComplexes } from '@/domains/complexe/reserverTerrain';

import LazySearchMap from '@/components/organisms/searchMap/LazySearchMap';

import { usePagesDesComplexes } from '@/services/complexe/complexeJoueurQueries';

/**
 * E-P01, LA VUE CARTE — RESA-CARTE (20/10/2026), plan E-P01 point 6, planches EP01 (état 2) et OR2.
 * La carte de l'annuaire (`SearchMap`, sans son aperçu) : une épingle par complexe proposé, avec
 * son nombre de créneaux libres (« Tél. » si tout se réserve par téléphone). La position de
 * chaque complexe vient de sa page publique (la recherche ne la rend pas), lue seulement quand
 * cette vue est montée. Toucher une épingle la choisit (l'écran montre la carte du complexe) ;
 * toucher l'épingle déjà choisie ouvre la page du complexe (E-P02).
 * @param {object} props - Les propriétés.
 * @param {any[]} props.cartes - Les cartes de la recherche, filtres appliqués.
 * @param {string | null} props.choisie - Le complexe choisi (slug), ou null.
 * @param {number} props.hauteur - La hauteur de la carte.
 * @param {(slug: string | null) => void} props.onChoisir - Une épingle touchée.
 * @param {(carte: any) => void} props.onOuvrir - L'épingle choisie touchée encore (E-P02).
 * @returns {import('react').ReactElement} La carte.
 */
function CarteDesComplexes({
  cartes, choisie, hauteur, onChoisir, onOuvrir,
}) {
  const { t } = useTranslation();
  const sansPosition = cartes
    .filter((carte) => carte?.slug && !carte?.address)
    .map((carte) => String(carte.slug));
  const { enCours, pages } = usePagesDesComplexes(sansPosition);
  const epingles = epinglesDesComplexes(
    cartes,
    pages,
    t('reserverTerrain.recherche.epingleTelephone', 'Tél.'),
  );
  // La carte du site recharge sa page Leaflet dès que ses repères changent d'IDENTITÉ
  // (platform/maps/maps.web.js) : les mêmes épingles gardent le même tableau.
  const signature = epingles
    .map((epingle) => [epingle.id, epingle.lat, epingle.lng, epingle.markerLabel].join(':'))
    .join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => epingles, [signature]);

  return (
    <LazySearchMap
      height={hauteur}
      isLoadingResults={enCours}
      items={items}
      onOpenItem={(/** @type {any} */ item) => onOuvrir(item.raw)}
      onSelectItem={(/** @type {string} */ slug) => onChoisir(slug || null)}
      scope="complexes"
      selectedItemId={choisie || ''}
      showPreviewCard={false}
      totalCount={cartes.length}
    />
  );
}

export default CarteDesComplexes;
