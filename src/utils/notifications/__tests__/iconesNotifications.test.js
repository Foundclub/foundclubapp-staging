import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { getNotificationIcon } from '@/utils/notifications/notificationPresentation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

/**
 * ICÔNES (01/10/2026, « icône go » d'Adel) — l'icône d'une notification, dans la
 * liste (20 px) et dans la fenêtre (16 px), vient de `getNotificationIcon`.
 * SANS-EMOJI y avait mis deux provisoires : l'enveloppe pour un message reçu, le
 * stade pour la League. Ce témoin fixe la bulle et le ballon, et vérifie que
 * TOUS les types de notification donnent une icône qui existe : un nom inconnu
 * ne lève aucune erreur, `SvgIcon` rend un rond vide.
 */

const dessine = (nom) => {
  let arbre;
  const avertir = jest.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => {
    arbre = renderer.create(<SvgIcon name={nom} />);
  });
  avertir.mockRestore();
  return arbre.root.findAllByType(Image).length === 1;
};

describe('ICÔNES — l icône d une notification', () => {
  it.each([
    'NEW_CLUB_MESSAGE', 'NEW_GROUP_MESSAGE', 'NEW_LEAGUE_MATCH_MESSAGE', 'NEW_TEAM_MESSAGE',
    'NEW_WHISPER',
  ])('un message reçu (%s) montre la bulle de discussion', (type) => {
    expect(getNotificationIcon(NOTIFICATION_TYPES[type])).toBe('message-circle');
  });

  it.each([
    'LEAGUE_MATCH_FOUND', 'LEAGUE_PROPOSAL_RECEIVED', 'LEAGUE_SEARCH_STARTED', 'REMATCH_REQUEST',
  ])('la League (%s) montre le ballon', (type) => {
    expect(getNotificationIcon(NOTIFICATION_TYPES[type])).toBe('soccer-ball');
  });

  it('chaque type de notification donne une icône qui se dessine', () => {
    const vides = [...Object.values(NOTIFICATION_TYPES), undefined]
      .filter((type) => !dessine(getNotificationIcon(type)))
      .map((type) => `${type} -> ${getNotificationIcon(type)}`);
    expect(vides).toEqual([]);
  });
});
