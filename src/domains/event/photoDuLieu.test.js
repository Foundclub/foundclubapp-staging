/* eslint-disable max-len -- titres de témoins en phrases */
import { photoDuLieu } from './photoDuLieu';

// IMPL-1B-PHOTO (19/11/2026) — LA PHOTO DU LIEU, choisie une seule fois pour le bandeau de la fiche,
// la carte du tournoi (Rechercher, accueil) et la carte de « Gérer le tournoi ». Les jeux recopient la
// forme que rend le serveur (`admin/src/api/event/utils/venue-media.js`, branche fix/IMPL-5B-PHOTO-admin).

const media = (/** @type {string} */ nom, /** @type {any} */ extra = {}) => ({
  alternativeText: null,
  formats: {
    medium: { height: 563, url: `https://cdn.test/medium_${nom}.jpg`, width: 750 },
    small: { height: 375, url: `https://cdn.test/small_${nom}.jpg`, width: 500 },
    thumbnail: { height: 117, url: `https://cdn.test/thumbnail_${nom}.jpg`, width: 156 },
  },
  height: 1200,
  url: `https://cdn.test/${nom}.jpg`,
  width: 1600,
  ...extra,
});

const complexe = (/** @type {any[]} */ photos) => ({
  documentId: 'cx1', logo: media('logo'), name: 'AR Soccer', photos, slug: 'ar-soccer',
});

describe('photoDuLieu', () => {
  it('prend la photo du TERRAIN en premier, à la taille demandée', () => {
    const event = { facility: { complexe: complexe([media('complexe')]), photos: [media('terrain')] } };
    expect(photoDuLieu(event, 'small')).toEqual({
      alt: 'AR Soccer', uri: 'https://cdn.test/small_terrain.jpg',
    });
  });

  it('prend la photo du COMPLEXE quand le terrain n’en a pas (photos: [])', () => {
    const event = { facility: { complexe: complexe([media('complexe')]), photos: [] } };
    expect(photoDuLieu(event, 'medium')).toEqual({
      alt: 'AR Soccer', uri: 'https://cdn.test/medium_complexe.jpg',
    });
  });

  it('garde l’adresse d’origine quand la taille manque ou que `formats` est null', () => {
    const sansFormats = { facility: { complexe: complexe([media('a', { formats: null })]), photos: [] } };
    expect(photoDuLieu(sansFormats, 'medium')?.uri).toBe('https://cdn.test/a.jpg');
    const sansMedium = {
      facility: {
        complexe: complexe([media('b', { formats: { thumbnail: { url: 'https://cdn.test/t_b.jpg' } } })]),
        photos: [],
      },
    };
    expect(photoDuLieu(sansMedium, 'medium')?.uri).toBe('https://cdn.test/b.jpg');
  });

  it('lit le texte alternatif de la photo avant le nom du complexe', () => {
    const event = {
      facility: { complexe: complexe([]), photos: [media('t', { alternativeText: 'Le terrain couvert' })] },
    };
    expect(photoDuLieu(event, 'small')?.alt).toBe('Le terrain couvert');
  });

  it('rend null sans photo : complexe suspendu (clés absentes), aucun lieu, aucune photo', () => {
    expect(photoDuLieu({ facility: { documentId: 'f1', name: 'Terrain A' } }, 'small')).toBeNull();
    expect(photoDuLieu({ facility: null }, 'small')).toBeNull();
    expect(photoDuLieu({}, 'small')).toBeNull();
    expect(photoDuLieu(null, 'small')).toBeNull();
    expect(photoDuLieu({ facility: { complexe: complexe([]), photos: [] } }, 'small')).toBeNull();
  });

  it('ignore un média sans adresse', () => {
    const event = { facility: { complexe: complexe([media('c')]), photos: [{ url: '' }] } };
    expect(photoDuLieu(event, 'small')?.uri).toBe('https://cdn.test/small_c.jpg');
  });
});
