import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Admin Reports screen component
 * @returns {import('react').ReactElement} Admin Reports screen component
 */
function AdminReports() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();

  // Mock data for now as per plan
  const reports = [
    // {
    //     id: '1',
    //     type: 'event',
    //     message: 'Contenu inapproprié',
    //     author: 'Jean Dupont',
    //     date: '2024-12-05',
    //     status: 'pending'
    // }
  ];

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.neutral800,
      ApplicationStyle.borderRadius16,
      Alignments.alignCenter,
      Spaces.padding[32],
      Spaces.marginVertical[24],
    ]}
    >
      <Text style={[Fonts.h2, { fontSize: 40, marginBottom: 16 }]}>👮‍♂️</Text>
      <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
        Aucun signalement à traiter
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral300, Fonts.textCenter, Spaces.marginTop[8]]}>
        Tout est calme pour le moment.
      </Text>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={[
      ApplicationStyle.backgroundColor.neutral800,
      ApplicationStyle.borderRadius16,
      Spaces.padding[16],
      Spaces.marginBottom[12],
    ]}
    >
      <Text style={[Fonts.h4, Fonts.neutral00]}>{item.type === 'event' ? 'Événement' : 'Message'}</Text>
      <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginVertical[8]]}>{item.message}</Text>
      <View style={[Alignments.row, Alignments.justifySpaceBetween]}>
        <Text style={[Fonts.p3, Fonts.neutral400]}>
          Par
          {item.author}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral400]}>{item.date}</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[16]]}>
        <Text style={[Fonts.h1, Fonts.neutral00]}>Signalements</Text>
      </View>

      <View style={[Alignments.fill, Spaces.paddingHorizontal[24]]}>
        <FlashList
          data={reports}
          estimatedItemSize={100}
          ListEmptyComponent={renderEmptyList}
          renderItem={renderItem}
        />
      </View>
    </ScreenContainer>
  );
}

export default AdminReports;
