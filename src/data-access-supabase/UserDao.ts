import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
interface UserProfile {
  dateTimeOfBirth?: number;
  email?: string;
  gender?: string;
  placeOfBirth?: {
    displayValue: string;
    geoLocation: {
      lat: number;
      long: number;
    };
  };
  aboutMe?: string;
  profilePic?: string;
}

interface JoinedChannel {
  channelId: string;
  channelType: string;
  joinedAt: number;
  status?: string;
}

interface CurrentUserOrder {
  channelId?: string;
  channelCreateTs?: number;
  userOrderTs?: number;
  channelType?: string;
  tempHost?: {
    status: string;
  };
}

interface EndUser {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  balance?: number;
  lastOnlineTs?: number;
  available?: number;
  profile?: UserProfile;
  joinedChannels?: JoinedChannel[];
  availableOffers?: any[];
  rejectedSessionList?: any[];
  isSupport?: string | boolean;
  currentUserOrder?: CurrentUserOrder;
  channelTimeSpent?: {
    livestream: number;
    chat: number;
    call: number;
  };
  languages?: string[];
  deviceToken?: string;
  role?: string;
}

export class UserDao {
  // ============================================================
  // USER CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new user (basic registration)
   */
  static async addUser(user: EndUser): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        name: user.name,
        phone_number: user.phoneNumber,
        balance: 0,
        available: 0,
        last_online_ts: Date.now(),
        profile: {},
        joined_channels: [],
        available_offers: [],
        rejected_session_list: [],
        is_support: false,
        current_user_order: {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Create a new user after OAuth sign-in (used by UserSupabase router)
   * Uses upsert to handle race conditions where user might already exist
   */
  static async createUser(userData: { id: string; email: string; username?: string; role?: string }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userData.id,
        email: userData.email,
        name: userData.username || userData.email.split('@')[0],
        role: userData.role || 'USER',
        balance: 0,
        available: 0,
        last_online_ts: Date.now(),
        profile: { email: userData.email },
        joined_channels: [],
        available_offers: [],
        rejected_session_list: [],
        is_support: false,
        current_user_order: {},
      }, {
        onConflict: 'id',
        ignoreDuplicates: false, // Update if exists
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Initialize user with full profile (after registration)
   */
  static async initializeUser(userId: string, userData: EndUser): Promise<EndUser> {
    // Get existing user data first
    const existingUser = await this.getUserById(userId);

    const profile: UserProfile = {
      dateTimeOfBirth: userData?.profile?.dateTimeOfBirth ?? 0,
      email: userData?.profile?.email ?? '',
      gender: userData?.profile?.gender ?? '',
      placeOfBirth: userData?.profile?.placeOfBirth ?? {
        displayValue: '',
        geoLocation: { lat: 28.6139, long: 77.2088 },
      },
      aboutMe: userData?.profile?.aboutMe ?? '',
      profilePic: userData?.profile?.profilePic ?? '',
    };

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        name: userData.name,
        balance: 0,
        last_online_ts: Date.now(),
        available: 0,
        profile: profile,
        joined_channels: [],
        available_offers: [],
        rejected_session_list: [],
        is_support: false,
        current_user_order: {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Create user settings
    await this.createUserSettings(userId);

    // Initialize notifications
    await this.initializeUserNotifications(userId);

    return this.mapToEndUser(data);
  }

  /**
   * Get user by ID
   * Returns null if user is not found (instead of empty object)
   */
  static async getUserById(userId: string): Promise<EndUser | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        astrologer:astrologers(*),
        settings:user_settings(*)
      `)
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // User not found - return null instead of empty object
        return null;
      }
      throw error;
    }
    return this.mapToEndUser(data);
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<EndUser | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        astrologer:astrologers(*),
        settings:user_settings(*)
      `)
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToEndUser(data);
  }

  /**
   * Get user by phone number
   */
  static async getUserByPhoneNumber({ phoneNumber }: { phoneNumber: string }): Promise<EndUser | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        astrologer:astrologers(*),
        settings:user_settings(*)
      `)
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToEndUser(data);
  }

  /**
   * Get all users
   */
  static async getAllUsers(): Promise<EndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*');

    if (error) throw error;
    return (data || []).map(this.mapToEndUser);
  }

  /**
   * Get all support users
   */
  static async getAllSupportUsers(): Promise<EndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('is_support', true);

    if (error) throw error;
    return (data || []).map(this.mapToEndUser);
  }

  /**
   * Delete user
   */
  static async deleteUser(id: string): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  // ============================================================
  // USER UPDATE OPERATIONS
  // ============================================================

  /**
   * Update user (generic update)
   */
  static async updateUser(userId: string, updates: any): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Update user profile
   */
  static async updateUserProfile({ id, profile }: { id: string; profile: UserProfile }): Promise<UserProfile> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        profile: profile,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('profile')
      .single();

    if (error) throw error;
    return data.profile as UserProfile;
  }

  /**
   * Update user balance
   */
  static async updateUserBalance({ id, balance }: { id: string; balance: number }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        balance: balance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Update user balance with transaction record
   */
  static async updateUserBalanceWithTransaction(
    userId: string,
    amount: number,
    type: 'credit' | 'debit',
    description?: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<EndUser> {
    // Get current balance
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const currentBalance = Number(user.balance) || 0;
    const newBalance = type === 'credit'
      ? currentBalance + amount
      : currentBalance - amount;

    if (newBalance < 0) {
      throw new Error('Insufficient balance');
    }

    // Update user balance
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create wallet transaction record
    await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        type: type === 'credit' ? 'CREDIT' : 'DEBIT',
        amount,
        balance_after: newBalance,
        description,
        reference_id: referenceId,
        reference_type: referenceType,
      });

    return this.mapToEndUser(updatedUser);
  }

  /**
   * Update user joined channels
   */
  static async updateUserJoinedChannels({ id, joinedChannels }: { id: string; joinedChannels: JoinedChannel[] }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        joined_channels: joinedChannels,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Add user channel time spent
   */
  static async addUserChannelTimeSpent({
    id,
    channelTimeSpent,
  }: {
    id: string;
    channelTimeSpent: { livestream: number; chat: number; call: number };
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        channel_time_spent: channelTimeSpent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user languages
   */
  static async updateUserLanguages({ id, languages }: { id: string; languages: string[] }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        languages: languages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user name
   */
  static async updateUserName({ id, name }: { id: string; name: string }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        name: name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Update user availability
   */
  static async updateUserAvailability({ id, available }: { id: string; available: number }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        available: available,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Update user last online timestamp
   */
  static async updateUserLastOnlineTs({ id }: { id: string }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        last_online_ts: Date.now(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Update user support status
   */
  static async updateUserIsSupportStatus({ id, status }: { id: string; status: string }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        is_support: status === 'true',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Update user current order
   */
  static async updateUserCurrentOrder({ id, currentUserOrder }: { id: string; currentUserOrder: CurrentUserOrder }): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        current_user_order: currentUserOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  /**
   * Update device token for push notifications
   */
  static async updateDeviceToken(userId: string, deviceToken: string): Promise<EndUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ 
        device_token: deviceToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToEndUser(data);
  }

  // ============================================================
  // SEQUENCE OPERATIONS
  // ============================================================

  /**
   * Get next UID for user
   */
  static async nextUID(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .rpc('get_next_sequence', { seq_name: 'user_uid' });

    if (error) throw error;
    return data;
  }

  // ============================================================
  // SETTINGS OPERATIONS
  // ============================================================

  /**
   * Get user settings
   */
  static async getUserSettings(userId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return this.createUserSettings(userId);
      }
      throw error;
    }
    return data;
  }

  /**
   * Create user settings
   */
  static async createUserSettings(userId: string, settings?: any): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .upsert({
        id: userId,
        notifications_enabled: true,
        call_notifications: true,
        chat_notifications: true,
        promotional_notifications: true,
        language: 'en',
        theme: 'light',
        ...settings,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user settings
   */
  static async updateUserSettings(userId: string, settings: any): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================
  // NOTIFICATION OPERATIONS
  // ============================================================

  /**
   * Initialize user notifications
   */
  static async initializeUserNotifications(userId: string): Promise<any> {
    // In Supabase, notifications are stored in the notifications table
    // This is just a placeholder to match DynamoDB behavior
    return { userId, inAppNotifications: [], pushNotifications: [] };
  }

  // ============================================================
  // WALLET OPERATIONS
  // ============================================================

  /**
   * Get wallet transactions
   */
  static async getWalletTransactions(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // KUNDLI PROFILE OPERATIONS
  // ============================================================

  /**
   * Get user kundli profile
   */
  static async getUserKundliProfile(userId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('kundli_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  /**
   * Create/Update kundli profile
   */
  static async upsertKundliProfile(userId: string, profile: any): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('kundli_profiles')
      .upsert({
        user_id: userId,
        ...profile,
        is_primary: true,
        updated_at: new Date().toISOString(),
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
   * Map Supabase user data to EndUser format
   */
  private static mapToEndUser(data: any): EndUser {
    if (!data) return {} as EndUser;

    // Determine role - check if user is an astrologer
    let role = data.role || 'USER';
    if (data.astrologer && data.astrologer.id) {
      role = 'ASTROLOGER';
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      phoneNumber: data.phone_number || data.phone,
      balance: Number(data.balance) || 0,
      lastOnlineTs: data.last_online_ts,
      available: data.available,
      profile: data.profile || {},
      joinedChannels: data.joined_channels || [],
      availableOffers: data.available_offers || [],
      rejectedSessionList: data.rejected_session_list || [],
      isSupport: data.is_support ? 'true' : 'false',
      currentUserOrder: data.current_user_order || {},
      channelTimeSpent: data.channel_time_spent || { livestream: 0, chat: 0, call: 0 },
      languages: data.languages || [],
      deviceToken: data.device_token,
      role: role,
    } as EndUser;
  }
}

// Export individual functions for backwards compatibility with existing code
export const initializeUser = UserDao.initializeUser.bind(UserDao);
export const addUser = UserDao.addUser.bind(UserDao);
export const getUserById = UserDao.getUserById.bind(UserDao);
export const getAllUsers = UserDao.getAllUsers.bind(UserDao);
export const getAllSupportUsers = UserDao.getAllSupportUsers.bind(UserDao);
export const deleteUser = UserDao.deleteUser.bind(UserDao);
export const getUserByPhoneNumber = UserDao.getUserByPhoneNumber.bind(UserDao);
export const updateUserProfile = UserDao.updateUserProfile.bind(UserDao);
export const updateUserBalance = UserDao.updateUserBalance.bind(UserDao);
export const updateUserJoinedChannels = UserDao.updateUserJoinedChannels.bind(UserDao);
export const addUserChannelTimeSpent = UserDao.addUserChannelTimeSpent.bind(UserDao);
export const updateUserLanguages = UserDao.updateUserLanguages.bind(UserDao);
export const updateUserName = UserDao.updateUserName.bind(UserDao);
export const updateUserAvailability = UserDao.updateUserAvailability.bind(UserDao);
export const updateUserLastOnlineTs = UserDao.updateUserLastOnlineTs.bind(UserDao);
export const updateUserIsSupportStatus = UserDao.updateUserIsSupportStatus.bind(UserDao);
export const nextUID = UserDao.nextUID.bind(UserDao);
