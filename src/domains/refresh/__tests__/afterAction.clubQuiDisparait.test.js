import {
  QueryClient,
  QueryObserver,
} from '@tanstack/react-query';

import { AFTER_ACTION_CACHES, invalidateAfterAction } from '@/domains/refresh/afterAction';

import {
  refreshOnReturn,
  resetReturnRefreshCooldown,
  RETURN_REFRESH_ACTIONS,
} from '@/app/queryRefreshOnReturn';

/**
 * LOT AB02 — « LE CLUB QUE JE VIENS DE CREER DISPARAIT QUELQUES MINUTES PLUS TARD. »
 *
 * Ces temoins tournent sur un VRAI `QueryClient` et un VRAI `QueryObserver`, jamais
 * sur un faux client. ⛔ Un faux `queryClient` dont `invalidateQueries` ne fait rien
 * ne prouve RIEN : il est vert des deux cotes du correctif. Ce qui est mesure ici
 * est une regle interne de react-query, pas une intention.
 *
 * CE QU'ILS ETABLISSENT, et c'est le motif meme du lot :
 *  · temoin 2 — un retour au premier plan RELIT le profil depuis le serveur. Donc
 *    une correction posee seulement dans le cache de l'app ne survit pas : elle est
 *    ECRASEE par la reponse du serveur. La correction devait etre serveur.
 *  · temoin 5 — la course entre l'invalidation non attendue (`ClubWizardRecap.js:82`)
 *    et le `refetchUserData()` attendu (`:93`) : c'est bien la lecture ATTENDUE qui
 *    ecrit la derniere, meme quand la premiere est plus lente.
 */

/** Le profil d'avant la creation : aucun club. C'est ce que servait le serveur perime. */
const PROFIL_SANS_CLUB = { club: null, documentId: 'u-1' };
/** Le profil d'apres : le createur est rattache a son club. */
const PROFIL_AVEC_CLUB = { club: { documentId: 'club-neuf', name: 'AS Test' }, documentId: 'u-1' };

const CLE_PROFIL = ['get-me', 'jeton'];

/**
 * Monte le profil comme l'app le monte : une query DEJA LUE et ACTIVE.
 *
 * ⚠️ `refetchOnMount` et `refetchOnWindowFocus` sont a `false` dans l'app
 * (`useAuth.js:352-353`), et `staleTime` a 5 min : sans observateur actif, une
 * invalidation ne declenche AUCUNE lecture. Le monter est donc obligatoire pour
 * mesurer quoi que ce soit.
 * @param {QueryClient} queryClient Le client de test.
 * @param {() => Promise<any>} lireLeServeur Ce que le serveur repond, appel par appel.
 * @returns {{ arreter: () => void, observer: QueryObserver }} L'observateur et son
 *   desabonnement.
 */
const monterLeProfil = (queryClient, lireLeServeur) => {
  queryClient.setQueryData(CLE_PROFIL, PROFIL_SANS_CLUB);
  const observer = new QueryObserver(queryClient, {
    queryFn: lireLeServeur,
    queryKey: CLE_PROFIL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const arreter = observer.subscribe(() => {});
  return { arreter, observer };
};

const attendre = (ms) => new Promise((resoudre) => { setTimeout(resoudre, ms); });

describe('AB02 — le club qui disparait', () => {
  /** @type {QueryClient} */
  let queryClient;

  beforeEach(() => {
    resetReturnRefreshCooldown();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it(
    'temoin 2 — un retour au premier plan RELIT le profil : une rustine'
    + ' posee dans l\'app ne survit pas',
    async () => {
    // Le serveur est encore perime : son cache profil (60 s + 4 min) ne connait pas
    // le club qui vient d'etre cree.
      const { arreter } = monterLeProfil(queryClient, async () => PROFIL_SANS_CLUB);

      // La correction 100 % cote app : on pose le club a la main dans le cache local.
      // A l'ecran, tout va bien — pendant quelques minutes.
      queryClient.setQueryData(CLE_PROFIL, PROFIL_AVEC_CLUB);
      expect(queryClient.getQueryData(CLE_PROFIL)?.club).not.toBeNull();

      // Le telephone repasse au premier plan. `queryRefreshOnReturn` relit les
      // familles de `membershipChanged`, dont `['get-me']`.
      expect(RETURN_REFRESH_ACTIONS).toContain('membershipChanged');
      expect(AFTER_ACTION_CACHES.membershipChanged).toContainEqual(['get-me']);
      refreshOnReturn(queryClient, 'foreground');
      await queryClient.getQueryCache().find({ queryKey: CLE_PROFIL })?.promise;

      // 🧨 LE DEFAUT NOMME PAR ADEL : le club a disparu. La reponse perimee du serveur
      // a ECRASE la rustine, et `TeamWizardName` redit « Il te faut d'abord un club ».
      expect(queryClient.getQueryData(CLE_PROFIL)?.club).toBeNull();

      arreter();
    },
  );

  it(
    'temoin 2 bis — le serveur corrige, le club est TOUJOURS la apres'
    + ' un retour au premier plan',
    async () => {
    // Le correctif serveur du lot : creer un club purge le cache profil de son
    // createur (admin, extensions/users-permissions/.../user-club-cache.js). Le
    // serveur rend donc desormais le profil qui connait le club.
      const { arreter } = monterLeProfil(queryClient, async () => PROFIL_AVEC_CLUB);

      refreshOnReturn(queryClient, 'foreground');
      await queryClient.getQueryCache().find({ queryKey: CLE_PROFIL })?.promise;

      expect(queryClient.getQueryData(CLE_PROFIL)?.club).toEqual(PROFIL_AVEC_CLUB.club);

      // Et un deuxieme retour ne le reperd pas.
      resetReturnRefreshCooldown();
      refreshOnReturn(queryClient, 'foreground');
      await queryClient.getQueryCache().find({ queryKey: CLE_PROFIL })?.promise;
      expect(queryClient.getQueryData(CLE_PROFIL)?.club).toEqual(PROFIL_AVEC_CLUB.club);

      arreter();
    },
  );

  /**
   * Le piege exact de `ClubWizardRecap.resumeAfterSuccess` : la PREMIERE lecture —
   * celle que declenche l'invalidation NON ATTENDUE de la ligne 82 — est LENTE et
   * rend le profil perime ; la seconde — le `refetchUserData()` ATTENDU de la ligne
   * 93 — est rapide et rend le bon. Si la lente ecrit la derniere, le club disparait.
   *
   * ⚠️ CE QUI SE MESURE EST L'ECRITURE DANS LE CACHE, PAS LA FIN DE LA FONCTION.
   * Une lecture annulee par react-query continue de tourner (on n'interrompt pas une
   * promesse en JS) et se termine donc BIEN APRES — mais son resultat est jete.
   * Compter les fins de fonction ferait echouer un code sain.
   * @param {QueryClient} client Le client de test.
   * @returns {{ arreter: () => void, ecritures: any[], observer: QueryObserver }}
   *   L'observateur, le journal des valeurs REELLEMENT ecrites, et le desabonnement.
   */
  const monterLaCourse = (client) => {
    /** @type {any[]} */
    const ecritures = [];
    let appels = 0;

    const monte = monterLeProfil(client, async () => {
      appels += 1;
      if (appels === 1) {
        await attendre(60);
        return PROFIL_SANS_CLUB;
      }
      await attendre(5);
      return PROFIL_AVEC_CLUB;
    });

    client.getQueryCache().subscribe((evenement) => {
      if (evenement?.type !== 'updated') return;
      if (evenement?.action?.type !== 'success') return;
      ecritures.push(evenement.action.data);
    });

    return { ...monte, ecritures };
  };

  it('temoin 5 — la course est fermee : la lecture ATTENDUE est la derniere a ECRIRE', async () => {
    const { arreter, ecritures, observer } = monterLaCourse(queryClient);

    // La sequence de `resumeAfterSuccess`, a l'identique.
    invalidateAfterAction(queryClient, 'createClub').catch(() => {});
    await observer.refetch();

    // Laisser la lecture lente revenir : si elle pouvait encore ecrire, c'est
    // maintenant.
    await attendre(150);

    // 🥇 Le coeur du temoin : le profil que l'ecran suivant lit est le FRAIS.
    // `refetch()` annule la lecture en cours (`cancelRefetch` vaut `true` par
    // defaut), et la reponse annulee n'ecrit plus jamais.
    expect(queryClient.getQueryData(CLE_PROFIL)).toEqual(PROFIL_AVEC_CLUB);
    expect(ecritures[ecritures.length - 1]).toEqual(PROFIL_AVEC_CLUB);
    expect(ecritures).not.toContainEqual(PROFIL_SANS_CLUB);

    arreter();
  });

  it(
    'temoin 5 ter — LE CONTRE-TEMOIN : sans la lecture attendue, la'
    + ' lente perimee ecrit bel et bien',
    async () => {
    // 📌 C'est ce qui rend le temoin 5 capable d'echouer. Meme montage, meme
    // serveur, meme minuterie — on retire seulement le `await refetchUserData()`.
    // La lecture lente n'est alors annulee par personne : elle ecrit le profil
    // perime, et le club disparait. Si le temoin 5 etait vert par accident de
    // montage, celui-ci le serait aussi.
      const { arreter, ecritures } = monterLaCourse(queryClient);

      invalidateAfterAction(queryClient, 'createClub').catch(() => {});
      await attendre(150);

      expect(queryClient.getQueryData(CLE_PROFIL)).toEqual(PROFIL_SANS_CLUB);
      expect(ecritures[ecritures.length - 1]).toEqual(PROFIL_SANS_CLUB);

      arreter();
    },
  );

  it(
    'temoin 5 bis — le faux client inerte, lui, est vert des DEUX'
    + ' cotes : il ne prouve rien',
    async () => {
    // 📌 Pourquoi les temoins ci-dessus montent un VRAI client. Le faux client
    // employe par les tests existants de l'ecran ne fait RIEN : aucune lecture ne
    // part, aucune valeur n'est ecrite, donc aucune course ne peut etre observee.
      const fauxClient = { invalidateQueries: jest.fn() };
      await invalidateAfterAction(fauxClient, 'createClub');

      expect(fauxClient.invalidateQueries).toHaveBeenCalled();
      // Il a « invalide » six racines et le cache n'a pas bouge d'un octet.
      expect(fauxClient.invalidateQueries.mock.calls.length)
        .toBe(AFTER_ACTION_CACHES.createClub.length);
    },
  );
});
