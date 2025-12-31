import { supabaseAdmin } from '../services/supabaseClient';
import { ChatDao } from './ChatDao';

// Types to match DynamoDB structure
interface SupportCase {
  id: string;
  userId: string;
  caseType: string;
  createTs: number;
  supportUserId?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  hidden: boolean;
  details?: string;
  commentResolution?: string;
}

export class SupportCaseDao {
  // ============================================================
  // SUPPORT CASE CRUD OPERATIONS
  // ============================================================

  /**
   * Get all active cases
   */
  static async getAllActiveCases(): Promise<SupportCase[]> {
    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .select(`
        *,
        user:users(username, email, profile_image)
      `)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToSupportCase);
  }

  /**
   * Get all active cases for a support user
   */
  static async getAllActiveSupportUserCases({ supportUserId }: { supportUserId: string }): Promise<SupportCase[]> {
    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .select(`
        *,
        user:users(username, email, profile_image)
      `)
      .eq('support_user_id', supportUserId)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToSupportCase);
  }

  /**
   * Initialize a new support case
   */
  static async initializeCase({
    userId,
    supportUserId,
    supportUserName,
    caseType,
    details,
    createTs,
  }: {
    userId: string;
    supportUserId: string;
    supportUserName: string;
    caseType: string;
    details: string;
    createTs: number;
  }): Promise<SupportCase> {
    // Create support case
    const { data: supportCase, error: caseError } = await supabaseAdmin
      .from('support_cases')
      .insert({
        user_id: userId,
        support_user_id: supportUserId,
        subject: caseType,
        description: details,
        status: 'OPEN',
        case_type: caseType,
        hidden: false,
        create_ts: createTs,
      })
      .select()
      .single();

    if (caseError) throw caseError;

    // Create chat session for support
    const chatUsers = [
      { id: `case_${userId}`, role: 'USER' as const, lastRead: createTs, lastReceived: createTs },
      { id: `case_${supportUserId}`, role: 'ASTROLOGER' as const, lastRead: createTs, lastReceived: createTs },
    ];

    await ChatDao.initializeChat({
      id: supportCase.id,
      status: 'ACTIVE',
      userList: chatUsers.map(u => u.id).sort().join('#'),
      users: chatUsers,
    });

    // Send initial message
    await ChatDao.sendMessage({
      id: supportCase.id,
      userTs: `${createTs}#${userId}`,
      sentTs: createTs,
      type: 'text',
      message: `Thank you for reaching out!\n${supportUserName} will now assist you with your case.\nCase: ${caseType}\nDetails: ${details || ''}`,
    });

    return this.mapToSupportCase(supportCase);
  }

  /**
   * Get case by ID
   */
  static async getCaseById({ id }: { id: string }): Promise<SupportCase | null> {
    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .select(`
        *,
        user:users!support_cases_user_id_fkey(username, email, profile_image),
        support_user:users!support_cases_assigned_to_fkey(username, email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToSupportCase(data);
  }

  /**
   * Update case status by ID
   */
  static async updateCaseStatusById({
    id,
    value,
    resolution,
  }: {
    id: string;
    value: string;
    resolution: string;
  }): Promise<SupportCase | null> {
    if (!value) {
      throw {
        statusCode: 400,
        code: 'InvalidParameter',
        message: 'Invalid parameter value',
      };
    }

    // Update support case
    const { data: supportCase, error: caseError } = await supabaseAdmin
      .from('support_cases')
      .update({
        status: value.toUpperCase(),
        comment_resolution: resolution,
        resolved_at: value.toUpperCase() === 'RESOLVED' || value.toUpperCase() === 'CLOSED' 
          ? new Date().toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (caseError) throw caseError;

    // Update associated chat session status
    const chatStatus = value.toUpperCase() === 'CLOSED' ? 'INACTIVE' : 'ACTIVE';
    await supabaseAdmin
      .from('chat_sessions')
      .update({ status: chatStatus })
      .eq('id', id);

    return this.mapToSupportCase(supportCase);
  }

  /**
   * Update case hidden status
   */
  static async updateCaseHiddenById({ id, value }: { id: string; value: boolean }): Promise<SupportCase | null> {
    if (typeof value !== 'boolean') {
      throw {
        statusCode: 400,
        code: 'InvalidParameter',
        message: 'Invalid parameter value',
      };
    }

    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .update({
        hidden: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToSupportCase(data);
  }

  /**
   * Get all cases by user ID
   */
  static async getAllCasesByUserId({ userId, status = 'OPEN' }: { userId: string; status: string }): Promise<SupportCase[]> {
    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .select(`
        *,
        support_user:users!support_cases_assigned_to_fkey(username, email)
      `)
      .eq('user_id', userId)
      .eq('status', status.toUpperCase())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToSupportCase);
  }

  /**
   * Get cases by status
   */
  static async getCasesByStatus(status: SupportCase['status']): Promise<SupportCase[]> {
    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .select(`
        *,
        user:users!support_cases_user_id_fkey(username, email, profile_image),
        support_user:users!support_cases_assigned_to_fkey(username, email)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToSupportCase);
  }

  /**
   * Assign case to support user
   */
  static async assignCase(caseId: string, supportUserId: string): Promise<SupportCase | null> {
    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .update({
        assigned_to: supportUserId,
        support_user_id: supportUserId,
        status: 'IN_PROGRESS',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToSupportCase(data);
  }

  /**
   * Get case statistics
   */
  static async getCaseStats(): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('support_cases')
      .select('status');

    if (error) throw error;

    return {
      total: data?.length || 0,
      open: data?.filter(c => c.status === 'OPEN').length || 0,
      in_progress: data?.filter(c => c.status === 'IN_PROGRESS').length || 0,
      resolved: data?.filter(c => c.status === 'RESOLVED').length || 0,
      closed: data?.filter(c => c.status === 'CLOSED').length || 0,
    };
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map Supabase data to SupportCase format
   */
  private static mapToSupportCase(data: any): SupportCase {
    if (!data) return {} as SupportCase;

    return {
      id: data.id,
      userId: data.user_id,
      caseType: data.case_type || data.subject,
      createTs: data.create_ts || new Date(data.created_at).getTime(),
      supportUserId: data.support_user_id || data.assigned_to,
      status: data.status,
      hidden: data.hidden || false,
      details: data.description,
      commentResolution: data.comment_resolution,
    };
  }
}

// Export individual functions for backwards compatibility
export const getAllActiveCases = SupportCaseDao.getAllActiveCases.bind(SupportCaseDao);
export const getAllActiveSupportUserCases = SupportCaseDao.getAllActiveSupportUserCases.bind(SupportCaseDao);
export const initializeCase = SupportCaseDao.initializeCase.bind(SupportCaseDao);
export const getCaseById = SupportCaseDao.getCaseById.bind(SupportCaseDao);
export const updateCaseStatusById = SupportCaseDao.updateCaseStatusById.bind(SupportCaseDao);
export const updateCaseHiddenById = SupportCaseDao.updateCaseHiddenById.bind(SupportCaseDao);
export const getAllCasesByUserId = SupportCaseDao.getAllCasesByUserId.bind(SupportCaseDao);
