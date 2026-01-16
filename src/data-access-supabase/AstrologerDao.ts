import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
interface PricingData {
  livestream: { rate: number; offer: number };
  chat: { rate: number; offer: number };
  call: { rate: number; offer: number };
}

interface HostProfile {
  gender?: string;
  experience?: number;
  earnings?: number;
  orders?: number;
  expertise?: string[];
  followers?: number;
  channelTimeSpent?: {
    chat: number;
    livestream: number;
    call: number;
  };
  profilePic?: string;
  languages?: string[];
  media?: any[];
  aboutMe?: string;
}

interface AstrologerCurrentChannel {
  livestream: { enabled: boolean; approxTime: number; channelCreateTs?: number };
  chat: { enabled: boolean; approxTime: number; channelCreateTs?: number };
  call: { enabled: boolean; approxTime: number; channelCreateTs?: number };
}

interface AstrologerCurrentOffer {
  [key: string]: any;
}

interface UserWaitlist {
  livestream: any[];
  call: any[];
  chat: any[];
}

interface Waitlist {
  id: string;
  name: string;
  channelType: string;
  ts: number;
  status?: string;
}

interface Astrologer {
  id: string;
  name?: string;
  phoneNumber?: string;
  lastOnlineTs?: number;
  available?: number;
  pricingData?: PricingData;
  hostProfile?: HostProfile;
  currentChannel?: AstrologerCurrentChannel;
  currentOffer?: AstrologerCurrentOffer;
  waitlist?: UserWaitlist;
  ranking?: number;
  dataHash?: string;
}

interface JoinedChannel {
  channelId: string;
  channelType: string;
  joinedAt: number;
  status?: string;
}

interface RejectedSessionListForUser {
  channelId: string;
  userId: string;
  reason: string;
  ts: number;
}

export class AstrologerDao {
  // ============================================================
  // ASTROLOGER CRUD OPERATIONS
  // ============================================================

  /**
   * Add a new astrologer
   */
  static async addAstrologer({
    userData,
    astrologerDetails,
  }: {
    userData: any;
    astrologerDetails: any;
  }): Promise<Astrologer> {
    const astrologerId = userData.id; // Use same ID as user

    const hostProfile: HostProfile = {
      gender: userData?.profile?.gender,
      experience: 0,
      earnings: 0,
      orders: 0,
      expertise: astrologerDetails?.expertise || [],
      followers: 0,
      channelTimeSpent: {
        chat: 0,
        livestream: 0,
        call: 0,
      },
      profilePic: '',
      languages: astrologerDetails?.languages || ['English', 'Hindi'],
      media: [],
      aboutMe: astrologerDetails?.aboutMe || '',
    };

    const pricingData: PricingData = {
      livestream: { rate: 1, offer: 0 },
      chat: { rate: 1, offer: 0 },
      call: { rate: 1, offer: 0 },
    };

    const currentChannel: AstrologerCurrentChannel = {
      livestream: { enabled: false, approxTime: 0 },
      chat: { enabled: false, approxTime: 0 },
      call: { enabled: false, approxTime: 0 },
    };

    const waitlist: UserWaitlist = {
      livestream: [],
      call: [],
      chat: [],
    };

    // Insert into astrologers table
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .insert({
        id: astrologerId,
        display_name: userData.name,
        bio: astrologerDetails?.aboutMe,
        specialties: astrologerDetails?.expertise || [],
        languages: astrologerDetails?.languages || ['English', 'Hindi'],
        rating: 0,
        total_reviews: 0,
        total_consultations: 0,
        hourly_rate: 1,
        chat_rate: 1,
        call_rate: 1,
        is_online: false,
        is_available: true,
        years_experience: 0,
        certifications: [],
        phone_number: userData.phoneNumber,
        pricing_data: pricingData,
        waitlist: waitlist,
        current_channel: currentChannel,
        current_offer: {},
        host_profile: hostProfile,
        ranking: 100,
        last_online_ts: Date.now(),
        available: 1,
        total_earnings: 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Create settings for astrologer
    await supabaseAdmin
      .from('user_settings')
      .upsert({
        id: astrologerId,
        notifications_enabled: true,
        call_notifications: true,
        chat_notifications: true,
        promotional_notifications: true,
        language: 'en',
      });

    return this.mapToAstrologer(data);
  }

  /**
   * Get astrologer by ID
   */
  static async getAstrologerById(id: string): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .select(`
        *,
        user:users(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return {} as Astrologer;
      throw error;
    }
    return this.mapToAstrologer(data);
  }

  /**
   * Get all astrologers
   */
  static async getAllAstrologers(): Promise<Astrologer[]> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .select(`
        *,
        user:users(username, email, profile_image)
      `);

    if (error) throw error;
    return (data || []).map(this.mapToAstrologer);
  }

  /**
   * Get astrologer by phone number
   */
  static async getAstrologerByPhoneNumber({ phoneNumber }: { phoneNumber: string }): Promise<Astrologer | null> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToAstrologer(data);
  }

  /**
   * Get astrologer list by availability
   */
  static async getAstrologerListByAvailable(available: number): Promise<Astrologer[]> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .select('*')
      .eq('available', available)
      .order('ranking', { ascending: true });

    if (error) throw error;
    return (data || []).map(this.mapToAstrologer);
  }

  /**
   * Delete astrologer
   */
  static async deleteAstrologer(id: string): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  // ============================================================
  // ASTROLOGER UPDATE OPERATIONS
  // ============================================================

  /**
   * Update astrologer (generic update)
   */
  static async updateAstrologer(astrologerId: string, updates: any): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', astrologerId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  /**
   * Update astrologer pricing data
   */
  static async updateAstrologerPricingData({ id, pricingData }: { id: string; pricingData: PricingData }): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        pricing_data: pricingData,
        hourly_rate: pricingData.livestream?.rate || 1,
        chat_rate: pricingData.chat?.rate || 1,
        call_rate: pricingData.call?.rate || 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  /**
   * Update astrologer host profile
   */
  static async updateAstrologerHostProfile({
    id,
    hostProfile,
    name,
  }: {
    id: string;
    hostProfile: HostProfile;
    name: string;
  }): Promise<HostProfile> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        display_name: name,
        host_profile: hostProfile,
        bio: hostProfile.aboutMe,
        languages: hostProfile.languages,
        specialties: hostProfile.expertise,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data.host_profile as HostProfile;
  }

  /**
   * Update astrologer personal waitlist (with user update)
   */
  static async updateAstrologerPersonalWaitlist({
    id,
    waitlist,
    userId,
    joinedChannels,
    rejectedList,
  }: {
    id: string;
    waitlist: UserWaitlist;
    userId: string;
    joinedChannels: JoinedChannel[];
    rejectedList?: RejectedSessionListForUser[];
  }): Promise<UserWaitlist> {
    // Update astrologer waitlist
    const { error: astroError } = await supabaseAdmin
      .from('astrologers')
      .update({
        waitlist: waitlist,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (astroError) throw astroError;

    // Update user joined channels
    const userUpdate: any = {
      joined_channels: joinedChannels,
      updated_at: new Date().toISOString(),
    };

    if (rejectedList && rejectedList.length > 0) {
      userUpdate.rejected_session_list = rejectedList;
    }

    const { error: userError } = await supabaseAdmin
      .from('users')
      .update(userUpdate)
      .eq('id', userId);

    if (userError) throw userError;

    return waitlist;
  }

  /**
   * Update astrologer name
   */
  static async updateAstrologerName({ id, name }: { id: string; name: string }): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        display_name: name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  /**
   * Update astrologer availability
   */
  static async updateAstrologerAvailability({
    id,
    available,
  }: {
    id: string;
    available: 1 | 0;
    returnParams?: boolean;
  }): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        available: available,
        is_available: available === 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  /**
   * Update astrologer current channel
   */
  static async updateAstrologerCurrentChannel({
    id,
    currentChannel,
  }: {
    id: string;
    currentChannel: AstrologerCurrentChannel;
  }): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        current_channel: currentChannel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  /**
   * Update astrologer last online timestamp
   */
  static async updateAstrologerLastOnlineTs({ id }: { id: string }): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        last_online_ts: Date.now(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  /**
   * Update astrologer data hash
   */
  static async updateAstrologerDataHash({ id, dataHash }: { id: string; dataHash: string }): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        data_hash: dataHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  /**
   * Update online status
   */
  static async updateOnlineStatus(astrologerId: string, isOnline: boolean): Promise<Astrologer> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .update({
        is_online: isOnline,
        updated_at: new Date().toISOString(),
      })
      .eq('id', astrologerId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToAstrologer(data);
  }

  // ============================================================
  // QUERY OPERATIONS
  // ============================================================

  /**
   * Get all astrologers with filters
   */
  static async getAllAstrologersFiltered(filters?: {
    is_online?: boolean;
    is_available?: boolean;
    specialties?: string[];
    min_rating?: number;
  }): Promise<Astrologer[]> {
    let query = supabaseAdmin
      .from('astrologers')
      .select(`
        *,
        user:users(username, email, profile_image)
      `);

    if (filters?.is_online !== undefined) {
      query = query.eq('is_online', filters.is_online);
    }
    if (filters?.is_available !== undefined) {
      query = query.eq('is_available', filters.is_available);
    }
    if (filters?.min_rating) {
      query = query.gte('rating', filters.min_rating);
    }
    if (filters?.specialties && filters.specialties.length > 0) {
      query = query.contains('specialties', filters.specialties);
    }

    const { data, error } = await query.order('rating', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToAstrologer);
  }

  /**
   * Get online astrologers
   */
  static async getOnlineAstrologers(): Promise<Astrologer[]> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .select(`
        *,
        user:users(username, email, profile_image)
      `)
      .eq('is_online', true)
      .eq('is_available', true)
      .order('rating', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToAstrologer);
  }

  /**
   * Get astrologer reviews
   */
  static async getAstrologerReviews(astrologerId: string, limit = 50, offset = 0): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        user:users(username, profile_image)
      `)
      .eq('astrologer_id', astrologerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get astrologer orders
   */
  static async getAstrologerOrders(
    astrologerId: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<any[]> {
    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        user:users(username, email, profile_image)
      `)
      .eq('astrologer_id', astrologerId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get astrologer earnings
   */
  static async getAstrologerEarnings(
    astrologerId: string,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    let query = supabaseAdmin
      .from('orders')
      .select('amount, created_at')
      .eq('astrologer_id', astrologerId)
      .eq('status', 'COMPLETED');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const totalEarnings = (data || []).reduce((sum, order) => sum + Number(order.amount), 0);
    
    return {
      total_earnings: totalEarnings,
      order_count: data?.length || 0,
      orders: data || [],
    };
  }

  /**
   * Update astrologer rating (called after new review)
   */
  static async updateAstrologerRating(astrologerId: string): Promise<Astrologer | null> {
    const { data: reviews, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('astrologer_id', astrologerId);

    if (reviewError) throw reviewError;

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      
      const { data, error } = await supabaseAdmin
        .from('astrologers')
        .update({
          rating: Math.round(avgRating * 100) / 100,
          total_reviews: reviews.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', astrologerId)
        .select()
        .single();

      if (error) throw error;
      return this.mapToAstrologer(data);
    }

    return null;
  }

  /**
   * Search astrologers
   */
  static async searchAstrologers(searchTerm: string): Promise<Astrologer[]> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .select(`
        *,
        user:users(username, email, profile_image)
      `)
      .or(`display_name.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%`)
      .order('rating', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToAstrologer);
  }

  /**
   * Get top rated astrologers
   */
  static async getTopRatedAstrologers(limit = 10): Promise<Astrologer[]> {
    const { data, error } = await supabaseAdmin
      .from('astrologers')
      .select(`
        *,
        user:users(username, email, profile_image)
      `)
      .gte('total_reviews', 5)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapToAstrologer);
  }

  // ============================================================
  // FOLLOWER OPERATIONS
  // ============================================================

  /**
   * Get astrologer followers
   */
  static async getAstrologerFollowers(astrologerId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .select(`
        *,
        user:users(id, username, profile_image)
      `)
      .eq('astrologer_id', astrologerId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get follower count
   */
  static async getFollowerCount(astrologerId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('astrologer_id', astrologerId);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Add follower
   */
  static async addFollower(userId: string, astrologerId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .insert({
        user_id: userId,
        astrologer_id: astrologerId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Already following
        return { already_following: true };
      }
      throw error;
    }
    return data;
  }

  /**
   * Remove follower
   */
  static async removeFollower(userId: string, astrologerId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('followers')
      .delete()
      .eq('user_id', userId)
      .eq('astrologer_id', astrologerId);

    if (error) throw error;
  }

  /**
   * Check if user is following astrologer
   */
  static async isFollowing(userId: string, astrologerId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('followers')
      .select('id')
      .eq('user_id', userId)
      .eq('astrologer_id', astrologerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }
    return !!data;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map Supabase data to Astrologer format
   */
  private static mapToAstrologer(data: any): Astrologer {
    if (!data) return {} as Astrologer;

    return {
      id: data.id,
      name: data.display_name,
      phoneNumber: data.phone_number,
      lastOnlineTs: data.last_online_ts,
      available: data.available,
      pricingData: data.pricing_data || {
        livestream: { rate: data.hourly_rate || 1, offer: 0 },
        chat: { rate: data.chat_rate || 1, offer: 0 },
        call: { rate: data.call_rate || 1, offer: 0 },
      },
      hostProfile: data.host_profile || {
        expertise: data.specialties,
        languages: data.languages,
        aboutMe: data.bio,
      },
      currentChannel: data.current_channel || {
        livestream: { enabled: false, approxTime: 0 },
        chat: { enabled: false, approxTime: 0 },
        call: { enabled: false, approxTime: 0 },
      },
      currentOffer: data.current_offer || {},
      waitlist: data.waitlist || { livestream: [], call: [], chat: [] },
      ranking: data.ranking || 100,
      dataHash: data.data_hash,
    };
  }
}

// Export individual functions for backwards compatibility
export const addAstrologer = AstrologerDao.addAstrologer.bind(AstrologerDao);
export const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);
export const getAllAstrologers = AstrologerDao.getAllAstrologers.bind(AstrologerDao);
export const getAstrologerByPhoneNumber = AstrologerDao.getAstrologerByPhoneNumber.bind(AstrologerDao);
export const getAstrologerListByAvailable = AstrologerDao.getAstrologerListByAvailable.bind(AstrologerDao);
export const deleteAstrologer = AstrologerDao.deleteAstrologer.bind(AstrologerDao);
export const updateAstrologerPricingData = AstrologerDao.updateAstrologerPricingData.bind(AstrologerDao);
export const updateAstrologerHostProfile = AstrologerDao.updateAstrologerHostProfile.bind(AstrologerDao);
export const updateAstrologerPersonalWaitlist = AstrologerDao.updateAstrologerPersonalWaitlist.bind(AstrologerDao);
export const updateAstrologerName = AstrologerDao.updateAstrologerName.bind(AstrologerDao);
export const updateAstrologerAvailability = AstrologerDao.updateAstrologerAvailability.bind(AstrologerDao);
export const updateAstrologerCurrentChannel = AstrologerDao.updateAstrologerCurrentChannel.bind(AstrologerDao);
export const updateAstrologerLastOnlineTs = AstrologerDao.updateAstrologerLastOnlineTs.bind(AstrologerDao);
export const updateAstrologerDataHash = AstrologerDao.updateAstrologerDataHash.bind(AstrologerDao);
