import Joi from 'joi';
import client from '../client';

/**
 * Search users (for mercato)
 * @param {object} params
 * @param {boolean} [params.isLookingForClub]
 * @param {string} [params.role]
 * @param {string} [params.q]
 * @param {string|string[]} [params.activity] - Sport/activity filter
 * @param {string|string[]} [params.category] - Section (M/F) filter
 * @param {string|string[]} [params.position] - Position filter
 * @param {string} [params.geohash] - Location geohash filter
 * @param {number} [params.page]
 * @param {number} [params.pageSize]
 * @returns {Promise<any>}
 */
export const searchUsers = async (params = {}) => {
    const {
        isLookingForClub,
        role,
        q,
        activity,
        category,
        position,
        geohash,
        page = 1,
        pageSize = 25,
    } = params;

    const filters = {
        filters: {},
        pagination: {
            page,
            pageSize,
        },
        populate: ['avatar', 'role', 'section'],
    };

    // Core filter: only show users looking for a club
    if (typeof isLookingForClub === 'boolean') {
        filters.filters.isLookingForClub = isLookingForClub;
    }

    // Role filter
    if (role) {
        filters.filters.role = {
            name: {
                $containsi: role,
            },
        };
    }

    // Text search (name)
    if (q) {
        filters.filters.$or = [
            { firstname: { $containsi: q } },
            { lastname: { $containsi: q } },
            { username: { $containsi: q } },
        ];
    }

    // Sport/Activity filter (preferredSport field)
    if (activity) {
        const activityValues = Array.isArray(activity) ? activity : [activity];
        if (activityValues.length > 0) {
            filters.filters.preferredSport = { $in: activityValues };
        }
    }

    // Section/Category filter
    if (category) {
        const categoryValues = Array.isArray(category) ? category : [category];
        if (categoryValues.length > 0) {
            filters.filters.section = {
                documentId: { $in: categoryValues },
            };
        }
    }

    // Position filter
    if (position) {
        const positionValues = Array.isArray(position) ? position : [position];
        if (positionValues.length > 0) {
            filters.filters.position = { $in: positionValues };
        }
    }

    // Geohash/location filter (requires backend support)
    // Note: This may need custom backend implementation
    // For now, we pass it but Strapi standard API may not support it
    if (geohash) {
        filters.filters.geohash = { $startswith: geohash };
    }

    const response = await client.get('/users', { params: filters });
    return response.data;
};

