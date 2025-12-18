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
import { useGetLevels } from '@/services/level/levelQueries';
import { useSearchClubs } from '@/services/club/clubQueries';
import { useCreateHistory, useUpdateHistory, useDeleteHistory } from '@/services/userHistory/userHistoryQueries';

const searchIcon = require('@/assets/icons/search.png');

/**
 * AddHistoryModal - Modal form to add/edit a sports history entry
 * @param {object} props
 * @param {boolean} props.visible - Whether modal is visible
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {object} props.editingEntry - Entry being edited (null for new)
 */
function AddHistoryModal({ visible, onClose, editingEntry = null }) {
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Form state
  const [clubSearch, setClubSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState(null);
  const [useCustomClub, setUseCustomClub] = useState(false);
  const [customClubName, setCustomClubName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [isCurrentlyActive, setIsCurrentlyActive] = useState(false);

  // Queries
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();
  const { data: clubResults, isLoading: searchingClubs } = useSearchClubs(clubSearch, { enabled: clubSearch.length >= 2 && !useCustomClub });

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
      setSelectedCategory(editingEntry.category);
      setSelectedLevel(editingEntry.level);
      setStartYear(editingEntry.startYear);
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
      club: selectedClub?.documentId || null,
      customClubName: useCustomClub ? customClubName : null,
      category: selectedCategory?.documentId || null,
      level: selectedLevel?.documentId || null,
      startYear,
      endYear: isCurrentlyActive ? null : endYear,
      isCurrentlyActive,
    };

    if (isEditing) {
      updateHistoryMutation.mutate(
        { id: editingEntry.documentId, data },
        { onSuccess: () => { onClose(); } }
      );
    } else {
      createHistoryMutation.mutate(data, {
        onSuccess: () => { onClose(); }
      });
    }
  };

  const handleDelete = () => {
    if (editingEntry) {
      deleteHistoryMutation.mutate(editingEntry.documentId, {
        onSuccess: () => { onClose(); }
      });
    }
  };

  const isValid = (selectedClub || (useCustomClub && customClubName)) && startYear;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: Colors.neutral900,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
        }}>
          {/* Header */}
          <View style={[
            Spaces.padding[16],
            Alignments.row,
            Alignments.justifySpaceBetween,
            Alignments.alignCenter,
            { borderBottomWidth: 1, borderBottomColor: Colors.neutral700 }
          ]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Annuler</Text>
            </TouchableOpacity>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
              {isEditing ? 'Modifier' : 'Ajouter une expérience'}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={[Spaces.padding[16]]} contentContainerStyle={[Spaces.gap[20]]}>
            {/* Club Selection */}
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Club</Text>
              
              {!useCustomClub ? (
                <>
                  {/* Club search */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: Colors.neutral800,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: Colors.neutral700,
                    paddingHorizontal: 12,
                  }}>
                    <Image source={searchIcon} style={{ width: 20, height: 20, tintColor: Colors.neutral500, marginRight: 8 }} />
                    <TextInput
                      value={selectedClub ? selectedClub.name : clubSearch}
                      onChangeText={(text) => {
                        setClubSearch(text);
                        setSelectedClub(null);
                      }}
                      placeholder="Rechercher un club..."
                      placeholderTextColor={Colors.neutral500}
                      style={[Fonts.p1, { flex: 1, color: Colors.neutral00, paddingVertical: 14 }]}
                    />
                    {searchingClubs && <ActivityIndicator size="small" color={Colors.primary500} />}
                  </View>

                  {/* Club results */}
                  {clubSearch.length >= 2 && !selectedClub && clubResults?.length > 0 && (
                    <View style={{ backgroundColor: Colors.neutral800, borderRadius: 8, maxHeight: 150 }}>
                      <ScrollView nestedScrollEnabled>
                        {clubResults.slice(0, 5).map((club) => (
                          <TouchableOpacity
                            key={club.documentId}
                            onPress={() => {
                              setSelectedClub(club);
                              setClubSearch('');
                            }}
                            style={[Spaces.padding[12], { borderBottomWidth: 1, borderBottomColor: Colors.neutral700 }]}
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
                    value={customClubName}
                    onChangeText={setCustomClubName}
                    placeholder="Nom du club..."
                    placeholderTextColor={Colors.neutral500}
                    style={[
                      Fonts.p1,
                      Spaces.padding[14],
                      {
                        backgroundColor: Colors.neutral800,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: Colors.neutral700,
                        color: Colors.neutral00,
                      }
                    ]}
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
                  {categories?.map((cat) => (
                    <TouchableOpacity
                      key={cat.documentId}
                      onPress={() => setSelectedCategory(cat)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                        backgroundColor: selectedCategory?.documentId === cat.documentId ? Colors.primary500 : Colors.neutral800,
                        borderWidth: 1,
                        borderColor: selectedCategory?.documentId === cat.documentId ? Colors.primary500 : Colors.neutral700,
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
                  {levels?.map((lvl) => (
                    <TouchableOpacity
                      key={lvl.documentId}
                      onPress={() => setSelectedLevel(lvl)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                        backgroundColor: selectedLevel?.documentId === lvl.documentId ? Colors.primary500 : Colors.neutral800,
                        borderWidth: 1,
                        borderColor: selectedLevel?.documentId === lvl.documentId ? Colors.primary500 : Colors.neutral700,
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
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: startYear === y ? Colors.primary500 : Colors.neutral800,
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
                  value={isCurrentlyActive}
                  onValueChange={setIsCurrentlyActive}
                  trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
                  thumbColor="#FFF"
                />
                <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>J'y suis toujours</Text>
              </View>

              {!isCurrentlyActive && (
                <View style={[Spaces.marginTop[8]]}>
                  <Text style={[Fonts.p3, { color: Colors.neutral500, marginBottom: 4 }]}>Fin</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      {yearOptions.filter(y => y >= startYear).slice(0, 15).map((y) => (
                        <TouchableOpacity
                          key={`end-${y}`}
                          onPress={() => setEndYear(y)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: endYear === y ? Colors.primary500 : Colors.neutral800,
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
              borderRadius: 12,
              borderLeftWidth: 4,
              borderLeftColor: '#F59E0B',
              padding: 16,
            }}>
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                ⚠️ <Text style={{ fontWeight: 'bold' }}>Déclaration sur l'honneur :</Text> Les informations saisies doivent être exactes. Tout historique peut être vérifié par la communauté et signalé en cas de fausse déclaration.
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
                  variant="Destructive"
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
