import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// GUIDES-SITE-CORR S17 (tournée du site, 09/11) : au bonus 2, le canal d'exemple du guide
// (`tourExample: 'canal'`) s'ouvre comme au téléphone (`TourCanalExemple`, ses ancres `ch-info` et
// `ch-input`) ; le fil du site l'ouvrait comme un vrai fil, sans ancre, et ses requêtes partaient.

jest.mock('@/components/molecules/tour/TourCanalExemple', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ clubName }) => <Texte>{`canal d exemple ${clubName}`}</Texte>,
  };
});

// Le module du fil charge ses services : aucun ne doit partir (l'aiguillage passe AVANT).
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/services/chat/chatService', () => ({}));
jest.mock('@/services/league/leagueMatchService', () => ({}));
jest.mock('@/services/messageReport/messageReportService', () => ({}));
jest.mock('@/services/event/eventService', () => ({}));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: {} }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: {} }));
jest.mock('@/store/authRuntime', () => ({ getAuthRuntimeSnapshot: () => ({ auth: {} }) }));
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/domains/messaging/useMessaging', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/services/chat/chatQueriesCompat', () => ({}));
jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({}));
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({}));
jest.mock('@/services/userBlock/userBlockQueries', () => ({}));
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
jest.mock('@/views/conversationConvocation/ConvocationWizard', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => () => null);
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

// eslint-disable-next-line import/first
import Conversation from '../Conversation.web';

test('le canal d exemple du guide s ouvre sans le vrai fil', () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <Conversation
        navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { chatId: 'tour-example-canal', clubName: 'CR-T5', tourExample: 'canal' } }}
      />,
    );
  });
  const textes = arbre.root.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
  expect(textes).toEqual(['canal d exemple CR-T5']);
  act(() => { arbre.unmount(); });
});
