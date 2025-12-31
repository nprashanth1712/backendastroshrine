import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
interface FollowerRelation {
  id: string;
  userId: string;
  followingId: string;
  createdAt: string;
  notificationsEnabled: boolean;
}

interface FollowerWithDetails {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    profilePicture: string | null;
    isOnline: boolean;
  };
  createdAt: string;
  notificationsEnabled: boolean;
}

interface FollowingWithDetails {
  id: string;
  followingId: string;
  astrologer?: {
    id: string;
    name: string;
    profilePicture: string | null;
    isOnline: boolean;
    specializations: string[];
    rating: number;
  };
  createdAt: string;
  notificationsEnabled: boolean;
}

export class FollowersDao {
  // ============================================================
  // FOLLOW/UNFOLLOW OPERATIONS
  // ============================================================

  /**
   * Follow an astrologer
   */
  static async followAstrologer(userId: string, astrologerId: string): Promise<FollowerRelation> {
    // Check if already following
    const existing = await this.getFollowRelation(userId, astrologerId);
    if (existing) {
      return existing;
    }

    const { data, error } = await supabaseAdmin
      .from('followers')
      .insert({
        user_id: userId,
        following_id: astrologerId,
        notifications_enabled: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Update follower count on astrologer
    await this.updateFollowerCount(astrologerId, 1);

    return this.mapToFollowerRelation(data);
  }

  /**
   * Unfollow an astrologer
   */
  static async unfollowAstrologer(userId: string, astrologerId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('followers')
      .delete()
      .eq('user_id', userId)
      .eq('following_id', astrologerId);

    if (error) throw error;

    // Update follower count on astrologer
    await this.updateFollowerCount(astrologerId, -1);
  }

  /**
   * Get a follow relation between user and astrologer
   */
  static async getFollowRelation(userId: string, astrologerId: string): Promise<FollowerRelation | null> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .select('*')
      .eq('user_id', userId)
      .eq('following_id', astrologerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToFollowerRelation(data);
  }

  /**
   * Check if user is following an astrologer
   */
  static async isFollowing(userId: string, astrologerId: string): Promise<boolean> {
    const relation = await this.getFollowRelation(userId, astrologerId);
    return relation !== null;
  }

  // ============================================================
  // GET FOLLOWERS/FOLLOWING
  // ============================================================

  /**
   * Get all followers of an astrologer
   */
  static async getAstrologerFollowers(
    astrologerId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ followers: FollowerWithDetails[]; total: number }> {
    let query = supabaseAdmin
      .from('followers')
      .select(`
        *,
        user:users!user_id (
          id,
          name,
          profile_picture,
          is_online
        )
      `, { count: 'exact' })
      .eq('following_id', astrologerId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      followers: (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        user: item.user ? {
          id: item.user.id,
          name: item.user.name,
          profilePicture: item.user.profile_picture,
          isOnline: item.user.is_online,
        } : undefined,
        createdAt: item.created_at,
        notificationsEnabled: item.notifications_enabled,
      })),
      total: count || 0,
    };
  }

  /**
   * Get all astrologers a user is following
   */
  static async getUserFollowing(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ following: FollowingWithDetails[]; total: number }> {
    let query = supabaseAdmin
      .from('followers')
      .select(`
        *,
        astrologer:astrologers!following_id (
          id,
          name,
          profile_picture,
          is_online,
          specializations,
          rating
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      following: (data || []).map(item => ({
        id: item.id,
        followingId: item.following_id,
        astrologer: item.astrologer ? {
          id: item.astrologer.id,
          name: item.astrologer.name,
          profilePicture: item.astrologer.profile_picture,
          isOnline: item.astrologer.is_online,
          specializations: item.astrologer.specializations || [],
          rating: item.astrologer.rating,
        } : undefined,
        createdAt: item.created_at,
        notificationsEnabled: item.notifications_enabled,
      })),
      total: count || 0,
    };
  }

  /**
   * Get follower IDs for an astrologer (for notifications)
   */
  static async getFollowerIds(astrologerId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .select('user_id')
      .eq('following_id', astrologerId)
      .eq('notifications_enabled', true);

    if (error) throw error;
    return (data || []).map(item => item.user_id);
  }

  /**
   * Get following IDs for a user
   */
  static async getFollowingIds(userId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .select('following_id')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(item => item.following_id);
  }

  // ============================================================
  // NOTIFICATION PREFERENCES
  // ============================================================

  /**
   * Update notification preference for a follow relation
   */
  static async updateNotificationPreference(
    userId: string,
    astrologerId: string,
    enabled: boolean
  ): Promise<FollowerRelation> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .update({ notifications_enabled: enabled })
      .eq('user_id', userId)
      .eq('following_id', astrologerId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToFollowerRelation(data);
  }

  /**
   * Get followers with notifications enabled
   */
  static async getFollowersWithNotificationsEnabled(astrologerId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .select('user_id')
      .eq('following_id', astrologerId)
      .eq('notifications_enabled', true);

    if (error) throw error;
    return (data || []).map(item => item.user_id);
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get follower count for an astrologer
   */
  static async getFollowerCount(astrologerId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', astrologerId);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get following count for a user
   */
  static async getFollowingCount(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Update follower count on astrologer (helper method)
   */
  private static async updateFollowerCount(astrologerId: string, delta: number): Promise<void> {
    // Use RPC for atomic increment/decrement
    const { error } = await supabaseAdmin.rpc('increment_follower_count', {
      astrologer_id: astrologerId,
      delta_value: delta,
    });

    // If RPC doesn't exist, fall back to direct update
    if (error && error.message.includes('does not exist')) {
      const { data: astrologer } = await supabaseAdmin
        .from('astrologers')
        .select('total_followers')
        .eq('id', astrologerId)
        .single();

      const newCount = Math.max(0, (astrologer?.total_followers || 0) + delta);

      await supabaseAdmin
        .from('astrologers')
        .update({ total_followers: newCount })
        .eq('id', astrologerId);
    } else if (error) {
      // Log but don't throw - follower count is not critical
      console.error('Error updating follower count:', error);
    }
  }

  // ============================================================
  // BULK OPERATIONS
  // ============================================================

  /**
   * Get multiple follow relations at once
   */
  static async getFollowRelationsBatch(
    userId: string,
    astrologerIds: string[]
  ): Promise<Map<string, boolean>> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .select('following_id')
      .eq('user_id', userId)
      .in('following_id', astrologerIds);

    if (error) throw error;

    const followingSet = new Set((data || []).map(item => item.following_id));
    const result = new Map<string, boolean>();

    for (const id of astrologerIds) {
      result.set(id, followingSet.has(id));
    }

    return result;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map Supabase data to FollowerRelation format
   */
  private static mapToFollowerRelation(data: any): FollowerRelation {
    if (!data) return {} as FollowerRelation;

    return {
      id: data.id,
      userId: data.user_id,
      followingId: data.following_id,
      createdAt: data.created_at,
      notificationsEnabled: data.notifications_enabled,
    };
  }
}

// Export individual functions for backwards compatibility
export const followAstrologer = FollowersDao.followAstrologer.bind(FollowersDao);
export const unfollowAstrologer = FollowersDao.unfollowAstrologer.bind(FollowersDao);
export const isFollowing = FollowersDao.isFollowing.bind(FollowersDao);
export const getAstrologerFollowers = FollowersDao.getAstrologerFollowers.bind(FollowersDao);
export const getUserFollowing = FollowersDao.getUserFollowing.bind(FollowersDao);
