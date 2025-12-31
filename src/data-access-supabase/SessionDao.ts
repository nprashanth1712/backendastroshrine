import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  channelId?: string;
  uid: number;
  sessionType: 'RECORDING' | 'USER' | 'HOST';
  status: 'ACTIVE' | 'ENDED' | 'ERROR';
  startedAt: string;
  endedAt?: string;
  metadata?: any;
}

export class SessionDao {
  // ============================================================
  // SESSION CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new session
   */
  static async createSession(sessionData: {
    userId?: string;
    deviceId: string;
    channelId?: string;
    sessionType: UserSession['sessionType'];
    metadata?: any;
  }): Promise<UserSession> {
    // Generate a unique UID for the session
    const uid = Math.floor(Math.random() * 1000000);

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: sessionData.userId,
        device_id: sessionData.deviceId,
        channel_id: sessionData.channelId,
        uid,
        session_type: sessionData.sessionType,
        status: 'ACTIVE',
        metadata: sessionData.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToUserSession(data);
  }

  /**
   * Create host recording session
   */
  static async createHostRecordingSession({
    channelId,
    deviceId,
  }: {
    channelId: string;
    deviceId: string;
  }): Promise<UserSession> {
    const uid = Math.floor(Math.random() * 1000000);

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: null,
        device_id: deviceId,
        uid,
        session_type: 'RECORDING',
        status: 'ACTIVE',
        metadata: { channelId },
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToUserSession(data);
  }

  /**
   * Get session by user ID and device ID
   */
  static async getSessionByUserIdDeviceId({
    userId,
    deviceId,
  }: {
    userId: string;
    deviceId: string;
  }): Promise<UserSession | null> {
    // For recording sessions, the userId might be stored in metadata
    let { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('device_id', deviceId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    // Check if any session matches the userId (either directly or in metadata)
    const matchingSession = (data || []).find(session => 
      session.user_id === userId || 
      session.metadata?.channelId === userId.replace('RECORDING_', '')
    );

    return matchingSession ? this.mapToUserSession(matchingSession) : null;
  }

  /**
   * Get session by ID
   */
  static async getSessionById(sessionId: string): Promise<UserSession | null> {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToUserSession(data);
  }

  /**
   * Get active sessions for a user
   */
  static async getActiveSessionsByUserId(userId: string): Promise<UserSession[]> {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    return (data || []).map(this.mapToUserSession);
  }

  /**
   * Get active sessions for a channel
   */
  static async getActiveSessionsByChannelId(channelId: string): Promise<UserSession[]> {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('channel_id', channelId)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    return (data || []).map(this.mapToUserSession);
  }

  /**
   * Update session status
   */
  static async updateSessionStatus(
    sessionId: string,
    status: UserSession['status']
  ): Promise<UserSession> {
    const updates: any = { status };

    if (status === 'ENDED' || status === 'ERROR') {
      updates.ended_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToUserSession(data);
  }

  /**
   * End session
   */
  static async endSession(sessionId: string): Promise<UserSession> {
    return this.updateSessionStatus(sessionId, 'ENDED');
  }

  /**
   * End all sessions for a user
   */
  static async endAllUserSessions(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('sessions')
      .update({
        status: 'ENDED',
        ended_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'ACTIVE');

    if (error) throw error;
  }

  /**
   * End all sessions for a channel
   */
  static async endAllChannelSessions(channelId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('sessions')
      .update({
        status: 'ENDED',
        ended_at: new Date().toISOString(),
      })
      .eq('channel_id', channelId)
      .eq('status', 'ACTIVE');

    if (error) throw error;
  }

  /**
   * Update session metadata
   */
  static async updateSessionMetadata(sessionId: string, metadata: any): Promise<UserSession> {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update({ metadata })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToUserSession(data);
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  }

  /**
   * Clean up old sessions (for maintenance)
   */
  static async cleanupOldSessions(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .eq('status', 'ENDED')
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map Supabase data to UserSession format
   */
  private static mapToUserSession(data: any): UserSession {
    if (!data) return {} as UserSession;

    return {
      id: data.id,
      userId: data.user_id,
      deviceId: data.device_id,
      channelId: data.channel_id,
      uid: data.uid,
      sessionType: data.session_type,
      status: data.status,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      metadata: data.metadata,
    };
  }
}

// Export individual functions for backwards compatibility
export const createHostRecordingSession = SessionDao.createHostRecordingSession.bind(SessionDao);
export const getSessionByUserIdDeviceId = SessionDao.getSessionByUserIdDeviceId.bind(SessionDao);
