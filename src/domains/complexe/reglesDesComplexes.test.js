import { createHash } from 'crypto';

import {
  payloadDeCreation,
  VERSION_DES_REGLES as VERSION_DU_TUNNEL,
} from '@/domains/complexe/complexeGerant';
import {
  estUnTitreDePartie,
  PARAGRAPHES_DES_REGLES,
  TEXTE_DES_REGLES,
  VERSION_DES_REGLES,
} from '@/domains/complexe/reglesDesComplexes';

import { LEGAL_COMPLEXE_RULES_PATH, LEGAL_COMPLEXE_RULES_URL } from '@/config/legalUrls';

// REGLES-COMPLEXES (10/11/2026, « 225- A », chef « 2 B ») — le texte PUBLIÉ des règles des
// complexes. Le serveur garde l'empreinte de CE texte sous la version 2026-11-10 (admin
// `COMPLEXE_RULES_VERSIONS`) ; la même valeur est écrite à la main des deux côtés : si une seule
// des deux bouge, l'un des deux témoins rougit.
const EMPREINTE_DU_SERVEUR = '6a30436a519684d84a4d9e373c8b94f7c924f13bb92ea5e907af90f4ebaa205b';

describe('REGLES-COMPLEXES — le texte publié', () => {
  it('son empreinte est celle que garde le serveur pour la version 2026-11-10', () => {
    expect(VERSION_DES_REGLES).toBe('2026-11-10');
    expect(createHash('sha256').update(TEXTE_DES_REGLES, 'utf8').digest('hex'))
      .toBe(EMPREINTE_DU_SERVEUR);
    expect(TEXTE_DES_REGLES).toBe(TEXTE_DES_REGLES.trim());
    expect(TEXTE_DES_REGLES).not.toMatch(/\r/);
  });

  it('le titre, la version affichée, puis les 8 parties dans l’ordre', () => {
    expect(PARAGRAPHES_DES_REGLES).toHaveLength(41);
    expect(PARAGRAPHES_DES_REGLES[0]).toBe('Règles d\'utilisation des complexes');
    expect(PARAGRAPHES_DES_REGLES[1]).toBe('Version du 10 novembre 2026');
    expect(PARAGRAPHES_DES_REGLES.filter(estUnTitreDePartie)).toEqual([
      '1. Créer un complexe',
      '2. Vos engagements',
      '3. Les données des joueurs',
      '4. Les mineurs',
      '5. Réservations non honorées et bannissement',
      '6. Ce que Found Club peut faire',
      '7. Le prix',
      '8. Évolution de ces règles',
    ]);
    expect(estUnTitreDePartie('1.1 Vous créez votre complexe')).toBe(false);
    expect(PARAGRAPHES_DES_REGLES[40]).toBe('Une question : contact@foundclubpro.com.');
  });

  it('rien de non validé : ni crochet, ni « à valider », ni gras ; « Found Club » (129- B)', () => {
    expect(TEXTE_DES_REGLES).not.toMatch(/[[\]*]/);
    expect(TEXTE_DES_REGLES).not.toMatch(/à valider/i);
    expect(TEXTE_DES_REGLES).not.toMatch(/FoundClub/);
    expect(TEXTE_DES_REGLES.match(/Found Club/g)).toHaveLength(17);
    // Le prix tranché par Adel (14/10, « 1- a ») : « gratuit », sans « pour l'instant ».
    expect(TEXTE_DES_REGLES).toContain(
      '7.1 Found Club est gratuit pour les complexes, y compris l\'affichage de votre logo et '
      + 'de vos partenaires.',
    );
    expect(TEXTE_DES_REGLES).not.toMatch(/pour l'instant/);
  });

  it('la case du tunnel fait accepter CETTE version', () => {
    expect(VERSION_DU_TUNNEL).toBe(VERSION_DES_REGLES);
    const fiche = {
      accepte: true,
      adresse: { label: 'x', lat: 1, lng: 2 },
      ageMinimum: 18,
      annulation: 24,
      nom: 'Le Five',
      sports: ['a'],
      telephone: '+33600000000',
    };
    expect(payloadDeCreation(fiche).rulesVersion).toBe('2026-11-10');
  });

  it('la page vit sur le site, à /regles-complexes', () => {
    expect(LEGAL_COMPLEXE_RULES_PATH).toBe('/regles-complexes');
    expect(LEGAL_COMPLEXE_RULES_URL).toBe('https://foundclub.app/regles-complexes');
  });
});
