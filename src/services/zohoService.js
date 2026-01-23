/**
 * Zoho CRM Service
 * Handles all Zoho CRM API interactions
 */

const axios = require('axios');
let axiosRetry = require('axios-retry');
const logger = require('../utils/logger');

// axios-retry v2+ exposes the function on the default export; support both shapes
axiosRetry = axiosRetry.default || axiosRetry;

// Configure axios with retry logic
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

class ZohoCRMService {
  constructor() {
    this.baseURL = `https://www.zohoapis.${process.env.ZOHO_DATACENTER}/crm/v2`;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get or refresh access token
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      logger.debug('Refreshing Zoho access token');
      const response = await axios.post(
        `https://accounts.zoho.${process.env.ZOHO_DATACENTER}/oauth/v2/token`,
        null,
        {
          params: {
            grant_type: 'refresh_token',
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            refresh_token: process.env.ZOHO_REFRESH_TOKEN,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 3600 seconds, refresh 5 minutes before expiry
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
      logger.debug('Access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to refresh Zoho access token', { error: error.message });
      throw new Error('Zoho authentication failed');
    }
  }

  /**
   * Make authenticated API request to Zoho
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request data
   * @returns {Promise<object>} API response
   */
  async request(method, endpoint, data = null) {
    try {
      const token = await this.getAccessToken();
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error('Zoho API request failed', {
        endpoint,
        method,
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Search for contacts or leads
   * @param {string} searchTerm - Search term (name, email, phone, company)
   * @param {string} module - 'Leads' or 'Contacts'
   * @param {number} limit - Max results
   * @returns {Promise<array>} Search results
   */
  async searchRecords(searchTerm, module = 'Leads', limit = 10) {
    try {
      logger.debug(`Searching ${module} for: ${searchTerm}`);

      // Build search criteria - search across multiple fields
      const criteria = `(Company:contains:${searchTerm}) OR (First_Name:contains:${searchTerm}) OR (Last_Name:contains:${searchTerm}) OR (Email:contains:${searchTerm}) OR (Phone:contains:${searchTerm})`;

      const response = await this.request(
        'GET',
        `/${module}/search?criteria=${encodeURIComponent(criteria)}&per_page=${limit}`
      );

      return response.data || [];
    } catch (error) {
      logger.error(`Search failed for ${module}`, { searchTerm, error: error.message });
      return [];
    }
  }

  /**
   * Get a specific record by ID
   * @param {string} recordId - Record ID
   * @param {string} module - 'Leads', 'Contacts', or 'Deals'
   * @returns {Promise<object>} Record data
   */
  async getRecord(recordId, module = 'Leads') {
    try {
      const response = await this.request('GET', `/${module}/${recordId}`);
      return response.data[0] || null;
    } catch (error) {
      logger.error(`Failed to get ${module} record`, { recordId, error: error.message });
      return null;
    }
  }

  /**
   * Create a new lead
   * @param {object} leadData - Lead data
   * @returns {Promise<object>} Created lead with ID
   */
  async createLead(leadData) {
    try {
      logger.info('Creating new lead', { company: leadData.Company });

      const payload = {
        data: [leadData],
      };

      const response = await this.request('POST', '/Leads', payload);

      if (response.data && response.data[0]) {
        const createdId = response.data[0].id;
        logger.info('Lead created successfully', { id: createdId, company: leadData.Company });
        return { id: createdId, ...leadData };
      }

      throw new Error('No ID returned from Zoho');
    } catch (error) {
      logger.error('Failed to create lead', { error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing record
   * @param {string} recordId - Record ID
   * @param {string} module - 'Leads', 'Contacts', or 'Deals'
   * @param {object} updateData - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  async updateRecord(recordId, module, updateData) {
    try {
      logger.debug(`Updating ${module} record`, { recordId });

      const payload = {
        data: [updateData],
      };

      await this.request('PUT', `/${module}/${recordId}`, payload);
      logger.info(`${module} record updated successfully`, { recordId });
      return true;
    } catch (error) {
      logger.error(`Failed to update ${module} record`, { recordId, error: error.message });
      throw error;
    }
  }

  /**
   * Create a new deal
   * @param {object} dealData - Deal data
   * @returns {Promise<object>} Created deal with ID
   */
  async createDeal(dealData) {
    try {
      logger.info('Creating new deal', { dealName: dealData.Deal_Name });

      const payload = {
        data: [dealData],
      };

      const response = await this.request('POST', '/Deals', payload);

      if (response.data && response.data[0]) {
        const createdId = response.data[0].id;
        logger.info('Deal created successfully', { id: createdId });
        return { id: createdId, ...dealData };
      }

      throw new Error('No ID returned from Zoho');
    } catch (error) {
      logger.error('Failed to create deal', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all deals in a specific stage
   * @param {string} stage - Pipeline stage
   * @returns {Promise<array>} Deals in that stage
   */
  async getDealsByStage(stage) {
    try {
      const criteria = `(Stage:equals:${stage})`;
      const response = await this.request(
        'GET',
        `/Deals/search?criteria=${encodeURIComponent(criteria)}&per_page=100`
      );
      return response.data || [];
    } catch (error) {
      logger.error('Failed to get deals by stage', { stage, error: error.message });
      return [];
    }
  }

  /**
   * Get all active deals (pipeline)
   * @returns {Promise<array>} All active deals
   */
  async getPipeline() {
    try {
      const response = await this.request('GET', '/Deals?per_page=200');
      return response.data || [];
    } catch (error) {
      logger.error('Failed to get pipeline', { error: error.message });
      return [];
    }
  }

  /**
   * Create a task/activity
   * @param {object} taskData - Task data
   * @returns {Promise<object>} Created task with ID
   */
  async createTask(taskData) {
    try {
      logger.debug('Creating task', { subject: taskData.Subject });

      const payload = {
        data: [taskData],
      };

      const response = await this.request('POST', '/Tasks', payload);

      if (response.data && response.data[0]) {
        const createdId = response.data[0].id;
        logger.info('Task created successfully', { id: createdId });
        return { id: createdId, ...taskData };
      }

      throw new Error('No ID returned from Zoho');
    } catch (error) {
      logger.error('Failed to create task', { error: error.message });
      throw error;
    }
  }

  /**
   * Log an activity (call, email, meeting)
   * @param {object} activityData - Activity data
   * @returns {Promise<object>} Created activity with ID
   */
  async logActivity(activityData) {
    try {
      logger.debug('Logging activity', { type: activityData.Activity_Type });

      const payload = {
        data: [activityData],
      };

      const response = await this.request('POST', '/Activities', payload);

      if (response.data && response.data[0]) {
        const createdId = response.data[0].id;
        logger.info('Activity logged successfully', { id: createdId });
        return { id: createdId, ...activityData };
      }

      throw new Error('No ID returned from Zoho');
    } catch (error) {
      logger.error('Failed to log activity', { error: error.message });
      throw error;
    }
  }

  /**
   * Add tags to a record
   * @param {string} recordId - Record ID
   * @param {string} module - 'Leads', 'Contacts', or 'Deals'
   * @param {array} tags - Tags to add
   * @returns {Promise<boolean>} Success status
   */
  async addTags(recordId, module, tags) {
    try {
      logger.debug(`Adding tags to ${module}`, { recordId, tags });

      const payload = {
        data: [
          {
            id: recordId,
            tags: tags.map((tag) => ({ name: tag })),
          },
        ],
      };

      await this.request('POST', `/${module}/${recordId}/actions/add_tags`, payload);
      logger.info('Tags added successfully', { recordId, tags });
      return true;
    } catch (error) {
      logger.error('Failed to add tags', { recordId, error: error.message });
      throw error;
    }
  }

  /**
   * Remove tags from a record
   * @param {string} recordId - Record ID
   * @param {string} module - 'Leads', 'Contacts', or 'Deals'
   * @param {array} tags - Tags to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeTags(recordId, module, tags) {
    try {
      logger.debug(`Removing tags from ${module}`, { recordId, tags });

      const payload = {
        data: [
          {
            id: recordId,
            tags: tags.map((tag) => ({ name: tag })),
          },
        ],
      };

      await this.request('POST', `/${module}/${recordId}/actions/remove_tags`, payload);
      logger.info('Tags removed successfully', { recordId, tags });
      return true;
    } catch (error) {
      logger.error('Failed to remove tags', { recordId, error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ZohoCRMService();
