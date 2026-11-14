import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  basculerMembre,
  corpsDeCreation,
  etapeUnPrete,
  filtrerCandidats,
  ICONES_COMMUNAUTE,
  MEMBRES_MINIMUM,
  THEMES_COMMUNAUTE,
  toutSelectionner,
} from '@/domains/messaging/communautes';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import EnTeteCommunaute from '@/views/communautes/EnTeteCommunaute';

import { RouteNames } from '@/navigation/routeNames';

import { creerGroupeCommunaute, getCandidatsCommunaute } from '@/services/chat/communauteService';

/**
 * Le libellé d'un thème. Récolte T11 : les replis vivent DANS `t()` (porte i18n:no-regression) ;
 * même clé, même repli qu'avant.
 * @param {import('i18next').TFunction} t - la traduction.
 * @param {string} cle
 * @returns {string} Le libellé.
 */
const libelleDuTheme = (t, cle) => {
  if (cle === 'covoiturage') return t('communautes.theme.covoiturage', 'Covoiturage');
  if (cle === 'equipe') return t('communautes.theme.equipe', 'Équipe');
  if (cle === 'evenement') return t('communautes.theme.evenement', 'Événement');
  if (cle === 'libre') return t('communautes.theme.libre', 'Libre');
  if (cle === 'parents') return t('communautes.theme.parents', 'Parents');
  if (cle === 'staff') return t('communautes.theme.staff', 'Staff');
  return t(`communautes.theme.${cle}`);
};

/**
 * Le message d'un refus du serveur (`ctx.badRequest(message, { code })` du socle), sinon une phrase
 * générale.
 * @param {any} erreur
 * @param {string} repli
 * @returns {string} La phrase à afficher.
 */
const messageDuRefus = (erreur, repli) => {
  const message = erreur?.response?.data?.error?.message;
  return typeof message === 'string' && message ? message : repli;
};

/**
 * COMMUNAUTES-L2 (13/11/2026, D76 ; maquette v3, écrans 3 et 4) — « Nouveau groupe » en 2 étapes :
 *   1. nom, thème, icône, qui peut écrire ;
 *   2. « Choisir les membres » : les candidats du serveur (`GET …/candidats?theme=`), « Tout
 * sélectionner »,
 *      « Chercher un membre », puis « Créer avec N membres » (`POST …/groupes`), qui ouvre le fil
 * créé.
 * Le serveur rejuge tout (qui crée, qui peut entrer, 271 A et 272 A). « Qui entre d'office » : lot
 * L3/L6.
 * @param {object} props
 * @param {any} props.navigation
 * @param {{ params?: { genre?: string, id?: string, nomCommunaute?: string } }} props.route
 * @returns {import('react').ReactElement} L'écran.
 */
function NouveauGroupeCommunaute({ navigation, route }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const genre = String(route?.params?.genre || '');
  const id = String(route?.params?.id || '');
  const nomCommunaute = String(route?.params?.nomCommunaute || '');

  const [etape, setEtape] = useState(1);
  const [nom, setNom] = useState('');
  const [theme, setTheme] = useState('libre');
  const [icone, setIcone] = useState(/** @type {string | null} */ (null));
  const [quiEcrit, setQuiEcrit] = useState(/** @type {'tous' | 'admins'} */ ('tous'));
  const [candidats, setCandidats] = useState(/** @type {any[] | null} */ (null));
  const [choisis, setChoisis] = useState(/** @type {string[]} */ ([]));
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  // `t` peut changer d'identité d'un rendu à l'autre : il ne doit jamais relancer le chargement des
  // candidats.
  // Récolte T11 : le repli traduit au rendu, dans un `t(...)` lisible par la porte
  // i18n:no-regression (il passait par une référence vers `t`, lue dans le `catch`).
  const repliDesCandidats = useRef('');
  repliDesCandidats.current = t(
    'communautes.erreurCandidats',
    'Impossible de charger les membres.',
  );

  useEffect(() => {
    if (etape !== 2) return undefined;
    let vivant = true;
    setCandidats(null);
    setErreur('');
    getCandidatsCommunaute({ genre, id, theme })
      .then((reponse) => {
        if (!vivant) return;
        setCandidats(reponse?.membres || []);
        // Un candidat qui n'en est plus un (thème changé) ne reste pas coché.
        const permis = new Set(
          (reponse?.membres || []).map((/** @type {any} */ m) => m.documentId),
        );
        setChoisis((avant) => avant.filter((m) => permis.has(m)));
      })
      .catch((e) => {
        if (vivant) {
          setErreur(messageDuRefus(e, repliDesCandidats.current));
        }
      });
    return () => {
      vivant = false;
    };
  }, [etape, genre, id, theme]);

  const visibles = useMemo(
    () => filtrerCandidats(candidats || [], recherche),
    [candidats, recherche],
  );
  const sourdine = withAlpha(Colors.neutral00, 0.6);
  // Un choix actif : fond primary500, encre primary900 ; inactif : fond translucide, encre claire.
  const fondDuChoix = (/** @type {boolean} */ actif) => (
    actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.08)
  );
  const encreDuChoix = (/** @type {boolean} */ actif) => (
    actif ? Colors.primary900 : Colors.neutral00
  );
  const filet = withAlpha(Colors.neutral00, 0.07);
  const nomDuTheme = (/** @type {string} */ cle) => (
    libelleDuTheme(t, cle)
  );

  const creer = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      const cree = await creerGroupeCommunaute({
        corps: corpsDeCreation({
          icone,
          membres: choisis,
          nom,
          quiEcrit,
          theme,
        }),
        genre,
        id,
      });
      if (cree?.chat) {
        const vers = { chatId: cree.chat, title: nom.trim() };
        if (typeof navigation.replace === 'function') {
          navigation.replace(RouteNames.Conversation, vers);
        } else navigation.navigate(RouteNames.Conversation, vers);
      }
    } catch (e) {
      setErreur(
        messageDuRefus(e, t('communautes.erreurCreation', 'Le groupe n’a pas pu être créé.')),
      );
    } finally {
      setEnvoi(false);
    }
  };

  const puce = (/** @type {any} */ {
    actif, cle, libelle, onPress,
  }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      key={cle}
      onPress={onPress}
      style={[
        styles.puce,
        { backgroundColor: fondDuChoix(actif) },
      ]}
      testID={`nouveau-groupe-${cle}`}
    >
      <Text style={[styles.textePuce, { color: encreDuChoix(actif) }]}>
        {libelle}
      </Text>
    </TouchableOpacity>
  );

  const champ = { backgroundColor: Colors.primary700, borderColor: filet, color: Colors.neutral00 };

  const etapeUn = (
    <>
      <Text style={[styles.titre, { color: Colors.neutral00 }]}>
        {t('communautes.nouveauGroupe', 'Nouveau groupe')}
      </Text>
      <Text style={[styles.libelle, { color: sourdine }]}>
        {t('communautes.nomDuGroupe', 'Nom du groupe')}
      </Text>
      <TextInput
        accessibilityLabel={t('communautes.nomDuGroupe', 'Nom du groupe')}
        maxLength={80}
        onChangeText={setNom}
        placeholder={t('communautes.nomExemple', 'Covoiturage U13')}
        placeholderTextColor={withAlpha(Colors.neutral00, 0.35)}
        style={[styles.champ, champ]}
        testID="nouveau-groupe-nom"
        value={nom}
      />
      <Text style={[styles.libelle, { color: sourdine }]}>
        {t('communautes.themeTitre', 'Thème')}
      </Text>
      <View style={styles.puces}>
        {THEMES_COMMUNAUTE.map((cle) => puce({
          actif: theme === cle,
          cle: `theme-${cle}`,
          libelle: nomDuTheme(cle),
          onPress: () => setTheme(cle),
        }))}
      </View>
      <Text style={[styles.libelle, { color: sourdine }]}>{t('communautes.icone', 'Icône')}</Text>
      <View style={styles.puces}>
        {ICONES_COMMUNAUTE.map((glyphe) => (
          <TouchableOpacity
            accessibilityLabel={glyphe}
            accessibilityRole="button"
            accessibilityState={{ selected: icone === glyphe }}
            key={glyphe}
            onPress={() => setIcone(icone === glyphe ? null : glyphe)}
            style={[
              styles.icone,
              { backgroundColor: fondDuChoix(icone === glyphe) },
            ]}
            testID={`nouveau-groupe-icone-${glyphe}`}
          >
            <GlyphIcon
              color={encreDuChoix(icone === glyphe)}
              name={glyphe}
              size={20}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.libelle, { color: sourdine }]}>
        {t('communautes.quiEcrit', 'Qui peut écrire')}
      </Text>
      <View style={styles.puces}>
        {puce({
          actif: quiEcrit === 'tous',
          cle: 'ecrit-tous',
          libelle: t('communautes.toutLeMonde', 'Tout le monde'),
          onPress: () => setQuiEcrit('tous'),
        })}
        {puce({
          actif: quiEcrit === 'admins',
          cle: 'ecrit-admins',
          libelle: t('communautes.seulementAdmins', 'Seulement les admins'),
          onPress: () => setQuiEcrit('admins'),
        })}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !etapeUnPrete({ nom, theme }) }}
        disabled={!etapeUnPrete({ nom, theme })}
        onPress={() => setEtape(2)}
        style={[
          styles.bouton,
          { backgroundColor: Colors.primary500, opacity: etapeUnPrete({ nom, theme }) ? 1 : 0.4 },
        ]}
        testID="nouveau-groupe-suivant"
      >
        <Text style={[styles.texteBouton, { color: Colors.primary900 }]}>
          {t('communautes.suivant', 'Suivant : choisir les membres')}
        </Text>
      </TouchableOpacity>
    </>
  );

  const toutCoche = (candidats || []).length > 0
    && (candidats || []).every((m) => choisis.includes(m.documentId));
  const etapeDeux = (
    <>
      <TextInput
        accessibilityLabel={t('communautes.chercher', 'Chercher un membre')}
        onChangeText={setRecherche}
        placeholder={t('communautes.chercher', 'Chercher un membre')}
        placeholderTextColor={withAlpha(Colors.neutral00, 0.35)}
        style={[styles.champ, champ]}
        testID="nouveau-groupe-recherche"
        value={recherche}
      />
      {candidats === null && !erreur ? (
        <ActivityIndicator color={Colors.primary500} style={styles.attente} />
      ) : null}
      {candidats ? (
        <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: toutCoche }}
            onPress={() => setChoisis(toutSelectionner(choisis, candidats))}
            style={styles.ligne}
            testID="nouveau-groupe-tout-selectionner"
          >
            <View style={styles.textes}>
              <Text style={[styles.nomMembre, { color: Colors.neutral00 }]}>
                {t('communautes.toutSelectionner', 'Tout sélectionner')}
              </Text>
              <Text style={[styles.aide, { color: sourdine }]}>
                {t('communautes.toutSelectionnerAide', '{{nom}} · {{total}} membres', {
                  nom: nomCommunaute,
                  total: candidats.length,
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
            </View>
            <View
              style={[
                styles.case,
                {
                  backgroundColor: toutCoche ? Colors.primary500 : 'transparent',
                  borderColor: Colors.primary500,
                },
              ]}
            >
              {toutCoche ? <GlyphIcon color={Colors.primary900} name="check" size={14} /> : null}
            </View>
          </TouchableOpacity>
          {visibles.map((m) => {
            const coche = choisis.includes(m.documentId);
            return (
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: coche }}
                key={m.documentId}
                onPress={() => setChoisis(basculerMembre(choisis, m.documentId))}
                style={[styles.ligne, { borderTopColor: filet, borderTopWidth: 1 }]}
                testID={`nouveau-groupe-membre-${m.documentId}`}
              >
                <View style={styles.textes}>
                  <Text numberOfLines={1} style={[styles.nomMembre, { color: Colors.neutral00 }]}>
                    {`${m.firstname || ''} ${m.lastname || ''}`.trim()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.case,
                    {
                      backgroundColor: coche ? Colors.primary500 : 'transparent',
                      borderColor: Colors.primary500,
                    },
                  ]}
                >
                  {coche ? <GlyphIcon color={Colors.primary900} name="check" size={14} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      <Text style={[styles.aide, { color: sourdine }]}>
        {t(
          'communautes.reglesMineurs',
          'Les enfants de moins de 13 ans n’entrent jamais dans un groupe à thème. '
            + 'Les groupes de parents, de covoiturage et de staff sont réservés aux adultes.',
        )}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: envoi || choisis.length < MEMBRES_MINIMUM }}
        disabled={envoi || choisis.length < MEMBRES_MINIMUM}
        onPress={creer}
        style={[
          styles.bouton,
          {
            backgroundColor: Colors.primary500,
            opacity: envoi || choisis.length < MEMBRES_MINIMUM ? 0.4 : 1,
          },
        ]}
        testID="nouveau-groupe-creer"
      >
        <Text style={[styles.texteBouton, { color: Colors.primary900 }]}>
          {t('communautes.creerAvec', 'Créer avec {{nombre}} membres', { nombre: choisis.length })}
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View
      style={[styles.page, { backgroundColor: Colors.chatBackground }]}
      testID="nouveau-groupe-communaute"
    >
      <EnTeteCommunaute
        onRetour={() => (etape === 2 ? setEtape(1) : navigation.goBack())}
        sousTitre={
          etape === 2
            ? t('communautes.cochesSur', '{{nom}} · {{nombre}} cochés', {
              nom: nom.trim(),
              nombre: choisis.length,
              ...SANS_ECHAPPEMENT,
            })
            : nomCommunaute
        }
        titre={
          etape === 2
            ? t('communautes.choisirLesMembres', 'Choisir les membres')
            : t('communautes.etapeUn', 'Étape 1 sur 2')
        }
      />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingBottom: 40 + bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {etape === 1 ? etapeUn : etapeDeux}
        {erreur ? (
          <Text style={[styles.erreur, { color: Colors.error500 }]} testID="nouveau-groupe-erreur">
            {erreur}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  aide: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    marginTop: 2,
  },
  attente: {
    marginTop: 24,
  },
  bouton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 48,
    justifyContent: 'center',
    marginTop: 8,
  },
  carte: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  case: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  champ: {
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: REGULIER_FAMILLE,
    fontSize: 16,
    height: 48,
    paddingHorizontal: 14,
  },
  contenu: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 640,
    padding: 16,
    width: '100%',
  },
  erreur: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 14,
  },
  icone: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  libelle: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 13,
    marginTop: 6,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  nomMembre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
  },
  page: {
    flex: 1,
  },
  puce: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  texteBouton: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
  },
  textePuce: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 14,
  },
  textes: {
    flex: 1,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 24,
  },
});

export default NouveauGroupeCommunaute;
