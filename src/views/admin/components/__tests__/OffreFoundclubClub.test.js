import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import OffreFoundclubClub from '../OffreFoundclubClub';

// 🎁 OFFRIR-ABONNEMENT (07/10/2026) — « Je prends mon téléphone, deux clics, et hop, je
// t’abonne » (Adel). Le bloc « Abonnement » de la fiche d un club dans la console SuperAdmin.
//
// Ce que ce témoin exige (ROUGE avant le lot : le composant n existait pas) :
//   O1 — un club gratuit : « Offrir l’abonnement » → la feuille (offre Club, 4 durées, « 1 an »
//        choisi, motif « Offert par FoundClub ») → « Offrir » : DEUX appuis, et le serveur
//        reçoit la durée et le motif ; le bloc relit l état et dit « jusqu’au … » ;
//   O2 — choisir « 1 mois » et un motif : c est ce qui part ;
//   O3 — un club offert : « Offert par FoundClub », jusqu’à quand, depuis quand, le motif, et
//        « Retirer l’offre » → confirmation → le serveur retire → « Offre retirée. » ;
//   O4 — un club qui paie : on le dit, et AUCUN bouton « Offrir » ;
//   O5 — le serveur répond « déjà payé » : le compte rendu le dit, rien n est annoncé posé ;
//   O6 — un refus du serveur (durée) s écrit dans la feuille, qui reste ouverte ;
//   O7 — la Ville offre déjà : on le dit, et on peut quand même offrir.
// Le client HTTP est doublé ; le VRAI i18next (fr.js) écrit les phrases.

jest.setTimeout(30000);

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        // eslint-disable-next-line max-len
        disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}`, variant: props.variant,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

// Le selecteur de date de l app (JJ/MM/AAAA) : double en champ texte, ses bornes visibles.
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput: ChampRN } = jest.requireActual('react-native');
  return function DatePickerInputMock(/** @type {any} */ props) {
    return reactActuel.createElement(ChampRN, {
      maximumDate: props.maximumDate,
      minimumDate: props.minimumDate,
      onChangeText: props.onChange,
      placeholder: props.placeholder,
      testID: 'offre-foundclub-date',
      value: props.value,
    });
  };
});

const ROUTE = '/admin-dashboard/subscription-ops/clubs/club-A/foundclub-offer';
const FIN = '2027-10-07T12:00:00.000Z';
const DEBUT = '2026-10-07T12:00:00.000Z';

/** @type {any} */
let serveur;

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const parTestID = (/** @type {any} */ noeud, /** @type {string} */ testID) => noeud.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.findAll(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
)[0];
const feuille = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && n.props?.accessibilityViewIsModal,
)[0];

const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let i = 0; i < 80 && !condition(); i += 1) {
    // React Query notifie par setTimeout(0) : setImmediate peut epuiser les
    // 80 tours avant cette notification sur Windows, meme sans charge.
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setTimeout(fin, 0); }); });
  }
  expect(condition()).toBe(true);
};

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <OffreFoundclubClub clubId="club-A" clubName="AS Offerte" />
      </QueryClientProvider>,
    );
  });
  await attendre(() => Boolean(parTestID(arbre.root, 'offre-foundclub-etat')));
  return arbre;
};

const etatAucun = {
  // eslint-disable-next-line max-len
  collectivite: false, kind: 'none', reason: null, since: null, subscriptionDocumentId: null, until: null,
};

beforeEach(() => {
  serveur = { etat: { ...etatAucun }, reponseOffre: null, reponseRetrait: null };
  [mockGet, mockPost].forEach((doublure) => doublure.mockReset());
  mockGet.mockImplementation(async (route) => {
    if (route === ROUTE) return { data: { data: serveur.etat } };
    throw new Error(`GET inattendu ${route}`);
  });
  mockPost.mockImplementation(async (route, corps) => {
    if (route === ROUTE) {
      if (serveur.reponseOffre instanceof Error) throw serveur.reponseOffre;
      const reponse = serveur.reponseOffre || {
        // eslint-disable-next-line max-len
        currentPeriodEnd: corps.data.duration === 'none' ? null : FIN, offer: 'granted', subscriptionDocumentId: 'sub-1',
      };
      if (reponse.offer === 'granted') {
        serveur.etat = {
          // eslint-disable-next-line max-len
          collectivite: false, kind: 'foundclub', reason: corps.data.reason, since: DEBUT, subscriptionDocumentId: 'sub-1', until: reponse.currentPeriodEnd,
        };
      }
      return { data: { data: reponse } };
    }
    if (route === `${ROUTE}/revoke`) {
      serveur.etat = { ...etatAucun };
      return { data: { data: serveur.reponseRetrait || { offer: 'revoked' } } };
    }
    throw new Error(`POST inattendu ${route}`);
  });
});

// eslint-disable-next-line max-len
test('O1 — club gratuit : « Offrir l’abonnement » puis « Offrir » (deux appuis) ; 1 an et le motif par défaut partent ; le bloc dit « jusqu’au 7 octobre 2027 »', async () => {
  const arbre = await monter();
  expect(textes(arbre.root)).toContain('Aucune offre Club en cours : le club est gratuit.');

  await act(async () => { bouton(arbre.root, 'Offrir l’abonnement').props.onPress(); });
  const ouverte = feuille(arbre, 'offre-foundclub-feuille');
  expect(ouverte).toBeTruthy();
  const vus = textes(ouverte);
  expect(vus).toEqual(expect.arrayContaining([
    // eslint-disable-next-line max-len
    'Offrir l’abonnement', 'AS Offerte', 'Club · toutes ses équipes', '1 mois', '3 mois', '1 an', 'Sans fin',
  ]));
  const choisies = ['1m', '3m', '1y', 'none']
    // eslint-disable-next-line max-len
    .filter((duree) => parTestID(ouverte, `offre-foundclub-duree-${duree}`).props.accessibilityState?.selected);
  expect(choisies).toEqual(['1y']);
  // eslint-disable-next-line max-len
  const motif = ouverte.findAllByType(TextInput).find((n) => n.props.testID === 'offre-foundclub-motif');
  expect(motif.props.value).toBe('Offert par FoundClub');

  await act(async () => { bouton(ouverte, 'Offrir').props.onPress(); });
  await attendre(() => textes(arbre.root).includes('Offert par FoundClub'));

  // eslint-disable-next-line max-len
  expect(mockPost).toHaveBeenCalledWith(ROUTE, { data: { duration: '1y', reason: 'Offert par FoundClub' } });
  expect(feuille(arbre, 'offre-foundclub-feuille')).toBeUndefined();
  const apres = textes(arbre.root);
  expect(apres).toContain('Abonnement offert jusqu’au 7 octobre 2027.');
  expect(apres).toContain('Jusqu’au 7 octobre 2027');
});

test('O2 — choisir « 1 mois » et écrire un motif : c est ce qui part', async () => {
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Offrir l’abonnement').props.onPress(); });
  const ouverte = feuille(arbre, 'offre-foundclub-feuille');
  await act(async () => { parTestID(ouverte, 'offre-foundclub-duree-1m').props.onPress(); });
  // eslint-disable-next-line max-len
  const motif = ouverte.findAllByType(TextInput).find((n) => n.props.testID === 'offre-foundclub-motif');
  await act(async () => { motif.props.onChangeText('Partenaire du tournoi'); });
  // eslint-disable-next-line max-len
  await act(async () => { bouton(feuille(arbre, 'offre-foundclub-feuille'), 'Offrir').props.onPress(); });
  await attendre(() => mockPost.mock.calls.length > 0);
  // eslint-disable-next-line max-len
  expect(mockPost).toHaveBeenCalledWith(ROUTE, { data: { duration: '1m', reason: 'Partenaire du tournoi' } });
});

// eslint-disable-next-line max-len
test('O3 — club offert : qui, jusqu’à quand, depuis quand, le motif ; « Retirer l’offre » demande confirmation, puis retire', async () => {
  serveur.etat = {
    // eslint-disable-next-line max-len
    collectivite: false, kind: 'foundclub', reason: 'Club pilote', since: DEBUT, subscriptionDocumentId: 'sub-1', until: null,
  };
  const arbre = await monter();
  expect(textes(arbre.root)).toEqual(expect.arrayContaining([
    'Offert par FoundClub', 'Sans fin', 'Depuis le 7 octobre 2026', 'Motif : Club pilote',
  ]));
  expect(bouton(arbre.root, 'Offrir l’abonnement')).toBeUndefined();

  await act(async () => { bouton(arbre.root, 'Retirer l’offre').props.onPress(); });
  const confirmation = feuille(arbre, 'offre-foundclub-retrait');
  expect(confirmation).toBeTruthy();
  expect(mockPost).not.toHaveBeenCalled();
  await act(async () => { bouton(confirmation, 'Retirer l’offre').props.onPress(); });
  await attendre(() => textes(arbre.root).includes('Offre retirée.'));
  expect(mockPost).toHaveBeenCalledWith(`${ROUTE}/revoke`, { data: { reason: '' } });
  expect(textes(arbre.root)).toContain('Aucune offre Club en cours : le club est gratuit.');
});

test('O4 — un club qui paie : on le dit, et aucun bouton « Offrir l’abonnement »', async () => {
  serveur.etat = { ...etatAucun, kind: 'paid' };
  const arbre = await monter();
  expect(textes(arbre.root)).toContain('Ce club paie déjà son abonnement : rien à offrir.');
  expect(bouton(arbre.root, 'Offrir l’abonnement')).toBeUndefined();
});

// eslint-disable-next-line max-len
test('O5 — le serveur répond « déjà payé » : le compte rendu le dit, rien n est annoncé posé', async () => {
  // eslint-disable-next-line max-len
  serveur.reponseOffre = { currentPeriodEnd: null, offer: 'already-paid', subscriptionDocumentId: null };
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Offrir l’abonnement').props.onPress(); });
  // eslint-disable-next-line max-len
  await act(async () => { bouton(feuille(arbre, 'offre-foundclub-feuille'), 'Offrir').props.onPress(); });
  // eslint-disable-next-line max-len
  await attendre(() => textes(arbre.root).includes('Ce club paie déjà son abonnement : rien n’a été posé.'));
  expect(textes(arbre.root).some((texte) => texte.startsWith('Abonnement offert'))).toBe(false);
});

test('O6 — un refus du serveur s écrit dans la feuille, qui reste ouverte', async () => {
  const refus = Object.assign(new Error('FOUNDCLUB_OFFER_INVALID_DURATION'), {
    // eslint-disable-next-line max-len
    response: { data: { error: { details: { code: 'FOUNDCLUB_OFFER_INVALID_DURATION' }, message: 'FOUNDCLUB_OFFER_INVALID_DURATION' } }, status: 400 },
  });
  serveur.reponseOffre = refus;
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Offrir l’abonnement').props.onPress(); });
  // eslint-disable-next-line max-len
  await act(async () => { bouton(feuille(arbre, 'offre-foundclub-feuille'), 'Offrir').props.onPress(); });
  await attendre(() => textes(arbre.root).includes('Choisis une durée.'));
  expect(feuille(arbre, 'offre-foundclub-feuille')).toBeTruthy();
});

// eslint-disable-next-line max-len
test('O7 — la Ville offre déjà l offre Club : on le dit, et on peut quand même offrir au nom de FoundClub', async () => {
  serveur.etat = { ...etatAucun, collectivite: true };
  const arbre = await monter();
  // eslint-disable-next-line max-len
  expect(textes(arbre.root)).toContain('Sa collectivité lui offre déjà l’offre Club. Celle de FoundClub s’ajoute, et reste si la Ville retire la sienne.');
  expect(bouton(arbre.root, 'Offrir l’abonnement')).toBeTruthy();
});

// eslint-disable-next-line max-len
test('O8 — club offert : « Modifier la durée » rouvre la feuille avec SA durée et SON motif ; « Enregistrer » renvoie le geste', async () => {
  serveur.etat = {
    collectivite: false,
    kind: 'foundclub',
    planCode: 'fc_foundclub_club',
    reason: 'Club pilote',
    since: DEBUT,
    subscriptionDocumentId: 'sub-1',
    until: null,
  };
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Modifier la durée').props.onPress(); });
  const ouverte = feuille(arbre, 'offre-foundclub-feuille');
  expect(textes(ouverte)).toContain('Modifier la durée');
  const choisies = ['1m', '3m', '1y', 'none']
    // eslint-disable-next-line max-len
    .filter((duree) => parTestID(ouverte, `offre-foundclub-duree-${duree}`).props.accessibilityState?.selected);
  expect(choisies).toEqual(['none']);
  // eslint-disable-next-line max-len
  const motif = ouverte.findAllByType(TextInput).find((n) => n.props.testID === 'offre-foundclub-motif');
  expect(motif.props.value).toBe('Club pilote');
  await act(async () => { parTestID(ouverte, 'offre-foundclub-duree-1y').props.onPress(); });
  await act(async () => {
    bouton(feuille(arbre, 'offre-foundclub-feuille'), 'Enregistrer').props.onPress();
  });
  await attendre(() => mockPost.mock.calls.length > 0);
  expect(mockPost).toHaveBeenCalledWith(ROUTE, { data: { duration: '1y', reason: 'Club pilote' } });
});

// eslint-disable-next-line max-len
test('O9 — une offre posée AVANT la console (plan de la Ville) : on prévient que l app lit « collectivité », et comment corriger', async () => {
  serveur.etat = {
    collectivite: false,
    kind: 'foundclub',
    planCode: 'fc_collectivite_club',
    reason: null,
    since: DEBUT,
    subscriptionDocumentId: 'sub-1',
    until: null,
  };
  const arbre = await monter();
  expect(textes(arbre.root)).toContain(
    // eslint-disable-next-line max-len
    'Posée avant la console : le club lit encore « offert par la collectivité ». « Modifier la durée » puis « Enregistrer » corrige ce libellé.',
  );
});

// Decision d Adel du 07/10 ~23h15 : « il faut pouvoir offrir le temps qu on veut ».
const champDate = (/** @type {any} */ noeud) => noeud.findAllByType(TextInput)
  .find((/** @type {any} */ n) => n.props.testID === 'offre-foundclub-date');

// eslint-disable-next-line max-len
test('O10 — « Jusqu’au… » : le sélecteur de date apparaît (demain au plus tôt, 5 ans au plus) ; « Offrir » attend une date ; la FIN du jour choisi part au serveur', async () => {
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Offrir l’abonnement').props.onPress(); });
  let ouverte = feuille(arbre, 'offre-foundclub-feuille');
  expect(textes(ouverte)).toContain('Jusqu’au…');
  expect(champDate(ouverte)).toBeUndefined();
  await act(async () => { parTestID(ouverte, 'offre-foundclub-duree-until').props.onPress(); });
  ouverte = feuille(arbre, 'offre-foundclub-feuille');
  const champ = champDate(ouverte);
  expect(champ).toBeTruthy();
  const maintenant = new Date();
  expect(champ.props.minimumDate.getTime()).toBeGreaterThan(maintenant.getTime());
  expect(champ.props.maximumDate.getFullYear()).toBe(maintenant.getFullYear() + 5);
  expect(bouton(ouverte, 'Offrir').props.disabled).toBe(true);

  await act(async () => { champ.props.onChangeText('31/12/2026'); });
  ouverte = feuille(arbre, 'offre-foundclub-feuille');
  expect(bouton(ouverte, 'Offrir').props.disabled).toBeFalsy();
  await act(async () => { bouton(ouverte, 'Offrir').props.onPress(); });
  await attendre(() => mockPost.mock.calls.length > 0);
  expect(mockPost).toHaveBeenCalledWith(ROUTE, {
    data: {
      duration: 'until',
      endsAt: new Date(2026, 11, 31, 23, 59, 59, 999).toISOString(),
      reason: 'Offert par FoundClub',
    },
  });
});

// eslint-disable-next-line max-len
test('O11 — « Modifier la durée » d une offre datée : « Jusqu’au… » est choisi, avec SA date', async () => {
  serveur.etat = {
    collectivite: false,
    kind: 'foundclub',
    planCode: 'fc_foundclub_club',
    reason: 'Club pilote',
    since: DEBUT,
    subscriptionDocumentId: 'sub-1',
    until: FIN,
  };
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Modifier la durée').props.onPress(); });
  const ouverte = feuille(arbre, 'offre-foundclub-feuille');
  const choisies = ['1m', '3m', '1y', 'none', 'until']
    // eslint-disable-next-line max-len
    .filter((duree) => parTestID(ouverte, `offre-foundclub-duree-${duree}`).props.accessibilityState?.selected);
  expect(choisies).toEqual(['until']);
  expect(champDate(ouverte).props.value).toBe('07/10/2027');
});

// eslint-disable-next-line max-len
test('O12 — une date refusée par le serveur (plus de 5 ans) : la phrase s écrit dans la feuille', async () => {
  serveur.reponseOffre = Object.assign(new Error('FOUNDCLUB_OFFER_END_DATE_TOO_FAR'), {
    response: {
      // eslint-disable-next-line max-len
      data: { error: { details: { code: 'FOUNDCLUB_OFFER_END_DATE_TOO_FAR' }, message: 'FOUNDCLUB_OFFER_END_DATE_TOO_FAR' } },
      status: 400,
    },
  });
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Offrir l’abonnement').props.onPress(); });
  // eslint-disable-next-line max-len
  await act(async () => { parTestID(feuille(arbre, 'offre-foundclub-feuille'), 'offre-foundclub-duree-until').props.onPress(); });
  // eslint-disable-next-line max-len
  await act(async () => { champDate(feuille(arbre, 'offre-foundclub-feuille')).props.onChangeText('01/01/2040'); });
  // eslint-disable-next-line max-len
  await act(async () => { bouton(feuille(arbre, 'offre-foundclub-feuille'), 'Offrir').props.onPress(); });
  await attendre(() => textes(arbre.root).includes('Pas plus de 5 ans.'));
  expect(textes(arbre.root)).toContain('Pas plus de 5 ans.');
});
