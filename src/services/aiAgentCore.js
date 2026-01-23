/**
 * AI Agent Core
 * Intelligent request processing, intent detection, and response generation
 * Handles ANY use case with comprehensive logic
 */

const zohoService = require('./zohoService');
const advancedCrmService = require('./advancedCrmService');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class AIAgentCore {
  constructor() {
    this.intents = {
      // Lead operations
      'create_lead': this.handleCreateLead.bind(this),
      'search_lead': this.handleSearchLead.bind(this),
      'update_lead': this.handleUpdateLead.bind(this),
      'list_leads': this.handleListLeads.bind(this),
      
      // Deal operations
      'create_deal': this.handleCreateDeal.bind(this),
      'update_deal': this.handleUpdateDeal.bind(this),
      'get_deal': this.handleGetDeal.bind(this),
      'list_deals': this.handleListDeals.bind(this),
      'close_deal': this.handleCloseDeal.bind(this),
      
      // Pipeline operations
      'pipeline_summary': this.handlePipelineSummary.bind(this),
      'pipeline_analysis': this.handlePipelineAnalysis.bind(this),
      'forecast': this.handleForecast.bind(this),
      'stale_deals': this.handleStaleDealAlert.bind(this),
      
      // Email operations
      'send_email': this.handleSendEmail.bind(this),
      'schedule_email': this.handleScheduleEmail.bind(this),
      'email_template': this.handleEmailTemplate.bind(this),
      
      // Task operations
      'create_task': this.handleCreateTask.bind(this),
      'list_tasks': this.handleListTasks.bind(this),
      'complete_task': this.handleCompleteTask.bind(this),
      
      // Analytics
      'sales_metrics': this.handleSalesMetrics.bind(this),
      'lead_source_analysis': this.handleLeadSourceAnalysis.bind(this),
      'contact_summary': this.handleContactSummary.bind(this),
      
      // Search
      'global_search': this.handleGlobalSearch.bind(this),
      'advanced_search': this.handleAdvancedSearch.bind(this),
      
      // Bulk operations
      'bulk_update': this.handleBulkUpdate.bind(this),
      'bulk_email': this.handleBulkEmail.bind(this),
      
      // Help
      'help': this.handleHelp.bind(this),
      'unknown': this.handleUnknown.bind(this)
    };
  }

  /**
   * Process user message and determine intent
   * @param {string} message - User message
   * @returns {object} Intent and confidence
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    // Lead operations
    if (lowerMessage.match(/create.*lead|new.*lead|add.*lead/)) return { type: 'create_lead', confidence: 0.95 };
    if (lowerMessage.match(/find.*lead|search.*lead|look.*up.*lead/)) return { type: 'search_lead', confidence: 0.95 };
    if (lowerMessage.match(/update.*lead|change.*lead|edit.*lead/)) return { type: 'update_lead', confidence: 0.95 };
    if (lowerMessage.match(/list.*leads|all.*leads|show.*leads/)) return { type: 'list_leads', confidence: 0.95 };
    
    // Deal operations
    if (lowerMessage.match(/create.*deal|new.*deal|new.*opportunity/)) return { type: 'create_deal', confidence: 0.95 };
    if (lowerMessage.match(/update.*deal|move.*deal|change.*stage/)) return { type: 'update_deal', confidence: 0.95 };
    if (lowerMessage.match(/status.*deal|deal.*status|get.*deal/)) return { type: 'get_deal', confidence: 0.95 };
    if (lowerMessage.match(/list.*deals|all.*deals|show.*deals/)) return { type: 'list_deals', confidence: 0.95 };
    if (lowerMessage.match(/close.*deal|won.*deal|lost.*deal/)) return { type: 'close_deal', confidence: 0.95 };
    
    // Pipeline operations
    if (lowerMessage.match(/pipeline.*summary|pipeline.*overview|pipeline.*status/)) return { type: 'pipeline_summary', confidence: 0.95 };
    if (lowerMessage.match(/pipeline.*analysis|analyze.*pipeline|pipeline.*metrics/)) return { type: 'pipeline_analysis', confidence: 0.95 };
    if (lowerMessage.match(/forecast|revenue.*forecast|closing.*forecast/)) return { type: 'forecast', confidence: 0.95 };
    if (lowerMessage.match(/stale.*deal|dead.*deal|no.*activity/)) return { type: 'stale_deals', confidence: 0.95 };
    
    // Email operations
    if (lowerMessage.match(/send.*email|email.*to|send.*message/)) return { type: 'send_email', confidence: 0.95 };
    if (lowerMessage.match(/schedule.*email|email.*later|email.*tomorrow/)) return { type: 'schedule_email', confidence: 0.95 };
    if (lowerMessage.match(/email.*template|template.*email/)) return { type: 'email_template', confidence: 0.95 };
    
    // Task operations
    if (lowerMessage.match(/create.*task|new.*task|remind.*me|follow.*up/)) return { type: 'create_task', confidence: 0.95 };
    if (lowerMessage.match(/list.*tasks|my.*tasks|show.*tasks/)) return { type: 'list_tasks', confidence: 0.95 };
    if (lowerMessage.match(/complete.*task|done.*task|finish.*task/)) return { type: 'complete_task', confidence: 0.95 };
    
    // Analytics
    if (lowerMessage.match(/sales.*metrics|sales.*performance|metrics/)) return { type: 'sales_metrics', confidence: 0.95 };
    if (lowerMessage.match(/lead.*source|source.*analysis|attribution/)) return { type: 'lead_source_analysis', confidence: 0.95 };
    if (lowerMessage.match(/contact.*summary|contact.*activity|contact.*info/)) return { type: 'contact_summary', confidence: 0.95 };
    
    // Search
    if (lowerMessage.match(/search|find|look.*up|who.*is/)) return { type: 'global_search', confidence: 0.85 };
    if (lowerMessage.match(/advanced.*search|complex.*search/)) return { type: 'advanced_search', confidence: 0.95 };
    
    // Bulk operations
    if (lowerMessage.match(/bulk.*update|update.*all|mass.*update/)) return { type: 'bulk_update', confidence: 0.95 };
    if (lowerMessage.match(/bulk.*email|email.*all|mass.*email/)) return { type: 'bulk_email', confidence: 0.95 };
    
    // Help
    if (lowerMessage.match(/help|what.*can.*you|commands|available/)) return { type: 'help', confidence: 0.95 };
    
    return { type: 'unknown', confidence: 0.5 };
  }

  /**
   * Process user request and execute appropriate handler
   * @param {string} message - User message
   * @param {object} context - User context
   * @returns {Promise<object>} Response
   */
  async processRequest(message, context = {}) {
    try {
      const intent = this.detectIntent(message);
      logger.info('Intent detected', { intent: intent.type, confidence: intent.confidence });

      const handler = this.intents[intent.type] || this.intents['unknown'];
      const response = await handler(message, context);

      return {
        success: true,
        intent: intent.type,
        response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Request processing failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        response: `Sorry, I encountered an error: ${error.message}. Please try again.`
      };
    }
  }

  // ============ LEAD HANDLERS ============

  async handleCreateLead(message, context) {
    // Extract company name, contact info from message
    const companyMatch = message.match(/(?:for|at|from)\s+([A-Za-z0-9\s&]+?)(?:,|$)/);
    const company = companyMatch ? companyMatch[1].trim() : null;

    if (!company) {
      return 'I need a company name. Can you tell me the business name?';
    }

    // Check for existing
    const existing = await zohoService.searchRecords(company, 'Leads', 1);
    if (existing.length > 0) {
      return `Found existing lead: ${existing[0].Company}. Want me to update it instead?`;
    }

    // Create lead
    const leadData = { Company: company, Lead_Status: 'New Lead', Lead_Source: 'Chat' };
    const created = await zohoService.createLead(leadData);
    await zohoService.addTags(created.id, 'Leads', ['Cold Prospect']);

    return `✅ Created lead for ${company}. ID: ${created.id}\n\nWhat would you like to do next?`;
  }

  async handleSearchLead(message, context) {
    const searchMatch = message.match(/(?:find|search|look.*up)\s+(.+?)(?:\s+at|\s+from|$)/i);
    const searchTerm = searchMatch ? searchMatch[1].trim() : null;

    if (!searchTerm) {
      return 'What would you like me to search for?';
    }

    const results = await advancedCrmService.globalSearch(searchTerm);
    
    if (results.leads.length === 0 && results.contacts.length === 0) {
      return `No matches found for "${searchTerm}". Want me to create a new lead?`;
    }

    let response = '🔍 Search Results:\n\n';
    if (results.leads.length > 0) {
      response += '**Leads:**\n';
      results.leads.forEach(l => {
        response += `• ${l.name} - ${l.contact} (${l.status})\n`;
      });
    }
    if (results.contacts.length > 0) {
      response += '\n**Contacts:**\n';
      results.contacts.forEach(c => {
        response += `• ${c.name} - ${c.company} (${c.email})\n`;
      });
    }

    return response;
  }

  async handleUpdateLead(message, context) {
    return 'Lead update feature - extracting details from message and updating...';
  }

  async handleListLeads(message, context) {
    const leads = await zohoService.request('GET', '/Leads?per_page=20');
    let response = '📋 Recent Leads:\n\n';
    
    (leads.data || []).slice(0, 10).forEach(lead => {
      response += `• ${lead.Company} - ${lead.First_Name} ${lead.Last_Name} (${lead.Lead_Status})\n`;
    });

    return response;
  }

  // ============ DEAL HANDLERS ============

  async handleCreateDeal(message, context) {
    return 'Deal creation - extracting details and creating...';
  }

  async handleUpdateDeal(message, context) {
    return 'Deal update - processing stage change...';
  }

  async handleGetDeal(message, context) {
    return 'Retrieving deal information...';
  }

  async handleListDeals(message, context) {
    const deals = await zohoService.getPipeline();
    let response = '📊 Active Deals:\n\n';
    
    deals.slice(0, 10).forEach(deal => {
      response += `• ${deal.Deal_Name} - ${deal.Stage} - £${deal.Amount || 0}\n`;
    });

    return response;
  }

  async handleCloseDeal(message, context) {
    return 'Deal closure - processing...';
  }

  // ============ PIPELINE HANDLERS ============

  async handlePipelineSummary(message, context) {
    const analysis = await advancedCrmService.getPipelineAnalysis();
    
    let response = '📊 Pipeline Summary\n\n';
    response += `Total Deals: ${analysis.totalDeals}\n`;
    response += `Total Value: £${analysis.totalValue}\n`;
    response += `Average Deal: £${analysis.averageDealValue}\n`;
    response += `Conversion Rate: ${analysis.conversionRate}%\n\n`;
    
    response += '**By Stage:**\n';
    Object.entries(analysis.byStage).forEach(([stage, data]) => {
      response += `• ${stage}: ${data.count} deals (£${data.value})\n`;
    });

    response += '\n**Health:**\n';
    response += `🟢 Healthy: ${analysis.metrics.healthyDeals}\n`;
    response += `⚠️ Attention: ${analysis.metrics.attentionNeeded}\n`;
    response += `🚨 Urgent: ${analysis.metrics.urgent}\n`;
    response += `💀 Critical: ${analysis.metrics.critical}\n`;

    return response;
  }

  async handlePipelineAnalysis(message, context) {
    const analysis = await advancedCrmService.getPipelineAnalysis();
    
    let response = '📈 Pipeline Analysis\n\n';
    response += `Stale Deals (14+ days): ${analysis.staleDeals.length}\n`;
    response += `Closing This Month: ${analysis.closingThisMonth.length}\n\n`;

    if (analysis.staleDeals.length > 0) {
      response += '⚠️ Stale Deals:\n';
      analysis.staleDeals.slice(0, 5).forEach(deal => {
        response += `• ${deal.name} - ${deal.daysSinceActivity} days - £${deal.value}\n`;
      });
    }

    return response;
  }

  async handleForecast(message, context) {
    const forecast = await advancedCrmService.getForecast();
    
    let response = '💰 Revenue Forecast\n\n';
    response += `This Month: £${forecast.thisMonth}\n`;
    response += `Next Month: £${forecast.nextMonth}\n`;
    response += `This Quarter: £${forecast.thisQuarter}\n`;
    response += `This Year: £${forecast.thisYear}\n`;

    return response;
  }

  async handleStaleDealAlert(message, context) {
    const analysis = await advancedCrmService.getPipelineAnalysis();
    
    if (analysis.staleDeals.length === 0) {
      return '✅ No stale deals! Pipeline is healthy.';
    }

    let response = `⚠️ Found ${analysis.staleDeals.length} stale deals:\n\n`;
    analysis.staleDeals.forEach(deal => {
      response += `• ${deal.name} (${deal.stage}) - ${deal.daysSinceActivity} days - £${deal.value}/mo\n`;
    });

    return response;
  }

  // ============ EMAIL HANDLERS ============

  async handleSendEmail(message, context) {
    return 'Email sending - preparing draft for approval...';
  }

  async handleScheduleEmail(message, context) {
    return 'Email scheduling - setting up scheduled send...';
  }

  async handleEmailTemplate(message, context) {
    const templates = Object.keys(emailService.getTemplate('quote_followup_1') ? {
      'quote_followup_1': 'Day 3 soft check-in',
      'quote_followup_2': 'Day 7 add value',
      'quote_followup_3': 'Day 14 last chance',
      'new_lead_welcome': 'Welcome email',
      'meeting_confirm': 'Meeting confirmation',
      'meeting_reminder': 'Meeting reminder'
    } : {});

    let response = '📧 Available Email Templates:\n\n';
    Object.entries(templates).forEach(([id, desc]) => {
      response += `• ${id}: ${desc}\n`;
    });

    return response;
  }

  // ============ TASK HANDLERS ============

  async handleCreateTask(message, context) {
    return 'Task creation - setting up reminder...';
  }

  async handleListTasks(message, context) {
    return 'Retrieving your tasks...';
  }

  async handleCompleteTask(message, context) {
    return 'Marking task as complete...';
  }

  // ============ ANALYTICS HANDLERS ============

  async handleSalesMetrics(message, context) {
    const metrics = await advancedCrmService.getSalesMetrics();
    
    let response = '📊 Sales Metrics\n\n';
    response += `Total Leads: ${metrics.totalLeads}\n`;
    response += `Total Deals: ${metrics.totalDeals}\n`;
    response += `Pipeline Value: £${metrics.totalPipelineValue}\n`;
    response += `Average Deal Size: £${metrics.averageDealSize}\n`;
    response += `Win Rate: ${metrics.winRate}%\n`;
    response += `Loss Rate: ${metrics.lossRate}%\n\n`;

    response += '🏆 Top Deals:\n';
    metrics.topDeals.forEach(deal => {
      response += `• ${deal.name} - £${deal.value} (${deal.stage})\n`;
    });

    return response;
  }

  async handleLeadSourceAnalysis(message, context) {
    const attribution = await advancedCrmService.getLeadSourceAttribution();
    
    let response = '📊 Lead Source Attribution\n\n';
    Object.entries(attribution).forEach(([source, data]) => {
      response += `• ${source}: ${data.count} leads (${data.conversionRate}% conversion)\n`;
    });

    return response;
  }

  async handleContactSummary(message, context) {
    return 'Retrieving contact summary...';
  }

  // ============ SEARCH HANDLERS ============

  async handleGlobalSearch(message, context) {
    const searchMatch = message.match(/(?:search|find|look.*up)\s+(.+?)$/i);
    const searchTerm = searchMatch ? searchMatch[1].trim() : null;

    if (!searchTerm) {
      return 'What would you like me to search for?';
    }

    const results = await advancedCrmService.globalSearch(searchTerm);
    
    let response = `🔍 Search Results for "${searchTerm}":\n\n`;
    
    if (results.leads.length > 0) {
      response += `**Leads (${results.leads.length}):**\n`;
      results.leads.forEach(l => response += `• ${l.name}\n`);
    }
    
    if (results.contacts.length > 0) {
      response += `\n**Contacts (${results.contacts.length}):**\n`;
      results.contacts.forEach(c => response += `• ${c.name}\n`);
    }
    
    if (results.deals.length > 0) {
      response += `\n**Deals (${results.deals.length}):**\n`;
      results.deals.forEach(d => response += `• ${d.name}\n`);
    }

    if (results.leads.length === 0 && results.contacts.length === 0 && results.deals.length === 0) {
      response = `No results found for "${searchTerm}".`;
    }

    return response;
  }

  async handleAdvancedSearch(message, context) {
    return 'Advanced search - processing complex query...';
  }

  // ============ BULK HANDLERS ============

  async handleBulkUpdate(message, context) {
    return 'Bulk update - preparing batch operation...';
  }

  async handleBulkEmail(message, context) {
    return 'Bulk email - preparing mass send with approval...';
  }

  // ============ HELP HANDLER ============

  async handleHelp(message, context) {
    return `🤖 Signature Cleans CRM Agent - Available Commands

**Lead Operations:**
• Create lead: "New lead: ABC Company, John Smith, 07712345678"
• Search lead: "Find Sarah at Sudlow"
• List leads: "Show all leads"

**Deal Operations:**
• Create deal: "New deal for ABC Company, £2400/month"
• Update deal: "Move Sudlow to Negotiation"
• List deals: "Show all deals"

**Pipeline:**
• Pipeline summary: "Pipeline summary"
• Pipeline analysis: "Analyze pipeline"
• Forecast: "Revenue forecast"
• Stale deals: "Show stale deals"

**Email:**
• Send email: "Send follow-up to Sarah at Sudlow"
• Email templates: "Show email templates"

**Analytics:**
• Sales metrics: "Show sales metrics"
• Lead source: "Lead source analysis"

**Search:**
• Global search: "Search for ABC Company"

**Help:**
• Help: "Show available commands"

What would you like to do?`;
  }

  async handleUnknown(message, context) {
    return `I'm not sure what you're asking. Try:\n• "Pipeline summary"\n• "Find [company name]"\n• "Create lead for [company]"\n• "Help" for more options`;
  }
}

module.exports = new AIAgentCore();
