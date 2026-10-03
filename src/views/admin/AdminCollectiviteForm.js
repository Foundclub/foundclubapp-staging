import { useNavigation } from '@react-navigation/native';
import {
  useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  COLLECTIVITE_TYPES,
  collectiviteTypeLabel,
  nomOfficielDeCommune,
  readCollectiviteCreateForm,
} from '@/domains/collectivite/collectiviteDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ConsoleSheet from '@/views/admin/components/ConsoleSheet';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCommuneSearch,
  useCreateAdminCollectivite,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

// Au-dela de cette largeur (site), le formulaire a gauche et l apercu a droite (P2-creer-ordi).
const LARGEUR_DEUX_COLONNES = 768;

/**
 * Le debut officiel du nom, pose dans le champ quand on choisit le type (D59). Ce sont des
 * noms FRANCAIS (« Ville de … ») quelle que soit la langue de l ecran : le dictionnaire
 * anglais porte la meme valeur.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {string} type - Le type choisi.
 * @returns {string} Le prefixe, espace final compris.
 */
const prefixeOfficiel = (t, type) => {
  switch (type) {
    case 'departement': return t('adminCollectivites.form.prefixes.departement', 'Département de ');
    case 'intercommunalite':
      return t('adminCollectivites.form.prefixes.intercommunalite', 'Communauté de communes ');
    case 'region': return t('adminCollectivites.form.prefixes.region', 'Région ');
    default: return t('adminCollectivites.form.prefixes.commune', 'Ville de ');
  }
};

/**
 * Un exemple de forme officielle, par type.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {string} type - Le type choisi.
 * @returns {string} L exemple.
 */
const exempleOfficiel = (t, type) => {
  switch (type) {
    case 'departement':
      return t('adminCollectivites.form.examples.departement', '« Département du Var »');
    case 'intercommunalite':
      return t(
        'adminCollectivites.form.examples.intercommunalite',
        '« Communauté de communes du Val » ou « Métropole Aix-Marseille-Provence »',
      );
    case 'region': return t('adminCollectivites.form.examples.region', '« Région Sud »');
    default:
      return t(
        'adminCollectivites.form.examples.commune',
        '« Ville de Montrivage » ou « Ville d’Aix »',
      );
  }
};

// Le champ sous lequel chaque faute s ecrit (planche P2-creer, etat 4 : « chaque erreur sous
// son champ ») ; « un code INSEE ou un SIREN » s ecrit sous la ligne des deux codes.
const CHAMP_DE_LA_FAUTE = {
  codeInsee: 'codeInsee',
  identifier: 'identifiants',
  officialName: 'name',
  siren: 'siren',
  type: 'type',
};

/**
 * 🏛️ CONSOLE › COLLECTIVITÉS › CRÉER (D61, 2026-09-29), restylé par COLL-CONSOLE (02/10/2026)
 * selon la planche P2-creer (design HY521H1, page 2, écran 3).
 *
 * Le nom se saisit sous sa FORME OFFICIELLE (D59) : le bandeau « Offert par la Ville de X »
 * le lit tel quel. Choisir le type pose son début officiel dans le champ (s'il est vide ou ne
 * porte qu'un autre début). Ce qui change avec la planche :
 *   - chaque erreur s'écrit SOUS SON CHAMP, dès qu'on le quitte (et toutes à l'envoi) — plus
 *     de liste groupée sous le dernier champ ;
 *   - l'APERÇU en direct de ce que liront les clubs : la pastille « Offert par … » (et, sur le
 *     site, la ligne de « Mon abonnement ») ;
 *   - « Créer — elle naîtra inactive » fixé en bas, éteint tant qu'il manque un code INSEE ou
 *     un SIREN ; pendant l'envoi, la roue et un formulaire qui ne bouge plus ; l'erreur du
 *     serveur s'écrit au-dessus du bouton ;
 *   - « Annuler » ou le retour, saisie commencée : une FEUILLE de l'app demande avant de perdre
 *     (textes du lot TEXTES-COLLECTIVITÉS) ;
 *   - créée : la fiche remplace le formulaire et dit les gestes qui restent (`justCreated`).
 * COLL-CONSOLE-BIS (03/10/2026) — « CHERCHER LA COMMUNE » (planche 14) : pour une commune, on la
 * cherche par son nom dans le référentiel de l'État (lu par le serveur) ; un appui remplit le
 * nom officiel, le code INSEE et le SIREN. Une commune déjà sur FoundClub le dit et ouvre sa
 * fiche. Référentiel muet ou en panne : les codes se saisissent à la main, contrôlés comme avant
 * (le serveur refuse toujours un INSEE ou un SIREN déjà pris).
 * @returns {import('react').ReactElement} L'écran.
 */
function AdminCollectiviteForm() {
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { width } = useWindowDimensions();
  const deuxColonnes = width >= LARGEUR_DEUX_COLONNES;
  const [form, setForm] = useState(() => ({
    codeInsee: '',
    email: '',
    name: prefixeOfficiel(t, 'commune'),
    phoneNumber: '',
    siren: '',
    type: 'commune',
  }));
  // Les champs QUITTES (une erreur ne s affiche qu une fois le champ quitte), ou tous apres un
  // envoi.
  const [touches, setTouches] = useState(/** @type {Set<string>} */ (new Set()));
  const [envoye, setEnvoye] = useState(false);
  // La sortie en attente de la feuille « Quitter sans créer ? » (rangée dans un objet : une
  // fonction passée à useState serait prise pour un initialiseur).
  const [quitter, setQuitter] = useState(/** @type {{ sortir: () => void } | null} */ (null));
  const creer = useCreateAdminCollectivite();
  const enCours = Boolean(creer.isPending);
  // COLL-CONSOLE-BIS (03/10) — le texte de « Chercher la commune » (planche 14).
  const [commune, setCommune] = useState('');
  const communes = useCommuneSearch(commune, { enabled: form.type === 'commune' });

  // TEXTES-COLLECTIVITES (01/10) — une saisie VIDE (seul le debut officiel du nom, pose par
  // l ecran) part sans question ; sinon, on demande. Apres une creation reussie, le detail
  // remplace le formulaire sans question (`sortieLibre`).
  // ponytail: sur le site, le « retour » du NAVIGATEUR ne passe pas par `beforeRemove` (la
  // couche web de la navigation ne l emet pas) : seul « Annuler » y demande. Voie de sortie :
  // un `beforeunload` dans la couche web, s il le faut un jour.
  const sortieLibre = useRef(false);
  const debutsOfficiels = COLLECTIVITE_TYPES.map((type) => prefixeOfficiel(t, type).trim());
  const saisieVide = ['codeInsee', 'email', 'phoneNumber', 'siren']
    .every((cle) => !String(/** @type {any} */ (form)[cle] || '').trim())
    && ['', ...debutsOfficiels].includes(form.name.trim());
  const demanderAvantDeQuitter = (/** @type {() => void} */ sortir) => setQuitter({ sortir });
  useEffect(() => navigation.addListener?.('beforeRemove', (/** @type {any} */ evenement) => {
    if (sortieLibre.current || saisieVide) return;
    evenement.preventDefault();
    demanderAvantDeQuitter(() => navigation.dispatch(evenement.data.action));
  }));
  const annuler = () => {
    if (saisieVide) {
      navigation.goBack?.();
      return;
    }
    demanderAvantDeQuitter(() => navigation.goBack?.());
  };

  const { data, errors } = readCollectiviteCreateForm(form);
  const sansIdentifiant = !form.codeInsee.trim() && !form.siren.trim();
  const visible = (/** @type {string} */ champ) => {
    if (envoye) return true;
    if (champ === 'identifiants') return touches.has('codeInsee') && touches.has('siren');
    return touches.has(champ);
  };
  const fautesDe = (/** @type {string} */ champ) => errors
    .filter((faute) => /** @type {any} */ (CHAMP_DE_LA_FAUTE)[faute] === champ && visible(champ));

  const changer = (/** @type {keyof typeof form} */ champ) => (/** @type {string} */ valeur) => {
    setForm((avant) => ({ ...avant, [champ]: valeur }));
  };
  const quitterLeChamp = (/** @type {string} */ champ) => () => setTouches(
    (avant) => new Set([champ, ...avant]),
  );
  const choisirType = (/** @type {string} */ type) => {
    setForm((avant) => {
      const prefixes = COLLECTIVITE_TYPES.map((autre) => prefixeOfficiel(t, autre).trim());
      const nomVide = !avant.name.trim() || prefixes.includes(avant.name.trim());
      return { ...avant, name: nomVide ? prefixeOfficiel(t, type) : avant.name, type };
    });
  };

  // Un appui sur une commune du référentiel remplit le formulaire ; une commune déjà sur
  // FoundClub ouvre sa fiche (elle ne se crée pas deux fois).
  const choisirCommune = (/** @type {any} */ trouvee) => {
    if (trouvee?.collectivite?.documentId) {
      navigation.navigate(RouteNames.AdminCollectiviteDetail, {
        collectiviteId: trouvee.collectivite.documentId,
      });
      return;
    }
    setForm((avant) => ({
      ...avant,
      codeInsee: String(trouvee?.codeInsee || ''),
      name: nomOfficielDeCommune(t, trouvee?.name) || avant.name,
      siren: String(trouvee?.siren || avant.siren),
    }));
    setCommune('');
  };

  const libelleFaute = (/** @type {string} */ faute) => {
    switch (faute) {
      case 'codeInsee':
        return t(
          'adminCollectivites.form.errors.codeInsee',
          'Code INSEE : 5 caractères (2A ou 2B en Corse).',
        );
      case 'identifier':
        return t(
          'adminCollectivites.form.errors.identifier',
          'Un code INSEE ou un SIREN est obligatoire.',
        );
      case 'officialName':
        return t('adminCollectivites.form.errors.officialName', {
          exemple: exempleOfficiel(t, form.type),
          ...SANS_ECHAPPEMENT,
        });
      case 'siren': return t('adminCollectivites.form.errors.siren', 'SIREN : 9 chiffres.');
      default: return t('adminCollectivites.form.errors.type', 'Choisis le type de collectivité.');
    }
  };
  const afficherFautes = (/** @type {string} */ champ) => fautesDe(champ).map((faute) => (
    <Text
      accessibilityRole="alert"
      key={faute}
      nativeID={`admin-collectivite-form-${champ}-erreur`}
      style={[Fonts.p3Bold, Fonts.error300]}
      testID={`admin-collectivite-form-${champ}-erreur`}
    >
      {libelleFaute(faute)}
    </Text>
  ));

  const envoyer = () => {
    setEnvoye(true);
    if (errors.length > 0) return;
    creer.mutate(data, {
      onSuccess: (/** @type {any} */ reponse) => {
        const collectiviteId = reponse?.data?.documentId;
        sortieLibre.current = true;
        if (collectiviteId) {
          navigation.replace(RouteNames.AdminCollectiviteDetail, {
            collectiviteId,
            justCreated: true,
          });
        } else navigation.goBack?.();
      },
    });
  };

  const champ = (/**
     @type {{ autoCapitalize?: 'characters' | 'none' | 'sentences',
    cle: keyof typeof form, keyboardType?: import('react-native').KeyboardTypeOptions,
    label: string, maxLength?: number }} */ {
      autoCapitalize = 'sentences', cle, keyboardType = 'default', label, maxLength = undefined,
    },
  ) => {
    const enFaute = fautesDe(cle).length > 0;
    return (
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={!enCours}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onBlur={quitterLeChamp(cle)}
          onChangeText={changer(cle)}
          placeholderTextColor={Colors.neutral400}
          style={[
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            Fonts.p2,
            Spaces.padding[12],
            {
              borderColor: enFaute ? Colors.error500 : withAlpha(Colors.primary500, 0.5),
              color: Colors.neutral00,
              opacity: enCours ? 0.6 : 1,
            },
          ]}
          testID={`admin-collectivite-form-${cle}`}
          value={form[cle]}
        />
        {afficherFautes(cle)}
      </View>
    );
  };

  // L apercu : ce que liront les clubs rattaches, des que le nom depasse son debut officiel.
  const nomSaisi = !['', ...debutsOfficiels].includes(form.name.trim());
  const offertPar = t('collectiviteConsole.creer.offertPar', 'Offert par {{collectivite}}', {
    collectivite: formatCollectiviteOfferedBy(form.name.trim()), ...SANS_ECHAPPEMENT,
  });
  const nomDuClub = t('collectiviteConsole.creer.apercuClub', 'Ton club');
  const apercu = nomSaisi ? (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        Spaces.padding[16],
        Alignments.alignCenter,
        {
          backgroundColor: withAlpha(Colors.primary700, 0.45),
          borderColor: withAlpha(Colors.primary500, 0.5),
          borderWidth: 1,
          gap: 12,
        },
      ]}
      testID="admin-collectivite-form-apercu"
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200, Alignments.selfStart]}>
        {t('collectiviteConsole.creer.apercuTitre', 'Ce que liront les clubs').toUpperCase()}
      </Text>
      <ClubLogoMark name={nomDuClub} size={60} />
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{nomDuClub}</Text>
      <View
        style={[
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[4],
          { backgroundColor: withAlpha(Colors.success500, 0.18), borderRadius: 999 },
        ]}
      >
        <Text style={[Fonts.p3Bold, Fonts.success500]}>{offertPar}</Text>
      </View>
      {deuxColonnes ? (
        <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
          {t(
            'collectiviteConsole.creer.apercuAbonnement',
            'Dans « Mon abonnement » : Offre Club offerte par {{collectivite}}',
            { collectivite: formatCollectiviteOfferedBy(form.name.trim()), ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}
    </View>
  ) : null;

  const communesTrouvees = Array.isArray(communes.data) ? communes.data : [];
  let resultatsCommune = null;
  if (commune.trim().length >= 3) {
    if (communes.isLoading) {
      resultatsCommune = (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('adminCollectivites.detail.searching', 'Recherche…')}
        </Text>
      );
    } else if (communesTrouvees.length === 0) {
      resultatsCommune = (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteConsoleBis.commune.aucune',
            'Aucune commune trouvée : saisis son nom officiel et ses codes ci-dessous.',
          )}
        </Text>
      );
    } else {
      resultatsCommune = communesTrouvees.map((trouvee) => (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={enCours}
          key={trouvee.codeInsee}
          onPress={() => choisirCommune(trouvee)}
          style={[
            ApplicationStyle.borderRadius16,
            Alignments.row,
            Alignments.alignCenter,
            Spaces.padding[12],
            {
              backgroundColor: withAlpha(Colors.primary700, 0.45),
              borderColor: withAlpha(Colors.primary500, 0.5),
              borderWidth: 1,
              gap: 8,
              minHeight: 56,
            },
          ]}
          testID={`admin-collectivite-form-commune-${trouvee.codeInsee}`}
        >
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{trouvee.name}</Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {[
                Array.isArray(trouvee.codesPostaux) ? trouvee.codesPostaux[0] : null,
                t('collectiviteConsole.fiche.insee', 'INSEE {{code}}', { code: trouvee.codeInsee }),
                trouvee.siren
                  ? t('collectiviteConsole.fiche.siren', 'SIREN {{code}}', { code: trouvee.siren })
                  : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {trouvee.collectivite?.documentId ? (
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t('collectiviteAccueil.inscription.collectivite.dejaSur', 'Déjà sur FoundClub')}
            </Text>
          ) : null}
        </TouchableOpacity>
      ));
    }
  }
  const rechercheCommune = form.type === 'commune' ? (
    <View style={{ gap: 6 }}>
      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
        {t('collectiviteConsoleBis.commune.chercher', 'Chercher la commune')}
      </Text>
      <TextInput
        accessibilityLabel={t('collectiviteConsoleBis.commune.chercher', 'Chercher la commune')}
        autoCorrect={false}
        editable={!enCours}
        onChangeText={setCommune}
        placeholderTextColor={Colors.neutral400}
        style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Fonts.p2,
          Spaces.padding[12],
          { borderColor: withAlpha(Colors.primary500, 0.5), color: Colors.neutral00 },
        ]}
        testID="admin-collectivite-form-commune"
        value={commune}
      />
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteConsoleBis.commune.aide',
          'Nom officiel, code INSEE et SIREN se remplissent à partir d’elle.',
        )}
      </Text>
      {resultatsCommune}
    </View>
  ) : null;

  const rangeeDuPied = deuxColonnes ? [Alignments.row, Alignments.justifyEnd] : null;
  const formulaire = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
          {t('adminCollectivites.form.type', 'Type')}
        </Text>
        <View
          accessibilityLabel={t('collectiviteConsole.creer.typeGroupe', 'Type de collectivité')}
          accessibilityRole="radiogroup"
          style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
        >
          {COLLECTIVITE_TYPES.map((type) => {
            const choisi = form.type === type;
            return (
              <TouchableOpacity
                accessibilityRole="radio"
                accessibilityState={{ checked: choisi, disabled: enCours, selected: choisi }}
                disabled={enCours}
                key={type}
                onPress={() => choisirType(type)}
                style={[
                  ApplicationStyle.borderRadius16,
                  ApplicationStyle.borderWidth1,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  {
                    backgroundColor: choisi ? Colors.primary500 : 'transparent',
                    borderColor: Colors.primary500,
                    justifyContent: 'center',
                    minHeight: 44,
                  },
                ]}
                testID={`admin-collectivite-form-type-${type}`}
              >
                <Text style={[Fonts.p3Bold, choisi ? Fonts.neutral900 : Fonts.neutral00]}>
                  {collectiviteTypeLabel(t, type)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {rechercheCommune}
      {champ({ cle: 'name', label: t('adminCollectivites.form.name', 'Nom officiel') })}
      {fautesDe('name').length === 0 ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('adminCollectivites.form.nameHint', {
            exemple: exempleOfficiel(t, form.type),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      {deuxColonnes ? null : apercu}
      <View style={{ gap: 6 }}>
        <View style={[Alignments.row, { gap: 12 }]}>
          {champ({
            autoCapitalize: 'characters',
            cle: 'codeInsee',
            label: t('adminCollectivites.form.codeInsee', 'Code INSEE'),
            maxLength: 5,
          })}
          {champ({
            cle: 'siren',
            keyboardType: 'number-pad',
            label: t('adminCollectivites.form.siren', 'SIREN'),
            maxLength: 11,
          })}
        </View>
        {afficherFautes('identifiants')}
      </View>
      {champ({
        autoCapitalize: 'none',
        cle: 'email',
        keyboardType: 'email-address',
        label: t('adminCollectivites.form.email', 'E-mail (facultatif)'),
      })}
      {champ({
        cle: 'phoneNumber',
        keyboardType: 'phone-pad',
        label: t('adminCollectivites.form.phone', 'Téléphone (facultatif)'),
      })}
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('adminCollectivites.list.title', 'Collectivités').toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('adminCollectivites.form.title', 'Créer une collectivité')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectiviteConsole.creer.dit',
              'Elle naît inactive : tu l’actives ensuite, depuis sa fiche.',
            )}
          </Text>
        </View>
        {deuxColonnes ? (
          <View style={[Alignments.row, Alignments.alignStart, { gap: 24 }]}>
            <View style={{ flex: 3 }}>{formulaire}</View>
            <View style={{ flex: 2 }}>
              {apercu || (
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'collectiviteConsole.creer.apercuVide',
                    'L’aperçu suit le nom officiel à chaque frappe.',
                  )}
                </Text>
              )}
            </View>
          </View>
        ) : formulaire}
      </ScrollView>
      {/* La barre du bas reste visible : l erreur du serveur au-dessus, puis les deux gestes. */}
      <View
        style={[
          Spaces.paddingTop[12],
          Spaces.paddingBottom[16],
          {
            borderTopColor: withAlpha(Colors.primary500, 0.3),
            borderTopWidth: 1,
            gap: 12,
          },
        ]}
        testID="admin-collectivite-form-pied"
      >
        {creer.error ? (
          <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>
            {getErrorMessage(/** @type {any} */ (creer.error))}
          </Text>
        ) : null}
        <View style={[rangeeDuPied, { gap: 12 }]}>
          {deuxColonnes ? (
            <Button
              disabled={enCours}
              onPress={annuler}
              title={t('adminCollectivites.form.cancel', 'Annuler')}
              variant="Secondary"
            />
          ) : null}
          <Button
            disabled={enCours || sansIdentifiant}
            isLoading={enCours}
            onPress={envoyer}
            title={t('collectiviteConsole.creer.envoyer', 'Créer — elle naîtra inactive')}
            variant="Primary"
          />
          {deuxColonnes ? null : (
            <Button
              disabled={enCours}
              onPress={annuler}
              title={t('adminCollectivites.form.cancel', 'Annuler')}
              variant="Ghost"
            />
          )}
        </View>
      </View>
      <ConsoleSheet
        onClose={() => setQuitter(null)}
        primary={{
          label: t('adminCollectivites.form.leave.stay', 'Rester'),
          onPress: () => setQuitter(null),
        }}
        secondary={{
          label: t('adminCollectivites.form.leave.confirm', 'Quitter'),
          onPress: () => {
            const sortir = quitter?.sortir;
            setQuitter(null);
            sortieLibre.current = true;
            sortir?.();
          },
          variant: 'Danger',
        }}
        subtitle={t('adminCollectivites.form.leave.message', 'Ce que tu as saisi sera perdu.')}
        testID="admin-collectivite-form-quitter"
        title={t('adminCollectivites.form.leave.title', 'Quitter sans créer la collectivité ?')}
        visible={Boolean(quitter)}
      />
    </ScreenContainer>
  );
}

export default AdminCollectiviteForm;
