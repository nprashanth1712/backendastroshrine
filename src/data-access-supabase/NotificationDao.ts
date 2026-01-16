import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
interface NotificationTable {
  id: string;
  inAppNotifications: any[];
  pushNotifications: any[];
  lastUpdated?: number;
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'CALL' | 'CHAT' | 'ORDER' | 'PAYMENT' | 'SYSTEM' | 'PROMOTION';
  data?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export class NotificationDao {
  // ============================================================
  // NOTIFICATION CRUD OPERATIONS
  // ============================================================

  /**
   * Get user notifications by user ID
   */
  static async getUserNotificationsByUserId({ id }: { id: string }): Promise<NotificationTable> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Transform to match DynamoDB format
    const inAppNotifications = (data || []).filter(n => 
      ['SYSTEM', 'ORDER', 'PAYMENT', 'PROMOTION'].includes(n.type)
    );
    const pushNotifications = (data || []).filter(n => 
      ['CALL', 'CHAT'].includes(n.type)
    );

    return {
      id,
      inAppNotifications,
      pushNotifications,
      lastUpdated: data && data.length > 0 ? new Date(data[0].created_at).getTime() : Date.now(),
    };
  }

  /**
   * Initialize user notifications
   */
  static async initializeUserNotifications({ userId }: { userId: string }): Promise<any> {
    // In Supabase, we don't need to initialize - notifications are added as needed
    return { userId, inAppNotifications: [], pushNotifications: [] };
  }

  /**
   * Update user notifications by ID
   */
  static async updateUserNotificationsById({
    id,
    inAppNotifications,
    pushNotifications,
  }: NotificationTable): Promise<any> {
    // In Supabase, we handle notifications individually
    // This method is for backwards compatibility
    const currentTime = Date.now();

    // Clear existing notifications and insert new ones
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', id);

    const allNotifications = [
      ...inAppNotifications.map(n => ({
        user_id: id,
        title: n.title || 'Notification',
        body: n.body || n.message || '',
        type: n.type || 'SYSTEM',
        data: n.data || n,
        is_read: n.is_read || false,
      })),
      ...pushNotifications.map(n => ({
        user_id: id,
        title: n.title || 'Notification',
        body: n.body || n.message || '',
        type: n.type || 'CHAT',
        data: n.data || n,
        is_read: n.is_read || false,
      })),
    ];

    if (allNotifications.length > 0) {
      await supabaseAdmin
        .from('notifications')
        .insert(allNotifications);
    }

    return { id, inAppNotifications, pushNotifications, lastUpdated: currentTime };
  }

  /**
   * Create a new notification
   */
  static async createNotification({
    userId,
    title,
    body,
    type,
    data,
  }: {
    userId: string;
    title: string;
    body: string;
    type: Notification['type'];
    data?: any;
  }): Promise<Notification> {
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        body,
        type,
        data,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return notification;
  }

  /**
   * Get user notifications (paginated)
   */
  static async getUserNotifications(
    userId: string,
    limit = 50,
    offset = 0,
    type?: Notification['type']
  ): Promise<Notification[]> {
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<Notification> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
  }

  /**
   * Delete all notifications for a user
   */
  static async deleteAllNotifications(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Update notification by type and message ID (for DynamoDB compatibility)
   */
  static async updateNotificationByTypeAndId({
    userId,
    type,
    messageId,
    updates,
  }: {
    userId: string;
    type: string;
    messageId: string;
    updates: any;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update(updates)
      .eq('user_id', userId)
      .eq('type', type.toUpperCase())
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Export individual functions for backwards compatibility
export const getUserNotificationsByUserId = NotificationDao.getUserNotificationsByUserId.bind(NotificationDao);
export const initializeUserNotifications = NotificationDao.initializeUserNotifications.bind(NotificationDao);
export const updateUserNotificationsById = NotificationDao.updateUserNotificationsById.bind(NotificationDao);
