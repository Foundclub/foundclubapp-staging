import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useSearchClubs } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useCreateHistory, useDeleteHistory, useUpdateHistory } from '@/services/userHistory/userHistoryQueries';

const searchIcon = require('@/assets/icons/search.png');

/**
 * @typedef {{
 *  documentId?: string;
 *  club?: Club | null;
 *  customClubName?: string | null;
 *  category?: Category | null;
 *  level?: Level | null;
 *  startYear?: number;
 *  endYear?: number | null;
 *  isCurrentlyActive?: boolean;
 * }} HistoryEntry
 */

/**
 * AddHistoryModal - Modal form to add/edit a sports history entry
 * @param {{ visible: boolean; onClose: () => void; editingEntry?: HistoryEntry | null }} props
 */
function AddHistoryModal({ editingEntry = null, onClose, visible }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Form state
  const [clubSearch, setClubSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState(/** @type {Club | null} */ (null));
  const [useCustomClub, setUseCustomClub] = useState(false);
  const [customClubName, setCustomClubName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(/** @type {Category | null} */ (null));
  const [selectedLevel, setSelectedLevel] = useState(/** @type {Level | null} */ (null));
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [isCurrentlyActive, setIsCurrentlyActive] = useState(false);

  // Queries
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();
  const { data: clubResults, isLoading: searchingClubs } = useSearchClubs(clubSearch, { enabled: clubSearch.length >= 2 && !useCustomClub });
  const clubs = clubResults ?? [];

  // Mutations
  const createHistoryMutation = useCreateHistory();
  const updateHistoryMutation = useUpdateHistory();
  const deleteHistoryMutation = useDeleteHistory();

  const isEditing = !!editingEntry;

  // Initialize form with editing entry
  useEffect(() => {
    if (editingEntry) {
      if (editingEntry.club) {
        setSelectedClub(editingEntry.club);
        setUseCustomClub(false);
      } else if (editingEntry.customClubName) {
        setCustomClubName(editingEntry.customClubName);
        setUseCustomClub(true);
      }
      setSelectedCategory(editingEntry.category || null);
      setSelectedLevel(editingEntry.level || null);
      setStartYear(editingEntry.startYear || new Date().getFullYear());
      setEndYear(editingEntry.endYear || new Date().getFullYear());
      setIsCurrentlyActive(editingEntry.isCurrentlyActive || false);
    } else {
      resetForm();
    }
  }, [editingEntry, visible]);

  const resetForm = () => {
    setClubSearch('');
    setSelectedClub(null);
    setUseCustomClub(false);
    setCustomClubName('');
    setSelectedCategory(null);
    setSelectedLevel(null);
    setStartYear(new Date().getFullYear());
    setEndYear(new Date().getFullYear());
    setIsCurrentlyActive(false);
  };

  // Generate year options
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1970; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const handleSubmit = () => {
    const data = {
      category: selectedCategory?.documentId || null,
      club: selectedClub?.documentId || null,
      customClubName: useCustomClub ? customClubName : null,
      endYear: isCurrentlyActive ? null : endYear,
      isCurrentlyActive,
      level: selectedLevel?.documentId || null,
      startYear,
    };

    if (isEditing) {
      updateHistoryMutation.mutate(
        { data, id: editingEntry.documentId },
        { onSuccess: () => { onClose(); } },
      );
    } else {
      createHistoryMutation.mutate(data, {
        onSuccess: () => { onClose(); },
      });
    }
  };

  const handleDelete = () => {
    if (editingEntry) {
      deleteHistoryMutation.mutate(editingEntry.documentId, {
        onSuccess: () => { onClose(); },
      });
    }
  };

  const isValid = Boolean((selectedClub || (useCustomClub && customClubName.trim())) && startYear);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        flex: 1,
        justifyContent: 'flex-end',
      }}
      >
        <View style={{
          backgroundColor: Colors.neutral900,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
        }}
        >
          {/* Header */}
          <View style={[
            Spaces.padding[16],
            Alignments.row,
            Alignments.justifySpaceBetween,
            Alignments.alignCenter,
            { borderBottomColor: Colors.neutral700, borderBottomWidth: 1 },
          ]}
          >
            <TouchableOpacity onPress={onClose}>
              <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Annuler</Text>
            </TouchableOpacity>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
              {isEditing ? 'Modifier' : 'Ajouter une expérience'}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView contentContainerStyle={[{ rowGap: 20 }]} style={[Spaces.padding[16]]}>
            {/* Club Selection */}
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Club</Text>

              {!useCustomClub ? (
                <>
                  {/* Club search */}
                  <View style={{
                    alignItems: 'center',
                    backgroundColor: Colors.neutral800,
                    borderColor: Colors.neutral700,
                    borderRadius: 12,
                    borderWidth: 1,
                    flexDirection: 'row',
                    paddingHorizontal: 12,
                  }}
                  >
                    <Image
                      source={/** @type {any} */ (searchIcon)}
                      style={{
                        height: 20, marginRight: 8, tintColor: Colors.neutral500, width: 20,
                      }}
                    />
                    <TextInput
                      onChangeText={(text) => {
                        setClubSearch(text);
                        setSelectedClub(null);
                      }}
                      placeholder="Rechercher un club..."
                      placeholderTextColor={Colors.neutral500}
                      style={[Fonts.p1, { color: Colors.neutral00, flex: 1, paddingVertical: 14 }]}
                      value={selectedClub?.name || clubSearch}
                    />
                    {searchingClubs && <ActivityIndicator color={Colors.primary500} size="small" />}
                  </View>

                  {/* Club results */}
                  {clubSearch.length >= 2 && !selectedClub && clubs.length > 0 && (
                    <View style={{ backgroundColor: Colors.neutral800, borderRadius: 8, maxHeight: 150 }}>
                      <ScrollView nestedScrollEnabled>
                        {clubs.slice(0, 5).map((club) => (
                          <TouchableOpacity
                            key={club.documentId}
                            onPress={() => {
                              setSelectedClub(club);
                              setClubSearch('');
                            }}
                            style={[Spaces.padding[12], { borderBottomColor: Colors.neutral700, borderBottomWidth: 1 }]}
                          >
                            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{club.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Club not found option */}
                  <TouchableOpacity onPress={() => setUseCustomClub(true)}>
                    <Text style={[Fonts.p2, { color: Colors.primary500 }]}>
                      Club non trouvé ? Saisir manuellement
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Custom club name input */}
                  <TextInput
                    onChangeText={setCustomClubName}
                    placeholder="Nom du club..."
                    placeholderTextColor={Colors.neutral500}
                    style={[
                      Fonts.p1,
                      { padding: 14 },
                      {
                        backgroundColor: Colors.neutral800,
                        borderColor: Colors.neutral700,
                        borderRadius: 12,
                        borderWidth: 1,
                        color: Colors.neutral00,
                      },
                    ]}
                    value={customClubName}
                  />
                  <TouchableOpacity onPress={() => { setUseCustomClub(false); setCustomClubName(''); }}>
                    <Text style={[Fonts.p2, { color: Colors.primary500 }]}>
                      Rechercher dans les clubs existants
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Category Selection */}
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[Alignments.row, Spaces.gap[8]]}>
                  {categories?.map((/** @type {Category} */ cat) => (
                    <TouchableOpacity
                      key={cat.documentId}
                      onPress={() => setSelectedCategory(cat)}
                      style={{
                        backgroundColor: selectedCategory?.documentId === cat.documentId ? Colors.primary500 : Colors.neutral800,
                        borderColor: selectedCategory?.documentId === cat.documentId ? Colors.primary500 : Colors.neutral700,
                        borderRadius: 20,
                        borderWidth: 1,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={[Fonts.p2, { color: selectedCategory?.documentId === cat.documentId ? '#FFF' : Colors.neutral300 }]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Level Selection */}
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Niveau</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[Alignments.row, Spaces.gap[8]]}>
                  {levels?.map((/** @type {Level} */ lvl) => (
                    <TouchableOpacity
                      key={lvl.documentId}
                      onPress={() => setSelectedLevel(lvl)}
                      style={{
                        backgroundColor: selectedLevel?.documentId === lvl.documentId ? Colors.primary500 : Colors.neutral800,
                        borderColor: selectedLevel?.documentId === lvl.documentId ? Colors.primary500 : Colors.neutral700,
                        borderRadius: 20,
                        borderWidth: 1,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={[Fonts.p2, { color: selectedLevel?.documentId === lvl.documentId ? '#FFF' : Colors.neutral300 }]}>
                        {lvl.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Year Selection */}
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Période</Text>
              <View style={[Alignments.row, Spaces.gap[16]]}>
                {/* Start Year */}
                <View style={[Alignments.fill]}>
                  <Text style={[Fonts.p3, { color: Colors.neutral500, marginBottom: 4 }]}>Début</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      {yearOptions.slice(0, 15).map((y) => (
                        <TouchableOpacity
                          key={`start-${y}`}
                          onPress={() => setStartYear(y)}
                          style={{
                            backgroundColor: startYear === y ? Colors.primary500 : Colors.neutral800,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={[Fonts.p2, { color: startYear === y ? '#FFF' : Colors.neutral300 }]}>{y}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* End Year / Currently Active */}
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], Spaces.marginTop[8]]}>
                <Switch
                  onValueChange={setIsCurrentlyActive}
                  thumbColor="#FFF"
                  trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
                  value={isCurrentlyActive}
                />
                <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>J'y suis toujours</Text>
              </View>

              {!isCurrentlyActive && (
                <View style={[Spaces.marginTop[8]]}>
                  <Text style={[Fonts.p3, { color: Colors.neutral500, marginBottom: 4 }]}>Fin</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      {yearOptions.filter((y) => y >= startYear).slice(0, 15).map((y) => (
                        <TouchableOpacity
                          key={`end-${y}`}
                          onPress={() => setEndYear(y)}
                          style={{
                            backgroundColor: endYear === y ? Colors.primary500 : Colors.neutral800,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={[Fonts.p2, { color: endYear === y ? '#FFF' : Colors.neutral300 }]}>{y}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Warning Declaration */}
            <View style={{
              backgroundColor: Colors.neutral800,
              borderLeftColor: '#F59E0B',
              borderLeftWidth: 4,
              borderRadius: 12,
              padding: 16,
            }}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                ⚠️
                {' '}
                <Text style={{ fontWeight: 'bold' }}>Déclaration sur l'honneur :</Text>
                {' '}
                Les informations saisies doivent être exactes. Tout historique peut être vérifié par la communauté et signalé en cas de fausse déclaration.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
              <Button
                disabled={!isValid}
                isLoading={createHistoryMutation.isPending || updateHistoryMutation.isPending}
                onPress={handleSubmit}
                title={isEditing ? 'Enregistrer les modifications' : 'Ajouter à mon parcours'}
                variant="Primary"
              />

              {isEditing && (
                <Button
                  isLoading={deleteHistoryMutation.isPending}
                  onPress={handleDelete}
                  title="Supprimer cette expérience"
                  variant="SecondaryLight"
                />
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default AddHistoryModal;
