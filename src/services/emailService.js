/**
 * Email Service
 * Handles email sending via Zoho CRM
 */

const axios = require('axios');
const logger = require('../utils/logger');
const db = require('../db/connection');

// Email templates
const EMAIL_TEMPLATES = {
  quote_followup_1: {
    subject: 'Quick follow-up on your cleaning quote',
    body: `Hi {first_name},

Just wanted to make sure you received the quote we sent over for {company}.

If you have any questions or would like to discuss anything, I'm happy to help.

Best regards,
{sender_name}
Signature Cleans
{sender_phone}`,
    autoApproval: true,
  },
  quote_followup_2: {
    subject: 'Any questions on the cleaning quote?',
    body: `Hi {first_name},

Following up on the quote for {company}. I know choosing a cleaning provider is an important decision.

A few things that might help:
• We're SSIP accredited for full health & safety compliance
• All staff are DBS-checked and fully trained
• We offer a 30-day pilot period so you can try us risk-free

Happy to arrange a quick call if it would help. What works for you?

Best regards,
{sender_name}
Signature Cleans
{sender_phone}`,
    autoApproval: true,
  },
  quote_followup_3: {
    subject: 'Should I close your file?',
    body: `Hi {first_name},

I've tried to reach you a couple of times about the cleaning quote for {company}.

I don't want to keep bothering you, so I'll assume the timing isn't right for now. I'll close your file, but please do reach out whenever you're ready - we'd love to help.

All the best,
{sender_name}
Signature Cleans
{sender_phone}`,
    autoApproval: true,
  },
  new_lead_welcome: {
    subject: 'Thanks for your enquiry - Signature Cleans',
    body: `Hi {first_name},

Thanks for getting in touch with Signature Cleans. We appreciate your interest in our services.

We'll review your requirements and get back to you shortly with a tailored quote.

In the meantime, if you have any questions, feel free to reach out.

Best regards,
{sender_name}
Signature Cleans
{sender_phone}`,
    autoApproval: true,
  },
  meeting_confirm: {
    subject: 'Meeting confirmed - {company}',
    body: `Hi {first_name},

Great! I've confirmed our meeting for:

📅 {meeting_date}
🕐 {meeting_time}
📍 {site_address}

Looking forward to discussing how we can help with your cleaning needs.

If you need to reschedule, just let me know.

Best regards,
{sender_name}
Signature Cleans
{sender_phone}`,
    autoApproval: true,
  },
  meeting_reminder: {
    subject: 'Reminder: Meeting tomorrow - {company}',
    body: `Hi {first_name},

Just a quick reminder about our meeting tomorrow:

📅 {meeting_date}
🕐 {meeting_time}
📍 {site_address}

Looking forward to it!

Best regards,
{sender_name}
Signature Cleans
{sender_phone}`,
    autoApproval: true,
  },
};

class EmailService {
  /**
   * Get email template
   * @param {string} templateId - Template ID
   * @returns {object} Template object
   */
  getTemplate(templateId) {
    return EMAIL_TEMPLATES[templateId] || null;
  }

  /**
   * Replace variables in email body
   * @param {string} text - Email text with variables
   * @param {object} variables - Variables to replace
   * @returns {string} Text with variables replaced
   */
  replaceVariables(text, variables) {
    let result = text;
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, variables[key] || '');
    });
    return result;
  }

  /**
   * Check if email requires approval
   * @param {number} dealValue - Deal value in GBP
   * @param {string} companyName - Company name
   * @param {string} templateId - Template ID
   * @returns {boolean} Whether approval is required
   */
  requiresApproval(dealValue, companyName, templateId) {
    const template = this.getTemplate(templateId);
    if (template && !template.autoApproval) {
      return true;
    }

    const approvalThreshold = parseInt(process.env.APPROVAL_REQUIRED_DEAL_VALUE || 5000);
    if (dealValue && dealValue > approvalThreshold) {
      return true;
    }

    const protectedAccounts = (process.env.PROTECTED_ACCOUNTS || '').split(',').map((a) => a.trim());
    if (protectedAccounts.includes(companyName)) {
      return true;
    }

    return false;
  }

  /**
   * Send email via Zoho CRM
   * @param {object} emailData - Email data
   * @returns {Promise<boolean>} Success status
   */
  async sendEmail(emailData) {
    try {
      logger.info('Sending email', {
        to: emailData.to_email,
        subject: emailData.subject,
      });

      // Log email as activity in Zoho CRM
      const zohoService = require('./zohoService');

      const activityData = {
        Activity_Type: 'Email',
        Subject: emailData.subject,
        Description: emailData.body,
        'What_Id.id': emailData.record_id,
        'Who_Id.id': emailData.contact_id,
        Sent: true,
      };

      await zohoService.logActivity(activityData);

      // In production, would send via SMTP or Zoho Mail API
      // For now, just log it
      logger.info('Email sent successfully', {
        to: emailData.to_email,
        subject: emailData.subject,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', { error: error.message });
      throw error;
    }
  }

  /**
   * Queue email for approval
   * @param {object} emailData - Email data
   * @param {string} userId - User ID requesting approval
   * @returns {Promise<object>} Approval record
   */
  async queueForApproval(emailData, userId) {
    try {
      logger.info('Queueing email for approval', {
        to: emailData.to_email,
        subject: emailData.subject,
      });

      const result = await db.query(
        `INSERT INTO email_approvals 
        (user_id, to_email, to_name, subject, body, deal_id, deal_value, template_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          userId,
          emailData.to_email,
          emailData.to_name,
          emailData.subject,
          emailData.body,
          emailData.deal_id,
          emailData.deal_value,
          emailData.template_id,
          'pending',
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to queue email for approval', { error: error.message });
      throw error;
    }
  }

  /**
   * Get pending approvals for a user
   * @param {string} userId - User ID
   * @returns {Promise<array>} Pending approvals
   */
  async getPendingApprovals(userId) {
    try {
      const result = await db.query(
        `SELECT * FROM email_approvals 
        WHERE user_id = $1 AND status = 'pending'
        ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get pending approvals', { error: error.message });
      return [];
    }
  }

  /**
   * Approve and send email
   * @param {number} approvalId - Approval record ID
   * @returns {Promise<boolean>} Success status
   */
  async approveAndSend(approvalId) {
    try {
      logger.info('Approving and sending email', { approvalId });

      // Get approval record
      const result = await db.query(
        `SELECT * FROM email_approvals WHERE id = $1`,
        [approvalId]
      );

      if (result.rows.length === 0) {
        throw new Error('Approval record not found');
      }

      const approval = result.rows[0];

      // Send email
      await this.sendEmail({
        to_email: approval.to_email,
        to_name: approval.to_name,
        subject: approval.subject,
        body: approval.body,
        record_id: approval.deal_id,
      });

      // Update approval status
      await db.query(
        `UPDATE email_approvals 
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [approvalId]
      );

      logger.info('Email approved and sent', { approvalId });
      return true;
    } catch (error) {
      logger.error('Failed to approve and send email', { error: error.message });
      throw error;
    }
  }

  /**
   * Reject email approval
   * @param {number} approvalId - Approval record ID
   * @returns {Promise<boolean>} Success status
   */
  async rejectApproval(approvalId) {
    try {
      logger.info('Rejecting email approval', { approvalId });

      await db.query(
        `UPDATE email_approvals 
        SET status = 'rejected'
        WHERE id = $1`,
        [approvalId]
      );

      return true;
    } catch (error) {
      logger.error('Failed to reject approval', { error: error.message });
      throw error;
    }
  }
}

module.exports = new EmailService();
