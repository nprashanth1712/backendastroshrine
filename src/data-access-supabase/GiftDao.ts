import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
interface Gift {
  giftId: string;
  createTs: number;
  name: string;
  amount: number;
  imageUrl: string;
  giftStatus: string;
}

interface GiftTransaction {
  id: string;
  channelId: string;
  senderId: string;
  receiverId: string;
  giftId: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
}

export class GiftDao {
  // ============================================================
  // GIFT CATALOG OPERATIONS
  // ============================================================

  /**
   * Get all active gifts
   */
  static async getAllActiveGifts(): Promise<Gift[]> {
    const { data, error } = await supabaseAdmin
      .from('gifts')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) throw error;
    return (data || []).map(this.mapToGift);
  }

  /**
   * Get all gifts (including inactive)
   */
  static async getAllGifts(): Promise<Gift[]> {
    const { data, error } = await supabaseAdmin
      .from('gifts')
      .select('*')
      .order('price', { ascending: true });

    if (error) throw error;
    return (data || []).map(this.mapToGift);
  }

  /**
   * Initialize/Create a new gift
   */
  static async initializeGift({
    id,
    name,
    amount,
    imageUrl,
  }: {
    id: string;
    name: string;
    amount: number;
    imageUrl: string;
  }): Promise<Gift> {
    const { data, error } = await supabaseAdmin
      .from('gifts')
      .insert({
        id,
        name,
        price: amount,
        icon_url: imageUrl,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToGift(data);
  }

  /**
   * Get gift by ID
   */
  static async getGiftById({ giftId }: { giftId: string }): Promise<Gift | null> {
    const { data, error } = await supabaseAdmin
      .from('gifts')
      .select('*')
      .eq('id', giftId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToGift(data);
  }

  /**
   * Update gift status
   */
  static async updateGiftStatusById({
    giftId,
    status,
  }: {
    giftId: string;
    status: string;
  }): Promise<Gift | null> {
    const { data, error } = await supabaseAdmin
      .from('gifts')
      .update({
        is_active: status === 'ACTIVE',
      })
      .eq('id', giftId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToGift(data);
  }

  /**
   * Update gift details
   */
  static async updateGift(giftId: string, updates: Partial<Gift>): Promise<Gift> {
    const { data, error } = await supabaseAdmin
      .from('gifts')
      .update({
        name: updates.name,
        price: updates.amount,
        icon_url: updates.imageUrl,
        is_active: updates.giftStatus === 'ACTIVE',
      })
      .eq('id', giftId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToGift(data);
  }

  /**
   * Delete gift
   */
  static async deleteGift(giftId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('gifts')
      .delete()
      .eq('id', giftId);

    if (error) throw error;
  }

  // ============================================================
  // GIFT TRANSACTION OPERATIONS
  // ============================================================

  /**
   * Create gift transaction
   */
  static async createGiftTransaction({
    channelId,
    senderId,
    receiverId,
    giftId,
    quantity = 1,
  }: {
    channelId: string;
    senderId: string;
    receiverId: string;
    giftId: string;
    quantity?: number;
  }): Promise<GiftTransaction> {
    // Get gift price
    const gift = await this.getGiftById({ giftId });
    if (!gift) throw new Error('Gift not found');

    const totalAmount = gift.amount * quantity;

    const { data, error } = await supabaseAdmin
      .from('gift_transactions')
      .insert({
        channel_id: channelId,
        sender_id: senderId,
        receiver_id: receiverId,
        gift_id: giftId,
        quantity,
        total_amount: totalAmount,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToGiftTransaction(data);
  }

  /**
   * Get gift transactions by channel
   */
  static async getGiftTransactionsByChannel(channelId: string): Promise<GiftTransaction[]> {
    const { data, error } = await supabaseAdmin
      .from('gift_transactions')
      .select(`
        *,
        gift:gifts(name, icon_url),
        sender:users!gift_transactions_sender_id_fkey(username, profile_image)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToGiftTransaction);
  }

  /**
   * Get gift transactions by sender
   */
  static async getGiftTransactionsBySender(senderId: string): Promise<GiftTransaction[]> {
    const { data, error } = await supabaseAdmin
      .from('gift_transactions')
      .select(`
        *,
        gift:gifts(name, icon_url),
        receiver:astrologers(display_name)
      `)
      .eq('sender_id', senderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToGiftTransaction);
  }

  /**
   * Get gift transactions by receiver (astrologer)
   */
  static async getGiftTransactionsByReceiver(receiverId: string): Promise<GiftTransaction[]> {
    const { data, error } = await supabaseAdmin
      .from('gift_transactions')
      .select(`
        *,
        gift:gifts(name, icon_url),
        sender:users!gift_transactions_sender_id_fkey(username, profile_image)
      `)
      .eq('receiver_id', receiverId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToGiftTransaction);
  }

  /**
   * Get total gift earnings for an astrologer
   */
  static async getTotalGiftEarnings(astrologerId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('gift_transactions')
      .select('total_amount')
      .eq('receiver_id', astrologerId);

    if (error) throw error;

    return (data || []).reduce((sum, t) => sum + Number(t.total_amount), 0);
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map Supabase data to Gift format
   */
  private static mapToGift(data: any): Gift {
    if (!data) return {} as Gift;

    return {
      giftId: data.id,
      createTs: new Date(data.created_at).getTime(),
      name: data.name,
      amount: Number(data.price),
      imageUrl: data.icon_url,
      giftStatus: data.is_active ? 'ACTIVE' : 'INACTIVE',
    };
  }

  /**
   * Map Supabase data to GiftTransaction format
   */
  private static mapToGiftTransaction(data: any): GiftTransaction {
    if (!data) return {} as GiftTransaction;

    return {
      id: data.id,
      channelId: data.channel_id,
      senderId: data.sender_id,
      receiverId: data.receiver_id,
      giftId: data.gift_id,
      quantity: data.quantity,
      totalAmount: Number(data.total_amount),
      createdAt: data.created_at,
    };
  }
}

// Export individual functions for backwards compatibility
export const getAllActiveGifts = GiftDao.getAllActiveGifts.bind(GiftDao);
export const initializeGift = GiftDao.initializeGift.bind(GiftDao);
export const getGiftById = GiftDao.getGiftById.bind(GiftDao);
export const updateGiftStatusById = GiftDao.updateGiftStatusById.bind(GiftDao);
