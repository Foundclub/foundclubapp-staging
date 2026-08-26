/**
 * Temoins du libelle de lieu — defaut T8 de la recette du 26/08.
 *
 * Constat d'Adel (capture 01h16, ecran RECRUTEMENT) : les cartes d'annonce
 * affichent « Gymnase - [object Object] » a la place du lieu.
 *
 * Le texte fautif est ECRIT EN BASE, il n'est pas fabrique a l'affichage :
 * 6 annonces (`recruitment_ads` id 2 a 6 au moins) portent la charge reproduite
 * ci-dessous. Tout y est pour afficher juste — `facilityName` et
 * `address.description` sont sains, seul `label` est corrompu.
 *
 * Ces temoins couvrent donc les DEUX bouts de la chaine :
 * - le fabricant, qui promettait un libelle et rendait un objet ;
 * - l'affichage, qui doit reparer les lignes deja ecrites en base.
 */
import { getFacilityAddressLabel, resolveLocationDisplayLabel } from './facilityAddressLabel';

// La charge EXACTE relevee le 26/08 dans `recruitment_ads.address`.
const AD_ADDRESS_CORROMPUE = {
  address: {
    description: '21 Rue fortia 13001 Marseille',
    geometry: { location: { lat: 43.2937, lng: 5.3711 } },
  },
  facilityDocumentId: 'r2dtoskvhuyqvglxuemz83qg',
  facilityName: 'Gymnase',
  label: 'Gymnase - [object Object]',
  source: 'club_facility',
  value: '',
};

// Ce que porte `facility.address` cote serveur : le texte vit dans
// `address.description`, un cran plus bas que ce que l'ancien fabricant lisait.
const FACILITY_ADDRESS_REELLE = {
  address: {
    description: '21 Rue fortia 13001 Marseille',
    geometry: { location: { lat: 43.2937, lng: 5.3711 } },
  },
  value: '',
};

// Toutes les formes vues ou plausibles, y compris les tordues.
const TOUTES_LES_FORMES = [
  null,
  undefined,
  '',
  '   ',
  '[object Object]',
  'Stade Velodrome',
  {},
  [],
  { geometry: { location: { lat: 43.29, lng: 5.37 } } },
  { label: { description: 'Gymnase Ruffi' } },
  { address: { address: { label: 'Complexe Ruffi' } } },
  FACILITY_ADDRESS_REELLE,
  AD_ADDRESS_CORROMPUE,
];

describe('getFacilityAddressLabel — le fabricant ne peut rendre que du texte', () => {
  test('descend jusqu au texte quand l adresse est structuree (forme reelle du 26/08)', () => {
    expect(getFacilityAddressLabel(FACILITY_ADDRESS_REELLE)).toBe('21 Rue fortia 13001 Marseille');
  });

  test('ne rend JAMAIS un objet, quelle que soit la forme recue', () => {
    TOUTES_LES_FORMES.forEach((forme) => {
      expect(typeof getFacilityAddressLabel(forme)).toBe('string');
    });
  });

  test('le libelle assemble ne contient jamais [object Object]', () => {
    TOUTES_LES_FORMES.forEach((forme) => {
      const assemble = ['Gymnase', getFacilityAddressLabel(forme)].filter(Boolean).join(' - ');
      expect(assemble).not.toContain('[object Object]');
    });
  });

  test('garde une adresse deja textuelle et respecte le repli fourni', () => {
    expect(getFacilityAddressLabel('21 Rue fortia 13001 Marseille'))
      .toBe('21 Rue fortia 13001 Marseille');
    expect(getFacilityAddressLabel(null)).toBe('Adresse non renseignée');
    expect(getFacilityAddressLabel({}, 'Adresse manquante')).toBe('Adresse manquante');
  });

  test('ecarte un libelle deja corrompu et va chercher le texte sain', () => {
    const dejaCorrompu = {
      description: '21 Rue fortia 13001 Marseille',
      label: 'Gymnase - [object Object]',
    };
    expect(getFacilityAddressLabel(dejaCorrompu)).toBe('21 Rue fortia 13001 Marseille');
  });

  test('descend dans un label lui-meme objet', () => {
    expect(getFacilityAddressLabel({ label: { description: 'Gymnase Ruffi' } }))
      .toBe('Gymnase Ruffi');
  });
});

describe('resolveLocationDisplayLabel — l affichage repare le parc deja en base', () => {
  test('recalcule le lieu des annonces corrompues (forme reelle du 26/08)', () => {
    const affiche = resolveLocationDisplayLabel(AD_ADDRESS_CORROMPUE, 'Lieu non précisé');
    expect(affiche).toBe('Gymnase · 13001 Marseille');
    expect(affiche).not.toContain('[object Object]');
  });

  test('ne touche pas un libelle sain', () => {
    const saine = { ...AD_ADDRESS_CORROMPUE, label: 'Gymnase - 21 Rue fortia 13001 Marseille' };
    expect(resolveLocationDisplayLabel(saine, 'Lieu non précisé'))
      .toBe('Gymnase - 21 Rue fortia 13001 Marseille');
  });

  test('accepte une adresse simple en chaine, telle quelle', () => {
    expect(resolveLocationDisplayLabel('Stade Velodrome', 'Lieu non précisé'))
      .toBe('Stade Velodrome');
  });

  test('retombe sur le repli quand tout manque', () => {
    expect(resolveLocationDisplayLabel(null, 'Lieu non précisé')).toBe('Lieu non précisé');
    expect(resolveLocationDisplayLabel({}, 'Lieu non précisé')).toBe('Lieu non précisé');
    expect(resolveLocationDisplayLabel({ label: {} }, 'Lieu non précisé')).toBe('Lieu non précisé');
  });

  test('descend dans un label objet imbrique', () => {
    expect(resolveLocationDisplayLabel({ label: { description: 'Gymnase Ruffi' } }, 'Lieu'))
      .toBe('Gymnase Ruffi');
  });

  test('jamais [object Object] a l ecran, quelle que soit la donnee recue', () => {
    TOUTES_LES_FORMES.forEach((forme) => {
      const affiche = resolveLocationDisplayLabel(forme, 'Lieu non précisé');
      expect(typeof affiche).toBe('string');
      expect(affiche).not.toContain('[object Object]');
    });
  });
});
