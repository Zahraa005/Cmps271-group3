import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

export const reportAPI = {
  createReport: async (payload) => {
    try {
      const response = await axios.post(`${BASE_URL}/report`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      console.error("Error creating report:", error.response?.data || error.message);
      throw error;
    }
  },
};
