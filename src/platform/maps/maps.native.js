// CONVOC (26/09) — `openExternalMap` vit desormais dans `./externalMap`, en UNE
// version pour l'app et le site. Celle qui etait ici n'etait appelee nulle part.
import { openExternalMap } from './externalMap';

export { openExternalMap };

export const renderMap = () => null;

export default {
  openExternalMap,
  renderMap,
};
