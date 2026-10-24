import { getGeohashForPointAndRadius } from './placesUseCases';

// BH03 · P11-14 — sans ville choisie, des coordonnees NaN donnaient un geohash
// « 00000 » qui filtrait la liste des clubs.
describe('BH03 · P11-14 — coordonnees invalides', () => {
  test.each([[NaN, NaN], [undefined, 2.35], [48.85, NaN]])('(%p, %p) ne donne aucun geohash', (lat, lon) => {
    // @ts-expect-error entree invalide voulue
    expect(getGeohashForPointAndRadius(lat, lon, 20)).toBe('');
  });

  it('des coordonnees valides donnent toujours un geohash', () => {
    expect(getGeohashForPointAndRadius(48.8566, 2.3522, 20)).toMatch(/^[0-9a-z]+$/);
  });
});
