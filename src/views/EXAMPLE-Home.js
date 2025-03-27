import { Text, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { FlashList } from '@shopify/flash-list';
// hooks
import useTheme from '../theme/themeContext';
import { useGetCurrentUser } from '../services/EXAMPLE-auth/EXAMPLE-authQueries';
import { useGetTodos } from '../services/EXAMPLE-todos/EXAMPLE-todosQueries';
import { useAuth } from '../domains/EXAMPLE-auth/EXAMPLE-useAuth';
// components
import ScreenContainer from '../components/templates/ScreenContainer';
import Button from '../components/atoms/EXAMPLE-button/EXAMPLE-Button';
import Header from '../components/molecules/EXAMPLE-homeHeader/EXAMPLE-Header';
import WithDataWrapper from '../components/molecules/withDataWrapper/WithDataWrapper';

/**
 * Home screen component.
 * @returns {import('react').ReactElement}
 */
function Home() {
  // hooks
  const {
    Alignments, Fonts, Spaces, ApplicationStyle,
  } = useTheme();
  const getMe = useGetCurrentUser();
  const todoListResult = useGetTodos();
  const { logout } = useAuth();

  /**
   * Render a single todo item
   * @param {object} item - The todo item to render
   * @param {Todo} item.item
   * @returns {import('react').ReactElement}
   */
  const renderTodoItem = ({ item }) => (
    <View style={[Spaces.marginVertical[8]]}>
      <BlurView
        style={[
          Spaces.padding[12],
          ApplicationStyle.borderRadius8,
          Alignments.fullSize,
          Alignments.absolute,
        ]}
        blurType="light"
        blurAmount={5}
      />
      <View style={[Spaces.padding[12]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutralFFF]}>
          👊
          {'  '}
          {item.todo}
        </Text>
      </View>
    </View>
  );

  const renderEmptyList = () => (
    <View style={[
      Alignments.alignCenter,
      Alignments.justifyCenter,
      Alignments.fullSize,
      Spaces.paddingVertical[24],
      ApplicationStyle.backgroundColor.primaryDarkBlue,
    ]}
    >
      <Text style={[Fonts.p1, Fonts.neutralFFF]}>
        No todos yet
      </Text>
    </View>
  );

  return (
    <ScreenContainer
      style={[Spaces.paddingVertical[24]]}
    >
      <WithDataWrapper
        isLoading={getMe?.isLoading}
        isError={getMe?.isError}
        error={getMe?.error?.message}
      >
        <Header
          userName={getMe?.data?.firstName}
          userImage={getMe?.data?.image}
        />
      </WithDataWrapper>
      <WithDataWrapper
        isLoading={todoListResult?.isLoading}
        isError={todoListResult?.isError}
        error={todoListResult?.error?.message}
        wrapperStyle={[Alignments.fill, Spaces.marginBottom[12]]}
      >
        <FlashList
          data={todoListResult?.data?.todos}
          renderItem={renderTodoItem}
          keyExtractor={(item) => item.id.toString()}
          estimatedItemSize={50}
          contentContainerStyle={Alignments.fill}
          ListEmptyComponent={renderEmptyList}
          refreshing={todoListResult?.isRefetching}
          onRefresh={todoListResult?.refetch}
        />
      </WithDataWrapper>
      <View>
        <Button
          title="Logout"
          variant="PrimaryLight"
          onPress={() => logout()}
        />
      </View>
    </ScreenContainer>
  );
}

export default Home;
