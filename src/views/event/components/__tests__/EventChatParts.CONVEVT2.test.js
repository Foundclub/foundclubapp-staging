import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getEventChatOfChat, getEventChatState } from '@/services/chat/chatService';

import {
  BandeauDuChatDEvenement,
  InfosDuChatDEvenement,
  quandDeLEvenement,
  sousTitreDuChatDEvenement,
  useChatDeLEvenement,
} from '../EventChatInfos';
import EventChatRow from '../EventChatRow';

// ==========================================================================
// CONVERSATION-EVENEMENT-2 (10/11/2026, « 215- B ») — ce que la 1re partie laissait, d apres
// la maquette validee « 193 » :
//   · G — la rangee d un chat deja ouvert : « Ouvert par Karim · 17 membres », les non-lus ;
//   · E — le fil : « Dim. 15 nov. · 14:00 · 17 membres », le bandeau lieu + RDV + « Voir » ;
//   · F — l ecran Infos : Staff, Convoques (ou Invites), Parents, sans ajout ni renommage.
// ==========================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _key, /** @type {any} */ fallback, /** @type {any} */ values) => (
      String(typeof fallback === 'string' ? fallback : _key).replace(/\{\{(\w+)\}\}/g, (_m, k) => String(values?.[k] ?? ''))
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));

jest.mock('@/services/chat/chatService', () => ({
  getEventChatOfChat: jest.fn(),
  getEventChatState: jest.fn(),
  openEventChat: jest.fn(),
}));

const remplir = (repli, valeurs) => String(repli)
  .replace(/\{\{(\w+)\}\}/g, (_m, k) => String(valeurs?.[k] ?? ''));
const t = (_cle, repli, valeurs) => remplir(repli, valeurs);

const attendre = async () => {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  }
};
const monter = (element) => {
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre;
};
const monterEnAttendant = async (element) => {
  let arbre;
  await act(async () => { arbre = renderer.create(element); });
  await attendre();
  return arbre;
};
const textesDe = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).join(''));
const parTestID = (arbre, id) => arbre.root.find((n) => n.props.testID === id && n.props.onPress);
const navigationDeTest = () => ({ addListener: jest.fn(() => jest.fn()), navigate: jest.fn() });

const INFO = {
  aDesParents: true,
  chat: {
    documentId: 'chat-9', nonLus: 3, ouvertPar: 'Karim', title: 'Match vs FC des Rives',
  },
  estMembre: true,
  estUnMatch: true,
  evenement: {
    date: '2026-11-15T13:00:00.000Z',
    documentId: 'match-1',
    estUnMatch: true,
    lieu: 'Stade Léo-Lagrange',
    rendezVous: { place: null, time: '13:15' },
    startTime: '14:00:00.000',
  },
  membres: {
    comptes: [
      { documentId: 'p1', nom: 'Ilyes S.', statut: 'titulaire' },
      { documentId: 'p2', nom: 'Nassim A.', statut: 'titulaire' },
      { documentId: 'p3', nom: 'Théo M.', statut: 'remplacant' },
      { documentId: 'p4', nom: 'Yanis K.', statut: 'titulaire' },
      { documentId: 'p5', nom: 'Zoé L.', statut: 'titulaire' },
    ],
    parents: [{ documentId: 'pa', enfants: [{ age: 12, prenom: 'Rayan' }], nom: 'Aïcha D.' }],
    staff: [
      { documentId: 'c', nom: 'Karim B.', role: 'coach' },
      { documentId: 'd', nom: 'Sofia L.', role: 'dirigeant' },
    ],
  },
  nombre: { membres: 15, staff: 2 },
  peutOuvrir: true,
};
const SOUS_TITRE = 'Dim. 15 nov. · 14:00 · 17 membres';
const rangee = () => <EventChatRow eventDocumentId="match-1" navigation={navigationDeTest()} />;

beforeEach(() => {
  getEventChatOfChat.mockReset();
  getEventChatState.mockReset();
});

describe('G — un chat deja ouvert, vu d un autre membre du staff', () => {
  test('la rangee dit qui l a ouvert, le nombre de membres, et montre les non-lus', async () => {
    getEventChatState.mockResolvedValue(INFO);
    const arbre = await monterEnAttendant(rangee());
    expect(textesDe(arbre)).toEqual(['Chat de l’événement', 'Ouvert par Karim · 17 membres', '3']);
    const badge = arbre.root.findAll((n) => n.props.testID === 'event-chat-row-unread'
      && n.props.accessibilityLabel);
    expect(badge[0].props.accessibilityLabel).toBe('3 messages non lus');
  });

  test('sans non-lu ni nom d ouverture : ni pastille, ni « Ouvert par »', async () => {
    const sansRien = { ...INFO, chat: { ...INFO.chat, nonLus: 0, ouvertPar: null } };
    getEventChatState.mockResolvedValue(sansRien);
    const arbre = await monterEnAttendant(rangee());
    expect(textesDe(arbre)).toEqual(['Chat de l’événement', '17 membres']);
  });

  test('au retour sur la fiche, la rangee se relit (les non-lus baissent)', async () => {
    getEventChatState
      .mockResolvedValueOnce(INFO)
      .mockResolvedValueOnce({ ...INFO, chat: { ...INFO.chat, nonLus: 0 } });
    let auRetour;
    const navigation = navigationDeTest();
    navigation.addListener.mockImplementation((nom, fn) => {
      if (nom === 'focus') auRetour = fn;
      return jest.fn();
    });
    const arbre = await monterEnAttendant(
      <EventChatRow eventDocumentId="match-1" navigation={navigation} />,
    );
    await act(async () => { auRetour(); });
    await attendre();
    expect(textesDe(arbre)).toEqual(['Chat de l’événement', 'Ouvert par Karim · 17 membres']);
  });
});

describe('E — le chat ouvert', () => {
  test('sous le nom : la date, l heure et le nombre de membres', () => {
    expect(quandDeLEvenement(INFO.evenement)).toEqual({ heure: '14:00', jour: 'Dim. 15 nov.' });
    expect(sousTitreDuChatDEvenement(INFO, t)).toBe(SOUS_TITRE);
    expect(sousTitreDuChatDEvenement(null, t)).toBe('');
  });

  test('le bandeau rappelle le lieu et le rendez-vous, et ramene a la fiche', () => {
    const onVoir = jest.fn();
    const arbre = monter(<BandeauDuChatDEvenement info={INFO} onVoirLEvenement={onVoir} />);
    expect(textesDe(arbre)).toEqual(['Stade Léo-Lagrange · RDV 13:15', 'Voir l’événement']);
    parTestID(arbre, 'event-chat-banner-see-event').props.onPress();
    expect(onVoir).toHaveBeenCalledWith('match-1');
  });

  test('sans lieu ni rendez-vous : « Lieu non précisé » ; sans evenement : rien', () => {
    const sansLieu = { ...INFO, evenement: { ...INFO.evenement, lieu: null, rendezVous: null } };
    const bandeau = monter(
      <BandeauDuChatDEvenement info={sansLieu} onVoirLEvenement={jest.fn()} />,
    );
    expect(textesDe(bandeau)[0]).toBe('Lieu non précisé');
    const vide = monter(<BandeauDuChatDEvenement info={null} onVoirLEvenement={jest.fn()} />);
    expect(vide.toJSON()).toBeNull();
  });

  test('le fil lit l etat de son evenement, et seulement pour un chat d evenement', async () => {
    getEventChatOfChat.mockResolvedValue(INFO);
    const vu = [];
    /**
     * Lit le hook et garde ce qu il rend.
     * @param {{ chatId: string, estEvt: boolean }} props - Le chat et son type.
     * @returns {null} Rien a l ecran.
     */
    function Sonde({ chatId, estEvt }) {
      const [info] = useChatDeLEvenement(chatId, estEvt);
      vu.push(info);
      return null;
    }
    await monterEnAttendant(<Sonde chatId="chat-team" estEvt={false} />);
    expect(getEventChatOfChat).not.toHaveBeenCalled();
    await monterEnAttendant(<Sonde chatId="chat-9" estEvt />);
    expect(getEventChatOfChat).toHaveBeenCalledWith('chat-9');
    expect(vu[vu.length - 1]).toBe(INFO);
  });
});

const infos = (info, titre = 'Match', onClose = jest.fn()) => monter(
  <InfosDuChatDEvenement info={info} onClose={onClose} titre={titre} visible />,
);

describe('F — les infos du chat', () => {
  test('Staff, Convoques et Parents, trois noms puis « Voir les N autres »', () => {
    const textes = textesDe(infos(INFO, 'Match vs FC des Rives'));
    expect(textes).toEqual(expect.arrayContaining([
      'Infos', 'Match vs FC des Rives', SOUS_TITRE,
      'Staff · 2', 'Karim B.', 'Coach', 'Sofia L.', 'Dirigeant',
      'Convoqués · 5', 'Ilyes S.', 'Titulaire', 'Théo M.', 'Remplaçant', 'Voir les 2 autres',
      'Parents · 1', 'Aïcha D.', 'parent : Rayan, 12 ans',
    ]));
    expect(textes).not.toContain('Zoé L.');
    expect(textes.join(' ')).not.toMatch(/Ajouter|Renommer/);
    expect(textes.join(' ')).toMatch(/La liste suit la convocation/);
  });

  test('« Voir les N autres » deroule la liste', async () => {
    const arbre = infos(INFO);
    const voir = arbre.root
      .findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress)
      .find((n) => textesDe({ root: n }).includes('Voir les 2 autres'));
    await act(async () => { voir.props.onPress(); });
    expect(textesDe(arbre)).toContain('Zoé L.');
  });

  test('un entrainement : « Invités », sans statut', () => {
    const entr = {
      ...INFO,
      estUnMatch: false,
      evenement: { ...INFO.evenement, estUnMatch: false },
      membres: { ...INFO.membres, comptes: [{ documentId: 'x', nom: 'Omar S.' }] },
    };
    const textes = textesDe(infos(entr, 'Entraînement'));
    expect(textes).toEqual(expect.arrayContaining(['Invités · 1', 'Omar S.']));
    expect(textes).not.toContain('Titulaire');
    expect(textes.join(' ')).toMatch(/La liste suit les invités/);
  });

  test('« Fermer » referme l ecran', () => {
    const onClose = jest.fn();
    parTestID(infos(INFO, 'Match', onClose), 'event-chat-infos-close').props.onPress();
    expect(onClose).toHaveBeenCalled();
  });
});
