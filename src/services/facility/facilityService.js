import client from '@/services/client';

const getFacilities = async (clubId) => {
    try {
        const response = await client.get(`/facilities?filters[club][documentId][$eq]=${clubId}&populate=*`);
        return response.data;
    } catch (error) {
        console.error('Error fetching facilities:', error);
        throw error;
    }
};

const getFacility = async (id) => {
    try {
        const response = await client.get(`/facilities/${id}?populate=*`);
        return response.data;
    } catch (error) {
        console.error('Error fetching facility:', error);
        throw error;
    }
};

const createFacility = async (data) => {
    try {
        const response = await client.post('/facilities', { data });
        return response.data;
    } catch (error) {
        console.error('Error creating facility:', error);
        throw error;
    }
};

const updateFacility = async (id, data) => {
    try {
        const response = await client.put(`/facilities/${id}`, { data });
        return response.data;
    } catch (error) {
        console.error('Error updating facility:', error);
        throw error;
    }
};

const deleteFacility = async (id) => {
    try {
        const response = await client.delete(`/facilities/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting facility:', error);
        throw error;
    }
};

export {
    getFacilities,
    getFacility,
    createFacility,
    updateFacility,
    deleteFacility,
};
