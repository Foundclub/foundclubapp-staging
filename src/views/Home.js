import useNotifications from '@/hooks/useNotifications';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Tag from '@/components/atoms/tag/Tag';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import ClubListContent from '@/components/organisms/clubListContent/ClubListContent';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

const searchOptions = [
  {
    label: i18n.t('home.fields.type.options.event'),
    value: 'events',
  },
  {
    label: i18n.t('home.fields.type.options.club'),
    value: 'clubs',
  },
  // TODO: uncomment or remove (with corresonding components) after found club have accepted
  // {
  //   label: i18n.t('home.fields.type.options.team'),
  //   value: 'teams',
  // },
];

/**
 * Main home screen to search for clubs, team or events
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Home screen component
 */
function Home({ navigation }) {
  const [searchType, setSearchType] = useState(searchOptions[0].value);
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  useNotifications({ navigate: navigation.navigate });

  /**
   * Handle search type change
   * @param {string} value - The new search type value
   */
  const onChange = (value) => {
    setSearchType(value);
  };

  const renderContent = () => {
    switch (searchType) {
      case 'clubs':
        return <ClubListContent />;
      case 'events':
        return (
          <EventListContent
            additionalFilters={{ sessionStatus: 'open' }}
            showFilters
          />
        );
      case 'teams':
        return <TeamListContent showFilters />;
      default:
        return null;
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[
        Spaces.marginTop[16],
        Spaces.marginBottom[24],
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween]}
      >
        <Image source={Images.logo} style={{ height: 23, resizeMode: 'cover', width: 222 }} />
        <ProfileButton />
      </View>

      <View style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[12],
      ]}
      >
        <Text style={[
          Fonts.h4,
          Fonts.neutral00,
        ]}
        >
          {t('home.fields.type.label')}
        </Text>
        <ScrollView
          contentContainerStyle={[Spaces.gap[8]]}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {searchOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                option.value === searchType && ApplicationStyle.backgroundColor.primary500,
                ApplicationStyle.borderRadius8,
              ]}
            >
              <Tag
                text={option.label}
                textColor={option.value === searchType ? 'neutral00' : 'primary500'}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {renderContent()}
    </ScreenContainer>
  );
}

export default Home;
