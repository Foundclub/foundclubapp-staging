export default {
  addCoach: {
    actions: {
      save: 'Ajouter',
    },
    alerts: {
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
    EVENT_ALREADY_MISSING: 'Vous avez déjà répondu absent à cet évènements.',
    EVENT_CANCEL_ERROR: 'Erreur lors de l\'annulation de l\'événement.',
    EVENT_CAPACITY_ERROR: 'La capacité maximale de l\'événement est atteinte.',
    EVENT_CREATE_ERROR: 'Erreur lors de la création de l\'événement.',
    EVENT_DATE_ERROR: 'La date de l\'événement est invalide.',
    EVENT_FIND_ERROR: 'Erreur lors de la recherche de l\'événement.',
    EVENT_IS_NOT_ACTIVE_ERROR: 'L\'événement n\'est pas actif.',
    EVENT_MISSING_ERROR: 'Erreur lors de la réponse à l\'événement.',
    EVENT_PARTICIPATION_ACCEPT_ERROR: 'Erreur lors de l\'acceptation de la participation.',
    EVENT_PARTICIPATION_ALREADY_TREATED: 'La demande de participation a déjà été traitée.',
    EVENT_PARTICIPATION_CREATE_ERROR: 'Erreur lors de la création de la participation.',
    EVENT_PARTICIPATION_REFUSE_ERROR: 'Erreur lors du refus de la participation.',
    EVENT_UPDATE_ERROR: 'Erreur lors de la mise à jour de l\'événement.',
    EVENT_USER_ALREADY_IN_EVENT_ERROR: 'L\'utilisateur·rice est déjà inscrit·e à cet événement.',
    EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR: 'L\'utilisateur·rice n\'est pas joueur·se de l\'équipe.',

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
      join: "C'est mon club !",
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
      cancel: 'Annuler',
      photoFromCamera: 'Prendre une photo',
      photoFromGallery: 'Choisir depuis la gallerie',
    },
    messages: {
      noData: 'Aucune donnée disponible',
    },
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
      missing: 'Absent·e·s',
      notAnswered: 'Sans réponse',
      participating: 'Présent·e·s',
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
      isRecurrent: {
        label: 'Évènement récurrent',
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
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
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
      description: 'En validant mon inscription à cet entraînement / détection organisé par {{ clubName }}, je reconnais et accepte expressément les termes suivants :'
        + '\n\nPratique sportive et risques inhérents : '
        + '\n    - Je reconnais que la participation à des activités sportives comporte des risques inhérents pouvant inclure, sans s’y limiter, des blessures corporelles, des chocs, des fractures, des entorses, des lésions musculaires, voire des accidents plus graves.'
        + '\n    - Je suis conscient(e) que ces risques peuvent survenir indépendamment des précautions prises par '
        + 'l’organisateur, les entraîneurs ou les autres participants.'
        + '\nAbsence de couverture d’assurance par Found Club'
        + '\n    - Je reconnais que Found Club n’organise pas ces événements et agit uniquement en tant que plateforme de mise en relation entre joueurs et clubs.'
        + '\n    - Je comprends que Found Club ne fournit aucune assurance couvrant les blessures, accidents ou dommages matériels subis lors de ma participation.'
        + '\n\nResponsabilité individuelle :'
        + '\n    - Je déclare être pleinement responsable de ma participation et renonce à tout recours contre Found Club, l’organisateur de l’événement, les entraîneurs et tout autre tiers impliqué.'
        + '\n    - En cas de blessure ou d’accident, je reconnais que je ne pourrai engager aucune responsabilité contre Found Club et que je devrai prendre en charge mes propres soins médicaux et assurances personnelles.'
        + '\n\nÉtat de santé et aptitude physique :'
        + '\n    - Je certifie être apte physiquement à pratiquer l’activité concernée et n’avoir aucune contre-indication médicale à la pratique du sport.'
        + '\n    - J’assume l’entière responsabilité de mon état de santé et je m’engage à ne pas participer en cas de doute sur ma condition physique.'
        + '\n\nAcceptation des conditions :'
        + '\nEn cochant la case ci-dessous et en validant mon inscription,'
        + ' je reconnais avoir lu, compris et accepté cette déclaration de responsabilité,'
        + ' et j’accepte de dégager Found Club et les organisateurs de toute responsabilité en cas d’accident,'
        + ' de blessure ou de dommage survenant lors de l’événement.',
      title: 'DÉCLARATION DE RESPONSABILITÉ ET ACCEPTATION DES RISQUES',
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
          team: 'une équipe',
        },
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
  profile: {
    actions: {
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      findClub: 'Trouver mon club',
      findTeam: 'Trouver une équipe',
      ignore: 'Ignorer',
      logout: 'Déconnexion',
      manageClub: 'Gérer mon club',
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
          confirm: 'Ouvrir le formulaire',
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
  teamDetails: {
    actions: {
      contactTeam: 'Contacter',
      edit: 'Modifier',
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
      pending: "{{firstname}} s'est signalé comme joueur·se de l'équipe {{teamName}} ",
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
};
