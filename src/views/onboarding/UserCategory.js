import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { categorieDeLaSaison } from '@/domains/category/ageEtCategorie';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingChoiceChip from '@/views/onboarding/components/OnboardingChoiceChip';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';
import OnboardingStickyFooter from '@/views/onboarding/components/OnboardingStickyFooter';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';
import { useGetCategories } from '@/services/category/categoryQueries';
import { getCategorySortKey } from '@/services/category/categoryService';

/**
 * Player categories (age groups)
 */
const CATEGORIES = [
  { label: 'U7', value: 'U7' },
  { label: 'U8', value: 'U8' },
  { label: 'U9', value: 'U9' },
  { label: 'U10', value: 'U10' },
  { label: 'U11', value: 'U11' },
  { label: 'U12', value: 'U12' },
  { label: 'U13', value: 'U13' },
  { label: 'U14', value: 'U14' },
  { label: 'U15', value: 'U15' },
  { label: 'U16', value: 'U16' },
  { label: 'U17', value: 'U17' },
  { label: 'U18', value: 'U18' },
  { label: 'U19', value: 'U19' },
  { label: 'U20', value: 'U20' },
  { label: 'U21', value: 'U21' },
  { label: 'U23', value: 'U23' },
  {
    get label() {
      return i18next.t('userCategory.categories.senior', 'Senior');
    },
    value: 'Senior',
  },
  {
    get label() {
      return i18next.t('userCategory.categories.veteran', 'Vétéran');
    },
    value: 'Vétéran',
  },
];

/**
 * User category selection screen (onboarding step)
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserCategory({ navigation }) {
  const [selectedCategories, setSelectedCategories] = useState(/** @type {string[]} */ ([]));

  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // CORR-INSCRIPTION p17 (décision A + ajout d'Adel « regarde en prod, les catégories sont nommées
  // différemment ») : la liste vient du SERVEUR (« U10 (10 ans) », « Sénior (+18 ans) »), comme
  // dans
  // « Modifier mon profil », déjà rangée U6 → U21 → Sénior. La liste écrite ici ne sert plus que de
  // repli quand le serveur ne répond pas.
  const { data: categoriesDuServeur } = useGetCategories();
  // Une clé stable : l'effet de présélection ne dépend pas de l'identité du tableau rendu.
  const nomsDuServeur = (Array.isArray(categoriesDuServeur) ? categoriesDuServeur : [])
    .map((categorie) => categorie?.name)
    .filter(Boolean)
    .join('|');
  const choix = useMemo(() => (nomsDuServeur
    ? nomsDuServeur.split('|').map((nom) => ({ label: nom, value: nom }))
    : CATEGORIES), [nomsDuServeur]);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert(t('userCategory.alerts.updateError.title', 'Erreur'), error?.message || t(
        'userCategory.alerts.updateError.message',
        'Impossible de mettre à jour ton profil.',
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserCategory) || getPostOnboardingHomeRoute());
    },
  });

  useEffect(() => {
    // CORR-INSCRIPTION p17 : le choix de la liste qui désigne la même catégorie (« Senior », écrit
    // par l'ancienne liste de cet écran, désigne « Sénior (+18 ans) » du serveur).
    const memeCategorie = (/** @type {string} */ valeur) => {
      const cible = getCategorySortKey(valeur);
      return cible.group < 3 ? choix.find((option) => {
        const cle = getCategorySortKey(option.value);
        return cle.group === cible.group && cle.rank === cible.rank;
      }) : undefined;
    };
    const categories = String(userData?.category || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (categories.length) {
      setSelectedCategories(categories.map((valeur) => memeCategorie(valeur)?.value || valeur));
      return;
    }

    // CORR-INSCRIPTION p17 : rien d'enregistré ⇒ la catégorie de son âge est présélectionnée
    // (« Sénior » pour un adulte de 28 ans), une seule, qu'il peut changer.
    const proposee = memeCategorie(categorieDeLaSaison(userData?.birthdate) || '');
    // La liste du serveur peut arriver après la liste de repli : ce qui est déjà coché suit.
    setSelectedCategories((avant) => {
      if (avant.length) return avant.map((valeur) => memeCategorie(valeur)?.value || valeur);
      return proposee ? [proposee.value] : avant;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.category, userData?.birthdate, nomsDuServeur]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description={t(
          'userCategory.loading.description',
          'Nous récupérons ton profil avant de choisir ta catégorie.',
        )}
        isLoading
        title={t('userCategory.loading.title', 'Chargement du profil')}
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel={t('userCategory.loadError.retry', 'Réessayer')}
        description={userDataError?.message || t(
          'userCategory.loadError.message',
          'Impossible de charger ton profil.',
        )}
        onAction={refetchUserData}
        title={t('userCategory.loadError.title', 'Chargement impossible')}
      />
    );
  }

  const toggleCategory = (categoryValue) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryValue)) {
        return prev.filter((c) => c !== categoryValue);
      }
      return [...prev, categoryValue];
    });
  };

  const handleNext = () => {
    if (selectedCategories.length > 0 && userData) {
      updateUserMutation.mutate({ category: selectedCategories.join(', ') });
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserCategory) || getPostOnboardingHomeRoute());
  };

  return (
    <FormScreenContainer
      bgImage="bg2"
      // D31 ⑤ — l'écran pose LUI-MÊME le retrait bas (`marginBottom` ci-dessous).
      // Sans ce mode, le conteneur en ajoutait un SECOND : `insets.bottom` était
      // compté deux fois, soit ~34 pt de vide sous « Passer cette étape ».
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Alignments.fill, Spaces.gap[24]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.category.title', 'Ta catégorie ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.category.subtitle', 'La catégorie d\'âge dans laquelle tu joues cette saison.')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[Spaces.gap[12]]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {/*
            D56 — la grille du pack : des chips de 48 pt qui SE REMPLISSENT de
            cyan quand on les choisit. Avant, la chip choisie combinait un fond
            cyan tres pale, un texte cyan et une coche « ✓ » — trois signaux
            faibles la ou le pack en veut un seul, fort.
          */}
          <View style={[Alignments.row, styles.chipsGrid]}>
            {choix.map((category) => (
              <OnboardingChoiceChip
                checked={selectedCategories.includes(category.value)}
                key={category.value}
                label={category.label}
                multi
                onPress={() => toggleCategory(category.value)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <OnboardingStickyFooter>
        <Button
          disabled={selectedCategories.length === 0}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('common.actions.next', 'Continuer')}
          variant="Primary"
        />
        <OnboardingSkipLink onPress={handleSkip} />
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

const styles = StyleSheet.create({
  // 12 et pas 10 : la rampe `Spaces` n'a PAS de palier 10, et un jeton absent
  // rend `undefined` que React Native ignore en silence.
  chipsGrid: {
    flexWrap: 'wrap',
    gap: 12,
  },
});

export default UserCategory;
