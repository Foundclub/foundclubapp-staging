import Joi from 'joi';

import client from '../client';

/** @typedef {import('@/domains/event/types').FCEvent} Reservation */

export const reservationSchema = Joi.object({
  bookingStatus: Joi.string().allow('', null).optional(),
  club: Joi.object().optional(),
  currentPlayers: Joi.number().required(),
  date: Joi.string().required(),
  description: Joi.string().allow('', null),
  documentId: Joi.string().required(),
  endTime: Joi.string().optional(),
  location: Joi.object().optional(),
  locationDetails: Joi.string().allow('', null),
  missingPlayers: Joi.number().required(),
  organizer: Joi.object().optional(),
  pricePerPerson: Joi.number().required(),
  reservationMode: Joi.string().valid('FULL_GROUP', 'RECRUITING').required(),
  startTime: Joi.string().optional(),
  team: Joi.object().optional(),
  totalPlayers: Joi.number().required(),
  type: Joi.object().required(),
}).required();

/**
 * Get reservations with filters
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 *   q?: string;
 *   type?: string;
 *   reservationMode?: string;
 *   club?: string;
 *   activity?: string;
 *   geohash?: string;
 *   maxPricePerPerson?: number;
 *   needsPlayers?: boolean;
 *   startTime?: string;
 *   startDateAfter?: string;
 *   startDateBefore?: string;
 * }} [filters]
 * @returns {Promise<{data: Reservation[], meta: {pagination: {page: number, pageSize: number, pageCount: number, total: number}}}>}
 */
export const getReservations = async (filters = {}) => {
  try {
    const {
      activity,
      club,
      geohash,
      maxPricePerPerson,
      needsPlayers = false,
      page = 1,
      pageSize = 15,
      q,
      reservationMode,
      startDateAfter,
      startDateBefore,
      startTime,
      type,
    } = filters;

    /** @type {{ filters: Record<string, any>; pagination: { page: number; pageSize: number }; populate: string[]; sort: string[] }} */
    const params = {
      filters: {
        type: { name: { $eq: 'Réservation' } },
      },
      pagination: {
        page,
        pageSize,
      },
      populate: [
        'club',
        'club.logo',
        'club.sponsor',
        'club.sponsor.logo',
        'organizer',
        'type',
        'team',
        'team.activities',
        'team.club',
        'team.club.logo',
        'team.club.sponsor',
        'team.club.sponsor.logo',
        'participations',
      ],
      sort: ['date:asc'],
    };

    // Apply date filters if provided, otherwise use default future dates filter
    if (startDateAfter || startDateBefore) {
      params.filters.date = {};
      if (startDateAfter) {
        params.filters.date.$gte = startDateAfter;
      }
      if (startDateBefore) {
        params.filters.date.$lte = startDateBefore;
      }
    } else {
      params.filters.date = {
        $gte: new Date().toISOString(), // Only get future dates if no specific date filter is set
      };
    }

    if (q) {
      params.filters.$or = [
        { description: { $containsi: q } },
        { locationDetails: { $containsi: q } },
      ];
    }

    if (type) {
      params.filters.type = { name: { $eq: type } };
    }

    if (reservationMode) {
      params.filters.reservationMode = { $eq: reservationMode };
    }

    if (needsPlayers) {
      params.filters.bookingStatus = { $eq: 'shared' };
      params.filters.missingPlayers = { $gt: 0 };
      params.filters.reservationMode = { $eq: 'RECRUITING' };
    }

    if (club) {
      params.filters.club = { documentId: { $eq: club } };
    }

    if (activity) {
      params.filters.team = {
        activities: {
          documentId: { $eq: activity },
        },
      };
    }

    if (maxPricePerPerson) {
      params.filters.pricePerPerson = { $lte: maxPricePerPerson };
    }

    if (startTime) {
      // Extract HH:mm from ISO string if needed, or use as is if it's already time string
      // Assuming startTime comes as ISO string from filters
      const timeString = startTime.includes('T') ? startTime.split('T')[1].substring(0, 5) : startTime;
      params.filters.startTime = { $gte: timeString };
    }

    if (geohash) {
      params.filters.geohash = { $contains: geohash };
    }

    const response = await client.get('/events', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching reservations:', error);
    // Return empty data structure instead of throwing
    return {
      data: [],
      meta: {
        pagination: {
          page: 1,
          pageCount: 0,
          pageSize: 15,
          total: 0,
        },
      },
    };
  }
};

/**
 * Get featured reservations
 * Returns featured items if available, otherwise returns latest reservations chronologically
 * @param {number} [limit] - Maximum number of items to return
 * @returns {Promise<{data: Reservation[], meta: {isFeatured: boolean, pagination: object}}>}
 */
export const getFeaturedReservations = async (limit = 10) => {
  try {
    const response = await client.get('/featured-items/reservations', {
      params: {
        limit,
      },
    });
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ Featured reservations unavailable, using fallback');
    }
    // Return empty data structure instead of throwing
    return {
      data: [],
      meta: {
        isFeatured: false,
        pagination: {
          page: 1,
          pageCount: 0,
          pageSize: 0,
          total: 0,
        },
      },
    };
  }
};

/**
 * Join a reservation
 * @param {string} reservationId
 * @returns {Promise<{data: Reservation}>}
 */
export const joinReservation = async (reservationId) => {
  const response = await client.post(`/events/${reservationId}/join-reservation`);
  return response.data;
};

/**
 * Create a reservation
 * @param {{
 *   mode: 'FULL_GROUP' | 'RECRUITING';
 *   totalPlayers: number;
 *   currentPlayers: number;
 *   pricePerPerson: number;
 *   date: string;
 *   startTime?: string;
 *   endTime?: string;
 *   description?: string;
 *   location?: object;
 *   locationDetails?: string;
 *   club?: string;
 *   team?: string;
 * }} reservationData
 * @returns {Promise<{data: Reservation}>}
 */
export const createReservation = async (reservationData) => {
  const response = await client.post('/reservations', {
    data: reservationData,
  });
  return response.data;
};

/**
 * Book full reservation (privatization)
 * Keeps existing players, marks as booked
 * @param {string} reservationId
 * @returns {Promise<{data: Reservation, message: string}>}
 */
export const bookFullReservation = async (reservationId) => {
  const response = await client.post(`/events/${reservationId}/book-full`);
  return response.data;
};

/**
 * Open reservation for players (crowdsourcing)
 * @param {string} reservationId
 * @param {number} [targetPlayers] - Optional target number of players
 * @returns {Promise<{data: Reservation, message: string}>}
 */
export const openForPlayers = async (reservationId, targetPlayers) => {
  const response = await client.post(`/events/${reservationId}/open-for-players`, {
    data: { targetPlayers },
  });
  return response.data;
};

/**
 * Trigger SOS alert (last-minute urgent recruitment)
 * @param {string} reservationId
 * @returns {Promise<{data: Reservation, message: string}>}
 */
export const triggerSosAlert = async (reservationId) => {
  const response = await client.post(`/events/${reservationId}/sos-alert`);
  return response.data;
};
