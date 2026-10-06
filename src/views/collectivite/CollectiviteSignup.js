import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  managerRequestPayload,
  signupContactErrors,
} from '@/domains/collectivite/collectiviteAccueil';
import {
  COLLECTIVITE_TYPES,
  collectiviteTypeLabel,
  nomOfficielDeCommune,
} from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import {
  continuerSurOrdinateur,
  STYLE_CONTINUER_ORDINATEUR,
} from '@/views/onboarding/components/continuerOrdinateur';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';
import {
  useCollectiviteSignupSearch,
  useCommuneSearch,
  useCreateManagerRequest,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import { useIsDesktop } from '@/responsive';

/**
 * @typedef {{ codeInsee?: string | null, documentId: string | null, name: string,
 *   type: string }} ChoixCollectivite
 */
/** @typedef {'firstname' | 'lastname' | 'jobTitle' | 'professionalEmail'} ChampVous */

/**
 * Le message d'un refus du serveur que la personne peut lire (clefs de CET espace de noms) ;
 * '' pour un autre refus (l'écran affiche alors le message général).
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {unknown} code - Le code du refus.
 * @returns {string} Le message.
 */
const refusLisible = (t, code) => {
  switch (code) {
    case 'COLLECTIVITE_MANAGER_REQUEST_ALREADY_MANAGER':
      return t(
        'collectiviteAccueil.inscription.refus.dejaGestionnaire',
        'Vous gérez déjà cette collectivité.',
      );
    case 'COLLECTIVITE_MANAGER_REQUEST_DUPLICATE':
      return t(
        'collectiviteAccueil.inscription.refus.dejaEnCours',
        'Une demande pour cette collectivité est déjà en cours de vérification.',
      );
    case 'COLLECTIVITE_MANAGER_REQUEST_TOO_MANY':
      return t(
        'collectiviteAccueil.inscription.refus.tropDeDemandes',
        'Vous avez déjà plusieurs demandes en cours de vérification.',
      );
    default:
      return '';
  }
};

/**
 * 🏛️ « JE REPRÉSENTE UNE COLLECTIVITÉ » — COLL-ACCUEIL (01/10/2026), planches
 * `P1-inscription-tel` et `-ordi`. Choisi au statut (UserRole), cet écran remplace TOUTES les
 * questions de sport : deux étapes, au VOUS (décision d'Adel « ton A »).
 *   1. Votre collectivité : son type, puis son nom ; une collectivité déjà sur FoundClub se
 *      choisit dans la liste, une autre devient une demande d'ouverture.
 *   2. Vous : prénom, nom, fonction, e-mail professionnel — ce qu'il faut pour vérifier, rien
 *      d'autre ; l'erreur s'écrit sous son champ dès qu'on le quitte.
 * L'envoi crée une DEMANDE DE GESTIONNAIRE (décision « console oui ») : aucun accès n'est
 * donné avant que l'équipe FoundClub l'ait validée. Le compte garde son rôle provisoire.
 * Sur le site, la même colonne de 560 px, centrée.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteSignup() {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const { refetchUserData, userData } = useAuth();

  const [etape, setEtape] = useState(/** @type {1 | 2} */ (1));
  const [type, setType] = useState('commune');
  const [recherche, setRecherche] = useState('');
  const [choix, setChoix] = useState(/** @type {ChoixCollectivite | null} */ (null));
  const [champs, setChamps] = useState({
    firstname: userData?.firstname || '',
    jobTitle: '',
    lastname: userData?.lastname || '',
    professionalEmail: '',
  });
  const [quittes, setQuittes] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [envoiTente, setEnvoiTente] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');

  const trouvees = useCollectiviteSignupSearch(recherche);
  // COLL-CONSOLE-BIS (03/10) — « Chercher la commune » (planches 7 et 8) : le référentiel de
  // l'État, lu par le serveur, pour une COMMUNE seulement.
  const communes = useCommuneSearch(recherche, { enabled: type === 'commune' });
  const envoi = /** @type {any} */ (useCreateManagerRequest());
  const fautes = signupContactErrors(champs);

  const resultats = (Array.isArray(trouvees.data) ? trouvees.data : [])
    .filter((collectivite) => collectivite?.type === type);
  const texte = recherche.trim();
  // Les communes du référentiel : celle qui est DÉJÀ sur FoundClub se choisit comme une
  // existante (une fois), une absente garde son code INSEE pour la demande.
  const dejaListees = new Set(resultats.map((collectivite) => collectivite?.documentId));
  const communesTrouvees = type === 'commune' && Array.isArray(communes.data) ? communes.data : [];
  const communesSurFoundClub = communesTrouvees.filter((commune) => (
    commune?.collectivite?.documentId && !dejaListees.has(commune.collectivite.documentId)
  ));
  const communesAbsentes = communesTrouvees.filter((commune) => !commune?.collectivite?.documentId);
  // Une collectivité absente de FoundClub reste possible : la demande servira à l'ouvrir. Quand
  // le référentiel a trouvé des communes, on choisit parmi elles (avec leur code) ; sinon (autre
  // type, référentiel muet ou en panne), la saisie libre d'avant reste.
  const absente = texte.length >= 3 && !trouvees.isLoading && !communes.isLoading
    && communesTrouvees.length === 0
    && !resultats.some((collectivite) => (
      String(collectivite?.name).toLowerCase() === texte.toLowerCase()
    ));

  const messageDeFaute = (/** @type {ChampVous} */ nom) => {
    if (!(quittes[nom] || envoiTente) || !fautes[nom]) return undefined;
    if (fautes[nom] === 'email') {
      return t(
        'collectiviteAccueil.inscription.erreurs.email',
        'Écrivez une adresse complète, par exemple sports@mairie.fr.',
      );
    }
    return t('collectiviteAccueil.inscription.erreurs.obligatoire', 'Ce champ est obligatoire.');
  };

  // FINITIONS18 11 (planche 8) — le site, a la largeur d'un ordinateur.
  const surOrdinateur = continuerSurOrdinateur(isDesktop);

  const retour = () => {
    if (etape === 2) {
      setEtape(1);
      return;
    }
    navigation.goBack();
  };

  const envoyer = async () => {
    setEnvoiTente(true);
    setErreurServeur('');
    if (!choix || Object.keys(fautes).length > 0) return;
    try {
      const prenom = champs.firstname.trim();
      const nom = champs.lastname.trim();
      // Le nom du COMPTE : c'est lui que la console affiche (« [Prénom Nom] »).
      if (prenom !== (userData?.firstname || '') || nom !== (userData?.lastname || '')) {
        await updateMe({ firstname: prenom, lastname: nom });
        await refetchUserData?.();
      }
      await envoi.mutateAsync(managerRequestPayload(choix, champs));
      navigation.reset({
        index: 0,
        routes: [{ name: RouteNames.CollectiviteSignupStatus, params: { justSent: true } }],
      });
    } catch (error) {
      const erreur = /** @type {any} */ (error);
      const code = erreur?.details?.code || erreur?.response?.data?.error?.details?.code;
      setErreurServeur(refusLisible(t, code) || getErrorMessage(erreur));
    }
  };

  const puce = (/** @type {string} */ valeur) => {
    const actif = type === valeur;
    return (
      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityState={{ checked: actif }}
        key={valeur}
        onPress={() => {
          setType(valeur);
          setChoix(null);
        }}
        style={[
          ApplicationStyle.borderRadius12,
          {
            backgroundColor: actif
              ? withAlpha(Colors.primary500, 0.22)
              : withAlpha(Colors.neutral00, 0.05),
            borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.12),
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
          },
        ]}
        testID={`collectivite-inscription-type-${valeur}`}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{collectiviteTypeLabel(t, valeur)}</Text>
      </TouchableOpacity>
    );
  };

  const ligneChoix = (
    /** @type {ChoixCollectivite} */ collectivite,
    /** @type {string} */ precision,
    /** @type {string} */ testID,
  ) => {
    // Deux communes homonymes (« Saint-Martin ») ne se confondent pas : le code INSEE compte.
    const choisie = choix?.name === collectivite.name
      && choix?.documentId === collectivite.documentId
      && (choix?.codeInsee || null) === (collectivite.codeInsee || null);
    return (
      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityState={{ checked: choisie }}
        key={testID}
        onPress={() => setChoix(collectivite)}
        style={[
          ApplicationStyle.borderRadius12,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.padding[12],
          {
            backgroundColor: choisie
              ? withAlpha(Colors.primary500, 0.16)
              : withAlpha(Colors.neutral00, 0.04),
            borderColor: choisie ? Colors.primary500 : withAlpha(Colors.neutral00, 0.1),
            borderWidth: 1,
            gap: 12,
            minHeight: 64,
          },
        ]}
        testID={testID}
      >
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{collectivite.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{precision}</Text>
        </View>
        {choisie ? (
          <Image
            source={Images.check}
            style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const libelleEtape = t('collectiviteAccueil.inscription.etape', 'Étape {{numero}} sur 2', {
    numero: etape,
  });
  const enTete = (
    <View style={{ gap: 8 }}>
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <TouchableOpacity
          accessibilityLabel={t('collectiviteAccueil.inscription.retour', 'Retour')}
          accessibilityRole="button"
          onPress={retour}
          style={[Alignments.justifyCenter, { minHeight: 44, minWidth: 44 }]}
          testID="collectivite-inscription-retour"
        >
          <Image
            source={Images.arrowLeft}
            style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
          />
        </TouchableOpacity>
        <Text style={[Fonts.p2Bold, Fonts.neutral200]}>{libelleEtape}</Text>
      </View>
      <View
        accessibilityLabel={libelleEtape}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: 2, min: 0, now: etape }}
        style={{ backgroundColor: withAlpha(Colors.neutral00, 0.12), borderRadius: 3, height: 6 }}
      >
        <View
          style={{
            backgroundColor: Colors.primary500,
            borderRadius: 3,
            height: 6,
            width: etape === 1 ? '50%' : '100%',
          }}
        />
      </View>
    </View>
  );

  const etapeCollectivite = (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteAccueil.inscription.collectivite.titre', 'Votre collectivité')}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {t(
            'collectiviteAccueil.inscription.collectivite.dit',
            'Laquelle représentez-vous ? FoundClub vérifie, puis vous en confie la gestion.',
          )}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
          {t('collectiviteAccueil.inscription.collectivite.type', 'Type')}
        </Text>
        <View
          accessibilityLabel={t(
            'collectiviteAccueil.inscription.collectivite.typeA11y',
            'Type de collectivité',
          )}
          accessibilityRole="radiogroup"
          style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
        >
          {COLLECTIVITE_TYPES.map(puce)}
        </View>
      </View>
      <Input
        icon="search"
        label={type === 'commune'
          ? t('collectiviteAccueil.inscription.collectivite.nomCommune', 'Nom de la commune')
          : t('collectiviteAccueil.inscription.collectivite.nom', 'Nom de la collectivité')}
        onChangeText={(valeur) => {
          setRecherche(valeur);
          setChoix(null);
        }}
        testID="collectivite-inscription-nom"
        value={recherche}
      />
      <View accessibilityRole="list" style={{ gap: 8 }}>
        {resultats.map((collectivite) => ligneChoix(
          { documentId: collectivite.documentId, name: collectivite.name, type: collectivite.type },
          t('collectiviteAccueil.inscription.collectivite.dejaSur', 'Déjà sur FoundClub'),
          `collectivite-inscription-trouvee-${collectivite.documentId}`,
        ))}
        {communesSurFoundClub.map((commune) => ligneChoix(
          {
            documentId: commune.collectivite.documentId,
            name: commune.collectivite.name,
            type: 'commune',
          },
          t('collectiviteAccueil.inscription.collectivite.dejaSur', 'Déjà sur FoundClub'),
          `collectivite-inscription-trouvee-${commune.collectivite.documentId}`,
        ))}
        {communesAbsentes.map((commune) => ligneChoix(
          {
            codeInsee: commune.codeInsee,
            documentId: null,
            name: nomOfficielDeCommune(t, commune.name),
            type: 'commune',
          },
          [
            Array.isArray(commune.codesPostaux) ? commune.codesPostaux[0] : null,
            t('collectiviteConsoleBis.commune.codeInsee', 'Code INSEE {{code}}', {
              code: commune.codeInsee,
            }),
          ].filter(Boolean).join(' · '),
          `collectivite-inscription-commune-${commune.codeInsee}`,
        ))}
        {absente ? ligneChoix(
          { documentId: null, name: texte, type },
          t('collectiviteAccueil.inscription.collectivite.pasEncore', 'Pas encore sur FoundClub'),
          'collectivite-inscription-nouvelle',
        ) : null}
      </View>
      {choix && !choix.documentId ? (
        <View
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.padding[12],
            {
              backgroundColor: withAlpha(Colors.primary500, 0.1),
              borderColor: withAlpha(Colors.primary500, 0.3),
              borderWidth: 1,
            },
          ]}
          testID="collectivite-inscription-ouverture"
        >
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'collectiviteAccueil.inscription.collectivite.ouverture',
              // eslint-disable-next-line max-len
              '{{nom}} n’a pas encore d’espace FoundClub. Continuez : votre demande servira à l’ouvrir.',
              { nom: choix.name, ...SANS_ECHAPPEMENT },
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const champ = (
    /** @type {ChampVous} */ nom,
    /** @type {string} */ libelle,
    /** @type {string | undefined} */ indice,
  ) => (
    <Input
      autoCapitalize={nom === 'professionalEmail' ? 'none' : 'sentences'}
      error={messageDeFaute(nom)}
      keyboardType={nom === 'professionalEmail' ? 'email-address' : 'default'}
      label={libelle}
      onBlur={() => setQuittes((avant) => ({ ...avant, [nom]: true }))}
      onChangeText={(valeur) => setChamps((avant) => ({ ...avant, [nom]: valeur }))}
      placeholder={indice}
      testID={`collectivite-inscription-${nom}`}
      value={champs[nom]}
    />
  );

  const etapeVous = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteAccueil.inscription.vous.titre', 'Vous')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteAccueil.inscription.vous.dit',
            // eslint-disable-next-line max-len
            'Pour que FoundClub vérifie votre demande. Aucune question de sport : ce compte sert à gérer les installations et les demandes de la Ville.',
          )}
        </Text>
      </View>
      {champ('firstname', t('collectiviteAccueil.inscription.vous.prenom', 'Prénom'), undefined)}
      {champ('lastname', t('collectiviteAccueil.inscription.vous.nom', 'Nom'), undefined)}
      {champ(
        'jobTitle',
        t('collectiviteAccueil.inscription.vous.fonction', 'Votre fonction'),
        t('collectiviteAccueil.inscription.vous.fonctionIndice', 'Ex. : service des sports'),
      )}
      {champ(
        'professionalEmail',
        t('collectiviteAccueil.inscription.vous.email', 'E-mail professionnel'),
        undefined,
      )}
      {erreurServeur ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
          {erreurServeur}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[16], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center', gap: 24, maxWidth: 560, paddingBottom: 24, width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {enTete}
        {etape === 1 ? etapeCollectivite : etapeVous}
      </ScrollView>
      <View
        style={[
          { alignSelf: 'center', maxWidth: 560, width: '100%' },
          // FINITIONS18 11 (planche 8, etat A) : sur ordinateur, « Annuler » puis « Continuer »,
          // a droite.
          surOrdinateur ? { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' } : null,
        ]}
      >
        {surOrdinateur && etape === 1 ? (
          <Button
            onPress={retour}
            style={{ minWidth: 120 }}
            title={t('common.actions.cancel', 'Annuler')}
            variant="Ghost"
          />
        ) : null}
        {etape === 1 ? (
          <Button
            disabled={!choix}
            onPress={() => setEtape(2)}
            style={surOrdinateur ? STYLE_CONTINUER_ORDINATEUR : undefined}
            title={t('collectiviteAccueil.inscription.continuer', 'Continuer')}
            variant="Primary"
          />
        ) : (
          <Button
            disabled={Boolean(envoi.isPending)}
            isLoading={Boolean(envoi.isPending)}
            onPress={envoyer}
            style={surOrdinateur ? STYLE_CONTINUER_ORDINATEUR : undefined}
            title={t('collectiviteAccueil.inscription.envoyer', 'Envoyer ma demande')}
            variant="Primary"
          />
        )}
      </View>
    </FormScreenContainer>
  );
}

export default CollectiviteSignup;
