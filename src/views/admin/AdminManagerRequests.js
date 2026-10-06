import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  formatCollectiviteDay,
  isOfficialCollectiviteName,
} from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useAdminManagerRequests,
  useDecideManagerRequest,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/** @typedef {{ kind: 'accept' | 'refuse', request: any }} Decision */

const LARGEUR_COLONNES = 1024;
const INSEE_PATTERN = /^(\d{2}|2A|2B)\d{3}$/;
const SIREN_PATTERN = /^\d{9}$/;

/**
 * 🏛️ CONSOLE › DEMANDES DE GESTIONNAIRE — COLL-ACCUEIL (01/10/2026), décision d'Adel
 * « console oui » ; planches `P2-gestion-tel` et `-ordi`.
 *
 * Chaque inscription « Je représente une collectivité » arrive ici, et n'ouvre RIEN tant que
 * l'équipe FoundClub ne l'a pas validée. La file (en attente, traitées) ; une demande ouverte
 * dit la personne (fonction, e-mail professionnel, téléphone du compte), la collectivité
 * demandée et ce qu'elle a déjà (clubs, gestionnaires) ; deux gestes :
 *   - VALIDER : la personne devient gestionnaire (serveur, mécanisme du lot 1a). Une
 *     collectivité absente de FoundClub est créée INACTIVE : le serveur exige alors son code
 *     INSEE ou son SIREN (il ne crée jamais deux fois la même commune), et son nom officiel
 *     (D59) se vérifie ici ;
 *   - REFUSER : avec un motif, obligatoire, que la personne lira.
 * Seul un SuperAdmin arrive ici (pile AdminStack) ; le serveur refuse tout autre compte (403).
 * Paramètre de route facultatif : `collectiviteId` (« Ouvrir dans la file » depuis la fiche
 * d'une collectivité) : la file s'ouvre sur la demande de cette collectivité.
 * COLL-CONSOLE-BIS (03/10/2026), planche 17 (P2-gestion-ordi, état D) : sur le site, « Traitées »
 * est une GRILLE sur toute la largeur — Personne | Collectivité | Issue | Le (et qui a tranché),
 * le motif d'un refus sous sa ligne. Le téléphone garde ses cartes. L'e-mail est tranché
 * (`mail A`, 02/10) : la personne est prévenue dans l'app seulement, en v1.
 * @returns {import('react').ReactElement} L'écran.
 */
function AdminManagerRequests() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const navigation = /** @type {any} */ (useNavigation());
  const params = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const { width } = useWindowDimensions();
  const enColonnes = width >= LARGEUR_COLONNES;

  const [onglet, setOnglet] = useState(/** @type {'pending' | 'decided'} */ ('pending'));
  const [ouverteId, setOuverteId] = useState(/** @type {string | null} */ (null));
  const [decision, setDecision] = useState(/** @type {Decision | null} */ (null));
  const [motif, setMotif] = useState('');
  const [nomOfficiel, setNomOfficiel] = useState('');
  const [codeInsee, setCodeInsee] = useState('');
  const [siren, setSiren] = useState('');
  const [erreur, setErreur] = useState('');

  const enAttente = useAdminManagerRequests('pending');
  const traitees = useAdminManagerRequests('decided', { enabled: onglet === 'decided' });
  const trancher = /** @type {any} */ (useDecideManagerRequest());
  const liste = onglet === 'pending' ? enAttente : traitees;
  const demandes = Array.isArray(liste.data) ? liste.data : [];
  const nbEnAttente = Array.isArray(enAttente.data) ? enAttente.data.length : 0;

  // « Ouvrir dans la file » : la demande de CETTE collectivité, s'il y en a une.
  const parDefaut = onglet === 'pending' && params?.collectiviteId
    ? demandes.find((demande) => demande?.collectivite?.documentId === params.collectiviteId)
    : null;
  const ouverte = demandes.find((demande) => demande?.documentId === ouverteId)
    || parDefaut
    || (enColonnes && onglet === 'pending' ? demandes[0] : null)
    || null;

  const nomDe = (/** @type {any} */ demande) => [
    demande?.requester?.firstname,
    demande?.requester?.lastname,
  ]
    .filter(Boolean)
    .join(' ')
    || t('collectiviteAccueil.console.sansNom', 'Compte sans nom');
  // FINITIONS14 (planche 17) — « jeu. 1 oct. », comme la planche.
  const dateDe = (/** @type {unknown} */ valeur) => formatCollectiviteDay(
    /** @type {any} */ (valeur),
  );

  const ecrireA = (/** @type {string} */ adresse) => Promise
    .resolve(Linking.openURL(`mailto:${adresse}`))
    .catch(() => {});
  const ouvrirDecision = (/** @type {'accept' | 'refuse'} */ kind, /** @type {any} */ demande) => {
    setDecision({ kind, request: demande });
    setMotif('');
    setErreur('');
    setNomOfficiel(demande?.collectivite?.name || '');
    setCodeInsee(demande?.collectivite?.codeInsee || '');
    setSiren('');
  };
  const fermer = () => {
    if (trancher.isPending) return;
    setDecision(null);
  };

  const confirmer = async () => {
    if (!decision) return;
    setErreur('');
    const aCreer = decision.kind === 'accept' && !decision.request?.collectivite?.exists;
    /** @type {Record<string, string>} */
    const data = {};
    if (decision.kind === 'refuse') {
      if (motif.trim().length < 3) {
        setErreur(
          t(
            'collectiviteAccueil.console.refus.motifObligatoire',
            'Le motif est obligatoire : la personne le lira.',
          ),
        );
        return;
      }
      data.reason = motif.trim();
    } else if (aCreer) {
      const insee = codeInsee.trim().toUpperCase();
      const sirenPropre = siren.replace(/\s/g, '');
      if (!isOfficialCollectiviteName(nomOfficiel, decision.request?.collectivite?.type)) {
        setErreur(
          t(
            'collectiviteAccueil.console.validation.nomOfficiel',
            // eslint-disable-next-line max-len
            'Écris le nom officiel : « Ville de … », « Communauté de communes … », « Département de … ».',
          ),
        );
        return;
      }
      if (
        (insee && !INSEE_PATTERN.test(insee))
        || (sirenPropre && !SIREN_PATTERN.test(sirenPropre))
        || (!insee && !sirenPropre)
      ) {
        setErreur(
          t(
            'collectiviteAccueil.console.validation.code',
            // eslint-disable-next-line max-len
            'Un code INSEE (5 caractères) ou un SIREN (9 chiffres) est obligatoire pour créer la collectivité.',
          ),
        );
        return;
      }
      data.name = nomOfficiel.trim();
      if (insee) data.codeInsee = insee;
      if (sirenPropre) data.siren = sirenPropre;
    }
    try {
      await trancher.mutateAsync({
        data,
        decision: decision.kind,
        requestId: decision.request?.documentId,
      });
      setDecision(null);
      setOuverteId(null);
    } catch (error) {
      setErreur(getErrorMessage(/** @type {any} */ (error)));
    }
  };

  const carteStyle = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    gap: 8,
  };
  const pastille = (/** @type {string} */ texte, /** @type {string} */ couleur) => (
    <View
      style={[
        ApplicationStyle.borderRadius12,
        {
          backgroundColor: withAlpha(couleur, 0.16),
          borderColor: withAlpha(couleur, 0.5),
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
      ]}
    >
      <Text style={[Fonts.p3Bold, { color: couleur }]}>{texte}</Text>
    </View>
  );
  const pastilleVille = (/** @type {any} */ demande) => (demande?.collectivite?.exists
    ? pastille(t('collectiviteAccueil.console.existe', 'Existe'), Colors.success500)
    : pastille(
      t('collectiviteAccueil.console.pasEncore', 'Pas encore sur FoundClub'),
      Colors.warning500,
    ));

  const renderCarteFile = (/** @type {any} */ demande) => {
    const choisie = ouverte?.documentId === demande?.documentId;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: choisie }}
        key={demande?.documentId}
        onPress={() => setOuverteId(demande?.documentId)}
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          carteStyle,
          choisie && enColonnes ? { borderColor: Colors.primary500 } : null,
        ]}
        testID={`gestionnaire-demande-${demande?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>{nomDe(demande)}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{dateDe(demande?.createdAt)}</Text>
        </View>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {[demande?.jobTitle, demande?.professionalEmail].filter(Boolean).join(' · ')}
        </Text>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, { gap: 8 }]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{demande?.collectivite?.name}</Text>
          {pastilleVille(demande)}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCarteTraitee = (/** @type {any} */ demande) => {
    const validee = demande?.status === 'accepted';
    return (
      <View
        key={demande?.documentId}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
        testID={`gestionnaire-traitee-${demande?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>{nomDe(demande)}</Text>
          {validee
            ? pastille(t('collectiviteAccueil.console.validee', 'Validée'), Colors.success500)
            : pastille(t('collectiviteAccueil.console.refusee', 'Refusée'), Colors.error300)}
        </View>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {demande?.decidedBy
            ? t('collectiviteAccueil.console.trancheePar', '{{ville}} · le {{date}} par {{qui}}', {
              date: dateDe(demande?.decidedAt),
              qui: demande.decidedBy,
              ville: demande?.collectivite?.name || '',
              ...SANS_ECHAPPEMENT,
            })
            : t('collectiviteAccueil.console.tranchee', '{{ville}} · le {{date}}', {
              date: dateDe(demande?.decidedAt),
              ville: demande?.collectivite?.name || '',
              ...SANS_ECHAPPEMENT,
            })}
        </Text>
        {!validee && demande?.refusalReason ? (
          <Text style={[Fonts.p2, Fonts.neutral100, { fontStyle: 'italic' }]}>
            {`« ${demande.refusalReason} »`}
          </Text>
        ) : null}
      </View>
    );
  };

  // COLL-CONSOLE-BIS (03/10) — une ligne de la grille des demandes traitées (site, planche 17).
  const renderLigneTraitee = (/** @type {any} */ demande) => {
    const validee = demande?.status === 'accepted';
    return (
      <View
        key={demande?.documentId}
        style={[
          Spaces.paddingVertical[12],
          { borderTopColor: withAlpha(Colors.primary500, 0.25), borderTopWidth: 1, gap: 4 },
        ]}
        testID={`gestionnaire-traitee-${demande?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 2 }]}>{nomDe(demande)}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100, { flex: 2 }]}>
            {demande?.collectivite?.name || ''}
          </Text>
          <View style={[Alignments.row, { flex: 1 }]}>
            {validee
              ? pastille(t('collectiviteAccueil.console.validee', 'Validée'), Colors.success500)
              : pastille(t('collectiviteAccueil.console.refusee', 'Refusée'), Colors.error300)}
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200, { flex: 2 }]}>
            {[dateDe(demande?.decidedAt), demande?.decidedBy].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {!validee && demande?.refusalReason ? (
          <Text style={[Fonts.p2, Fonts.neutral100, { fontStyle: 'italic' }]}>
            {`« ${demande.refusalReason} »`}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderFiche = (/** @type {any} */ demande) => {
    const ville = demande?.collectivite || {};
    const etatVille = ville.exists
      ? t(
        'collectiviteAccueil.console.villeEtat',
        '{{etat}} · {{clubs}} clubs · {{gestionnaires}}',
        {
          clubs: ville.clubsCount ?? 0,
          etat: ville.isActive
            ? t('collectiviteAccueil.console.active', 'Active')
            : t('collectiviteAccueil.console.inactive', 'Inactive'),
          gestionnaires:
              Array.isArray(ville.gestionnaires) && ville.gestionnaires.length > 0
                ? t(
                  'collectiviteAccueil.console.gestionnairesActuels',
                  'gestionnaires : {{noms}}',
                  {
                    noms: ville.gestionnaires.join(', '),
                    ...SANS_ECHAPPEMENT,
                  },
                )
                : t('collectiviteAccueil.console.aucunGestionnaire', 'aucun gestionnaire'),
          ...SANS_ECHAPPEMENT,
        },
      )
      : t('collectiviteAccueil.console.villeAbsente', '{{code}}pas encore sur FoundClub', {
        code: ville.codeInsee
          ? t('collectiviteAccueil.console.codeInsee', 'Code INSEE {{code}} · ', {
            code: ville.codeInsee,
          })
          : '',
        ...SANS_ECHAPPEMENT,
      });
    const boutonRefuser = (
      <Button
        key="refuser"
        onPress={() => ouvrirDecision('refuse', demande)}
        title={t('collectiviteAccueil.console.refuser', 'Refuser')}
        variant="Secondary"
      />
    );
    const boutonValider = (
      <Button
        key="valider"
        onPress={() => ouvrirDecision('accept', demande)}
        title={
          ville.exists
            ? t('collectiviteAccueil.console.valider', 'Valider : nommer gestionnaire')
            : t('collectiviteAccueil.console.validerCreer', 'Valider et créer la Ville')
        }
        variant="Primary"
      />
    );
    return (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[enColonnes ? 24 : 16],
          carteStyle,
          { gap: 16 },
        ]}
        testID="gestionnaire-fiche"
      >
        {enColonnes ? null : (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setOuverteId(null)}
            style={{ justifyContent: 'center', minHeight: 44 }}
            testID="gestionnaire-retour-file"
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('collectiviteAccueil.console.retourFile', 'Retour à la file')}
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('collectiviteAccueil.console.demandeDe', 'Demande de gestionnaire').toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {nomDe(demande)}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('collectiviteAccueil.console.inscrite', 'Inscrite le {{date}}', {
              date: dateDe(demande?.createdAt),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
        <View style={[enColonnes ? Alignments.row : null, { gap: 16 }]}>
          <View style={{ flex: enColonnes ? 1 : undefined, gap: 6 }}>
            <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
              {t('collectiviteAccueil.console.laPersonne', 'La personne').toUpperCase()}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('collectiviteAccueil.console.fonction', 'Fonction : {{fonction}}', {
                fonction: demande?.jobTitle || '—',
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
            {demande?.professionalEmail ? (
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => ecrireA(demande.professionalEmail)}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>{demande.professionalEmail}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('collectiviteAccueil.console.telephone', 'Téléphone du compte : {{numero}}', {
                numero: demande?.requester?.phone || '—',
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          </View>
          <View style={{ flex: enColonnes ? 1 : undefined, gap: 6 }}>
            <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
              {t('collectiviteAccueil.console.laVille', 'La collectivité demandée').toUpperCase()}
            </Text>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{ville.name}</Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>{etatVille}</Text>
          </View>
        </View>
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
        >
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'collectiviteAccueil.console.conseil',
              // eslint-disable-next-line max-len
              'Avant de valider : appelle le standard de la mairie, ou réponds depuis son adresse officielle. La personne verra les demandes des clubs, leurs contacts généraux et leurs dirigeants.',
            )}
          </Text>
        </View>
        {/* FINITIONS14 (T13-bis, planche 17) — téléphone : « Valider » AU-DESSUS de « Refuser »
            (état 2) ; site : « Refuser » à gauche du geste principal (planche ordi, état A). */}
        <View style={[enColonnes ? Alignments.row : null, { gap: 12, justifyContent: 'flex-end' }]}>
          {enColonnes ? boutonRefuser : boutonValider}
          {enColonnes ? boutonValider : boutonRefuser}
        </View>
      </View>
    );
  };

  const motifsRapides = [
    {
      cle: 'lien',
      libelle: t('collectiviteAccueil.console.refus.lien', 'Lien avec la mairie non vérifié'),
      texte: t(
        'collectiviteAccueil.console.refus.lienTexte',
        // eslint-disable-next-line max-len
        'Nous n’avons pas pu vérifier votre lien avec la mairie. Écrivez-nous depuis l’adresse officielle du service.',
      ),
    },
    {
      cle: 'adresse',
      libelle: t('collectiviteAccueil.console.refus.adresse', 'Adresse non officielle'),
      texte: t(
        'collectiviteAccueil.console.refus.adresseTexte',
        'L’adresse donnée n’est pas une adresse officielle de la collectivité.',
      ),
    },
    {
      cle: 'geree',
      libelle: t('collectiviteAccueil.console.refus.geree', 'Déjà gérée'),
      texte: t(
        'collectiviteAccueil.console.refus.gereeTexte',
        'Cette collectivité a déjà un gestionnaire : adressez-vous à lui.',
      ),
    },
  ];

  const renderFenetre = () => {
    if (!decision) return null;
    const estRefus = decision.kind === 'refuse';
    const ville = decision.request?.collectivite || {};
    let libelleConfirmer = t(
      'collectiviteAccueil.console.validerCreer',
      'Valider et créer la Ville',
    );
    if (estRefus) {
      libelleConfirmer = t('collectiviteAccueil.console.refus.confirmer', 'Refuser la demande');
    } else if (ville.exists) {
      libelleConfirmer = t('collectiviteAccueil.console.validation.confirmer', 'Valider');
    }
    const champStyle = {
      borderColor: withAlpha(Colors.primary500, 0.27),
      color: Colors.neutral00,
    };
    return (
      <Modal animationType="fade" onRequestClose={fermer} transparent visible>
        <View
          style={[
            Alignments.fill,
            Alignments.justifyCenter,
            Alignments.alignCenter,
            Spaces.padding[24],
            { backgroundColor: withAlpha(Colors.neutral900, 0.7) },
          ]}
        >
          <View
            accessibilityViewIsModal
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.gap[16],
              {
                borderColor: withAlpha(Colors.primary500, 0.4),
                maxWidth: 560,
                padding: 20,
                width: '100%',
              },
            ]}
            testID="gestionnaire-fenetre"
          >
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {estRefus
                ? t('collectiviteAccueil.console.refus.titre', 'Refuser la demande')
                : t('collectiviteAccueil.console.validation.titre', 'Valider la demande ?')}
            </Text>
            {estRefus ? (
              <>
                <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
                  {motifsRapides.map((rapide) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={rapide.cle}
                      onPress={() => setMotif(rapide.texte)}
                      style={[
                        ApplicationStyle.borderRadius12,
                        {
                          borderColor: withAlpha(Colors.neutral00, 0.2),
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        },
                      ]}
                      testID={`gestionnaire-motif-${rapide.cle}`}
                    >
                      <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{rapide.libelle}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel={t(
                    'collectiviteAccueil.console.refus.motif',
                    'Le motif (obligatoire)',
                  )}
                  multiline
                  onChangeText={setMotif}
                  placeholder={t(
                    'collectiviteAccueil.console.refus.motif',
                    'Le motif (obligatoire)',
                  )}
                  placeholderTextColor={Colors.neutral400}
                  style={[
                    ApplicationStyle.borderRadius16,
                    ApplicationStyle.borderWidth1,
                    Fonts.p2,
                    Spaces.padding[16],
                    champStyle,
                    { minHeight: 96, textAlignVertical: 'top' },
                  ]}
                  testID="gestionnaire-motif"
                  value={motif}
                />
              </>
            ) : (
              <>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {t(
                    'collectiviteAccueil.console.validation.texte',
                    '{{nom}} devient gestionnaire de {{ville}}.',
                    {
                      nom: nomDe(decision.request),
                      ville: ville.name || '',
                      ...SANS_ECHAPPEMENT,
                    },
                  )}
                </Text>
                {ville.exists ? null : (
                  <View style={{ gap: 10 }}>
                    <View
                      style={[
                        ApplicationStyle.borderRadius12,
                        Spaces.padding[12],
                        {
                          backgroundColor: withAlpha(Colors.warning500, 0.12),
                          borderColor: withAlpha(Colors.warning500, 0.4),
                          borderWidth: 1,
                          gap: 4,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                        {t(
                          'collectiviteAccueil.console.validation.absente',
                          '{{ville}} n’existe pas encore.',
                          {
                            ville: ville.name || '',
                            ...SANS_ECHAPPEMENT,
                          },
                        )}
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'collectiviteAccueil.console.validation.creee',
                          // eslint-disable-next-line max-len
                          'Elle sera créée inactive, sans club, avec le code ci-dessous. Tu compléteras sa fiche, puis tu l’activeras.',
                        )}
                      </Text>
                    </View>
                    {[
                      [
                        'nomOfficiel',
                        t('collectiviteAccueil.console.validation.nom', 'Nom officiel'),
                        nomOfficiel,
                        setNomOfficiel,
                      ],
                      [
                        'codeInsee',
                        t('collectiviteAccueil.console.validation.insee', 'Code INSEE'),
                        codeInsee,
                        setCodeInsee,
                      ],
                      [
                        'siren',
                        t('collectiviteAccueil.console.validation.siren', 'SIREN'),
                        siren,
                        setSiren,
                      ],
                    ].map(([cle, libelle, valeur, changer]) => (
                      <TextInput
                        accessibilityLabel={/** @type {string} */ (libelle)}
                        key={/** @type {string} */ (cle)}
                        onChangeText={/** @type {(texte: string) => void} */ (changer)}
                        placeholder={/** @type {string} */ (libelle)}
                        placeholderTextColor={Colors.neutral400}
                        style={[
                          ApplicationStyle.borderRadius12,
                          ApplicationStyle.borderWidth1,
                          Fonts.p2,
                          Spaces.padding[12],
                          champStyle,
                        ]}
                        testID={`gestionnaire-${cle}`}
                        value={/** @type {string} */ (valeur)}
                      />
                    ))}
                  </View>
                )}
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'collectiviteAccueil.console.validation.prevenue',
                    'La personne reçoit une notification : son espace est ouvert.',
                  )}
                </Text>
              </>
            )}
            {erreur ? (
              <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>
                {erreur}
              </Text>
            ) : null}
            <View style={{ gap: 12 }}>
              <Button
                disabled={Boolean(trancher.isPending)}
                onPress={confirmer}
                title={libelleConfirmer}
                variant="Primary"
              />
              <Button
                disabled={Boolean(trancher.isPending)}
                onPress={fermer}
                title={t('collectiviteAccueil.console.annuler', 'Annuler')}
                variant="Secondary"
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  let file;
  if (liste.isLoading) {
    file = <Loader />;
  } else if (liste.error) {
    file = (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {getErrorMessage(/** @type {any} */ (liste.error))}
        </Text>
        <Button
          onPress={() => liste.refetch?.()}
          title={t('collectiviteAccueil.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (demandes.length === 0) {
    file = (
      <View style={{ gap: 4 }} testID="gestionnaire-vide">
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {onglet === 'pending'
            ? t('collectiviteAccueil.console.videAttente', 'Aucune demande en attente.')
            : t(
              'collectiviteAccueil.console.videTraitees',
              'Aucune demande traitée pour l’instant.',
            )}
        </Text>
        {onglet === 'pending' ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'collectiviteAccueil.console.videDit',
              'Les inscriptions « Je représente une collectivité » arrivent ici.',
            )}
          </Text>
        ) : null}
      </View>
    );
  } else if (onglet === 'decided' && enColonnes) {
    const colonne = (/** @type {string} */ texte, /** @type {number} */ flex) => (
      <Text style={[Fonts.p3Bold, Fonts.neutral300, { flex }]}>{texte}</Text>
    );
    file = (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[8],
          carteStyle,
        ]}
        testID="gestionnaire-traitees-grille"
      >
        <View style={[Alignments.row, Spaces.paddingVertical[8], { gap: 12 }]}>
          {colonne(t('collectiviteConsoleBis.traitees.colonnePersonne', 'Personne'), 2)}
          {colonne(t('collectiviteConsoleBis.traitees.colonneCollectivite', 'Collectivité'), 2)}
          {colonne(t('collectiviteConsoleBis.traitees.colonneIssue', 'Issue'), 1)}
          {colonne(t('collectiviteConsoleBis.traitees.colonneLe', 'Le'), 2)}
        </View>
        {demandes.map(renderLigneTraitee)}
      </View>
    );
  } else {
    file = (
      <View style={{ gap: 12 }}>
        {demandes.map(onglet === 'pending' ? renderCarteFile : renderCarteTraitee)}
      </View>
    );
  }

  const enTete = (
    <View style={{ gap: 4 }}>
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('adminCollectivites.kicker', 'Console').toUpperCase()}
      </Text>
      <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
        {t('collectiviteAccueil.console.titre', 'Demandes de gestionnaire')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteAccueil.console.dit',
          // eslint-disable-next-line max-len
          'Une inscription « Je représente une collectivité » n’ouvre rien tant que tu ne l’as pas validée.',
        )}
      </Text>
    </View>
  );
  const segments = (
    <SegmentedControl
      onChange={(/** @type {string} */ valeur) => {
        // FINITIONS18 · POINT 7 (T15, T16) — au téléphone, « Traitées » « ne réagit pas » (2 appuis),
        // alors que la logique est juste (témoins) et que le même contrôle marche sur « Demandes
        // de la Ville ». Cette ligne dit dans logcat si l'appui ARRIVE au code.
        // ponytail: diagnostic ; à retirer avec le correctif.
        console.info(`[CONSOLE] ONGLET_GESTIONNAIRES valeur=${valeur} avant=${onglet}`);
        setOnglet(valeur === 'decided' ? 'decided' : 'pending');
        setOuverteId(null);
      }}
      options={[
        {
          label: t('collectiviteAccueil.console.ongletAttente', 'En attente ({{nombre}})', {
            nombre: nbEnAttente,
          }),
          value: 'pending',
        },
        { label: t('collectiviteAccueil.console.ongletTraitees', 'Traitées'), value: 'decided' },
      ]}
      value={onglet}
    />
  );

  // Téléphone : la file, ou la demande ouverte. Ordinateur : la file à gauche, la demande à droite.
  let corps;
  if (enColonnes && onglet === 'decided') {
    // COLL-CONSOLE-BIS (03/10) — la grille des traitées prend toute la largeur (planche 17).
    corps = (
      <View style={{ gap: 12 }}>
        <View style={{ width: 400 }}>{segments}</View>
        {file}
      </View>
    );
  } else if (enColonnes) {
    corps = (
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
        <View style={{ gap: 12, width: 400 }}>
          {segments}
          {file}
        </View>
        <View style={{ flex: 1 }}>
          {onglet === 'pending' && ouverte ? renderFiche(ouverte) : null}
        </View>
      </View>
    );
  } else if (onglet === 'pending' && ouverte) {
    corps = renderFiche(ouverte);
  } else {
    corps = (
      <View style={{ gap: 12 }}>
        {segments}
        {file}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      {renderFenetre()}
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => {
              enAttente.refetch?.();
              traitees.refetch?.();
            }}
            refreshing={Boolean(enAttente.isRefetching || traitees.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {enTete}
        {corps}
        {navigation?.canGoBack?.() ? null : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminManagerRequests;
