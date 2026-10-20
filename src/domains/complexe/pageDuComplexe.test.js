import {
  corpsDeLaPage,
  corpsDesPartenaires,
  erreursDeLaPage,
  horairesEnLignes,
  lignesEnHoraires,
  nomDuJour,
} from '@/domains/complexe/pageDuComplexe';

// RESA-L5B-2 (20/10/2026) — E-G11 « Mon complexe » (planches EG11, RA5 ; plan :802-845) sur les
// serveurs RESA-L1A (`PUT /complexes/:id/manage`, un champ absent reste inchangé) et RESA-L4
// (`PUT /complexes/:id/partenaires`, la liste entière).

const ENREGISTRE = {
  address: { label: '12 allée des Sports, Montrivage', lat: 45.1, lng: 4.8 },
  description: 'Deux terrains.',
  email: 'accueil@lefive.example',
  logo: { id: 7, url: '/l.png' },
  name: 'Le Five de Montrivage',
  openingHours: [{ day: 1, ranges: [{ from: '17:00', to: '23:00' }] }],
  phoneNumber: '+33639981234',
  photos: [{ id: 3, url: '/p.png' }],
  siret: null,
  websiteUrl: null,
};

const saisieDe = (/** @type {Record<string, any>} */ autres = {}) => ({
  adresse: ENREGISTRE.address,
  description: ENREGISTRE.description,
  email: ENREGISTRE.email,
  horaires: horairesEnLignes(ENREGISTRE.openingHours),
  logo: ENREGISTRE.logo,
  nom: ENREGISTRE.name,
  photos: ENREGISTRE.photos,
  siret: '',
  site: '',
  telephone: ENREGISTRE.phoneNumber,
  ...autres,
});

describe('E-G11 — les règles pures de la page du complexe', () => {
  it('les jours, du lundi au dimanche', () => {
    expect([1, 2, 7].map(nomDuJour)).toEqual(['Lundi', 'Mardi', 'Dimanche']);
  });

  it('les horaires : 7 lignes, et retour au serveur les jours ouverts seulement', () => {
    const lignes = horairesEnLignes(ENREGISTRE.openingHours);
    expect(lignes).toHaveLength(7);
    expect(lignes[0]).toEqual({
      autres: [], day: 1, from: '17:00', ouvert: true, to: '23:00',
    });
    expect(lignes[1].ouvert).toBe(false);
    expect(lignesEnHoraires(lignes)).toEqual(ENREGISTRE.openingHours);
  });

  it('rien changé : un corps vide (« Enregistrer » n’écrit rien)', () => {
    expect(corpsDeLaPage(saisieDe(), ENREGISTRE)).toEqual({});
  });

  it('seuls les champs changés partent ; l’adresse avec sa position', () => {
    const adresse = {
      city: 'Valbrune', label: '3 rue du Stade, Valbrune', lat: 45.2, lng: 4.9,
    };
    expect(corpsDeLaPage(saisieDe({
      adresse, description: '  Trois terrains. ', logo: null, site: 'https://lefive.example',
    }), ENREGISTRE)).toEqual({
      address: { label: '3 rue du Stade, Valbrune', lat: 45.2, lng: 4.9 },
      addressLabel: '3 rue du Stade, Valbrune',
      city: 'Valbrune',
      coordinates: { lat: 45.2, lng: 4.9 },
      description: 'Trois terrains.',
      logo: null,
      websiteUrl: 'https://lefive.example',
    });
  });

  it('nom, adresse (avec position), téléphone obligatoires ; e-mail, site, SIRET vérifiés', () => {
    expect(erreursDeLaPage(saisieDe())).toEqual({});
    expect(erreursDeLaPage(saisieDe({
      adresse: { label: 'quelque part' },
      email: 'x',
      nom: ' ',
      siret: '123',
      site: 'lefive.fr',
      telephone: '',
    }))).toEqual({
      adresse: 'adresseObligatoire',
      email: 'emailInvalide',
      nom: 'nomObligatoire',
      siret: 'siretInvalide',
      site: 'siteInvalide',
      telephone: 'telephoneObligatoire',
    });
  });

  it('les partenaires : la liste entière, dans l’ordre ; le logo par son identifiant', () => {
    expect(corpsDesPartenaires([
      {
        documentId: 'p-1', link: '', logo: { id: 9, url: '/s.png' }, title: ' Sport  Montrivage ',
      },
      { link: 'https://roux.example', logo: null, title: 'Boulangerie Roux' },
    ])).toEqual([
      { documentId: 'p-1', logo: 9, title: 'Sport Montrivage' },
      { link: 'https://roux.example', title: 'Boulangerie Roux' },
    ]);
  });
});
