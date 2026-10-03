import i18next from 'i18next';

import { managerRequestPayload } from './collectiviteAccueil';
import { nomOfficielDeCommune, readCollectiviteCreateForm } from './collectiviteDisplay';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 1 — « Chercher la commune » (planches 7, 8 et 14).
// Une commune trouvée dans le référentiel de l'État s'écrit sous sa FORME OFFICIELLE (D59), celle
// que lit le bandeau « Offert par la Ville de … », et sa demande de gestionnaire porte son code
// INSEE. ROUGE avant le lot : `nomOfficielDeCommune` n'existait pas, et le code INSEE ne
// partait pas.

const t = /** @type {any} */ (i18next.t.bind(i18next));

describe('COLL-CONSOLE-BIS — le nom officiel d une commune du référentiel', () => {
  it.each([
    ['Valfleuri', 'Ville de Valfleuri'],
    ['Aix-en-Provence', 'Ville d’Aix-en-Provence'],
    ['Évry-Courcouronnes', 'Ville d’Évry-Courcouronnes'],
    ['Le Havre', 'Ville du Havre'],
    ['Les Mureaux', 'Ville des Mureaux'],
    ['La Rochelle', 'Ville de La Rochelle'],
    ['L’Isle-Adam', 'Ville de L’Isle-Adam'],
  ])('%s → %s, accepté par le contrôle de forme officielle', (commune, attendu) => {
    expect(nomOfficielDeCommune(t, commune)).toBe(attendu);
    expect(readCollectiviteCreateForm({
      codeInsee: '13999', name: attendu, type: 'commune',
    }).errors).toEqual([]);
  });

  it('sans nom, rien', () => {
    expect(nomOfficielDeCommune(t, '  ')).toBe('');
    expect(nomOfficielDeCommune(t, null)).toBe('');
  });
});

describe('COLL-CONSOLE-BIS — la demande d une commune absente porte son code INSEE', () => {
  const contact = { jobTitle: 'Service des sports', professionalEmail: 'Sports@Valfleuri.fr' };

  it('une commune trouvée dans le référentiel : son code INSEE part avec la demande', () => {
    expect(managerRequestPayload(
      {
        codeInsee: '13999', documentId: null, name: 'Ville de Valfleuri', type: 'commune',
      },
      contact,
    )).toEqual({
      codeInsee: '13999',
      collectiviteName: 'Ville de Valfleuri',
      collectiviteType: 'commune',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@valfleuri.fr',
    });
  });

  it('une saisie libre (sans code) ne change pas ; une collectivité existante non plus', () => {
    expect(managerRequestPayload({ documentId: null, name: 'Valfleuri', type: 'commune' }, contact))
      .not.toHaveProperty('codeInsee');
    expect(managerRequestPayload(
      {
        codeInsee: '13998',
        documentId: 'ville-montrivage',
        name: 'Ville de Montrivage',
        type: 'commune',
      },
      contact,
    )).toEqual({
      collectiviteDocumentId: 'ville-montrivage',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@valfleuri.fr',
    });
  });
});
