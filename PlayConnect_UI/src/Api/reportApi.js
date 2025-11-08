import axios from "axios";
import API_BASE_URL from "./config";

export const reportAPI = {
  createReport: async (payload) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/report`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      console.error("Error creating report:", error.response?.data || error.message);
      throw error;
    }
  },
};