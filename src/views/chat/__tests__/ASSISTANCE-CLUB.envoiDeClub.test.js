import fs from 'node:fs';
import path from 'node:path';

import { t as traduire } from 'i18next';
import renderer, { act } from 'react-test-renderer';

import {
  clubsAProposer,
  compositionDuClubPartage,
  texteDuClubPartage,
} from '@/domains/messaging/clubPartage';
import { extraitDuMessageCite } from '@/domains/messaging/habillageDuFil';
import { getChatMessagePreview } from '@/domains/messaging/messagingUseCases';

import ClubShareBubble from '@/components/molecules/clubShareBubble/ClubShareBubble';

import { RouteNames } from '@/navigation/routeNames';
import { WEB_ROUTE_PATTERNS } from '@/navigation/webRoutes';

// ASSISTANCE-MINEURS-CLUB (19/11/2026, D271, partie B) — « un bouton + comme pour les
// événements, mais là pour envoyer un club » (Adel). ROUGE avant le lot : aucune entrée « Club »
// dans le « + », aucun sélecteur, aucune carte « Club partagé », aucune route. Le serveur relit
// le club et réécrit la carte (témoin admin ASSISTANCE-CLUB-carte-relue-par-le-serveur) :
// l'app n'envoie que l'identifiant.

let mockErreurDeLecture = null;
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({ error: mockErreurDeLecture }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: jest.requireActual('i18next').t }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({ Colors, Fonts: generateFonts(Colors) }),
  };
});

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => 'ClubLogoMark');
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const { Text } = jest.requireActual('react-native');
  /**
   * Le texte défilant, réduit à son texte.
   * @param {{ text: string }} props - Les propriétés.
   * @returns {import('react').ReactElement} Le texte.
   */
  function MarqueeText({ text }) {
    return <Text>{text}</Text>;
  }
  return MarqueeText;
});

const SRC = path.join(__dirname, '..', '..', '..');
const lire = (fichier) => fs.readFileSync(path.join(SRC, fichier), 'utf8');

const CARTE = {
  cityName: 'Aubagne',
  clubDocumentId: 'club-aubagne',
  clubName: 'Aubagne Handball',
  logoUrl: '/uploads/ahb.png',
  postcode: '13400',
  sport: 'Handball',
  type: 'club_share',
};

const monterLaBulle = (onPressClub) => {
  let arbre;
  act(() => {
    arbre = renderer.create(<ClubShareBubble composition={CARTE} onPressClub={onPressClub} />);
  });
  const textes = arbre.root.findAll((noeud) => noeud.type === 'Text')
    .flatMap((noeud) => [].concat(noeud.props.children))
    .filter((morceau) => typeof morceau === 'string');
  const bouton = arbre.root.findByProps({ testID: 'bulle-club-partage-ouvrir' });
  return { bouton, textes };
};

beforeEach(() => {
  mockErreurDeLecture = null;
});

describe('ASSISTANCE-CLUB · la carte « Club partagé »', () => {
  it('montre nom, « sport · ville (département) », « Voir le club » qui ouvre la fiche', () => {
    const onPressClub = jest.fn();
    const { bouton, textes } = monterLaBulle(onPressClub);
    expect(textes).toEqual(expect.arrayContaining([
      'Club partagé',
      'Aubagne Handball',
      'Handball · Aubagne (13)',
      'Voir le club',
    ]));
    act(() => bouton.props.onPress());
    expect(onPressClub).toHaveBeenCalledWith('club-aubagne');
  });

  it('un club disparu (404) : « Ce club n\'est plus disponible », le bouton est mort', () => {
    mockErreurDeLecture = { response: { status: 404 } };
    const onPressClub = jest.fn();
    const { bouton, textes } = monterLaBulle(onPressClub);
    expect(textes).toEqual(expect.arrayContaining([
      "Ce club n'est plus disponible",
      'Indisponible',
    ]));
    expect(textes).not.toContain('Aubagne Handball');
    expect(bouton.props.disabled).toBe(true);
    act(() => bouton.props.onPress());
    expect(onPressClub).not.toHaveBeenCalled();
  });

  it('une panne qui n\'est pas un 404 garde la carte écrite par le serveur', () => {
    mockErreurDeLecture = { response: { status: 500 } };
    expect(monterLaBulle(jest.fn()).textes).toContain('Aubagne Handball');
  });
});

describe('ASSISTANCE-CLUB · l\'envoi', () => {
  it('la composition ne porte que l\'identifiant et le nom ; le texte est « Club : <nom> »', () => {
    const club = { documentId: ' club-aubagne ', logo: 'x', name: 'Aubagne Handball' };
    expect(compositionDuClubPartage(club)).toEqual({
      clubDocumentId: 'club-aubagne',
      clubName: 'Aubagne Handball',
      type: 'club_share',
    });
    expect(texteDuClubPartage(traduire, 'Aubagne Handball')).toBe('Club : Aubagne Handball');
  });

  it('le sélecteur : rien sous 2 lettres, ni omnisport, ni doublon', () => {
    const lireLaPage = (page) => page.items;
    const items = [
      { documentId: 'c1', name: 'Aubagne Handball' },
      { _type: 'multisport', documentId: 'm1', name: 'Omnisport Aubagne' },
      { documentId: 'c1', name: 'Aubagne Handball' },
      { documentId: 'c2', name: 'Aubagne Basket' },
    ];
    const pages = [{ items }];
    expect(clubsAProposer('a', pages, lireLaPage)).toEqual([]);
    const proposes = clubsAProposer('aub', pages, lireLaPage).map((club) => club.documentId);
    expect(proposes).toEqual(['c1', 'c2']);
  });

  it('l\'aperçu de la liste et la citation nomment le club', () => {
    expect(getChatMessagePreview({ composition: CARTE, message: '' }, traduire))
      .toBe('Club : Aubagne Handball');
    expect(extraitDuMessageCite({ composition: CARTE }, traduire))
      .toEqual({ icone: 'users', texte: 'Aubagne Handball' });
  });
});

describe('ASSISTANCE-CLUB · le branchement (téléphone et site)', () => {
  it('la route du sélecteur existe, sur le téléphone et sur le site', () => {
    expect(RouteNames.ConversationClubPicker).toBe('ConversationClubPicker');
    expect(WEB_ROUTE_PATTERNS[RouteNames.ConversationClubPicker]).toBe('/messages/:chatId/clubs');
    expect(lire('navigation/private/PrivateNavigator.js')).toMatch(
      /ConversationClubPicker'\)\.default\}\s*name=\{RouteNames\.ConversationClubPicker\}/,
    );
  });

  it('le « + » du téléphone : entrée « club », carte rendue, non modifiable', () => {
    const source = lire('views/Conversation.js');
    expect(source).toMatch(/key: 'club',\s*label: t\('conversation\.attachments\.club', 'Club'\)/);
    expect(source).toMatch(/case 'club':[\s\S]{0,160}ConversationClubPicker, \{ chatId \}/);
    expect(source).toMatch(/composition\.type === 'club_share'[\s\S]{0,200}<ClubShareBubble/);
    expect(source).toMatch(/NON_EDITABLE_MESSAGE_COMPOSITION_TYPES = new Set\(\[\s*'club_share',/);
    expect(source).toMatch(/route\?\.params\?\.sharedClubFromPicker/);
  });

  it('le menu « Ajouter » du site : entrée « club », carte rendue, non modifiable', () => {
    const source = lire('views/Conversation.web.js');
    expect(source).toMatch(/ConversationClubPicker, \{ chatId \}[\s\S]{0,60}cle: 'club'/);
    expect(source).toMatch(/composition\.type === 'club_share'[\s\S]{0,120}<ClubShareBubble/);
    expect(source).toMatch(/route\?\.params\?\.sharedClubFromPicker/);
    expect(lire('views/conversationWeb/filDuSite.js'))
      .toMatch(/TYPES_NON_MODIFIABLES = new Set\(\[\s*'club_share',/);
  });

  it('l\'icône « club » est dessinée (pas le rond par défaut)', () => {
    const icones = lire('components/organisms/chatAttachmentSheet/ChatAttachmentActionIcon.js');
    expect(icones).toMatch(/case 'club':/);
  });
});
