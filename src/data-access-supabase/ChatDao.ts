import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
interface ChatUser {
  id: string;
  role: 'USER' | 'ASTROLOGER';
  lastRead: number;
  lastReceived: number;
}

interface PrivateChatKey {
  id: string;
  status: string;
  userList: string;
  users: ChatUser[];
}

interface PrivateChat {
  id: string;
  userTs: string;
  sentTs: number;
  type: string;
  message: string;
  tags?: string;
  hidden?: boolean;
}

export class ChatDao {
  // ============================================================
  // CHAT SESSION (KEY) OPERATIONS
  // ============================================================

  /**
   * Initialize a new chat session
   */
  static async initializeChat(privateChatKey: PrivateChatKey): Promise<PrivateChatKey> {
    const currentTime = Date.now();
    const sortedUsers = [...privateChatKey.users].sort((a, b) => a.id.localeCompare(b.id));
    const userListString = sortedUsers.map(u => u.id).join('#');

    // Check if chat already exists
    const existingChat = await this.getChatKeyByUserIds({ userIdListStr: userListString });
    if (existingChat && existingChat.length > 0) {
      return existingChat[0];
    }

    // Create chat session
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        user_id: sortedUsers.find(u => u.role === 'USER')?.id,
        astrologer_id: sortedUsers.find(u => u.role === 'ASTROLOGER')?.id,
        status: 'ACTIVE',
        user_list: userListString,
        users: sortedUsers.map(user => ({
          id: user.id,
          role: user.role,
          lastRead: currentTime,
          lastReceived: currentTime,
        })),
      })
      .select()
      .single();

    if (error) throw error;

    // Create chat_user_keys entries for each user
    for (const user of sortedUsers) {
      await supabaseAdmin
        .from('chat_user_keys')
        .insert({
          user_id: user.id,
          chat_session_id: data.id,
        })
        .single();
    }

    return this.mapToPrivateChatKey(data);
  }

  /**
   * Get chat key data by ID
   */
  static async getKeyDataById({ id }: { id: string }): Promise<PrivateChatKey | null> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToPrivateChatKey(data);
  }

  /**
   * Get chat key by user IDs string
   */
  static async getChatKeyByUserIds({ userIdListStr }: { userIdListStr: string }): Promise<PrivateChatKey[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('user_list', userIdListStr);

    if (error) throw error;
    return (data || []).map(this.mapToPrivateChatKey);
  }

  /**
   * Get chat keys by user ID (all active chats for a user)
   */
  static async getChatKeysByUserId({ userId }: { userId: string }): Promise<PrivateChatKey[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .or(`user_id.eq.${userId},astrologer_id.eq.${userId}`)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    return (data || []).map(this.mapToPrivateChatKey);
  }

  /**
   * Update chat session status
   */
  static async updateChatSessionStatus({ id, status }: { id: string; status: string }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update chat key users list
   */
  static async updateChatKeyUsersList({
    id,
    userId,
    keyData,
    updatedUser,
  }: {
    id: string;
    userId: string;
    keyData: PrivateChatKey;
    updatedUser: ChatUser;
  }): Promise<PrivateChatKey> {
    const updatedUsers = [
      ...keyData.users.filter(user => user.id !== userId),
      updatedUser,
    ];

    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ users: updatedUsers })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToPrivateChatKey(data);
  }

  /**
   * Update user chat session status
   */
  static async updateUserChatSession({ id, status }: { id: string; status: string }): Promise<PrivateChatKey> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToPrivateChatKey(data);
  }

  // ============================================================
  // MESSAGE OPERATIONS
  // ============================================================

  /**
   * Send a message
   */
  static async sendMessage(messageData: {
    id: string;
    userTs: string;
    sentTs: number;
    tags?: string;
    type: string;
    message: string;
  }): Promise<PrivateChat> {
    const [ts, senderId] = messageData.userTs.split('#');

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        session_id: messageData.id,
        sender_id: senderId,
        content: messageData.message,
        type: messageData.type?.toUpperCase() || 'TEXT',
        tags: messageData.tags,
        sent_ts: messageData.sentTs,
        is_delivered: true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: messageData.id,
      userTs: messageData.userTs,
      sentTs: messageData.sentTs,
      type: messageData.type,
      message: messageData.message,
      tags: messageData.tags,
    };
  }

  /**
   * Get chat by ID and timestamp (for specific message)
   */
  static async getChatById({ id, userId, ts }: { id: string; userId: string; ts: number }): Promise<PrivateChat[]> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', id)
      .eq('sender_id', userId)
      .eq('sent_ts', ts);

    if (error) throw error;
    return (data || []).map(this.mapToPrivateChat);
  }

  /**
   * Get chat messages list by ID starting from timestamp
   */
  static async getChatDataListByIdTs({ id, ts }: { id: string; ts: number }): Promise<PrivateChat[]> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', id)
      .gt('sent_ts', ts)
      .order('sent_ts', { ascending: true });

    if (error) throw error;
    return (data || []).map(this.mapToPrivateChat);
  }

  /**
   * Get chat messages list by ID (paginated)
   */
  static async getChatDataListById({ id, key }: { id: string; key?: string }): Promise<PrivateChat[]> {
    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: false });

    if (key) {
      const [ts, userId] = key.split('#');
      query = query.lt('sent_ts', Number(ts));
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;
    return (data || []).map(this.mapToPrivateChat);
  }

  /**
   * Get messages for a session (with user details)
   */
  static async getMessages(sessionId: string, limit = 50, offset = 0): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users(id, username, profile_image),
        reply_message:messages!reply_to(id, content, type)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data ? data.reverse() : [];
  }

  /**
   * Edit message
   */
  static async editMessage({ id, userId, oldTs, value }: { id: string; userId: string; oldTs: number; value: string }): Promise<PrivateChat> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .update({ content: value })
      .eq('session_id', id)
      .eq('sender_id', userId)
      .eq('sent_ts', oldTs)
      .select()
      .single();

    if (error) throw error;
    return this.mapToPrivateChat(data);
  }

  /**
   * Hide message (soft delete)
   */
  static async hideMessage({ id, userId, oldTs, value }: { id: string; userId: string; oldTs: number; value: boolean }): Promise<PrivateChat> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .update({ hidden: value })
      .eq('session_id', id)
      .eq('sender_id', userId)
      .eq('sent_ts', oldTs)
      .select()
      .single();

    if (error) throw error;
    return this.mapToPrivateChat(data);
  }

  /**
   * Mark messages as read
   */
  static async markMessagesAsRead(sessionId: string, userId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('session_id', sessionId)
      .neq('sender_id', userId)
      .eq('is_read', false)
      .select();

    if (error) throw error;
    return data || [];
  }

  /**
   * Get unread message count
   */
  static async getUnreadMessageCount(userId: string): Promise<number> {
    const { data: sessions, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .or(`user_id.eq.${userId},astrologer_id.eq.${userId}`)
      .eq('status', 'ACTIVE');

    if (sessionError) throw sessionError;

    if (!sessions || sessions.length === 0) return 0;

    const sessionIds = sessions.map(s => s.id);

    const { count, error } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Delete message (soft delete by updating content)
   */
  static async deleteMessage(messageId: string, userId: string): Promise<any> {
    const { data: message, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    if (message.sender_id !== userId) {
      throw new Error('Unauthorized to delete this message');
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .update({
        content: '[Message deleted]',
        metadata: { deleted: true, deleted_at: new Date().toISOString() },
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Search messages
   */
  static async searchMessages(sessionId: string, searchTerm: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users(id, username, profile_image)
      `)
      .eq('session_id', sessionId)
      .ilike('content', `%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // CHAT SESSION QUERIES
  // ============================================================

  /**
   * Create chat session (simplified)
   */
  static async createChatSession(sessionData: {
    user_id: string;
    astrologer_id: string;
    order_id?: string;
    session_type?: 'CHAT' | 'ASSISTANT' | 'SUPPORT';
  }): Promise<any> {
    const userListString = [sessionData.user_id, sessionData.astrologer_id].sort().join('#');
    const currentTime = Date.now();

    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        ...sessionData,
        session_type: sessionData.session_type || 'CHAT',
        status: 'ACTIVE',
        user_list: userListString,
        users: [
          { id: sessionData.user_id, role: 'USER', lastRead: currentTime, lastReceived: currentTime },
          { id: sessionData.astrologer_id, role: 'ASTROLOGER', lastRead: currentTime, lastReceived: currentTime },
        ],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get chat session by ID (with full details)
   */
  static async getChatSessionById(sessionId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        *,
        user:users!chat_sessions_user_id_fkey(id, username, profile_image),
        astrologer:astrologers(id, display_name, user:users(profile_image))
      `)
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get user's chat sessions
   */
  static async getUserChatSessions(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        *,
        astrologer:astrologers(id, display_name, user:users(profile_image))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get astrologer's chat sessions
   */
  static async getAstrologerChatSessions(astrologerId: string, limit = 50, offset = 0): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        *,
        user:users!chat_sessions_user_id_fkey(id, username, profile_image)
      `)
      .eq('astrologer_id', astrologerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * End chat session
   */
  static async endChatSession(sessionId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        status: 'ENDED',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get active chat count for astrologer
   */
  static async getActiveChatCount(astrologerId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('astrologer_id', astrologerId)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    return count || 0;
  }

  /**
   * Create support chat session
   */
  static async createSupportChatSession(userId: string, subject: string): Promise<any> {
    const { data: supportCase, error: caseError } = await supabaseAdmin
      .from('support_cases')
      .insert({
        user_id: userId,
        subject,
        description: 'Chat support requested',
        status: 'OPEN',
      })
      .select()
      .single();

    if (caseError) throw caseError;

    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        user_id: userId,
        astrologer_id: userId,
        session_type: 'SUPPORT',
        status: 'ACTIVE',
        metadata: { support_case_id: supportCase.id },
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map to PrivateChatKey format
   */
  private static mapToPrivateChatKey(data: any): PrivateChatKey {
    if (!data) return {} as PrivateChatKey;

    return {
      id: data.id,
      status: data.status,
      userList: data.user_list || '',
      users: data.users || [],
    };
  }

  /**
   * Map to PrivateChat format
   */
  private static mapToPrivateChat(data: any): PrivateChat {
    if (!data) return {} as PrivateChat;

    return {
      id: data.session_id,
      userTs: `${data.sent_ts}#${data.sender_id}`,
      sentTs: data.sent_ts || new Date(data.created_at).getTime(),
      type: data.type?.toLowerCase() || 'text',
      message: data.content,
      tags: data.tags,
      hidden: data.hidden,
    };
  }
}

// Export individual functions for backwards compatibility
export const initializeChat = ChatDao.initializeChat.bind(ChatDao);
export const sendMessage = ChatDao.sendMessage.bind(ChatDao);
export const getKeyDataById = ChatDao.getKeyDataById.bind(ChatDao);
export const getChatKeyByUserIds = ChatDao.getChatKeyByUserIds.bind(ChatDao);
export const getChatById = ChatDao.getChatById.bind(ChatDao);
export const updateChatSessionStatus = ChatDao.updateChatSessionStatus.bind(ChatDao);
export const getChatDataListByIdTs = ChatDao.getChatDataListByIdTs.bind(ChatDao);
export const getChatDataListById = ChatDao.getChatDataListById.bind(ChatDao);
export const updateChatKeyUsersList = ChatDao.updateChatKeyUsersList.bind(ChatDao);
export const editMessage = ChatDao.editMessage.bind(ChatDao);
export const hideMessage = ChatDao.hideMessage.bind(ChatDao);
