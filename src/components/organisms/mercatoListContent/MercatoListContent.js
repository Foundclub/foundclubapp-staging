import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import { searchUsers } from '@/services/user/userService';
import MercatoCard from '@/components/molecules/mercatoCard/MercatoCard';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
import Loader from '@/components/atoms/loader/Loader';


import { useNavigation } from '@react-navigation/native';
import { RouteNames } from '@/navigation/routeNames';

import { useAppContext } from '@/store/appContext';

const MercatoListContent = () => {
    const { t } = useTranslation();
    const { Spaces, Fonts, Alignments } = useTheme();
    const navigation = useNavigation();
    const [{ mercatoFilters }] = useAppContext();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await searchUsers({
                isLookingForClub: true,
                q: searchValue,
                ...mercatoFilters,
            });
            setUsers(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [searchValue, mercatoFilters]);

    const handleCardPress = (user) => {
        navigation.navigate(RouteNames.UserDetails, { userId: user.documentId || user.id });
    };

    const filtersCount = Object.keys(mercatoFilters || {}).filter((key) => {
        const value = mercatoFilters[key];
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object' && value !== null) return !!value.value;
        return !!value;
    }).length;



    return (
        <View style={[Alignments.fill, Spaces.paddingHorizontal[16]]}>
            <View style={[Spaces.marginBottom[16], Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                <View style={{ flex: 1 }}>
                    <SearchComponent
                        filtersCount={filtersCount}
                        handleSearchField={setSearchValue}
                        placeholder="Rechercher un profil..."
                        searchDefaultValue={searchValue}
                        openFilters={() => navigation.navigate(RouteNames.MercatoFilters)}
                    />
                </View>
            </View>
            {loading ? (
                <Loader />
            ) : (
                <FlatList
                    contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[40]]}
                    data={users}
                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                    ListEmptyComponent={(
                        <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }, Spaces.marginTop[24]]}>
                            Aucun profil trouvé
                        </Text>
                    )}
                    renderItem={({ item }) => (
                        <MercatoCard user={item} onPress={handleCardPress} />
                    )}
                />
            )}
        </View>
    );
};

export default MercatoListContent;
