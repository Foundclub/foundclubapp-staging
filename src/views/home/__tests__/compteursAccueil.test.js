import fs from 'fs';
import path from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  normalizeHomeCounters,
  selectBannerLines,
  selectHomeAlerts,
} from '@/domains/home/homeCounters';

import { useHomeSummary } from '@/services/home/homeSummaryQueries';
import { getHomeSummary } from '@/services/home/homeSummaryService';

// D78 — LA COUTURE : l'accueil appelle enfin ses compteurs.
//
// 🪤 CE QUE CE FICHIER AJOUTE, ET CE QU'IL N'AJOUTE PAS.
// D72 a deja fige, exhaustivement, le comportement A ZERO : `homeCounters.test.js`
// (les selecteurs purs), `HomeHeadBanner.test.js` (un bandeau vide DISPARAIT) et
// `HomeActionCard.pastille.test.js` (zero en attente = aucune pastille). Ces
// temoins doivent rester verts — on ne les rejoue pas ici.
// Ce qu'aucun d'eux ne pouvait ecrire, faute d'endpoint, c'est le SYMETRIQUE :
// une reponse serveur NON NULLE allume-t-elle vraiment le bandeau et les
// pastilles, et un appel qui ECHOUE laisse-t-il l'accueil utilisable ?
//
// 🔬 POURQUOI UNE SONDE PLUTOT QUE `HomeHub` MONTE EN ENTIER : le meme motif que
// ses trois voisins de ce dossier (`accueilParRole.test.js:10`) — HomeHub fait
// 2 665 lignes et depend d'une vingtaine de contextes React. La sonde rejoue la
// couture A L'IDENTIQUE (memes trois fonctions, meme ordre), et un temoin sur la
// SOURCE verifie que HomeHub la cable bien ainsi, et une seule fois.

jest.mock('@/services/home/homeSummaryService', () => ({
  getHomeSummary: jest.fn(),
}));

const SOURCE_HUB = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');
const DOSSIER_HOME = path.resolve(__dirname, '..', '..', '..', 'services', 'home');
const SOURCE_QUERIES = fs.readFileSync(path.join(DOSSIER_HOME, 'homeSummaryQueries.js'), 'utf8');
const SOURCE_SERVICE = fs.readFileSync(path.join(DOSSIER_HOME, 'homeSummaryService.js'), 'utf8');

/**
 * Le nombre d'occurrences d'un motif dans un texte.
 * @param {string} texte
 * @param {string} motif
 * @returns {number}
 */
const compter = (texte, motif) => texte.split(motif).length - 1;

// Un dirigeant qui a du retard partout : 3 demandes, 4 cotisations impayees
// pour 620 €, et 2 reponses recues sur ses offres.
const RESUME_NON_NUL = {
  candidatures: 2,
  demandes: 3,
  impayes: { amount: 620, count: 4 },
  maCotisationDue: 0,
  mesReponses: 0,
  moderation: {
    aLaUne: 0, clubsAOnboarder: 0, revendications: 0, signalements: 0,
  },
  prochaineSeance: null,
  prochainEvenement: null,
  propositionsMatch: 0,
  reservations: 0,
};

/**
 * La sonde rejoue la couture de HomeHub : UN appel, la reponse passee a
 * `normalizeHomeCounters`, puis les deux selecteurs du pack.
 *
 * ⚠️ Elle ecrit dans un tableau RECU EN PROP, jamais dans une variable de
 * module : mesure du 2026-08-12, un observateur partage rendait la suite
 * dependante de l'ORDRE des tests — trois d'entre eux tombaient ou passaient
 * selon leur position, pas selon le code mesure.
 * @param {{ roleKey: string, vues: any[] }} props - Les props.
 * @returns {null} Rien a rendre : la sonde ne sert qu'aux assertions.
 */
function SondeAccueil({ roleKey, vues }) {
  const { data, status } = useHomeSummary({ enabled: true });
  const compteurs = normalizeHomeCounters(data);
  const pastilles = selectHomeAlerts(compteurs);

  vues.push({
    bandeau: selectBannerLines(compteurs, roleKey),
    etat: status,
    pastilles: Object.keys(pastilles).filter((clef) => pastilles[clef]).sort(),
    rendu: true,
  });
  return null;
}

/**
 * Monte la sonde, attend que la query ait REELLEMENT abouti, rend ce qu'elle a
 * vu au dernier rendu, puis DEMONTE.
 *
 * 🧨 Deux pieges payes comptant dans ce lot :
 *   · monter ne suffit pas — le premier rendu precede la reponse ;
 *   · un nombre FIXE de vidanges ne suffit pas non plus. On attend l'etat REEL
 *     de la query, sinon le test ment selon sa position dans le fichier.
 * 🧹 Le demontage n'est pas une politesse : un arbre orphelin fait sortir jest
 * en 1 avec tous les tests verts (defaut paye par le lot D68).
 * @param {string} [roleKey]
 * @returns {Promise<any>} Ce que la sonde a vu au dernier rendu.
 */
const monterLaSonde = async (roleKey = 'president') => {
  /** @type {any[]} */
  const vues = [];
  // `retry: false` : sans lui, le temoin d'echec attendrait les reprises du
  // vrai QueryClient. Ce test mesure l'etat rendu, pas le calendrier.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;

  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <SondeAccueil roleKey={roleKey} vues={vues} />
      </QueryClientProvider>,
    );
  });
  // 1. Attendre les promesses REELLEMENT rendues par le service — pas un delai.
  await act(async () => {
    await Promise.all(getHomeSummary.mock.results.map(
      (resultat) => Promise.resolve(resultat.value).catch(() => null),
    ));
  });
  // 2. Laisser la reponse redescendre jusqu'au rendu.
  // 🧨 MESURE DU 2026-08-12 : les MICROTACHES SEULES NE SUFFISENT PAS. Le
  // notificateur de react-query repasse par la file des macrotaches ; avec
  // `await Promise.resolve()` seul, la query restait `pending` indefiniment et
  // trois temoins tombaient. Il faut un vrai tour de boucle d'evenements.
  for (let tour = 0; tour < 10 && vues[vues.length - 1]?.etat === 'pending'; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- l'attente est justement le sujet
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
  const derniereVue = vues[vues.length - 1];

  await act(async () => {
    arbre.unmount();
  });
  queryClient.clear();

  return derniereVue;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('D78 — avec des compteurs non nuls, le bandeau apparait', () => {
  beforeEach(() => {
    getHomeSummary.mockResolvedValue(RESUME_NON_NUL);
  });

  it('LE TEMOIN : le dirigeant voit ses lignes, alors qu il n en avait aucune', async () => {
    const vu = await monterLaSonde('president');

    expect(vu.bandeau.map((ligne) => ligne.key)).toEqual(['demandes', 'impayes']);
  });

  it('et chaque ligne porte la valeur venue du serveur, pas un zero', async () => {
    const vu = await monterLaSonde('president');

    expect(vu.bandeau.map((ligne) => ligne.value)).toEqual([3, 4]);
  });

  it('une file vide du meme resume ne fabrique pas de ligne', async () => {
    const vu = await monterLaSonde('president');

    // `prochainEvenement` est `null` dans le resume : sa ligne n'existe pas.
    expect(vu.bandeau.map((ligne) => ligne.key)).not.toContain('prochainEvenement');
  });
});

describe('D78 — une carte dont le compteur est > 0 porte sa pastille', () => {
  it('LE TEMOIN : les trois cartes concernees s allument, et elles seules', async () => {
    getHomeSummary.mockResolvedValue(RESUME_NON_NUL);

    const vu = await monterLaSonde('president');

    expect(vu.pastilles).toEqual([
      'manage-licenses', 'manage-my-ads', 'manage-requests',
    ]);
  });

  it('un seul compteur non nul n allume que SA carte', async () => {
    getHomeSummary.mockResolvedValue({ ...RESUME_NON_NUL, candidatures: 0, demandes: 0 });

    const vu = await monterLaSonde('president');

    expect(vu.pastilles).toEqual(['manage-licenses']);
  });
});

describe('D78 — si l appel echoue, l accueil reste utilisable', () => {
  it('LE TEMOIN : la sonde se rend quand meme, sans lever', async () => {
    getHomeSummary.mockRejectedValue(new Error('reseau coupe'));

    const vu = await monterLaSonde('president');

    expect(vu.rendu).toBe(true);
    expect(vu.etat).toBe('error');
  });

  it('ni bandeau ni pastille : exactement l accueil d avant le lot', async () => {
    getHomeSummary.mockRejectedValue(new Error('reseau coupe'));

    const vu = await monterLaSonde('president');

    expect(vu.bandeau).toEqual([]);
    expect(vu.pastilles).toEqual([]);
  });

  // Une reponse vide n'est pas un echec reseau : elle traverse `data`.
  it('une reponse vide se lit comme « rien en attente », pas comme une panne', async () => {
    getHomeSummary.mockResolvedValue(null);

    const vu = await monterLaSonde('president');

    expect(vu.rendu).toBe(true);
    expect(vu.pastilles).toEqual([]);
  });
});

describe('D78 — UN SEUL appel part a l ouverture de l accueil', () => {
  it('LE TEMOIN : une ouverture = un appel, pas un par carte', async () => {
    getHomeSummary.mockResolvedValue(RESUME_NON_NUL);

    await monterLaSonde('president');

    expect(getHomeSummary).toHaveBeenCalledTimes(1);
  });

  // ⚠️ On ne peut PAS l'ecrire `toHaveBeenCalledWith()` — react-query passe
  // toujours son contexte (`queryKey`, `signal`…) en premier argument.
  // Ce qui compte est ailleurs : la requete elle-meme ne boucle sur rien.
  it('et il part sans perimetre a boucler : ni club, ni equipe, ni carte', () => {
    expect(SOURCE_SERVICE).toContain("client.get('/app/home-summary')");
    expect(compter(SOURCE_SERVICE, 'client.get(')).toBe(1);
  });

  // Le temoin qui tiendrait meme si quelqu'un ajoutait un appel par carte
  // ailleurs dans l'ecran : la source n'en cable qu'un.
  it('HomeHub ne cable qu UN SEUL point d appel', () => {
    expect(compter(SOURCE_HUB, 'useHomeSummary(')).toBe(1);
  });
});

describe('D78 — la couture est bien celle-la, dans HomeHub', () => {
  it('LE TEMOIN : la constante figee de D72 a disparu', () => {
    expect(SOURCE_HUB).not.toContain('const homeCounters = EMPTY_HOME_COUNTERS;');
  });

  it('la reponse passe par `normalizeHomeCounters`, jamais en direct', () => {
    expect(SOURCE_HUB).toContain('normalizeHomeCounters(');
  });

  it('l appel est declenche au FOCUS de l ecran, comme le pack le demande', () => {
    expect(SOURCE_HUB).toMatch(/enabled: isFocused/);
  });

  // ⛔ Le garde-fou de la decision D76 : pas de cache long cote app.
  it('aucun cache long ne se glisse cote app', () => {
    expect(SOURCE_QUERIES).toContain('staleTime: 0');
  });
});
