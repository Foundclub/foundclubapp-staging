import { getDistanceKm } from '@/domains/search/friendlyMatchFlow';

/**
 * FIN-MESSAGERIE p67 (02/11, revue) — les villes proposées dans le champ Ville d'une alerte, avant
 * toute frappe (jusque-là : une liste vide).
 * ponytail: aucune route ne donne les communes voisines ; ce sont donc les grandes villes les plus
 * proches, et les plus peuplées sans ville au profil. Sortie : une route « communes autour d'un
 * point » côté serveur.
 * Rangées par population.
 */
const GRANDES_VILLES = [
  ['Paris', '75001', 48.8566, 2.3522],
  ['Marseille', '13001', 43.2965, 5.3698],
  ['Lyon', '69001', 45.764, 4.8357],
  ['Toulouse', '31000', 43.6047, 1.4442],
  ['Nice', '06000', 43.7102, 7.262],
  ['Nantes', '44000', 47.2184, -1.5536],
  ['Montpellier', '34000', 43.6108, 3.8767],
  ['Strasbourg', '67000', 48.5734, 7.7521],
  ['Bordeaux', '33000', 44.8378, -0.5792],
  ['Lille', '59000', 50.6292, 3.0573],
  ['Rennes', '35000', 48.1173, -1.6778],
  ['Toulon', '83000', 43.1242, 5.928],
  ['Reims', '51100', 49.2583, 4.0317],
  ['Saint-Étienne', '42000', 45.4397, 4.3872],
  ['Le Havre', '76600', 49.4944, 0.1079],
  ['Dijon', '21000', 47.322, 5.0415],
  ['Grenoble', '38000', 45.1885, 5.7245],
  ['Angers', '49000', 47.4784, -0.5632],
  ['Nîmes', '30000', 43.8367, 4.3601],
  ['Aix-en-Provence', '13100', 43.5297, 5.4474],
  ['Clermont-Ferrand', '63000', 45.7772, 3.087],
  ['Brest', '29200', 48.3904, -4.4861],
  ['Tours', '37000', 47.3941, 0.6848],
  ['Amiens', '80000', 49.8941, 2.2957],
  ['Limoges', '87000', 45.8336, 1.2611],
  ['Metz', '57000', 49.1193, 6.1757],
  ['Perpignan', '66000', 42.6887, 2.8948],
  ['Besançon', '25000', 47.2378, 6.0241],
  ['Orléans', '45000', 47.9029, 1.9093],
  ['Rouen', '76000', 49.4432, 1.0999],
  ['Caen', '14000', 49.1829, -0.3707],
  ['Avignon', '84000', 43.9493, 4.8055],
  ['Poitiers', '86000', 46.5802, 0.3404],
  ['Pau', '64000', 43.2951, -0.3708],
  ['Ajaccio', '20000', 41.9192, 8.7386],
].map(([city, postcode, lat, lng]) => ({
  city,
  label: `${city} (${postcode})`,
  lat,
  lng,
  postcode,
  value: `${lng}|${lat}`,
}));

const NOMBRE_DE_VILLES = 5;

/**
 * Les villes à proposer avant la frappe.
 * @param {{ label?: string, lat?: number, lng?: number, value?: string } | null | undefined} ville -
 *   La ville du profil.
 * @returns {Array<{ label: string, value: string }>} Sa ville d'abord, puis les plus proches ; sans
 *   ville connue, les plus grandes.
 */
const villesAProposer = (ville) => {
  if (!ville?.value || !Number.isFinite(ville.lat) || !Number.isFinite(ville.lng)) {
    return GRANDES_VILLES.slice(0, NOMBRE_DE_VILLES);
  }
  const lesPlusProches = [...GRANDES_VILLES]
    .sort((a, b) => Number(getDistanceKm(ville, a)) - Number(getDistanceKm(ville, b)))
    .slice(0, NOMBRE_DE_VILLES - 1);
  return [(ville), ...lesPlusProches];
};

export default villesAProposer;
