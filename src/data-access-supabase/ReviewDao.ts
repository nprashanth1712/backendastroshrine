import { supabaseAdmin } from '../services/supabaseClient';
import { AstrologerDao } from './AstrologerDao';

// Types to match DynamoDB structure
interface Review {
  hostId: string;
  tsUserId: string;
  rating: number;
  comment: string;
  userName?: string;
  reply?: string;
}

export class ReviewDao {
  // ============================================================
  // REVIEW CRUD OPERATIONS
  // ============================================================

  /**
   * Get all reviews for a host/astrologer (paginated)
   */
  static async getAllHostReviews({
    hostId,
    startTs,
    endTs,
    exclusiveStartKey,
  }: {
    hostId: string;
    startTs: string;
    endTs: string;
    exclusiveStartKey?: { hostId: string; tsUserId: string };
  }): Promise<Review[]> {
    let query = supabaseAdmin
      .from('reviews')
      .select(`
        *,
        user:users(username, profile_image)
      `)
      .eq('astrologer_id', hostId)
      .gte('created_at', new Date(parseInt(startTs)).toISOString())
      .lte('created_at', new Date(parseInt(endTs)).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (exclusiveStartKey?.tsUserId) {
      const [ts] = exclusiveStartKey.tsUserId.split('#');
      query = query.lt('created_at', new Date(parseInt(ts)).toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(this.mapToReview);
  }

  /**
   * Add a new review
   */
  static async addNewReview({
    hostId,
    userId,
    userName,
    rating,
    message,
  }: {
    userId: string;
    userName: string;
    hostId: string;
    rating: number;
    message: string;
  }): Promise<Review> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        astrologer_id: hostId,
        user_id: userId,
        rating,
        comment: message,
        user_name: userName,
        ts_user_id: `${Date.now()}#${userId}`,
      })
      .select()
      .single();

    if (error) throw error;

    // Update astrologer rating
    await AstrologerDao.updateAstrologerRating(hostId);

    return this.mapToReview(data);
  }

  /**
   * Get a specific review
   */
  static async getReview({ hostId, tsUserId }: { hostId: string; tsUserId: string }): Promise<Review | null> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        user:users(username, profile_image)
      `)
      .eq('astrologer_id', hostId)
      .eq('ts_user_id', tsUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToReview(data);
  }

  /**
   * Reply to a review
   */
  static async replyReview({
    hostId,
    tsUserId,
    reply,
  }: {
    hostId: string;
    tsUserId: string;
    reply: string;
  }): Promise<Review | null> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ reply })
      .eq('astrologer_id', hostId)
      .eq('ts_user_id', tsUserId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReview(data);
  }

  /**
   * Get reviews by user ID
   */
  static async getReviewsByUserId(userId: string, limit = 50, offset = 0): Promise<Review[]> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        astrologer:astrologers(display_name, user:users(profile_image))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []).map(this.mapToReview);
  }

  /**
   * Get review by order ID
   */
  static async getReviewByOrderId(orderId: string): Promise<Review | null> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        user:users(username, profile_image)
      `)
      .eq('order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToReview(data);
  }

  /**
   * Update review
   */
  static async updateReview(reviewId: string, updates: Partial<Review>): Promise<Review> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({
        rating: updates.rating,
        comment: updates.comment,
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;

    // Update astrologer rating
    if (data.astrologer_id) {
      await AstrologerDao.updateAstrologerRating(data.astrologer_id);
    }

    return this.mapToReview(data);
  }

  /**
   * Delete review
   */
  static async deleteReview(reviewId: string): Promise<void> {
    const { data: review, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('astrologer_id')
      .eq('id', reviewId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;

    // Update astrologer rating
    if (review?.astrologer_id) {
      await AstrologerDao.updateAstrologerRating(review.astrologer_id);
    }
  }

  /**
   * Get featured reviews for an astrologer
   */
  static async getFeaturedReviews(astrologerId: string, limit = 5): Promise<Review[]> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        user:users(username, profile_image)
      `)
      .eq('astrologer_id', astrologerId)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapToReview);
  }

  /**
   * Set review as featured
   */
  static async setFeatured(reviewId: string, isFeatured: boolean): Promise<Review> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ is_featured: isFeatured })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReview(data);
  }

  /**
   * Get review statistics for an astrologer
   */
  static async getReviewStats(astrologerId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('astrologer_id', astrologerId);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const totalReviews = data.length;
    const averageRating = data.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    data.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating as 1 | 2 | 3 | 4 | 5]++;
      }
    });

    return {
      totalReviews,
      averageRating: Math.round(averageRating * 100) / 100,
      ratingDistribution,
    };
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map Supabase data to Review format
   */
  private static mapToReview(data: any): Review {
    if (!data) return {} as Review;

    return {
      hostId: data.astrologer_id,
      tsUserId: data.ts_user_id || `${new Date(data.created_at).getTime()}#${data.user_id}`,
      rating: data.rating,
      comment: data.comment,
      userName: data.user_name || data.user?.username,
      reply: data.reply,
    };
  }
}

// Export individual functions for backwards compatibility
export const getAllHostReviews = ReviewDao.getAllHostReviews.bind(ReviewDao);
export const addNewReview = ReviewDao.addNewReview.bind(ReviewDao);
export const getReview = ReviewDao.getReview.bind(ReviewDao);
export const replyReview = ReviewDao.replyReview.bind(ReviewDao);
