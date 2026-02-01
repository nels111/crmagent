/**
 * CRM Tools
 * Defines all CRM operations as tools for the AI agent
 * Uses OpenAI function calling format
 */

const zohoService = require('./zohoService');
const advancedCrmService = require('./advancedCrmService');
const emailService = require('./emailService');
const db = require('../db/connection');
const logger = require('../utils/logger');

/**
 * Tool definitions for OpenAI function calling
 */
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_crm',
      description: 'Search for leads, contacts, or deals in the CRM by name, company, email, or phone number. Use this when the user wants to find or look up someone or a company.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search term - can be a name, company name, email, or phone number',
          },
          module: {
            type: 'string',
            enum: ['all', 'Leads', 'Contacts', 'Deals'],
            description: 'Which CRM module to search in. Use "all" to search everywhere.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a new lead in the CRM. Use this when the user wants to add a new potential customer or prospect.',
      parameters: {
        type: 'object',
        properties: {
          company: {
            type: 'string',
            description: 'Company or business name',
          },
          first_name: {
            type: 'string',
            description: 'Contact first name',
          },
          last_name: {
            type: 'string',
            description: 'Contact last name',
          },
          email: {
            type: 'string',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          lead_source: {
            type: 'string',
            description: 'How the lead was acquired (e.g., Website, Referral, Cold Call)',
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the lead',
          },
        },
        required: ['company'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead',
      description: 'Update an existing lead in the CRM. Use this to change lead status, add notes, or update contact information.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'The Zoho CRM lead ID',
          },
          status: {
            type: 'string',
            description: 'New lead status (e.g., New Lead, Contacted, Qualified, Quote Sent)',
          },
          email: {
            type: 'string',
            description: 'Updated email address',
          },
          phone: {
            type: 'string',
            description: 'Updated phone number',
          },
          notes: {
            type: 'string',
            description: 'Notes to add to the lead',
          },
        },
        required: ['lead_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_deal',
      description: 'Create a new deal/opportunity in the CRM. Use this when a lead becomes a real sales opportunity with a potential value.',
      parameters: {
        type: 'object',
        properties: {
          deal_name: {
            type: 'string',
            description: 'Name of the deal (usually company name + service)',
          },
          amount: {
            type: 'number',
            description: 'Monthly contract value in GBP',
          },
          stage: {
            type: 'string',
            enum: ['Qualification', 'Site Survey', 'Quote Sent', 'Negotiation', 'Closed Won', 'Closed Lost'],
            description: 'Current stage in the sales pipeline',
          },
          contact_id: {
            type: 'string',
            description: 'Associated contact ID in Zoho',
          },
          closing_date: {
            type: 'string',
            description: 'Expected closing date (YYYY-MM-DD format)',
          },
          description: {
            type: 'string',
            description: 'Deal description or notes',
          },
        },
        required: ['deal_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_deal',
      description: 'Update an existing deal. Use this to change deal stage, update value, or add notes.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The Zoho CRM deal ID',
          },
          stage: {
            type: 'string',
            enum: ['Qualification', 'Site Survey', 'Quote Sent', 'Negotiation', 'Closed Won', 'Closed Lost'],
            description: 'New deal stage',
          },
          amount: {
            type: 'number',
            description: 'Updated monthly contract value in GBP',
          },
          closing_date: {
            type: 'string',
            description: 'Updated expected closing date (YYYY-MM-DD format)',
          },
          notes: {
            type: 'string',
            description: 'Notes to add to the deal',
          },
        },
        required: ['deal_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pipeline_summary',
      description: 'Get a summary of the sales pipeline including total deals, values by stage, and deal health metrics. Use this when the user asks about pipeline, deals overview, or sales status.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stale_deals',
      description: 'Get deals that have had no activity for 14+ days and need attention. Use this when the user asks about stale deals, dead deals, or deals needing follow-up.',
      parameters: {
        type: 'object',
        properties: {
          days_threshold: {
            type: 'number',
            description: 'Minimum days of inactivity to consider a deal stale (default: 14)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_revenue_forecast',
      description: 'Get revenue forecast for this month, next month, quarter, and year. Use this when the user asks about forecasts, expected revenue, or projected income.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_metrics',
      description: 'Get sales performance metrics including total leads, deals, win rate, average deal size. Use this when the user asks about metrics, performance, or analytics.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a follow-up task or reminder in the CRM. Use this when the user wants to set a reminder or create a to-do.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'Task subject/title (e.g., "Call back John at ABC Company")',
          },
          due_date: {
            type: 'string',
            description: 'Due date (YYYY-MM-DD format or relative like "tomorrow", "next Friday")',
          },
          priority: {
            type: 'string',
            enum: ['High', 'Normal', 'Low'],
            description: 'Task priority',
          },
          related_to_id: {
            type: 'string',
            description: 'ID of the related lead, contact, or deal',
          },
          related_to_module: {
            type: 'string',
            enum: ['Leads', 'Contacts', 'Deals'],
            description: 'Module of the related record',
          },
          description: {
            type: 'string',
            description: 'Additional task details',
          },
        },
        required: ['subject'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send or draft an email to a contact. For high-value deals or protected accounts, this will queue for approval.',
      parameters: {
        type: 'object',
        properties: {
          to_email: {
            type: 'string',
            description: 'Recipient email address',
          },
          to_name: {
            type: 'string',
            description: 'Recipient name',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body content',
          },
          template_id: {
            type: 'string',
            enum: ['quote_followup_1', 'quote_followup_2', 'quote_followup_3', 'new_lead_welcome', 'meeting_confirm', 'meeting_reminder'],
            description: 'Optional: Use a predefined email template',
          },
          deal_id: {
            type: 'string',
            description: 'Associated deal ID for logging',
          },
          deal_value: {
            type: 'number',
            description: 'Deal value (used for approval workflow)',
          },
        },
        required: ['to_email', 'subject'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_quote_sequence',
      description: 'Start an automated quote follow-up email sequence for a deal. Sends follow-ups at day 3, 7, 14, and auto-closes at day 21.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The deal ID to start the sequence for',
          },
          deal_name: {
            type: 'string',
            description: 'Deal name',
          },
          contact_email: {
            type: 'string',
            description: 'Contact email for the follow-ups',
          },
          contact_name: {
            type: 'string',
            description: 'Contact name',
          },
          deal_value: {
            type: 'number',
            description: 'Monthly deal value',
          },
        },
        required: ['deal_id', 'deal_name', 'contact_email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop_quote_sequence',
      description: 'Stop/cancel an automated quote follow-up sequence. Use this when a customer has replied or the deal status has changed.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: {
            type: 'string',
            description: 'The deal ID to stop the sequence for',
          },
          reason: {
            type: 'string',
            description: 'Reason for stopping the sequence',
          },
        },
        required: ['deal_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_activity',
      description: 'Log a call, meeting, or other activity against a CRM record.',
      parameters: {
        type: 'object',
        properties: {
          activity_type: {
            type: 'string',
            enum: ['Call', 'Meeting', 'Email', 'Note'],
            description: 'Type of activity',
          },
          subject: {
            type: 'string',
            description: 'Activity subject',
          },
          description: {
            type: 'string',
            description: 'Activity details/notes',
          },
          related_to_id: {
            type: 'string',
            description: 'ID of the related record',
          },
          related_to_module: {
            type: 'string',
            enum: ['Leads', 'Contacts', 'Deals'],
            description: 'Module of the related record',
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes (for calls/meetings)',
          },
        },
        required: ['activity_type', 'subject'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_record_details',
      description: 'Get full details of a specific lead, contact, or deal by ID.',
      parameters: {
        type: 'object',
        properties: {
          record_id: {
            type: 'string',
            description: 'The record ID',
          },
          module: {
            type: 'string',
            enum: ['Leads', 'Contacts', 'Deals'],
            description: 'The CRM module',
          },
        },
        required: ['record_id', 'module'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_tags',
      description: 'Add tags to a CRM record for categorization.',
      parameters: {
        type: 'object',
        properties: {
          record_id: {
            type: 'string',
            description: 'The record ID',
          },
          module: {
            type: 'string',
            enum: ['Leads', 'Contacts', 'Deals'],
            description: 'The CRM module',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to add',
          },
        },
        required: ['record_id', 'module', 'tags'],
      },
    },
  },
];

/**
 * Execute a tool function by name
 * @param {string} name - Tool/function name
 * @param {object} args - Function arguments
 * @param {object} context - User context
 * @returns {Promise<object>} Tool execution result
 */
async function executeTool(name, args, context = {}) {
  logger.info('Executing CRM tool', { tool: name, args });

  try {
    switch (name) {
      case 'search_crm':
        return await searchCrm(args);
      case 'create_lead':
        return await createLead(args);
      case 'update_lead':
        return await updateLead(args);
      case 'create_deal':
        return await createDeal(args);
      case 'update_deal':
        return await updateDeal(args);
      case 'get_pipeline_summary':
        return await getPipelineSummary();
      case 'get_stale_deals':
        return await getStaleDeals(args);
      case 'get_revenue_forecast':
        return await getRevenueForecast();
      case 'get_sales_metrics':
        return await getSalesMetrics();
      case 'create_task':
        return await createTask(args);
      case 'send_email':
        return await sendEmail(args, context);
      case 'start_quote_sequence':
        return await startQuoteSequence(args);
      case 'stop_quote_sequence':
        return await stopQuoteSequence(args);
      case 'log_activity':
        return await logActivity(args);
      case 'get_record_details':
        return await getRecordDetails(args);
      case 'add_tags':
        return await addTags(args);
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    logger.error('Tool execution failed', { tool: name, error: error.message });
    return { success: false, error: error.message };
  }
}

// Tool implementations

async function searchCrm({ query, module = 'all' }) {
  if (module === 'all') {
    const results = await advancedCrmService.globalSearch(query);
    const totalResults = results.leads.length + results.contacts.length + results.deals.length;

    if (totalResults === 0) {
      return { success: true, found: false, message: `No results found for "${query}"` };
    }

    return {
      success: true,
      found: true,
      total: totalResults,
      leads: results.leads,
      contacts: results.contacts,
      deals: results.deals,
    };
  }

  const results = await zohoService.searchRecords(query, module, 10);
  if (results.length === 0) {
    return { success: true, found: false, message: `No ${module} found for "${query}"` };
  }

  return {
    success: true,
    found: true,
    module,
    count: results.length,
    records: results.map(r => ({
      id: r.id,
      name: r.Company || r.Deal_Name || `${r.First_Name} ${r.Last_Name}`,
      status: r.Lead_Status || r.Stage,
      email: r.Email,
      phone: r.Phone,
      value: r.Amount,
    })),
  };
}

async function createLead({ company, first_name, last_name, email, phone, lead_source, notes }) {
  // Check for existing
  const existing = await zohoService.searchRecords(company, 'Leads', 1);
  if (existing.length > 0) {
    return {
      success: false,
      error: 'duplicate',
      message: `A lead already exists for "${company}"`,
      existing: {
        id: existing[0].id,
        name: existing[0].Company,
        status: existing[0].Lead_Status,
      },
    };
  }

  const leadData = {
    Company: company,
    First_Name: first_name || '',
    Last_Name: last_name || company,
    Email: email,
    Phone: phone,
    Lead_Source: lead_source || 'Chat',
    Lead_Status: 'New Lead',
    Description: notes,
  };

  const created = await zohoService.createLead(leadData);
  await zohoService.addTags(created.id, 'Leads', ['Added via Agent']);

  return {
    success: true,
    message: `Created new lead for ${company}`,
    lead: {
      id: created.id,
      company,
      status: 'New Lead',
    },
  };
}

async function updateLead({ lead_id, status, email, phone, notes }) {
  const updateData = {};
  if (status) updateData.Lead_Status = status;
  if (email) updateData.Email = email;
  if (phone) updateData.Phone = phone;
  if (notes) updateData.Description = notes;

  await zohoService.updateRecord(lead_id, 'Leads', updateData);

  return {
    success: true,
    message: 'Lead updated successfully',
    updated_fields: Object.keys(updateData),
  };
}

async function createDeal({ deal_name, amount, stage, contact_id, closing_date, description }) {
  const dealData = {
    Deal_Name: deal_name,
    Amount: amount || 0,
    Stage: stage || 'Qualification',
    Closing_Date: closing_date || getDefaultClosingDate(),
    Description: description,
  };

  if (contact_id) {
    dealData.Contact_Name = { id: contact_id };
  }

  const created = await zohoService.createDeal(dealData);

  return {
    success: true,
    message: `Created deal "${deal_name}"`,
    deal: {
      id: created.id,
      name: deal_name,
      amount,
      stage: dealData.Stage,
    },
  };
}

async function updateDeal({ deal_id, stage, amount, closing_date, notes }) {
  const updateData = {};
  if (stage) updateData.Stage = stage;
  if (amount !== undefined) updateData.Amount = amount;
  if (closing_date) updateData.Closing_Date = closing_date;
  if (notes) updateData.Description = notes;

  await zohoService.updateRecord(deal_id, 'Deals', updateData);

  // If moved to Closed Won/Lost, update any quote sequences
  if (stage === 'Closed Won' || stage === 'Closed Lost') {
    await db.query(
      `UPDATE quote_sequences SET sequence_cancelled = true, cancelled_reason = $1, cancelled_at = CURRENT_TIMESTAMP WHERE deal_id = $2`,
      [`Deal ${stage}`, deal_id]
    );
  }

  return {
    success: true,
    message: `Deal updated to ${stage || 'new values'}`,
    updated_fields: Object.keys(updateData),
  };
}

async function getPipelineSummary() {
  const analysis = await advancedCrmService.getPipelineAnalysis();

  return {
    success: true,
    total_deals: analysis.totalDeals,
    total_value: analysis.totalValue,
    average_deal: analysis.averageDealValue,
    conversion_rate: analysis.conversionRate,
    by_stage: analysis.byStage,
    health: {
      healthy: analysis.metrics.healthyDeals,
      attention_needed: analysis.metrics.attentionNeeded,
      urgent: analysis.metrics.urgent,
      critical: analysis.metrics.critical,
    },
    closing_this_month: analysis.closingThisMonth,
  };
}

async function getStaleDeals({ days_threshold = 14 }) {
  const analysis = await advancedCrmService.getPipelineAnalysis();
  const staleDeals = analysis.staleDeals.filter(d => d.daysSinceActivity >= days_threshold);

  return {
    success: true,
    count: staleDeals.length,
    deals: staleDeals.map(d => ({
      name: d.name,
      stage: d.stage,
      value: d.value,
      days_inactive: d.daysSinceActivity,
      owner: d.owner,
    })),
  };
}

async function getRevenueForecast() {
  const forecast = await advancedCrmService.getForecast();

  return {
    success: true,
    this_month: forecast.thisMonth,
    next_month: forecast.nextMonth,
    this_quarter: forecast.thisQuarter,
    this_year: forecast.thisYear,
    by_stage: forecast.byStage,
  };
}

async function getSalesMetrics() {
  const metrics = await advancedCrmService.getSalesMetrics();

  return {
    success: true,
    total_leads: metrics.totalLeads,
    total_deals: metrics.totalDeals,
    pipeline_value: metrics.totalPipelineValue,
    average_deal_size: metrics.averageDealSize,
    win_rate: metrics.winRate,
    loss_rate: metrics.lossRate,
    top_deals: metrics.topDeals,
    lead_sources: metrics.topLeadSources,
  };
}

async function createTask({ subject, due_date, priority, related_to_id, related_to_module, description }) {
  const taskData = {
    Subject: subject,
    Due_Date: parseDueDate(due_date),
    Priority: priority || 'Normal',
    Status: 'Not Started',
    Description: description,
  };

  if (related_to_id && related_to_module) {
    taskData.What_Id = { id: related_to_id, module: related_to_module };
  }

  const created = await zohoService.createTask(taskData);

  return {
    success: true,
    message: `Task created: "${subject}"`,
    task: {
      id: created.id,
      subject,
      due_date: taskData.Due_Date,
      priority: taskData.Priority,
    },
  };
}

async function sendEmail({ to_email, to_name, subject, body, template_id, deal_id, deal_value }, context = {}) {
  let emailSubject = subject;
  let emailBody = body;

  // Use template if specified
  if (template_id) {
    const template = emailService.getTemplate(template_id);
    if (template) {
      const variables = {
        first_name: to_name?.split(' ')[0] || 'there',
        company: to_name || '',
        sender_name: 'Nelson',
        sender_phone: '01392 931035',
      };
      emailSubject = emailService.replaceVariables(template.subject, variables);
      emailBody = emailService.replaceVariables(template.body, variables);
    }
  }

  // Check if approval required
  const needsApproval = emailService.requiresApproval(deal_value, to_name, template_id);

  if (needsApproval) {
    const approval = await emailService.queueForApproval({
      to_email,
      to_name,
      subject: emailSubject,
      body: emailBody,
      deal_id,
      deal_value,
      template_id,
    }, context.userId || 'system');

    return {
      success: true,
      needs_approval: true,
      message: `Email queued for approval (deal value: £${deal_value || 0})`,
      approval_id: approval.id,
    };
  }

  // Send directly
  await emailService.sendEmail({
    to_email,
    to_name,
    subject: emailSubject,
    body: emailBody,
    record_id: deal_id,
  });

  return {
    success: true,
    needs_approval: false,
    message: `Email sent to ${to_name || to_email}`,
  };
}

async function startQuoteSequence({ deal_id, deal_name, contact_email, contact_name, deal_value }) {
  // Check if sequence already exists
  const existing = await db.query('SELECT * FROM quote_sequences WHERE deal_id = $1', [deal_id]);
  if (existing.rows.length > 0 && !existing.rows[0].sequence_cancelled) {
    return {
      success: false,
      message: 'Quote sequence already active for this deal',
    };
  }

  await db.query(
    `INSERT INTO quote_sequences (deal_id, deal_name, contact_email, contact_name, deal_value, quote_sent_date)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (deal_id) DO UPDATE SET
       sequence_cancelled = false,
       cancelled_reason = NULL,
       cancelled_at = NULL,
       quote_sent_date = CURRENT_TIMESTAMP,
       followup_1_sent = false,
       followup_2_sent = false,
       followup_3_sent = false,
       updated_at = CURRENT_TIMESTAMP`,
    [deal_id, deal_name, contact_email, contact_name, deal_value]
  );

  return {
    success: true,
    message: `Quote follow-up sequence started for ${deal_name}`,
    schedule: {
      day_3: 'Soft check-in email',
      day_7: 'Add value email',
      day_14: 'Last chance email',
      day_21: 'Auto-close as lost',
    },
  };
}

async function stopQuoteSequence({ deal_id, reason }) {
  await db.query(
    `UPDATE quote_sequences SET sequence_cancelled = true, cancelled_reason = $1, cancelled_at = CURRENT_TIMESTAMP WHERE deal_id = $2`,
    [reason || 'Manually stopped', deal_id]
  );

  return {
    success: true,
    message: 'Quote sequence stopped',
  };
}

async function logActivity({ activity_type, subject, description, related_to_id, related_to_module, duration }) {
  const activityData = {
    Activity_Type: activity_type,
    Subject: subject,
    Description: description,
    Duration_in_Minutes: duration,
  };

  if (related_to_id && related_to_module) {
    activityData.What_Id = { id: related_to_id };
  }

  await zohoService.logActivity(activityData);

  return {
    success: true,
    message: `${activity_type} logged: "${subject}"`,
  };
}

async function getRecordDetails({ record_id, module }) {
  const record = await zohoService.getRecord(record_id, module);

  if (!record) {
    return { success: false, message: 'Record not found' };
  }

  return {
    success: true,
    module,
    record: {
      id: record.id,
      name: record.Company || record.Deal_Name || `${record.First_Name} ${record.Last_Name}`,
      ...record,
    },
  };
}

async function addTags({ record_id, module, tags }) {
  await zohoService.addTags(record_id, module, tags);

  return {
    success: true,
    message: `Added tags: ${tags.join(', ')}`,
  };
}

// Helper functions

function getDefaultClosingDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
}

function parseDueDate(dateStr) {
  if (!dateStr) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  const lower = dateStr.toLowerCase();
  const today = new Date();

  if (lower === 'today') {
    return today.toISOString().split('T')[0];
  }
  if (lower === 'tomorrow') {
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  }
  if (lower.includes('next')) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i])) {
        const currentDay = today.getDay();
        let daysUntil = i - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        today.setDate(today.getDate() + daysUntil);
        return today.toISOString().split('T')[0];
      }
    }
  }

  // Try to parse as date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed)) {
    return parsed.toISOString().split('T')[0];
  }

  // Default to tomorrow
  today.setDate(today.getDate() + 1);
  return today.toISOString().split('T')[0];
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool,
};
