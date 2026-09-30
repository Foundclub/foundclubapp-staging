// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';
import { navigateOrExplainOnWeb } from '@/navigation/webNavigationGuard';

import {
  useDeleteDeclaredChild,
  useGetMyDeclaredChildren,
} from '@/services/declaredChild/declaredChildQueries';
import {
  useCancelParentLink,
  useParentLinksAsParent,
} from '@/services/parentLink/parentLinkQueries';

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

  // 🔗 PARENT-LIEN — LES COMPTES de mes enfants (13-17 ans) reliés au mien, et mes demandes.
  // Une liste À PART des fiches : une fiche est un enfant SANS compte, déclaré par moi ; un
  // compte relié est un ado qui a ACCEPTÉ le lien depuis le sien.
  const {
    data: liens,
    error: erreurLiens,
    isLoading: chargementLiens,
  } = useParentLinksAsParent();
  const { isPending: annulationEnCours, mutate: annulerDemande } = useCancelParentLink();
  const comptesRelies = Array.isArray(liens?.children) ? liens.children : [];
  const demandesEnvoyees = Array.isArray(liens?.requests) ? liens.requests : [];

  const relierUnCompte = useCallback((enfant) => {
    // Ecran pas encore route sur le site (webRouteExemptions) : le site EXPLIQUE au lieu
    // d atterrir en silence sur l accueil.
    navigateOrExplainOnWeb(navigation, RouteNames.ParentLinkInvite, enfant
      ? { childDocumentId: enfant.documentId, childFirstname: enfant.firstname || '' }
      : undefined);
  }, [navigation]);

  const ouvrirLeProfil = useCallback((compte) => {
    // C'est SUR SON PROFIL que vit « Retours du coach » (lot PARENT-RETOURS).
    navigation.navigate(RouteNames.UserDetails, { userId: compte.documentId });
  }, [navigation]);

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
      t('myChildren.confirmDelete.title', 'Supprimer cette fiche ?', {
        firstname: prenom, ...SANS_ECHAPPEMENT,
      }),
      t('myChildren.confirmDelete.message', 'Cette fiche sera effacée.', {
        firstname: prenom, ...SANS_ECHAPPEMENT,
      }),
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
                            { firstname: prenom, ...SANS_ECHAPPEMENT },
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
                          { firstname: prenom, ...SANS_ECHAPPEMENT },
                        )}
                      </Text>
                    ) : null}

                    {/* 🔑 F20 — à 13 ans, la fiche reçoit la clé : Lina crée SON compte,
                        et la fiche y est accrochée quand elle accepte le lien. */}
                    {aUnAge && pouvoir === 'view' && !enfant?.account ? (
                      <TouchableOpacity onPress={() => relierUnCompte(enfant)}>
                        <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
                          {t(
                            'myChildren.actions.giveAccount',
                            'Donner un compte à {{firstname}}',
                            { firstname: prenom, ...SANS_ECHAPPEMENT },
                          )}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {enfant?.account ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'myChildren.screen.hasAccount',
                          '{{firstname}} a son propre compte.',
                          { firstname: prenom, ...SANS_ECHAPPEMENT },
                        )}
                      </Text>
                    ) : null}
                    {pouvoir === 'none' ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'myChildren.screen.adultHint',
                          '{{firstname}} est majeur : il gère son compte seul.',
                          { firstname: prenom, ...SANS_ECHAPPEMENT },
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

        {/* 🔗 PARENT-LIEN — « LES COMPTES DE MES ENFANTS ». Une rangée par ado relié : elle
            ouvre SON profil, où vit « Retours du coach ». Le lien ne s'écrit qu'avec SON
            accord, et il peut le retirer. */}
        <View style={[Spaces.marginTop[12], { gap: 12 }]} testID="my-children-accounts">
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('myChildren.accounts.title', 'Les comptes de mes enfants')}
          </Text>
          <WithDataWrapper error={erreurLiens?.message} isLoading={chargementLiens}>
            <View style={{ gap: 12 }}>
              {comptesRelies.length === 0 ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t(
                    'myChildren.accounts.empty',
                    'Ton enfant a 13 ans ou plus et son propre compte ? Relie-le au tien :'
                    + ' tu verras les retours de son coach, jamais ses messages.',
                  )}
                </Text>
              ) : null}

              {comptesRelies.map((compte) => {
                const nomDuCompte = `${compte?.firstname || ''} ${compte?.lastname || ''}`.trim();
                return (
                  <TouchableOpacity
                    key={compte?.documentId}
                    onPress={() => ouvrirLeProfil(compte)}
                    style={carteStyle}
                    testID={`linked-child-${compte?.documentId}`}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
                      <ProfileAvatar
                        enablePreview={false}
                        imageUrl={compte?.avatar?.url}
                        name={nomDuCompte}
                        size={44}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                          {nomDuCompte}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {typeof compte?.age === 'number'
                            ? t('myChildren.screen.years', '{{count}} ans', { count: compte.age })
                            : ''}
                        </Text>
                      </View>
                      <Text style={[Fonts.p3Bold, { color: Colors.primary300 }]}>
                        {t('myChildren.accounts.open', 'Voir son profil')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* 🤐 Une demande s'affiche « envoyée » jusqu'à sa réponse ou son échéance :
                  le numéro ne dit jamais s'il existe un compte derrière. */}
              {demandesEnvoyees.map((demande) => (
                <View
                  key={demande?.documentId}
                  style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
                >
                  <Text style={[Fonts.p3, Fonts.neutral200, { flex: 1 }]}>
                    {demande?.declaredChild?.firstname
                      ? t(
                        'myChildren.accounts.pendingForChild',
                        'Demande envoyée au numéro finissant par {{hint}} (pour {{firstname}}).',
                        {
                          firstname: demande.declaredChild.firstname,
                          hint: demande?.phoneHint || '··',
                          ...SANS_ECHAPPEMENT,
                        },
                      )
                      : t(
                        'myChildren.accounts.pending',
                        'Demande envoyée au numéro finissant par {{hint}}.',
                        { hint: demande?.phoneHint || '··', ...SANS_ECHAPPEMENT },
                      )}
                  </Text>
                  <TouchableOpacity
                    disabled={annulationEnCours}
                    onPress={() => annulerDemande(demande.documentId)}
                    testID={`cancel-link-${demande?.documentId}`}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
                      {t('myChildren.accounts.cancel', 'Annuler')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              <Button
                onPress={() => relierUnCompte(null)}
                testID="my-children-link-account"
                title={t('myChildren.accounts.link', 'Relier le compte de mon enfant')}
                variant="Secondary"
              />
            </View>
          </WithDataWrapper>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyChildren;
