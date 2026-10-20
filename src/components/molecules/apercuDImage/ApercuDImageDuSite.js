import i18next from 'i18next';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';

import { colors, withAlpha } from '@/theme/colors';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';

// Jumeaux `.native.js` (Metro, Jest) et `.web.js` (Vite) : le controle de types ne voit
// aucun fichier a ce chemin exact (meme note que `CollectiviteChiffres.js`).
// @ts-ignore -- cf. ci-dessus
import { ECHECS_D_ENREGISTREMENT, enregistrerLImage } from '@/platform/media/enregistrerLImage';

// La regle du glisser, la MEME que sur le telephone.
import { doitFermer, opaciteDuFond } from './gesteDeFermeture';

/**
 * MSGIMG — L'IMAGE D'UNE CONVERSATION OUVERTE EN GRAND, SUR LE SITE (20/10/2026).
 *
 * 🐛 AVANT : le site n'avait pas d'apercu. Toucher une photo l'ouvrait dans un NOUVEL
 * ONGLET, hors de la conversation — sans croix, sans « Enregistrer ».
 *
 * ✅ Les memes regles que le telephone (`ApercuDImage.js`) :
 *  - la croix dans un ROND sombre translucide, lisible sur une photo blanche ;
 *  - « Enregistrer » TELECHARGE le fichier (`enregistrerLImage.web.js`) ;
 *  - Echap ferme, et le focus revient a ce qui avait ouvert l'image ;
 *  - glisser vers le bas ferme — AU TOUCHER seulement (`pointerType`), la souris ne
 *    glisse pas une image. `touch-action: pinch-zoom` : le doigt qui glisse est pour
 *    nous, mais le pincement pour zoomer reste au navigateur.
 *
 * ⚠️ POSEE DANS `<body>` PAR `WebFloatingOverlay`, et pas dans la page : la carte de
 * navigation du site porte une transformation, qui CONFINE un `position: fixed` et son
 * z-index. Mesure le 20/10 (capture 390 px) : dessinee dans la page, l'apercu passait SOUS
 * la barre d'onglets du telephone. Le calque (z-index 1 300) passe au-dessus d'elle (1 100).
 */

/** Opacite du rond derriere les boutons de l'apercu (la meme que le telephone). */
const OPACITE_DU_ROND = 0.65;

/** Duree d'affichage de l'avis (ms). */
const DUREE_DE_L_AVIS = 3500;

const HABILLAGE_DU_ROND = {
  alignItems: 'center',
  background: withAlpha(colors.neutral900, OPACITE_DU_ROND),
  border: `1px solid ${withAlpha(colors.neutral00, 0.35)}`,
  boxSizing: 'border-box',
  color: colors.neutral00,
  cursor: 'pointer',
  display: 'flex',
  height: 44,
  justifyContent: 'center',
  position: 'absolute',
  top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
};

/**
 * L'apercu plein ecran d'une image de la messagerie du site.
 * @param {object} props
 * @param {() => void} props.onClose Referme l'apercu.
 * @param {string} props.uri L'adresse de l'image ('' = ferme).
 * @returns {import('react').ReactElement | null} La fenetre.
 */
function ApercuDImageDuSite({ onClose, uri }) {
  const [glissement, setGlissement] = useState(0);
  const [enGeste, setEnGeste] = useState(false);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [avis, setAvis] = useState('');
  const departRef = useRef(/** @type {{ id: number, t: number, y: number } | null} */ (null));
  const enCoursRef = useRef(false);
  const minuterieRef = useRef(/** @type {any} */ (null));
  const croixRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  // Chaque ouverture repart d'une image a sa place, sans avis ; la croix prend le focus,
  // et le rend a ce qui avait ouvert l'image quand elle se referme.
  useEffect(() => {
    setGlissement(0);
    setEnGeste(false);
    setAvis('');
    departRef.current = null;
    if (!uri || typeof document === 'undefined') return undefined;
    const declencheur = /** @type {HTMLElement | null} */ (document.activeElement);
    croixRef.current?.focus?.();
    const surTouche = (/** @type {KeyboardEvent} */ evenement) => {
      if (evenement.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
      declencheur?.focus?.();
    };
  }, [onClose, uri]);

  useEffect(() => () => clearTimeout(minuterieRef.current), []);

  const montrerAvis = useCallback((/** @type {string} */ texte) => {
    clearTimeout(minuterieRef.current);
    setAvis(texte);
    minuterieRef.current = setTimeout(() => setAvis(''), DUREE_DE_L_AVIS);
  }, []);

  const enregistrer = useCallback(async () => {
    if (enCoursRef.current || !uri) return;
    enCoursRef.current = true;
    setEnregistrementEnCours(true);
    try {
      const { issue } = await enregistrerLImage(uri);
      montrerAvis(issue === 'ouverte'
        ? i18next.t(
          'conversation.imagePreview.openedInTab',
          'L’image s’ouvre dans un nouvel onglet : enregistre-la depuis là.',
        )
        : i18next.t('conversation.imagePreview.downloaded', 'Image téléchargée'));
    } catch (erreur) {
      montrerAvis(/** @type {any} */ (erreur)?.reason === ECHECS_D_ENREGISTREMENT.PERMISSION
        ? i18next.t('conversation.imagePreview.permissionTitle', 'Accès aux photos refusé')
        : i18next.t(
          'conversation.imagePreview.saveFailed',
          'L’image n’a pas pu être enregistrée. Réessaie.',
        ));
    } finally {
      enCoursRef.current = false;
      setEnregistrementEnCours(false);
    }
  }, [montrerAvis, uri]);

  const hauteur = () => (typeof window === 'undefined' ? 0 : window.innerHeight);

  const surAppui = (/** @type {PointerEvent} */ evenement) => {
    if (evenement.pointerType === 'mouse') return;
    departRef.current = { id: evenement.pointerId, t: evenement.timeStamp, y: evenement.clientY };
    setEnGeste(true);
  };
  const surDeplacement = (/** @type {PointerEvent} */ evenement) => {
    const depart = departRef.current;
    if (!depart || evenement.pointerId !== depart.id) return;
    setGlissement(Math.max(0, evenement.clientY - depart.y));
  };
  const surLacher = (/** @type {PointerEvent} */ evenement) => {
    const depart = departRef.current;
    if (!depart || evenement.pointerId !== depart.id) return;
    departRef.current = null;
    setEnGeste(false);
    const distance = evenement.clientY - depart.y;
    const vitesse = (distance / Math.max(1, evenement.timeStamp - depart.t)) * 1000;
    if (doitFermer(distance, vitesse, hauteur())) {
      onClose();
      return;
    }
    setGlissement(0);
  };
  const surAbandon = () => {
    departRef.current = null;
    setEnGeste(false);
    setGlissement(0);
  };

  if (!uri) return null;

  const titreDeLEnregistrement = i18next.t(
    'conversation.imagePreview.downloadHint',
    'Télécharger l’image',
  );

  return (
    <WebFloatingOverlay
      style={{
        bottom: 0, left: 0, right: 0, top: 0, zIndex: 1300,
      }}
    >
      <div
        aria-label={i18next.t('conversation.imagePreview.title', 'Image en grand')}
        aria-modal="true"
        data-testid="MSGIMG-apercu"
        role="dialog"
        style={{
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'auto',
          position: 'absolute',
        }}
      >
        <div
          data-testid="MSGIMG-fond"
          style={{
            background: colors.neutral900,
            inset: 0,
            opacity: opaciteDuFond(glissement, hauteur()),
            position: 'absolute',
          }}
        />

        <div
          data-testid="MSGIMG-image-glissante"
          onPointerCancel={surAbandon}
          onPointerDown={surAppui}
          onPointerMove={surDeplacement}
          onPointerUp={surLacher}
          style={{
            alignItems: 'center',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            position: 'absolute',
            touchAction: 'pinch-zoom',
            transform: `translateY(${glissement}px)`,
            transition: enGeste ? 'none' : 'transform 180ms ease-out',
          }}
        >
          <img
            alt={i18next.t('conversation.attachments.photo', 'Photo')}
            draggable={false}
            src={uri}
            style={{
              maxHeight: '90%',
              maxWidth: '100%',
              objectFit: 'contain',
              userSelect: 'none',
            }}
          />
        </div>

        <button
          aria-label={i18next.t('conversation.imagePreview.close', 'Fermer l’image')}
          data-testid="MSGIMG-fermer"
          onClick={onClose}
          ref={croixRef}
          style={{
            ...HABILLAGE_DU_ROND,
            borderRadius: 999,
            left: 16,
            padding: 0,
            width: 44,
          }}
          type="button"
        >
          <GlyphIcon color={colors.neutral00} name="xmark" size={22} />
        </button>

        <button
          aria-busy={enregistrementEnCours}
          aria-label={titreDeLEnregistrement}
          data-testid="MSGIMG-enregistrer"
          disabled={enregistrementEnCours}
          onClick={enregistrer}
          style={{
            ...HABILLAGE_DU_ROND,
            borderRadius: 999,
            fontFamily: 'Montserrat-Bold, sans-serif',
            fontSize: 13,
            gap: 8,
            padding: '0 16px',
            right: 16,
          }}
          title={titreDeLEnregistrement}
          type="button"
        >
          <GlyphIcon color={colors.neutral00} name="arrowDownToBracket" size={20} />
          <span>
            {enregistrementEnCours
              ? i18next.t('conversation.imagePreview.saving', 'Enregistrement…')
              : i18next.t('conversation.imagePreview.save', 'Enregistrer')}
          </span>
        </button>

        {avis ? (
          <div
            role="status"
            style={{
              background: withAlpha(colors.neutral900, OPACITE_DU_ROND),
              border: `1px solid ${withAlpha(colors.neutral00, 0.35)}`,
              borderRadius: 22,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
              boxSizing: 'border-box',
              color: colors.neutral00,
              fontFamily: 'Montserrat-Regular, sans-serif',
              fontSize: 14,
              left: '50%',
              maxWidth: 'calc(100vw - 32px)',
              padding: '12px 16px',
              position: 'absolute',
              textAlign: 'center',
              transform: 'translateX(-50%)',
            }}
          >
            {avis}
          </div>
        ) : null}
      </div>
    </WebFloatingOverlay>
  );
}

export default ApercuDImageDuSite;
