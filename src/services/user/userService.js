import Joi from 'joi';
import client from '../client';

/**
 * Search users
 * @param {object} params
 * @param {boolean} [params.isLookingForClub]
 * @param {string} [params.role]
 * @param {string} [params.q]
 * @param {number} [params.page]
 * @param {number} [params.pageSize]
 * @returns {Promise<any>}
 */
export const searchUsers = async (params = {}) => {
    const {
        isLookingForClub,
        role,
        q,
        page = 1,
        pageSize = 10,
    } = params;

    const filters = {
        filters: {},
        pagination: {
            page,
            pageSize,
        },
        populate: ['avatar', 'role', 'section'],
    };

    if (typeof isLookingForClub === 'boolean') {
        filters.filters.isLookingForClub = isLookingForClub;
    }

    if (role) {
        filters.filters.role = {
            name: {
                $containsi: role,
            },
        };
    }

    if (q) {
        filters.filters.$or = [
            { firstname: { $containsi: q } },
            { lastname: { $containsi: q } },
            { username: { $containsi: q } },
        ];
    }

    const response = await client.get('/users', { params: filters });
    return response.data;
};
