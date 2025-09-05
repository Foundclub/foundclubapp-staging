import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetTeamMembershipRequests } from '@/services/teamMembershipRequest/teamMembershipRequestQueries';
import {
  acceptTeamMembershipRequest,
  rejectTeamMembershipRequest,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

/**
 * Team membership request list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team membership request list screen component
 */
function TeamMembershipRequestList({ route }) {
  const { teamIds } = route?.params ?? {};

  // hooks
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetTeamMembershipRequests(teamIds, {
    pageSize: 10,
  });

  const acceptRequestMutation = useMutation({
    mutationFn: acceptTeamMembershipRequest,
    onSuccess: () => {
      refetch();
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: rejectTeamMembershipRequest,
    onSuccess: () => {
      refetch();
    },
  });

  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Handle accept request
   * @param {string} requestId
   */
  const handleAcceptRequest = (requestId) => {
    if (requestId) {
      acceptRequestMutation.mutate(requestId);
    }
  };

  /**
   * Handle reject request
   * @param {string} requestId
   */
  const handleRejectRequest = (requestId) => {
    if (requestId) {
      rejectRequestMutation.mutate(requestId);
    }
  };

  /**
   * @type {TeamMembershipRequest[]}
   */
  const requests = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {TeamMembershipRequest[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);

  /**
   * Render the request item
   * @param {object} param
   * @param {TeamMembershipRequest} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => (
    <View
      style={[
        Alignments.alignEnd,
        Alignments.justifySpaceBetween,
        Spaces.gap[12],
        Spaces.padding[24],
        Spaces.marginVertical[12],
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
      ]}
    >
      <Tag
        text={item.team?.name}
      />
      <View
        style={[
          Alignments.row,
          Alignments.fullWidth,
          Alignments.alignCenter,
          Spaces.gap[24],
        ]}
      >
        <Image
          source={item?.user?.avatar?.url
            ? { uri: item?.user?.avatar?.url }
            : Images.roundAvatar}
          style={[
            ApplicationStyle.borderColor.neutral00,
            ApplicationStyle.borderWidth1,
            { borderRadius: 62, height: 62, width: 62 }]}
        />
        {item?.user?.firstname && item?.user?.lastname && (
        <View style={[
          { maxWidth: '70%' },
          Alignments.justifyStart,
          Alignments.alignStart,
          Spaces.gap[4],
        ]}
        >
          <Text
            numberOfLines={2}
            style={[
              Fonts.textCenter,
              Fonts.h4Black,
              Fonts.neutral00]}
          >
            {`${item?.user?.firstname} ${item?.user?.lastname?.toUpperCase()}`}
          </Text>
          <Text
            style={[
              Fonts.textLeft,
              Fonts.p3,
              Fonts.neutral00]}
          >
            {t('teamMembershipRequestList.fields.pending', {
              firstname: item?.user?.firstname,
              teamName: item?.team?.name,
            })}
          </Text>
        </View>
        )}
      </View>
      <View style={[Alignments.row,
        Spaces.gap[12], Spaces.marginTop[12]]}
      >
        <Button
          icon="check"
          isOption
          onPress={() => handleAcceptRequest(item.documentId)}
          title={t('teamMembershipRequestList.actions.accept')}
          variant="Primary"
        />
        <Button
          icon="close"
          isOption
          onPress={() => handleRejectRequest(item.documentId)}
          title={t('teamMembershipRequestList.actions.reject')}
          variant="Secondary"
        />
      </View>
    </View>
  );

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius32,
      Alignments.alignCenter,
      Spaces.gap[32],
      Spaces.paddingHorizontal[12],
      Spaces.paddingVertical[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('teamMembershipRequestList.noData')}
      </Text>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <WithDataWrapper
        error={error?.message}
        isLoading={(isLoading && !isFetchingNextPage)
           || acceptRequestMutation.isPending
            || rejectRequestMutation.isPending}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[
          Alignments.fill,
          ApplicationStyle.borderRadius2,
          { minHeight: 500 }]}
        >
          <FlashList
            contentContainerStyle={{ paddingBottom: 20 }}
            data={requests}
            estimatedItemSize={120}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={renderEmptyList}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetch}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
          />
        </View>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TeamMembershipRequestList;
