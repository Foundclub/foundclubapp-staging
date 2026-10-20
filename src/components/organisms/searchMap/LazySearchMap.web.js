import SearchMap from '@/components/organisms/searchMap/SearchMap';

/**
 * RESA-CARTE (20/10/2026) — sur le site, la carte de recherche s'importe normalement : son
 * serveur de développement sert ce fichier au navigateur, où `require` n'existe pas
 * (LazySearchMap.js charge, lui, la carte du téléphone à l'ouverture).
 */
export default SearchMap;
