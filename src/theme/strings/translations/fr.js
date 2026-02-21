export default {
  addCoach: {
    actions: {
      save: 'Ajouter',
      invite: 'Inviter',
    },
    alerts: {
      success: {
        title: 'Ajout réussi !',
        description: "L'entraîneur·e {{trainerName}} a bien été ajouté·e à votre club.",
      },
      alreadyExist: {
        actions: {
          addToClub: 'Ajouter au club',
          cancel: 'Annuler',
        },
        description: "Le détenteur de ce numéro de téléphone utilise l'application sous le nom de {{firstname}} {{lastname}}. Voulez-vous l'ajouter à votre club ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter cet·te entraîneur·e à l'équipe",
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
    },
    subtitles: {
      avatar: "Ajoutez une photo de profil pour que l'on puisse reconnaître l'entraîneur·e facilement.",
      birthdate: "Renseignez la date de naissance de l'entraîneur·e.",
      name: "Renseignez le nom et prénom de l'entraîneur·e.",
    },
    titles: {
      birthdate: 'Quelle est sa date de naissance ?',
      main: 'Ajouter un·e entraîneur·e',
      name: "Comment s'appelle l'entraîneur·e ?",
    },
  },
  addSponsor: {
    actions: {
      save: 'Ajouter',
    },
    fields: {
      link: {
        label: 'Lien vers le site du partenaire',
        placeholder: 'https://www.nike.com',
      },
      logo: 'Logo du partenaire',
      title: {
        label: 'Nom du partenaire',
        placeholder: 'Nike',
      },
    },
    title: 'Ajouter un partenaire',
  },
  APIerrors: {
    // Authentication errors
    AUTHENTICATION_FAILED: "Échec d'authentification.",
    INVALID_TOKEN: "Jeton d'authentification invalide.",
    MISSING_TOKEN: "Jeton d'authentification manquant.",
    OTP_ERROR: 'Une erreur est survenue lors de la connexion OTP',

    // Authorization errors
    FORBIDDEN: 'Accès refusé.',
    UNAUTHORIZED: "Vous n'êtes pas autorisé·e à effectuer cette action.",

    // Validation errors
    INVALID_FIELD_FORMAT: 'Format de champ invalide.',
    MISSING_REQUIRED_FIELD: 'Un champ obligatoire est manquant.',
    VALIDATION_ERROR: 'Erreur de validation.',

    // User errors
    EMAIL_TAKEN: 'Cette adresse email est déjà utilisée.',
    PHONE_NUMBER_TAKEN: 'Ce numéro de téléphone est déjà utilisé.',
    USER_ALREADY_EXISTS: 'Cet utilisateur existe déjà.',
    USER_NOT_FOUND: 'Utilisateur introuvable.',
    USERNAME_TAKEN: "Ce nom d'utilisateur est déjà utilisé.",

    // Club errors
    CLUB_DELETE_ERROR: 'Erreur lors de la suppression du club.',
    CLUB_IMPORT_ERROR: "Erreur lors de l'import des données du club.",
    CLUB_NOT_FOUND: 'Club introuvable.',
    CLUB_SPONSOR_ERROR: 'Erreur concernant le partenaire du club.',
    CLUB_UPDATE_ERROR: 'Erreur lors de la mise à jour du club.',
    USER_NOT_IN_CLUB: "L'utilisateur n'est pas membre du club.",

    // Membership request errors
    MEMBERSHIP_REQUEST_ALREADY_PROCESSED: "La demande d'adhésion a déjà été traitée.",
    MEMBERSHIP_REQUEST_NOT_PENDING: "La demande d'adhésion n'est pas en attente.",
    MEMBERSHIP_REQUEST_REFUSED: "La demande d'adhésion a été refusée.",

    // Sport errors
    SPORT_DELETE_ERROR: 'Erreur lors de la suppression du sport.',

    // Trainer errors
    NOT_A_TRAINER: "L'utilisateur n'est pas un·e entraîneur·e.",
    TRAINER_ALREADY_IN_CLUB: "L'entraîneur·e est déjà membre d'un club.",
    TRAINER_HAS_TEAMS: "L'entraîneur·e est associé·e à des équipes.",
    TRAINER_IS_UNIQUE_TEAM_TRAINER: "L'entraîneur·e est le/la seul·e entraîneur·e de l'équipe.",
    TRAINER_NOT_FOUND: 'Entraîneur·e introuvable.',
    TRAINER_NOT_IN_CLUB: "L'entraîneur·e n'est pas membre du club.",

    // Team errors
    CLUB_MAX_TEAM_NUMBER_REACHED: 'Le nombre maximum d\'équipes pour ce club a été atteint.',
    TEAM_CLUB_REQUIRED: 'Un club est requis pour chaque équipe.',
    TEAM_MEMBER_POLICY_ERROR: 'Pour effectuer cette action, vous devez être membre de l\'équipe.',
    TEAM_PLAYER_REMOVE_ERROR: 'Erreur lors de la suppression du/de la joueur·se de l\'équipe.',
    TEAM_TRAINER_CONNECT_REQUIRED: 'La connexion avec l\'entraîneur·e est requise.',
    TEAM_TRAINER_REMOVE_ERROR: 'Erreur lors de la suppression de l\'entraîneur·e de l\'équipe.',
    TEAM_TRAINER_REQUIRED: 'Au moins un·e entraîneur·e est requis·e pour chaque équipe.',
    TEAM_TRAINER_SET_REQUIRED: 'Une équipe d\'entraîneur·e·s est requise.',

    // Department errors
    DEPARTMENT_IMPORT_ERROR: 'Erreur lors de l\'import des données du département.',
    DEPARTMENT_REQUIRED: 'Le département est requis.',

    // Event errors
    EVENT_ALREADY_MISSING: 'Vous avez deja repondu absent a cet evenement.',
    EVENT_CANCEL_ERROR: "Erreur lors de l'annulation de l'evenement.",
    EVENT_CAPACITY_ERROR: "La capacite maximale de l'evenement est atteinte.",
    EVENT_CREATE_ERROR: "Erreur lors de la creation de l'evenement.",
    EVENT_DATE_ERROR: "La date de l'evenement est invalide.",
    EVENT_DATE_PAST: "La date ou l'heure de l'evenement est deja passee.",
    EVENT_FIND_ERROR: "Erreur lors de la recherche de l'evenement.",
    EVENT_INVALID_TIME_RANGE: "L'heure de fin doit etre apres l'heure de debut.",
    EVENT_IS_NOT_ACTIVE_ERROR: "L'evenement n'est pas actif.",
    EVENT_LOCATION_REQUIRED: 'Un lieu est requis pour creer un evenement.',
    EVENT_MISSING_ERROR: "Erreur lors de la reponse a l'evenement.",
    EVENT_PARTICIPATION_ACCEPT_ERROR: "Erreur lors de l'acceptation de la participation.",
    EVENT_PARTICIPATION_ALREADY_TREATED: 'La demande de participation a deja ete traitee.',
    EVENT_PARTICIPATION_CREATE_ERROR: 'Erreur lors de la creation de la participation.',
    EVENT_PARTICIPATION_REFUSE_ERROR: 'Erreur lors du refus de la participation.',
    EVENT_SLOT_CONFLICT: 'Un conflit de creneau a ete detecte pour ce lieu.',
    EVENT_UPDATE_ERROR: "Erreur lors de la mise a jour de l'evenement.",
    EVENT_USER_ALREADY_IN_EVENT_ERROR: "L'utilisateur est deja inscrit a cet evenement.",
    EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR: "L'utilisateur n'est pas joueur de l'equipe.",

    // Event participation request errors
    EVENT_PARTICIPATION_ALREADY_HAS_A_REQUEST_POLICY_ERROR: 'Une demande de participation existe déjà pour cet événement.',
    EVENT_PARTICIPATION_DELETE_ERROR: 'Erreur lors de la suppression de la participation à l\'événement.',
    EVENT_PARTICIPATION_REQUEST_ALREADY_EXISTS: 'Une demande de participation existe déjà.',
    EVENT_PARTICIPATION_REQUEST_NOT_FOUND: 'Demande de participation introuvable.',
    EVENT_PARTICIPATION_REQUEST_POLICY_ERROR: 'Violation de la politique concernant les demandes de participation.',
    EVENT_PLAYER_POLICY_ERROR: 'Violation de la politique concernant les joueur·se·s.',

    // Chat errors
    CHAT_ID_NOT_PROVIDED: 'ID de chat non fourni.',
    FAILED_TO_ACCESS_CHAT: 'Impossible d\'accéder au chat.',
    FAILED_TO_JOIN_CHAT: 'Impossible de rejoindre le chat.',
    FAILED_TO_SEND_MESSAGE: 'Impossible d\'envoyer le message.',
    MESSAGE_TOO_LONG: 'Le message est trop long.',
    RATE_LIMIT_EXCEEDED: 'Limite de taux dépassée.',
    USER_NOT_PARTICIPANT_OF_CHAT: 'L\'utilisateur·rice n\'est pas participant·e du chat.',

    // Server errors
    DATABASE_ERROR: 'Erreur de base de données.',
    INTERNAL_SERVER_ERROR: 'Erreur interne du serveur.',

    // File upload errors
    FILE_TOO_LARGE: 'Fichier trop volumineux.',
    FILE_UPLOAD_ERROR: 'Erreur lors du téléchargement du fichier.',
    INVALID_FILE_TYPE: 'Type de fichier invalide.',

    // Policy errors
    CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR: 'CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR',
    CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR: 'CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR',
    CHAT_NOT_FOUND_POLICY_ERROR: 'CHAT_NOT_FOUND_POLICY_ERROR',
    CLUB_MANAGER_CREATE_POLICY_ERROR: 'CLUB_MANAGER_CREATE_POLICY_ERROR',
    CLUB_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s du club.',
    CLUB_MEMBER_POLICY_ERROR: 'Violation de la politique concernant les membres du club.',
    CLUB_STAFF_CREATE_POLICY_ERROR: 'Violation de la politique de création de personnel du club.',
    CLUB_STAFF_POLICY_ERROR: 'Violation de la politique concernant le personnel du club.',
    EVENT_TRAINER_CREATE_POLICY_ERROR: "Violation de la politique de création d'événements par les entraîneur·e·s.",
    EVENT_TRAINER_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et les événements.',
    generic: 'Une erreur est survenue. Veuillez réessayer plus tard.',
    error: 'Erreur',
    unknown: 'Une erreur inconnue est survenue.',
    HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR: "Vous avez déjà une demande d'adhésion en attente.",
    MANAGER_TRAINER_CLUB_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et dirigeant·e·s du club.',
    MANAGER_WITH_CLUB_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s avec club.',
    phoneNumberAlreadyUsed: 'Ce numéro est déjà utilisé par {{firstname}} {{lastname}}.',
    phoneNumberAlreadyUsedWithClub: 'Ce numéro est déjà utilisé par un·e entraîneur·e qui appartient à un club.',
    'Request failed with status code 404': 'La ressource demandée est introuvable.',
    schemaMismatch: 'Un problème est survenu lors de la récupération des informations.'
      + ' Veuillez vérifier que votre application est à jour ou réessayer plus tard.',
    TEAM_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les gestionnaires d\'équipe.',
    TEAM_TRAINER_CREATE_POLICY_ERROR: 'Violation de la politique de création d\'événements par les entraîneur·e·s.',
    title: 'Erreur',
    UNIQUE_CLUB_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions de club.',
    UNIQUE_TEAM_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions d\'équipe.',
    UNIQUE_WHISPER_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions privées.',
    USER_NOT_FOUND_POLICY_ERROR: 'Violation de la politique concernant les utilisateurs introuvables.',
  },
  clubDetails: {
    actions: {
      contactTrainers: 'Contacter les entraîneur·e·s',
      delete: 'Supprimer',
      editInfo: 'Modifier',
      join: "C'est mon club !",
      requestJoin: 'Demander à rejoindre ce club',
      requestPending: 'Demande en attente',
      claimClub: "C'est mon club",
      manageJoinRequests: 'Voir les demandes d\'affiliation',
    },
    alerts: {
      deleteSponsor: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Êtes-vous sûr·e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer le partenaire {{sponsorName}} .',
      },
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Le compte ne sera pas supprimé mais l\'entraineur·e ne sera plus lié au club. Êtes-vous sûr·e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer cet·te entraîneur·e.',
      },
      inviteTrainer: {
        message: 'Bonjour {{coachName}} !'
          + '\nVous avez été désigné comme entraineur·e dans le club {{clubName}}.'
          + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
          + ' et commencer à gérer vos équipes et vos évènements.',
        title: 'Bienvenue sur Found Club !',
      },
      joinClub: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre dirigeant·e va recevoir votre demande et la traiter dès que possible.',
        title: "Votre demande d'adhésion a bien été envoyée",
      },
      myClub: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Contacter Found Club',
        },
        description: 'Contactez nos équipes pour accéder aux fonctionnalités pour les dirigeant·e·s et entraineurs de club !',
        title: 'Vous êtes dirigeant·e de ce club ?',
      },
    },
    titles: {
      activities: 'Sports',
      coachs: 'Nos entraîneur·e·s',
      owners: 'Nos dirigeant·e·s',
      sponsors: 'Nos partenaires',
      teams: 'Nos équipes',
    },
  },
  clubFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        label: 'Sport',
        placeholder: 'Sélectionner une activité',
      },
      city: {
        label: 'Ville',
        placeholder: 'Marseille',
      },
      radius: {
        label: 'Dans un rayon autour de : ',
      },
    },
  },
  clubList: {
    actions: {
      createClub: 'Ajouter mon club',
    },
    fields: {
      search: 'Rechercher',
    },
    noData: 'Aucun club ne correspond à la recherche.',
    title: 'Trouver mon club ',
  },
  clubMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    errors: {
      accept: 'Impossible de valider la demande pour le moment.',
      missingRequester: 'Impossible de traiter cette demande. Demandez au joueur de renvoyer sa demande.',
      reject: 'Impossible de refuser la demande pour le moment.',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme entraineur·e de cette équipe ",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'affiliation en attente',
    title: 'Demandes d\'affiliation',
  },
  common: {
    actions: {
      askLater: 'Plus tard',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      continueLater: 'Continuer plus tard',
      create: 'Creer',
      delete: 'Supprimer',
      ok: 'OK',
      photoFromCamera: 'Prendre une photo',
      photoFromGallery: 'Choisir depuis la gallerie',
      save: 'Enregistrer',
    },
    back: 'Retour',
    close: 'Fermer',
    ignore: 'Ignorer',
    next: 'Suivant',
    previous: 'Precedent',
    skip: 'Passer',
    finish: 'Terminer',
    view: 'Voir',
    messages: {
      noData: 'Aucune donnée disponible',
    },
    error: 'Erreur',
  },
  event: {
    shareInChat: 'Partager dans une conversation',
    sharedEvent: 'Événement partagé',
  },
  club: {
    fields: {
      address: {
        label: 'Adresse',
        placeholder: 'Adresse du club',
      },
      email: {
        label: 'Email',
        placeholder: 'Email du club',
      },
      name: {
        label: 'Nom',
        placeholder: 'Nom du club',
      },
      phoneNumber: {
        label: 'Téléphone',
        placeholder: 'Téléphone du club',
      },
    },
  },
  clubEdit: {
    title: 'Modifier le club',
  },
  conversation: {
    messagePlaceholder: 'Message',
    modals: {
      actions: {
        report: 'Signaler le message',
        seeUser: 'Voir le profil',
      },
      reportSuccess: {
        description: 'Merci de votre retour, nous allons traiter votre demande dans les plus brefs délais.',
        title: 'Votre signalement a bien été envoyé',
      },
    },
  },
  createClubRequest: {
    actions: {
      create: 'Ajouter le club',
      ok: 'OK',
    },
    alerts: {
      description: "L'équipe Found Club va examiner votre demande et vous recontacter dans les plus brefs délais.",
      title: 'Votre demande de création de club a bien été envoyée',
    },
    fields: {
      clubName: {
        label: 'Nom du club',
        placeholder: 'FC Marseille',
      },
      holderFirstname: {
        label: 'Prénom du responsable',
        placeholder: 'Luc',
      },
      holderLastname: {
        label: 'Nom du responsable',
        placeholder: 'Harne',
      },
      holderPhone: {
        label: 'Numéro de téléphone du responsable',
        placeholder: '0612345678',
      },
    },
    title: 'Ajouter un club',
  },
  errorPage: {
    action: 'Recharger la page',
    subtitle: 'Une erreur est survenue.',
    title: 'Oups !',
  },
  eventDetails: {
    actions: {
      accept: 'Accepter',
      cancelEvent: 'Annuler l\'évènement',
      cancelResponse: 'Annuler ma participation',
      edit: 'Modifier l\'évènement',
      editResponse: 'Modifier ma réponse',
      join: 'Participer',
      refuse: 'Refuser',
      remind: 'Relancer',
    },
    fields: {
      description: 'À propos',
      participationRequests: 'Demandes de participation',
      participations: 'Participants',
    },
    modals: {
      accept: {
        title: 'Êtes-vous sûr·e de vouloir accepter cette demande ?',
      },
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer',
        report: 'Signaler',
      },
      cancelEvent: {
        description: 'Une fois annulé, l\'évènement ne sera plus visible par les participant·e·s.',
        title: 'Êtes-vous sûr·e de vouloir annuler cet évènement ?',
      },
      deleteParticipation: {
        actions: {
          cancel: 'Non, retour',
          confirm: 'Oui, annuler',
        },
        description: 'Êtes-vous sûr·e de vouloir annuler votre participation à cet évènement ?',
        title: 'Annuler ma participation',
      },
      editResponse: {
        description: "En modifiant votre réponse vous indiquez votre participation à l'évènement",
        title: 'Modifier ma réponse',
      },
      refuse: {
        fields: {
          reason: {
            label: 'Raison du refus',
            placeholder: 'Il faut avoir plus de 16 ans.',
          },
        },
        title: 'Êtes-vous sûr·e de vouloir refuser cette demande ?',
      },
      remindSuccess: {
        description: 'Les joueur·se·s vont recevoir une notification pour leur rappeler de répondre à l\'évènement.',
        title: 'Votre relance a bien été envoyée',
      },
      reportEvent: {
        description: 'Merci de nous indiquer la raison pour laquelle vous signalez cet évènement.',
        fields: {
          reason: {
            label: 'Raison du signalement',
            placeholder: 'Cet évènement est inapproprié.',
          },
        },
        title: 'Signaler un évènement',
      },
      reportSuccess: {
        description: 'Merci de votre retour, nous allons traiter votre demande dans les plus brefs délais.',
        title: 'Votre signalement a bien été envoyé',
      },
    },
    participationStatus: {
      missing: 'Absent\u00b7e\u00b7s',
      notAnswered: 'Sans r\u00e9ponse',
      participating: 'Pr\u00e9sent\u00b7e\u00b7s',
    },
    invitedTeams: {
      homeTeamBadge: 'Equipe organisatrice',
      invitedTeamBadge: 'Equipe invitee',
      historicalTitle: 'Historique equipe retiree',
      historicalPending: '{{count}} reponse(s) en attente',
    },
  },
  eventEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      capacity: {
        label: 'Nombre de participant·e·s',
        placeholder: 'Illimité',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: "Date de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      description: {
        label: 'Description',
        placeholder: 'Évènement de détection ouvert à tous·tes les joueur·se·s.',
      },
      endTime: {
        label: 'Heure de fin',
        placeholder: 'HH:mm',
      },
      isRecurrent: {
        label: 'Évènement récurrent',
      },
      pricePerPerson: {
        label: 'Prix par personne (€)',
        placeholder: 'Ex: 10',
      },
      location: {
        label: 'Lieu',
        placeholder: '2 rue du stade, 69000 Lyon',
      },
      recurrenceDay: {
        label: 'Jour de la récurrence',
      },
      recurrenceEndDate: {
        label: 'Date de fin de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      recurrenceFrequency: {
        label: 'Fréquence de la récurrence',
        options: {
          month: 'Mensuel',
          week: 'Hebdomadaire',
        },
      },
      recurrenceStartDate: {
        label: 'Date de début de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      sessionStatus: {
        label: 'Statut de la session',
        options: {
          closed: 'Fermé',
          open: 'Ouvert',
        },
      },
      startTime: {
        label: 'Heure de début',
        placeholder: 'HH:mm',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
      },
      invitedTeams: {
        label: 'Inviter des équipes',
        placeholder: 'Sélectionner des équipes',
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
      },
      totalPlayers: {
        label: 'Nombre total de joueurs',
        placeholder: 'Ex: 10',
      },
      time: {
        label: "Horaire de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      type: {
        label: 'Type d\'évènement',
        placeholder: 'Sélectionner un type d\'évènement',
      },
      validationMode: {
        label: 'Mode de validation',
        options: {
          auto: 'Automatique',
          manual: 'Manuelle',
        },
      },
    },
    title: 'Créer un évènement',
    titleEdit: 'Modifier l\'évènement',
  },

  eventWizard: {
    common: {
      stepCounter: 'Etape {{current}}/{{total}}',
    },
    steps: {
      description: {
        label: 'Description',
        placeholder: "Ajoute des details utiles pour les participants.",
        subtitle: 'Ajoute un contexte clair pour cet evenement.',
        title: 'Description',
      },
      invites: {
        myTeams: 'MES EQUIPES',
        otherTeams: 'AUTRES EQUIPES',
        subtitle: 'Invite des equipes, ou passe cette etape.',
        title: 'Invitations',
      },
      location: {
        addInstallation: 'Ajouter une installation',
        addressMissing: 'Adresse non renseignee',
        helper: 'Selectionne un lieu du club ou saisis une adresse externe.',
        installationHelper: 'Choisis une installation existante de ton club.',
        noInstallations: 'Aucune installation disponible pour ce club.',
        subtitle: 'Le lieu est obligatoire pour continuer.',
        title: 'Lieu',
      },
      logistics: {
        isRecurrent: 'Evenement recurrent',
        recurrenceDays: 'Jours de recurrence',
        recurrenceInterval: 'Intervalle de recurrence',
        recurrenceTitle: 'Configuration recurrence',
        reservationMode: 'Mode de reservation',
        reservationTitle: 'Parametres reservation',
        subtitle: "Configure date, horaires et regles d'acces.",
        title: 'Logistique',
      },
      participants: {
        fixed: 'Capacite fixe',
        hint: 'Tu pourras encore modifier ces valeurs avant la creation finale.',
        modeHintFixed: 'Mode capacite fixe: nombre de places limite.',
        modeHintUnlimited: 'Mode illimite: aucun plafond de participants.',
        modeLabel: 'Mode de capacite',
        playersUnit: 'joueurs max',
        previewCapacity: 'Capacite: {{value}}',
        previewMode: 'Mode: {{value}}',
        previewTitle: 'Apercu',
        previewTotalPlayers: 'Joueurs attendus: {{value}}',
        quickPresets: 'Valeurs rapides',
        subtitle: 'Choisis une capacite max, ou laisse l evenement en acces illimite.',
        summaryTitle: 'Resume',
        totalPlayersExceedsCapacity: 'Le nombre de joueurs attendus ne peut pas depasser la capacite max.',
        title: 'Participants',
        unlimited: 'Illimite',
        unlimitedHint: 'Aucune limite de places',
        unlimitedLabel: 'Illimite',
      },
      validation: {
        autoDesc: 'Les participants peuvent confirmer automatiquement leur presence.',
        autoRuleOne: 'Check-in simplifie pour les joueurs',
        autoRuleTwo: 'Ideal pour les sessions ouvertes',
        manualDesc: 'Le coach valide manuellement les participants.',
        manualRuleOne: 'Controle total par le staff',
        manualRuleTwo: 'Recommande pour groupes fermes',
        optionLabel: 'Mode {{title}}',
        previewTitle: 'Mode selectionne',
        recommended: 'Recommande',
        selectedHint: 'Mode actuellement selectionne.',
        selectHint: 'Selectionne ce mode de validation.',
        subtitle: "Definis comment valider les presences a l'evenement.",
        title: 'Mode de validation',
      },
      recap: {
        subtitle: 'Verifie les informations avant creation.',
        title: 'Recapitulatif',
      },
      team: {
        subtitle: "Selectionne l'equipe organisatrice.",
        title: 'Equipe organisatrice',
      },
      type: {
        subtitle: "Selectionne le type d'evenement.",
        title: "Type d'evenement",
      },
      visibility: {
        private: 'Prive',
        privateDesc: "Visible uniquement pour les membres concernes.",
        public: 'Public',
        publicDesc: "Visible pour tous les profils qui y ont acces.",
        subtitle: "Definis qui peut voir l'evenement.",
        title: 'Visibilite',
      },
    },
    recap: {
      actions: {
        create: 'Creer les evenements',
        createShort: 'Creer',
        edit: 'Modifier',
      },
      completedCount: '{{done}}/5 infos cles completees',
      dateLabel: 'Date',
      incomplete: 'A completer',
      invitesCount: '{{count}} equipe(s) invitee(s)',
      invitedTeamsTitle: 'Equipes invitees',
      noDescription: 'Aucune description',
      notSet: 'Non renseigne',
      organizationTitle: 'Organisation',
      participationTitle: 'Participation',
      pricePerPerson: 'Prix par personne: {{value}}',
      quickOverviewTitle: 'Vue d ensemble',
      ready: 'Pret a creer',
      recurrenceCount: '{{count}} occurrence(s) prevue(s)',
      reservationMode: 'Mode de reservation: {{value}}',
      timeLabel: 'Horaire',
      totalPlayersTitle: 'Joueurs attendus',
      whenWhereTitle: 'Quand et lieu',
      capacity: 'Participants max: {{value}}',
      sections: {
        description: 'Description',
        location: 'Lieu',
        logistics: 'Logistique',
        participants: 'Participants',
        reservation: 'Reservation',
        team: 'Equipe',
        type: 'Type',
        validation: 'Validation',
        visibility: 'Visibilite',
      },
      totalPlayers: 'Joueurs attendus: {{value}}',
      validationMode: 'Validation: {{value}}',
    },
    partial: {
      actions: {
        keep: 'Conserver les creations',
        retry: 'Reessayer les echecs',
        rollback: 'Annuler les creations',
      },
      noCreated: "Aucun evenement n'a ete cree.",
      rollbackPartial: "{{count}} annulation(s) n'ont pas pu etre finalisees.",
      rollbackSuccess: 'Les evenements crees ont ete annules.',
      summary: '{{success}} succes / {{failed}} echec(s).',
      title: 'Creation partielle detectee',
    },
    errors: {
      datePast: "La date ou l'heure de debut doit etre dans le futur.",
      genericCreate: "Erreur de creation d'evenement.",
      invalidTimeRange: "L'heure de fin doit etre apres l'heure de debut.",
      invitesFetch: "Impossible de charger les equipes a inviter.",
      locationRequired: 'Un lieu est requis.',
      noOtherTeams: 'Aucune autre equipe disponible a inviter.',
      noTeams: "Aucune equipe organisatrice disponible.",
      noTypes: "Aucun type d'evenement disponible.",
      recurrenceDatesRequired: 'Les dates de recurrence sont obligatoires.',
      recurrenceDaysRequired: 'Selectionne au moins un jour de recurrence.',
      recurrenceInvalidRange: 'La date de fin de recurrence doit etre apres la date de debut.',
      slotConflict: 'Conflit de creneau detecte pour le lieu selectionne.',
    },
  },
  eventFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        label: 'Sport',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: 'Date',
        placeholder: 'Sélectionner une date',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      sessionStatus: {
        label: 'Statut de la session',
        options: {
          closed: 'Fermé',
          open: 'Ouvert',
        },
        placeholder: 'Sélectionner un statut',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
        selectClubFirst: 'Sélectionner un club avant l\'équipe',
      },
      type: {
        label: 'Type d\'évènement',
        placeholder: 'Sélectionner un type d\'évènement',
      },
    },
    infos: {
      activity: 'Le sport pratiqué par l\'équipe (football, basketball, handball, etc.).\n\nFiltrer par sport vous permet de ne voir que les événements correspondant à votre discipline.',
      category: 'La catégorie d\'âge de l\'équipe (U7, U9, U11, U13, Senior, etc.).\n\nVous pouvez sélectionner plusieurs catégories pour voir tous les événements correspondants.',
      level: 'Le niveau de jeu de l\'équipe (Départemental, Régional, National, etc.).\n\nCe filtre vous aide à trouver des événements adaptés à votre niveau de pratique.',
      type: 'Le type d\'événement (Entraînement, Match, Détection, Tournoi, etc.).\n\nSélectionnez plusieurs types pour voir différentes activités.',
    },
  },
  eventList: {
    actions: {
      about: 'À propos',
      absent: 'Absent·e',
      add: 'Ajouter un évènement',
      findEvent: 'Trouver un évènement',
      join: 'Participer',
      present: 'Présent·e',
    },
    info: {
      alreadyJoined: 'Je participe !',
      alreadyMissing: 'Je serai absent·e',
      pendingRequest: 'Participation en attente',
    },
    joinModal: {
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer ma participation',
      },
      checkboxes: {
        conditions: "J'accepte les conditions pour participer à l'évènement",
        responsibility: 'Je déclare avoir pris connaissance de la "Déclaration de responsabilité et acceptation des risques"',
      },
      description: 'Je soussigné(e), participant majeur ou, le cas échéant, représentant légal du participant mineur, reconnais et accepte ce qui suit :'
        + '\n\nRôle de Found Club : '
        + '\n    - Found Club est une plateforme de mise en relation et n’organise pas l’événement. Found Club ne fournit aucune assurance liée à la participation.'
        + '\n\nTrajets aller/retour :'
        + '\n    - Sauf transport expressément organisé par l’organisateur, le trajet vers et depuis l’événement est sous ma responsabilité (ou celle du représentant légal pour un mineur), y compris assurance et choix du mode de transport.'
        + '\n\nAssurance :'
        + '\n    - J’atteste disposer (ou, pour un mineur, que l’enfant dispose) d’une couverture d’assurance appropriée (ex. licence fédérale en cours et/ou responsabilité civile). J’ai compris que Found Club n’assure ni les dommages corporels ni matériels.'
        + '\n\nAptitude médicale :'
        + '\nJ’atteste être apte à la pratique au jour de l’événement (ou que l’enfant est apte, conformément aux exigences fédérales : certificat/questionnaire le cas échéant) et je m’engage à ne pas participer / ne pas autoriser la participation en cas de doute sur l’état de santé.'
        + '\n\nLimites de responsabilité (droit FR) :'
        + '\nDans la mesure permise par la loi, je m’engage à ne pas rechercher la responsabilité de Found Club du fait de la participation ; cette clause ne s’applique pas en cas de faute lourde ou intentionnelle ou de manquement grave aux obligations de sécurité imputable à Found Club ou à l’organisateur.'
        + '\n\nRèglement & sécurité :'
        + '\nJe m’engage (ou j’engage le mineur) à respecter le règlement, les consignes de sécurité et les instructions des encadrants ; l’organisateur peut refuser ou interrompre la participation en cas de non-respect.'
        + '\n\nUrgence médicale :'
        + '\nJ’autorise l’organisateur à prévenir les secours en cas d’urgence ; pour un mineur, j’autorise l’organisateur à accompagner l’enfant si nécessaire et je m’engage à rester joignable.',
      title: 'DÉCLARATION DE RESPONSABILITÉ ET ACCEPTATION DES RISQUES',
      validation: 'En cochant les cases et en validant mon inscription, je confirme avoir lu, compris et accepté la présente déclaration et j’accepte de participer à l’événement dans ces conditions.',
    },
    noData: 'Aucun évènement trouvé.',
    title: 'Mes évènements',
  },
  home: {
    fields: {
      type: {
        label: 'Trouver',
        options: {
          club: 'un club',
          event: 'un évènement',
          reservation: 'une réservation',
          team: 'une équipe',
        },
      },
    },
  },
  homeHub: {
    title: 'Accueil',
    roles: {
      coach: 'Entraineur',
      player: 'Joueur',
      president: 'Dirigeant',
    },
    sections: {
      account: 'Compte',
      league: 'FoundClub League',
      manageClub: 'Gerer mon club',
      manageTeams: 'Gerer mes equipes',
      profile: 'Mon profil',
      quickNav: 'Navigation rapide',
      search: 'Rechercher',
    },
    cards: {
      manage: {
        addEvent: {
          title: 'Ajouter un evenement',
          subtitle: 'Creer rapidement un entrainement, un match ou une seance d essai pour vos equipes.',
        },
        teamRequests: {
          title: 'Demandes adhesion equipes',
          subtitle: 'Traiter les demandes d adhesion des joueurs vers vos equipes.',
        },
        clubRequests: {
          title: 'Demandes adhesion club',
          subtitle: 'Valider ou refuser les demandes d adhesion au club.',
        },
        featuredRequests: {
          title: 'Demandes evenements a la une',
          subtitle: 'Gerer les demandes d evenements a la une pour votre organisation.',
        },
      },
      search: {
        events: {
          title: 'Evenement',
          subtitle: 'Rechercher detections, seances d essai, entrainements, matchs, stages et tournois.',
        },
        clubs: {
          title: 'Club',
          subtitle: 'Trouver votre page club pour voir toutes ses informations.',
        },
        reservations: {
          title: 'Reservations',
          subtitle: 'Reserver le terrain de votre choix football a 5, padel et autres.',
        },
        ads: {
          title: 'Annonces',
          subtitle: 'Postuler aux annonces de recherche des equipes.',
        },
      },
      league: {
        title: 'FoundClub League',
        subtitle: 'Acceder a FoundClub League et a ses fonctionnalites competitives.',
      },
      profile: {
        view: {
          title: 'Voir mon profil',
          subtitle: 'Consulter les informations de votre compte.',
        },
        edit: {
          title: 'Modifier mon profil',
          subtitle: 'Mettre a jour vos informations personnelles et sportives.',
        },
        history: {
          title: 'Historique sportif',
          subtitle: 'Ajouter ou ajuster votre historique sportif.',
        },
        alerts: {
          title: 'Gerer mes alertes',
          subtitle: 'Creer des alertes pour recevoir des notifications personnalisees selon vos recherches.',
        },
      },
      quick: {
        planning: {
          title: 'Mon planning',
          subtitle: 'Retrouver vos evenements a venir et votre planning personnel.',
        },
        teams: {
          title: 'Mes equipes',
          subtitle: 'Acceder a vos equipes et a leurs informations.',
        },
        chat: {
          title: 'Messagerie',
          subtitle: 'Ouvrir rapidement votre messagerie.',
        },
      },
      account: {
        switch: {
          title: 'Changer de compte',
          subtitle: 'Basculer vers un autre compte connecte.',
        },
        logout: {
          title: 'Deconnexion',
          subtitle: 'Fermer votre session sur cet appareil.',
        },
        tutorial: {
          title: 'Tutoriels et aide',
          subtitle: 'Relancer un tutoriel ou reinitialiser les guides.',
        },
      },
    },
    alerts: {
      noTrainedTeams: {
        title: 'Aucune equipe disponible',
        description: 'Vous devez etre entraineur d au moins une equipe pour gerer les demandes d adhesion.',
      },
      noClub: {
        title: 'Club introuvable',
        description: 'Votre compte doit etre rattache a un club pour gerer ces demandes.',
      },
      featuredFallback: {
        title: 'Information',
        description: 'Aucun club omnisport detecte. Redirection vers les demandes du club.',
      },
      missingContext: {
        title: 'Contexte manquant',
        description: 'Aucun club disponible pour gerer les demandes a la une.',
      },
    },
    account: {
      logoutTitle: 'Deconnexion',
      logoutDescription: 'Voulez-vous vous deconnecter de votre compte ?',
    },
  },
  homeHubTutorial: {
    actions: {
      scrollDown: 'Descendre',
    },
    entry: {
      title: 'Bienvenue sur FoundClub',
      subtitle: 'FoundClub est un outil concu pour vous accompagner dans toute votre aventure sportive, peu importe votre sport.',
      description: 'Vous pouvez lancer le tutoriel complet pour tout comprendre, ou explorer l application par vous meme.',
      actions: {
        start: 'Lancer le tutoriel complet',
        skip: 'Passer',
      },
    },
    reset: {
      title: 'Reinitialiser les tutoriels',
      description: 'Tous les tutoriels seront remis a zero pour ce compte.',
      confirm: 'Reinitialiser',
    },
    center: {
      title: 'Tutoriels et aide',
      subtitle: 'Relancez un tutoriel ou reinitialisez tous les guides.',
      actions: {
        relaunchHome: 'Relancer le tutoriel Accueil',
        pickFeature: 'Choisir un tutoriel de fonctionnalite',
        resetAll: 'Reinitialiser tous les tutoriels',
      },
    },
    featurePicker: {
      title: 'Choisir un tutoriel',
      subtitle: 'Selectionnez une fonctionnalite a decouvrir.',
    },
    steps: {
      header: {
        title: 'Accueil FoundClub',
        description: 'Cette page vous donne un acces rapide a toutes les fonctionnalites principales.',
      },
      manageAddEvent: {
        title: 'Ajouter un evenement',
        description: 'Creez un entrainement, match ou detection pour vos equipes.',
      },
      manageTeamRequests: {
        title: 'Demandes adhesion equipes',
        description: 'Validez ou refusez les demandes pour rejoindre vos equipes.',
      },
      manageClubRequests: {
        title: 'Demandes adhesion club',
        description: 'Traitez les demandes d adhesion recues par votre club.',
      },
      manageFeaturedRequests: {
        title: 'Demandes evenements a la une',
        description: 'Validez les demandes d evenements a la une de votre organisation.',
      },
      searchEvents: {
        title: 'Rechercher un evenement',
        description: 'Trouvez des evenements sportifs en utilisant les filtres de recherche.',
      },
      searchClubs: {
        title: 'Rechercher un club',
        description: 'Explorez les clubs et ouvrez leur fiche detaillee.',
      },
      searchReservations: {
        title: 'Rechercher une reservation',
        description: 'Accedez aux reservations et filtrez selon votre activite.',
      },
      searchAds: {
        title: 'Rechercher des annonces',
        description: 'Consultez les annonces de recrutement et les profils disponibles.',
      },
      league: {
        title: 'FoundClub League',
        description: 'Basculez vers FoundClub League pour les fonctionnalites competitives.',
      },
      profileView: {
        title: 'Voir mon profil',
        description: 'Consultez votre page profil complete.',
      },
      profileEdit: {
        title: 'Modifier mon profil',
        description: 'Modifiez vos informations personnelles et sportives.',
      },
      profileHistory: {
        title: 'Historique sportif',
        description: 'Ajoutez vos experiences via le wizard historique.',
      },
      profileAlerts: {
        title: 'Gerer mes alertes',
        description: 'Configurez des alertes personnalisees selon vos recherches.',
      },
      quickPlanning: {
        title: 'Mon planning',
        description: 'Accedez rapidement a votre planning personnel.',
      },
      quickTeams: {
        title: 'Mes equipes',
        description: 'Retrouvez toutes vos equipes et leurs pages.',
      },
      quickChat: {
        title: 'Messagerie',
        description: 'Ouvrez votre messagerie et suivez vos conversations.',
      },
      accountSwitch: {
        title: 'Changer de compte',
        description: 'Ouvrez la modal pour changer ou ajouter un compte.',
      },
      accountLogout: {
        title: 'Deconnexion',
        description: 'Deconnectez-vous proprement de l appareil actuel.',
      },
      tutorialCenter: {
        title: 'Tutoriels et aide',
        description: 'Relancez un tutoriel quand vous voulez, ou remettez tout a zero.',
      },
    },
  },
  searchTypeSwitcher: {
    recruitment: 'Recrutement',
  },
  reservation: {
    actions: {
      participate: 'Réserver',
      requestFeatured: 'Demander la mise à la une',
      cancelRequest: 'Annuler la demande',
    },
    card: {
      missingPlayers: 'Il manque {{count}} joueur',
      missingPlayers_plural: 'Il manque {{count}} joueurs',
      pricePerPerson: '{{price}}€/pers',
    },
    featured: 'À la une :',
    featuredRequest: {
      title: 'Mise en avant',
      pending: 'Demande en attente',
      approved: 'Approuvée',
      rejected: 'Refusée',
      requestSuccess: 'Demande envoyée avec succès',
      requestError: 'Erreur lors de l\'envoi de la demande',
      cancelSuccess: 'Demande annulée',
      cancelError: 'Erreur lors de l\'annulation',
    },
    filters: {
      detections: 'Détections',
      openTrainings: 'Entraînements ouverts',
      tournaments: 'Tournois',
    },
    mode: {
      fullGroup: 'J\'ai déjà mon groupe complet',
      invalidPlayerCount: 'Veuillez entrer un nombre valide',
      playerCount: 'Combien de joueurs avez-vous ?',
      recruiting: 'Il me manque des joueurs',
      selectMode: 'Veuillez sélectionner un mode',
      title: 'Comment voulez-vous participer ?',
      tooManyPlayers: 'Le nombre doit être inférieur au total',
    },
    noData: 'Aucune réservation trouvée.',
    title: 'Évènements :',
  },
  reservationFilters: {
    fields: {
      maxPrice: {
        label: 'Prix maximum par personne',
        placeholder: 'Ex: 20',
      },
      startTime: {
        label: 'À partir de',
        placeholder: 'Heure de début',
      },
    },
  },
  login: {
    actions: {
      login: 'Se connecter',
      register: 'Créer un compte',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    or: 'ou',
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Connecte-toi',
  },
  menu: {
    chat: 'Messagerie',
    home: 'Accueil',
    myClub: 'Mon club',
    myTeams: 'Mes équipes',
    planning: 'Mon planning',
    search: 'Rechercher',
  },
  messaging: {
    noData: 'Aucune conversation trouvée.',
    title: 'Messages privés',
  },
  modals: {
    actions: {
      search: 'Rechercher...',
      select: 'Sélectionner',
    },
    phone: {
      title: 'Sélectionner un pays',
    },
  },
  myEventList: {
    actions: {
      closeTimeFilter: 'Valider',
    },
    fields: {
      timeFilter: {
        next: 'Mes prochains évènements',
        past: 'Mes évènements passés',
        selectDate: 'Sélectionner une date',
      },
      type: {
        all: 'Tous',
      },
    },
  },
  myTeamList: {

    title: 'Mes équipes',
  },
  otp: {
    actions: {
      confirm: 'Confirmer',
    },
    fields: {
      code: {
        label: 'Code de confirmation',
        placeholder: '123456',
      },
    },
    subtitle: 'Entre le code reçu par SMS.',
    title: 'Confirme ton numéro',
  },
  permissions: {
    camera: {
      denied: 'Permission caméra refusée',
      message: 'L\'application a besoin d\'accéder à votre caméra pour prendre une photo.',
      title: 'Permission Caméra',
    },
  },
  profile: {
    actions: {
      confirmDeleteAvatar: 'Êtes-vous sûr de vouloir supprimer cette image ?',
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      findClub: 'Trouver mon club',
      findTeam: 'Trouver une équipe',
      ignore: 'Ignorer',
      logout: 'D\u00e9connexion',
      manageClub: 'G\u00e9rer mon club',
      manageAlerts: 'G\u00e9rer mes alertes',
      manageClubJoinRequests: 'Gérer les demandes d\'affiliation au club',
      manageEvents: 'Gérer mes évènements',
      manageTeamJoinRequests: 'Gérer les demandes d\'adhésion aux équipes',
      manageTeams: 'Gérer mes équipes',
      myTeams: 'Mes équipes',
      save: 'Continuer',
    },
    alerts: {
      deleteAlert: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        subtitle: 'Pour demander la suppression de votre compte merci de remplir le formulaire de contact'
          + ' suivant en précisant votre demande.',
        title: 'Supprimer votre compte ?',
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      height: {
        label: 'Taille (m)',
        placeholder: '1,80',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
      position: {
        label: 'Poste',
        placeholder: 'Ailier',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      sections: {
        female: 'Féminine',
        male: 'Masculine',
      },
      types: {
        coach: 'Entraîneur·e',
        player: 'Joueur·se',
        president: 'Dirigeant·e',
      },
      weight: {
        label: 'Poids (kg)',
        placeholder: '80',
      },
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse te reconnaître facilement.",
      birthdate: 'Renseigne ta date de naissance.',
      name: 'Renseigne ton nom et prénom.',
      section: 'Renseigne la catégorie de sexe dans laquelle tu évolues',
      type: 'Renseignez votre fonction principale.',
    },
    titles: {
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est ta date de naissance ?',
      edit: 'Modifier mes informations',
      name: "Comment t'appelles-tu ?",
      profile: 'Mon compte',
      section: 'Dans quelle section évolues-tu ?',
      type: 'Quel est votre statut ?',
    },
  },
  register: {
    actions: {
      register: 'Continuer',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Crée ton compte',
  },
  onboardingAffiliation: {
    titleClub: 'Trouve ton club',
    titleTeam: 'Trouve ton equipe',
    subtitleClub: 'Recherche ton club puis ouvre sa fiche pour valider C est mon club.',
    subtitleTeam: 'Recherche ton equipe puis ouvre sa fiche pour envoyer ta demande.',
    common: {
      roleTargetClub: 'club',
      roleTargetTeam: 'equipe',
    },
    actions: {
      continueLater: 'Continuer plus tard',
      notFoundClub: 'Je ne trouve pas mon club',
      notFoundTeam: 'Je ne trouve pas mon equipe',
    },
    search: {
      placeholderClub: 'Nom du club',
      placeholderTeam: 'Nom de l equipe',
      filtersActive_one: '{{count}} filtre actif',
      filtersActive_other: '{{count}} filtres actifs',
    },
    results: {
      openClubFallback: 'Voir fiche club',
      openTeamFallback: 'Voir fiche equipe',
    },
    states: {
      loading: 'Recherche en cours...',
      errorTitle: 'Impossible de charger les resultats',
      errorSubtitle: 'Verifie ta connexion puis reessaie.',
      retry: 'Reessayer',
      emptyWithQueryClub: 'Aucun club trouve pour "{{query}}".',
      emptyWithQueryTeam: 'Aucune equipe trouvee pour "{{query}}".',
      emptyWithoutQueryClub: 'Aucun club a afficher pour le moment.',
      emptyWithoutQueryTeam: 'Aucune equipe a afficher pour le moment.',
    },
    feedback: {
      requestError: 'Impossible d envoyer votre demande.',
      requestSentTitle: 'Demande envoyee',
      requestSentDescription: 'Votre demande a ete envoyee aux superadmins. Vous recevrez une notification.',
      missingInfoTitle: 'Information manquante',
      missingInfoMessageClub: 'Renseigne le nom du club recherche.',
      missingInfoMessageTeam: 'Renseigne le nom de l equipe recherchee.',
    },
    tutorial: {
      stepSearchTitle: 'Recherche',
      stepSearchDescription: 'Tape le nom du {{roleTargetLabel}} pour filtrer la liste.',
      stepResultTitleClub: 'Selectionner un club',
      stepResultTitleTeam: 'Selectionner une equipe',
      stepResultDescriptionClub: 'Ouvre la fiche du club pour utiliser le bouton C est mon club.',
      stepResultDescriptionTeam: 'Ouvre la fiche equipe pour envoyer ta demande de rejoindre.',
      stepNotFoundTitleClub: 'Je ne trouve pas mon club',
      stepNotFoundTitleTeam: 'Je ne trouve pas mon equipe',
      stepNotFoundDescriptionClub: 'Si tu ne trouves pas ton club, envoie une demande guidee aux superadmins.',
      stepNotFoundDescriptionTeam: 'Si tu ne trouves pas ton equipe, envoie une demande guidee aux superadmins.',
      stepFiltersTitle: 'Ouvrir les filtres',
      stepFiltersDescription: 'On va maintenant ouvrir les filtres pour affiner ta recherche.',
    },
    filtersTutorial: {
      cityTitle: 'Localisation',
      cityDescription: 'Choisis une ville ou une adresse pour centrer la recherche des clubs.',
      radiusTitle: 'Rayon de recherche',
      radiusDescription: 'Ajuste le rayon en kilometres autour de ta localisation.',
      activityTitle: 'Sport',
      activityDescription: 'Selectionne un sport pour filtrer uniquement les clubs correspondants.',
      applyTitle: 'Appliquer',
      applyDescription: 'Applique tes filtres pour revenir a la liste avec des resultats plus precis.',
    },
    modal: {
      titleClub: 'Je ne trouve pas mon club',
      titleTeam: 'Je ne trouve pas mon equipe',
      description: 'Donnez un maximum de contexte pour aider les superadmins.',
      send: 'Envoyer',
      nameLabelClub: 'Nom du club recherche *',
      nameLabelTeam: 'Nom de l equipe recherchee *',
      namePlaceholderClub: 'Ex: Olympique ...',
      namePlaceholderTeam: 'Ex: U17 Nationaux ...',
      commentLabel: 'Commentaire (optionnel)',
      commentPlaceholder: 'Ex: ville, categorie, orthographe probable...',
    },
    a11y: {
      backHint: 'Revient a l etape precedente de l onboarding.',
      searchInputHintClub: 'Saisis le nom du club pour filtrer la liste.',
      searchInputHintTeam: 'Saisis le nom de l equipe pour filtrer la liste.',
      searchInputLabelClub: 'Champ nom du club',
      searchInputLabelTeam: 'Champ nom de l equipe',
      filterHint: 'Ouvre les filtres de recherche de club.',
      filterLabel: 'Ouvrir les filtres',
      cardHintClub: 'Ouvre la fiche du club pour confirmer l affiliation.',
      cardHintTeam: 'Ouvre la fiche de l equipe pour demander a rejoindre.',
      cardLabelClub: 'Ouvrir la fiche du club {{name}}',
      cardLabelTeam: 'Ouvrir la fiche de l equipe {{name}}',
      retryHint: 'Relance la recherche de resultats.',
      notFoundHintClub: 'Envoie une demande d aide si ton club est introuvable.',
      notFoundHintTeam: 'Envoie une demande d aide si ton equipe est introuvable.',
      continueLaterHint: 'Passe cette etape et continue l onboarding.',
      modalCancelHint: 'Ferme la fenetre de demande.',
      modalSendHint: 'Envoie ta demande aux superadmins.',
      modalNameHintClub: 'Renseigne le nom du club que tu recherches.',
      modalNameHintTeam: 'Renseigne le nom de l equipe que tu recherches.',
      modalCommentHint: 'Ajoute des informations utiles a la recherche.',
      tooltipSkipHint: 'Quitte le tutoriel guide.',
      tooltipPreviousHint: 'Revient a l etape precedente du tutoriel.',
      tooltipNextHint: 'Passe a l etape suivante du tutoriel.',
    },
  },
  teamDetails: {
    actions: {
      contactTeam: 'Contacter',
      edit: 'Modifier',
      stats: 'Statistiques',
      join: "C'est mon équipe !",
      leave: "Quitter l'équipe",
    },
    alerts: {
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer du club',
        },
        description: 'Le compte ne sera pas supprimé mais l\'entraineur·e ne sera plus lié au club ni à aucune de ces équipes.'
          + ' Si vous souhaitez le retirer seulement de cette équipe merci de passer par le bouton de modification de l\'équipe.',
        title: 'Vous êtes sur le point de supprimer cet·te entraîneur·e de votre club.',
      },
      invitePlayers: {
        alreadyHaveTheApp: "J'ai déjà l'application",
        downloadOnAndroid: 'Télécharger sur Android',
        downloadOnIOS: 'Télécharger sur iOS',
        message: 'Bonjour !'
          + '\nVotre équipe {{teamName}} de votre club {{clubName}} vous attend !'
          + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
          + ' et commencer accéder et participer aux évènements de votre équipe.',
        title: 'Vos coéquipiers vous attendent !',
      },
      joinRequest: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre entraîneur·e va recevoir votre demande et la traiter dès que possible.',
        title: 'Votre demande d\'adhésion a bien été envoyée',
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: "Quitter l'équipe",
        },
        description: 'Vous êtes sur le point de quitter l\'équipe. Une fois cette action validée vous ne pourrez plus participer aux entrainements et matchs.',
        title: 'Êtes-vous sûr·e de vouloir quitter cette équipe ?',
      },
    },
    myTitle: 'Mon équipe',
    tabs: {
      infos: 'Infos',
      standings: 'Classement',
      calendar: 'Calendrier',
      stats: 'Statistiques',
    },
    stats: {
      summaryHint: 'Consulte les statistiques detaillees de ton equipe.',
    },
    sections: {
      nextEvents: 'Prochains évènements',
      players_one: 'Joueur·se',
      players_other: 'Joueur·se·s',
      trainers_one: 'Entraîneur·e',
      trainers_other: 'Entraîneur·e·s',
    },
    title: 'Équipe',
  },
  teamEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      description: {
        label: 'Description',
        placeholder: 'Équipe senior évoluant en championnat régional depuis 2015.',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      name: {
        label: 'Nom de l\'équipe',
        placeholder: 'Les lions de Marseille',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      trainers: {
        label: 'Entraîneur·e·s',
        placeholder: 'Sélectionner un·e entraîneur·e',
      },
    },
    title: 'Créer une équipe',
    titleEdit: "Modifier l'équipe",
  },
  teamFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
    },
  },
  teamList: {
    actions: {
      add: 'Ajouter une équipe',
    },
    alerts: {
      maxTeamLimitReached: {
        actions: {
          cancel: 'Abandon',
          contact: 'Contacter Found Club',
        },
        description: 'Vous avez atteint le nombre maximum d\'équipes autorisées dans votre club. Veuillez contacter Found Club pour débloquer cette limite.',
        title: 'Limite d\'équipes atteinte',
      },
    },
    fields: {
      category: 'Catégorie',
      level: 'Niveau',
      section: 'Section',
    },
    noData: 'Aucune équipe trouvée.',
    title: 'Équipes de mon club',
  },
  teamMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme joueur·se de l'équipe",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'adhésion en attente',
    title: 'Demandes d\'adhésion',
  },
  userDetails: {
    actions: {
      sendMessage: 'Envoyer un message',
    },
    fields: {
      birthYear: 'Année de naissance',
      height: 'Taille (m)',
      position: 'Poste',
      weight: 'Poids (kg)',
    },
    title: 'Infos profil',
    titles: {
      teams: 'Équipes',
    },
  },
  welcome: {
    actions: {
      go: 'Allons-y !',
    },
    descriptions: {
      club: {
        bold: '🔥 Rejoins un club',
        regular: 'et progresse dans ta carrière sportive.',
      },
      info: {
        bold: '📢 Reste informé·e',
        regular: ' des nouveautés grâce aux notifications',
      },
      register: {
        bold: '📅 Inscris-toi',
        regular: ' à des entrainements et détections ouverts',
      },
      search: {
        bold: '🔎 Recherche',
        regular: ' des clubs et des évènements près de chez toi.',
      },
    },
    subtitle: 'Prêt·e à trouver ton club et évoluer dans le sport ?',
    title: 'Bienvenu·e sur',
  },
  multisport: {
    deleteSectionTitle: 'Supprimer la section',
    deleteSectionConfirm: 'Êtes-vous sûr de vouloir supprimer la section "{{name}}" ?\nCette action est irréversible et supprimera toutes les équipes et membres associés.',
    sectionDeleted: 'La section a été supprimée avec succès.',
    sectionCreated: 'La section a été créée avec succès.',
  },
};


