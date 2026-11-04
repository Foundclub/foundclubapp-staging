import fs from 'node:fs';
import path from 'node:path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { mapClubInterestRequestToHubItem } from '@/domains/requests/requestMappers';

import RequestFeedItem from '@/components/molecules/requestFeedItem/RequestFeedItem';

import InterestConversationSheet from '../InterestConversationSheet';

// T4-PARENT-RETOURS (04/11/2026, Adel « 20- A », registre des mineurs, ligne 56) — le club parle au
// parent AVANT de décider : la carte garde Accepter et Refuser, et gagne
// « Ouvrir une conversation ».
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => () => null);
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function Bouton({ onPress, title }) {
    return <Texte onPress={onPress}>{title}</Texte>;
  };
});
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: () => ({ data: { trainers: [] }, isError: false, isLoading: false }),
}));

const PLACE = {
  actions: { primary: 'accept', secondary: 'reject', tertiary: 'chat' },
  createdAt: '2026-11-03T12:29:00.000Z',
  id: 'interest:demande',
  meta: {
    childAge: 12,
    childFirstname: 'Farid',
    childId: 'farid',
    requesterId: 'parent',
    requesterName: 'Yolaine Bard',
    requestId: 'demande',
    teamId: 'u11',
    teamName: 'U11',
  },
  status: 'pending',
  subtitle: 'Demande une place dans U11.',
  title: 'Farid, 12 ans',
  type: 'interest',
};

const monter = (element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre;
};
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((noeud) => [].concat(noeud.props.children).join(''));

test('la demande pour un enfant propose la conversation, en plus des deux décisions', () => {
  const ligne = mapClubInterestRequestToHubItem({
    club: { documentId: 'club-1', name: 'FoundClub' },
    createdAt: '2026-11-03T12:29:00.000Z',
    declaredChild: { age: 12, documentId: 'farid', firstname: 'Farid' },
    documentId: 'demande',
    status: 'pending',
    team: { documentId: 'u11', name: 'U11' },
    user: { documentId: 'parent', firstname: 'Yolaine', lastname: 'Bard' },
  });
  expect(ligne.actions).toEqual({ primary: 'accept', secondary: 'reject', tertiary: 'chat' });
});

test('la carte montre le bouton, qui ouvre la feuille sans trancher', () => {
  const onChatPress = jest.fn();
  const onPrimaryPress = jest.fn();
  const arbre = monter(
    <RequestFeedItem item={PLACE} onChatPress={onChatPress} onPrimaryPress={onPrimaryPress} />,
  );
  const bouton = arbre.root.findAllByType(Text)
    .find((noeud) => noeud.props.children === 'Ouvrir une conversation');
  expect(bouton).toBeTruthy();
  act(() => bouton.props.onPress());
  expect(onChatPress).toHaveBeenCalledWith(PLACE);
  expect(onPrimaryPress).not.toHaveBeenCalled();
});

test('une carte d adulte ne reçoit pas de troisième bouton', () => {
  const arbre = monter(
    <RequestFeedItem
      item={{
        ...PLACE,
        actions: { primary: 'chat', secondary: 'respond' },
        meta: { requesterId: 'parent', requesterName: 'Yolaine Bard', requestId: 'demande' },
      }}
    />,
  );
  expect(textes(arbre).filter((texte) => texte === 'Ouvrir une conversation')).toHaveLength(1);
});

test('la feuille nomme l enfant et dit qu il n entre pas dans le fil', () => {
  const arbre = monter(
    <InterestConversationSheet item={PLACE} onCancel={jest.fn()} onConfirm={jest.fn()} />,
  );
  const lu = textes(arbre).join(' | ');
  // La doublure de `t` rend le texte sans ses variables : le prénom se lit dans fr.js.
  expect(lu).toContain('{{name}} · place pour {{child}}');
  expect(lu).toContain('{{child}} n’entre pas dans ce fil');
});

test('ouvrir le fil d une demande pour un enfant laisse sa carte dans la liste', () => {
  const ecran = fs.readFileSync(path.join(__dirname, '..', 'RequestsHub.js'), 'utf8');
  expect(ecran).toMatch(/if \(!item\?\.meta\?\.childId\) \{\s+setSettledItemIds/);
  expect(ecran).toContain('onChatPress={setConversationItem}');
});
