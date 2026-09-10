// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';

import {
  useDeleteDeclaredChild,
  useGetMyDeclaredChildren,
} from '@/services/declaredChild/declaredChildQueries';

import { parentalPowerForAge } from '@/constants/parentalDeclaration';

/**
 * PARENT P2 — ÉCRAN 7 : « MES ENFANTS ».
 *
 * 🧒 POURQUOI CET ÉCRAN EXISTE. Un enfant de moins de 13 ans n'a pas de compte —
 * le serveur le refuse (palier 13). Il vit donc comme une FICHE portée par le
 * compte de son parent, et c'est ici que le parent la crée, la corrige, et
 * l'efface. C'est le seul endroit, pour le 1er enfant comme pour le 3ᵉ.
 *
 * 🔒 LES TROIS TRANCHES D'ÂGE SE VOIENT ICI (E17, tranché par Adel le 07/09) —
 * et l'écran EXPLIQUE au lieu de faire disparaître un bouton sans un mot :
 *   · moins de 13 ans → « Chercher un club pour Léa » ;
 *   · 13 à 17 ans     → l'ado fait ses demandes lui-même ;
 *   · 18 ans et plus  → le lien parental s'éteint, c'est la loi.
 * Le pouvoir se CALCULE à partir de l'âge rendu par le serveur : rien n'est
 * stocké, donc rien ne peut être en retard le jour d'un anniversaire.
 *
 * ⛔ CE QUE CET ÉCRAN NE MONTRE PAS, et c'est voulu : la date de naissance. Le
 * serveur ne la rend jamais — il rend un âge calculé, exactement comme le profil
 * public d'un compte.
 * @returns {import('react').ReactElement} L'écran.
 */
function MyChildren() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const {
    data: enfantsBruts,
    error: erreurEnfants,
    isLoading: chargementEnfants,
  } = useGetMyDeclaredChildren();
  const { isPending: suppressionEnCours, mutate: supprimerEnfant } = useDeleteDeclaredChild();

  const enfants = Array.isArray(enfantsBruts) ? enfantsBruts : [];

  const ouvrirFormulaire = useCallback((enfant) => {
    navigation.navigate(RouteNames.ChildEdit, enfant
      ? { childDocumentId: enfant.documentId }
      : undefined);
  }, [navigation]);

  const chercherUnClub = useCallback((enfant) => {
    // On emmène l'enfant visé jusqu'à la recherche : la fiche du club en a
    // besoin pour proposer « demander à rejoindre au nom de Léa » plutôt qu'un
    // bouton anonyme.
    // ⚠️ La recherche vit dans `SearchStack`, deux niveaux plus bas que cet
    // ecran : un nom nu remonterait vers les PARENTS, il ne descend jamais chez
    // un voisin. `allerDansLOnglet` ecrit ce chemin UNE fois (defaut du 08/09,
    // cinq navigations mortes de la meme facon).
    allerDansLOnglet(navigation, RouteNames.SearchClubs, {
      childDocumentId: enfant?.documentId,
      childFirstname: enfant?.firstname,
    });
  }, [navigation]);

  const demanderSuppression = useCallback((enfant) => {
    const prenom = enfant?.firstname || '';
    Alert.alert(
      t('myChildren.confirmDelete.title', 'Supprimer cette fiche ?', { firstname: prenom }),
      t('myChildren.confirmDelete.message', 'Cette fiche sera effacée.', { firstname: prenom }),
      [
        { style: 'cancel', text: t('myChildren.confirmDelete.cancel', 'Annuler') },
        {
          onPress: () => supprimerEnfant(enfant?.documentId, {
            onError: () => Alert.alert(
              t('common.error', 'Erreur'),
              t('myChildren.errors.delete', 'Impossible de supprimer cette fiche pour le moment.'),
            ),
          }),
          style: 'destructive',
          text: t('myChildren.confirmDelete.confirm', 'Supprimer'),
        },
      ],
    );
  }, [supprimerEnfant, t]);

  const carteStyle = [
    ApplicationStyle.card,
    Spaces.padding[16],
    {
      backgroundColor: `${Colors.primary700}73`,
      borderColor: `${Colors.primary500}80`,
      gap: 12,
    },
  ];

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <View style={[Alignments.alignCenter, { gap: 8 }]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { letterSpacing: 1 }]}>
          {t('myChildren.screen.title', 'Mes enfants').toUpperCase()}
        </Text>
        <View style={{ backgroundColor: Colors.neutral00, height: 2, width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'myChildren.screen.hint',
            'Tu déclares tes enfants depuis TON compte :'
            + ' avant 13 ans, ils n’ont pas de compte à eux.',
          )}
        </Text>

        <WithDataWrapper error={erreurEnfants?.message} isLoading={chargementEnfants}>
          {enfants.length === 0 ? (
            <View style={[Spaces.marginTop[12], { gap: 16 }]}>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t('myChildren.screen.empty', 'Tu n’as pas encore déclaré d’enfant.')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'myChildren.screen.emptyHint',
                  'Déclare-le ici, puis cherche-lui un club.',
                )}
              </Text>
              <Button
                onPress={() => ouvrirFormulaire(null)}
                title={t('myChildren.actions.add', 'Ajouter un enfant')}
              />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {/* ⚠️ Pluriel : la clef porte « _one » / « _other » et l'appel
                  DOIT passer `count` — sans lui, i18next rend toujours le
                  singulier (piège maison, « cle_plural » est morte depuis
                  i18next 21). */}
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'myChildren.screen.count',
                  '{{count}} enfants déclarés',
                  { count: enfants.length },
                )}
              </Text>

              {enfants.map((enfant) => {
                const prenom = enfant?.firstname || '';
                const nomComplet = `${prenom} ${enfant?.lastname || ''}`.trim();
                const pouvoir = parentalPowerForAge(enfant?.age);
                const aUnAge = typeof enfant?.age === 'number';

                return (
                  <View key={enfant?.documentId} style={carteStyle}>
                    <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
                      <ProfileAvatar
                        enablePreview={false}
                        imageUrl={enfant?.photo?.url}
                        name={nomComplet}
                        size={44}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                          {nomComplet}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {aUnAge
                            ? t('myChildren.screen.years', '{{count}} ans', { count: enfant.age })
                            : ''}
                          {aUnAge ? ' · ' : ''}
                          {enfant?.team?.name
                            || t('myChildren.screen.noTeam', 'Pas encore d’équipe')}
                        </Text>
                      </View>
                    </View>

                    {/* 🔒 E17 — la SEULE tranche où le parent agit encore. */}
                    {pouvoir === 'full' ? (
                      <TouchableOpacity onPress={() => chercherUnClub(enfant)}>
                        <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
                          {t(
                            'myChildren.actions.searchClub',
                            'Chercher un club pour {{firstname}}',
                            { firstname: prenom },
                          )}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* On EXPLIQUE l'absence du bouton, on ne la subit pas. */}
                    {pouvoir === 'view' ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'myChildren.screen.tooOldHint',
                          'À partir de 13 ans, {{firstname}} fait ses demandes lui-même.',
                          { firstname: prenom },
                        )}
                      </Text>
                    ) : null}
                    {pouvoir === 'none' ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'myChildren.screen.adultHint',
                          '{{firstname}} est majeur : il gère son compte seul.',
                          { firstname: prenom },
                        )}
                      </Text>
                    ) : null}

                    <View style={[Alignments.row, { gap: 20 }]}>
                      <TouchableOpacity onPress={() => ouvrirFormulaire(enfant)}>
                        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                          {t('myChildren.actions.edit', 'Modifier')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={suppressionEnCours}
                        onPress={() => demanderSuppression(enfant)}
                      >
                        <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
                          {t('myChildren.actions.delete', 'Supprimer')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <Button
                onPress={() => ouvrirFormulaire(null)}
                title={t('myChildren.actions.add', 'Ajouter un enfant')}
              />
            </View>
          )}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyChildren;
