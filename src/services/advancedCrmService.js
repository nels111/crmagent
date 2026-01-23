/**
 * Advanced CRM Service
 * Handles complex CRM operations, analytics, and business logic
 */

const zohoService = require('./zohoService');
const logger = require('../utils/logger');

class AdvancedCrmService {
  /**
   * Get comprehensive pipeline analysis
   * @returns {Promise<object>} Pipeline analysis with metrics
   */
  async getPipelineAnalysis() {
    try {
      const deals = await zohoService.getPipeline();
      
      const analysis = {
        totalDeals: deals.length,
        totalValue: 0,
        byStage: {},
        byOwner: {},
        staleDeals: [],
        closingThisMonth: [],
        averageDealValue: 0,
        conversionRate: 0,
        metrics: {}
      };

      const now = new Date();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      deals.forEach((deal) => {
        const value = deal.Amount || 0;
        analysis.totalValue += value;

        // By stage
        if (!analysis.byStage[deal.Stage]) {
          analysis.byStage[deal.Stage] = { count: 0, value: 0, deals: [] };
        }
        analysis.byStage[deal.Stage].count++;
        analysis.byStage[deal.Stage].value += value;
        analysis.byStage[deal.Stage].deals.push(deal.Deal_Name);

        // By owner
        const owner = deal.Owner?.name || 'Unassigned';
        if (!analysis.byOwner[owner]) {
          analysis.byOwner[owner] = { count: 0, value: 0 };
        }
        analysis.byOwner[owner].count++;
        analysis.byOwner[owner].value += value;

        // Stale deals (14+ days)
        const lastActivity = deal.Last_Activity_Time ? new Date(deal.Last_Activity_Time) : new Date(deal.Created_Time);
        const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
        if (daysSinceActivity >= 14) {
          analysis.staleDeals.push({
            name: deal.Deal_Name,
            stage: deal.Stage,
            value,
            daysSinceActivity,
            owner
          });
        }

        // Closing this month
        if (deal.Closing_Date) {
          const closingDate = new Date(deal.Closing_Date);
          if (closingDate <= monthEnd && closingDate >= now) {
            analysis.closingThisMonth.push({
              name: deal.Deal_Name,
              value,
              closingDate: closingDate.toLocaleDateString()
            });
          }
        }
      });

      // Calculate metrics
      analysis.averageDealValue = analysis.totalDeals > 0 ? Math.round(analysis.totalValue / analysis.totalDeals) : 0;
      
      // Conversion rate (Closed Won / Total)
      const closedWon = analysis.byStage['Closed Won']?.count || 0;
      analysis.conversionRate = analysis.totalDeals > 0 ? Math.round((closedWon / analysis.totalDeals) * 100) : 0;

      // Additional metrics
      analysis.metrics = {
        healthyDeals: deals.filter(d => {
          const lastActivity = d.Last_Activity_Time ? new Date(d.Last_Activity_Time) : new Date(d.Created_Time);
          const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
          return daysSinceActivity < 7;
        }).length,
        attentionNeeded: deals.filter(d => {
          const lastActivity = d.Last_Activity_Time ? new Date(d.Last_Activity_Time) : new Date(d.Created_Time);
          const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
          return daysSinceActivity >= 7 && daysSinceActivity < 14;
        }).length,
        urgent: deals.filter(d => {
          const lastActivity = d.Last_Activity_Time ? new Date(d.Last_Activity_Time) : new Date(d.Created_Time);
          const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
          return daysSinceActivity >= 14 && daysSinceActivity < 21;
        }).length,
        critical: deals.filter(d => {
          const lastActivity = d.Last_Activity_Time ? new Date(d.Last_Activity_Time) : new Date(d.Created_Time);
          const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
          return daysSinceActivity >= 21;
        }).length
      };

      return analysis;
    } catch (error) {
      logger.error('Failed to get pipeline analysis', { error: error.message });
      throw error;
    }
  }

  /**
   * Get deal forecast
   * @returns {Promise<object>} Revenue forecast
   */
  async getForecast() {
    try {
      const deals = await zohoService.getPipeline();
      const now = new Date();

      const forecast = {
        thisMonth: 0,
        nextMonth: 0,
        thisQuarter: 0,
        thisYear: 0,
        byStage: {}
      };

      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
      const yearEnd = new Date(now.getFullYear(), 11, 31);

      deals.forEach((deal) => {
        const value = deal.Amount || 0;
        const closingDate = deal.Closing_Date ? new Date(deal.Closing_Date) : null;

        if (!closingDate) return;

        // By stage
        if (!forecast.byStage[deal.Stage]) {
          forecast.byStage[deal.Stage] = 0;
        }
        forecast.byStage[deal.Stage] += value;

        // This month
        if (closingDate <= monthEnd && closingDate >= now) {
          forecast.thisMonth += value;
        }

        // Next month
        if (closingDate <= nextMonthEnd && closingDate > monthEnd) {
          forecast.nextMonth += value;
        }

        // This quarter
        if (closingDate <= quarterEnd && closingDate >= now) {
          forecast.thisQuarter += value;
        }

        // This year
        if (closingDate <= yearEnd && closingDate >= now) {
          forecast.thisYear += value;
        }
      });

      return forecast;
    } catch (error) {
      logger.error('Failed to get forecast', { error: error.message });
      throw error;
    }
  }

  /**
   * Get lead source attribution
   * @returns {Promise<object>} Lead source metrics
   */
  async getLeadSourceAttribution() {
    try {
      const leads = await zohoService.request('GET', '/Leads?per_page=200');
      const attribution = {};

      (leads.data || []).forEach((lead) => {
        const source = lead.Lead_Source || 'Unknown';
        if (!attribution[source]) {
          attribution[source] = { count: 0, converted: 0 };
        }
        attribution[source].count++;

        // Check if converted (has associated deal)
        if (lead.Lead_Status === 'Quote accepted' || lead.Lead_Status === 'Ongoing customer') {
          attribution[source].converted++;
        }
      });

      // Calculate conversion rates
      Object.keys(attribution).forEach((source) => {
        const data = attribution[source];
        data.conversionRate = data.count > 0 ? Math.round((data.converted / data.count) * 100) : 0;
      });

      return attribution;
    } catch (error) {
      logger.error('Failed to get lead source attribution', { error: error.message });
      return {};
    }
  }

  /**
   * Get contact activity summary
   * @param {string} contactId - Contact ID
   * @returns {Promise<object>} Activity summary
   */
  async getContactActivitySummary(contactId) {
    try {
      const contact = await zohoService.getRecord(contactId, 'Contacts');
      if (!contact) {
        throw new Error('Contact not found');
      }

      const summary = {
        contact: {
          id: contact.id,
          name: `${contact.First_Name} ${contact.Last_Name}`,
          email: contact.Email,
          phone: contact.Phone,
          company: contact.Account_Name
        },
        lastActivity: contact.Last_Activity_Time,
        deals: [],
        tasks: [],
        activities: []
      };

      // Get associated deals
      const deals = await zohoService.request('GET', `/Contacts/${contactId}/Deals`);
      summary.deals = (deals.data || []).map(d => ({
        id: d.id,
        name: d.Deal_Name,
        stage: d.Stage,
        value: d.Amount
      }));

      return summary;
    } catch (error) {
      logger.error('Failed to get contact activity summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk update records
   * @param {string} module - Module name
   * @param {array} updates - Array of {id, fields}
   * @returns {Promise<object>} Update results
   */
  async bulkUpdate(module, updates) {
    try {
      logger.info(`Bulk updating ${updates.length} records in ${module}`);

      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };

      for (const update of updates) {
        try {
          await zohoService.updateRecord(update.id, module, update.fields);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            id: update.id,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk update failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Search across all modules
   * @param {string} searchTerm - Search term
   * @returns {Promise<object>} Results from all modules
   */
  async globalSearch(searchTerm) {
    try {
      logger.debug(`Global search for: ${searchTerm}`);

      const results = {
        leads: [],
        contacts: [],
        deals: [],
        accounts: []
      };

      // Search leads
      const leads = await zohoService.searchRecords(searchTerm, 'Leads', 5);
      results.leads = leads.map(l => ({
        id: l.id,
        type: 'Lead',
        name: l.Company,
        contact: `${l.First_Name} ${l.Last_Name}`,
        status: l.Lead_Status
      }));

      // Search contacts
      const contacts = await zohoService.searchRecords(searchTerm, 'Contacts', 5);
      results.contacts = contacts.map(c => ({
        id: c.id,
        type: 'Contact',
        name: `${c.First_Name} ${c.Last_Name}`,
        company: c.Account_Name,
        email: c.Email
      }));

      // Search deals
      const deals = await zohoService.request('GET', `/Deals/search?criteria=(Deal_Name:contains:${encodeURIComponent(searchTerm)})&per_page=5`);
      results.deals = (deals.data || []).map(d => ({
        id: d.id,
        type: 'Deal',
        name: d.Deal_Name,
        stage: d.Stage,
        value: d.Amount
      }));

      return results;
    } catch (error) {
      logger.error('Global search failed', { error: error.message });
      return { leads: [], contacts: [], deals: [], accounts: [] };
    }
  }

  /**
   * Get deal timeline
   * @param {string} dealId - Deal ID
   * @returns {Promise<array>} Timeline of activities
   */
  async getDealTimeline(dealId) {
    try {
      const deal = await zohoService.getRecord(dealId, 'Deals');
      if (!deal) {
        throw new Error('Deal not found');
      }

      const timeline = [];

      // Add deal creation
      timeline.push({
        date: deal.Created_Time,
        type: 'Deal Created',
        description: `Deal "${deal.Deal_Name}" created`,
        stage: deal.Stage
      });

      // Add stage changes (would need to fetch from activities)
      // This is a simplified version - in production, fetch from Activities module

      return timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      logger.error('Failed to get deal timeline', { error: error.message });
      throw error;
    }
  }

  /**
   * Get sales metrics
   * @returns {Promise<object>} Sales performance metrics
   */
  async getSalesMetrics() {
    try {
      const deals = await zohoService.getPipeline();
      const leads = await zohoService.request('GET', '/Leads?per_page=200');

      const metrics = {
        totalLeads: (leads.data || []).length,
        totalDeals: deals.length,
        totalPipelineValue: 0,
        averageDealSize: 0,
        winRate: 0,
        lossRate: 0,
        avgSalesCycle: 0,
        topDeals: [],
        topLeadSources: {}
      };

      // Calculate values
      deals.forEach(d => {
        metrics.totalPipelineValue += d.Amount || 0;
      });

      metrics.averageDealSize = metrics.totalDeals > 0 ? Math.round(metrics.totalPipelineValue / metrics.totalDeals) : 0;

      // Win/Loss rates
      const closedWon = deals.filter(d => d.Stage === 'Closed Won').length;
      const closedLost = deals.filter(d => d.Stage === 'Closed Lost').length;
      const totalClosed = closedWon + closedLost;

      metrics.winRate = totalClosed > 0 ? Math.round((closedWon / totalClosed) * 100) : 0;
      metrics.lossRate = totalClosed > 0 ? Math.round((closedLost / totalClosed) * 100) : 0;

      // Top deals
      metrics.topDeals = deals
        .sort((a, b) => (b.Amount || 0) - (a.Amount || 0))
        .slice(0, 5)
        .map(d => ({
          name: d.Deal_Name,
          value: d.Amount,
          stage: d.Stage
        }));

      // Lead sources
      (leads.data || []).forEach(l => {
        const source = l.Lead_Source || 'Unknown';
        if (!metrics.topLeadSources[source]) {
          metrics.topLeadSources[source] = 0;
        }
        metrics.topLeadSources[source]++;
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to get sales metrics', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AdvancedCrmService();
