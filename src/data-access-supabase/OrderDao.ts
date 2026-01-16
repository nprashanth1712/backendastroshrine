import { supabaseAdmin } from '../services/supabaseClient';
import { UserDao } from './UserDao';

// Types to match DynamoDB structure
interface PaymentDetails {
  paymentId?: string;
  method?: string;
  status?: string;
  timestamp?: number;
  [key: string]: any;
}

interface Order {
  userId: string;
  createTs: number;
  razorPayOrderId?: string;
  paymentDetails?: PaymentDetails[];
  status: string;
  amount: number;
}

interface UserOrder {
  userId: string;
  hostId: string;
  hostName?: string;
  userName?: string;
  hostIdTs?: string;
  ts: number;
  amount: number;
  status: string;
  orderTentativeEndTs?: number;
  orderEndTs?: number;
  channelType?: string;
  subType?: string;
}

interface AstrologerOrder {
  astrologerId: string;
  customerId: string;
  timeSpent: number;
  orderTs: number;
  orderType?: string;
  subOrderType?: string;
  amount: number;
}

export class OrderDao {
  // ============================================================
  // RAZORPAY ORDER OPERATIONS
  // ============================================================

  /**
   * Initialize payment order (Razorpay)
   */
  static async initializePaymentOrder({
    id,
    userId,
    status,
    amount,
    createTs,
    paymentDetails,
    isDummy,
  }: {
    id: string;
    userId: string;
    status: string;
    amount: number;
    createTs: number;
    paymentDetails: PaymentDetails;
    isDummy?: boolean;
  }): Promise<Order> {
    const orderData = {
      user_id: userId,
      razorpay_order_id: id,
      amount: amount / 100, // Convert from paise to rupees
      status: status.toUpperCase(),
      payment_details: [paymentDetails],
      is_dummy: isDummy || false,
    };

    const { data, error } = await supabaseAdmin
      .from('razorpay_orders')
      .insert(orderData)
      .select()
      .single();

    if (error) throw error;

    // If dummy order, add balance to user
    if (isDummy) {
      await UserDao.updateUserBalanceWithTransaction(
        userId,
        amount / 100,
        'credit',
        'Dummy order credit',
        data.id,
        'DUMMY_ORDER'
      );
    }

    return {
      userId: data.user_id,
      createTs: new Date(data.created_at).getTime(),
      razorPayOrderId: data.razorpay_order_id,
      paymentDetails: data.payment_details,
      status: data.status,
      amount: Number(data.amount),
    };
  }

  /**
   * Get order by Razorpay order ID
   */
  static async getOrderByRazorPayId({ razorPayOrderId }: { razorPayOrderId: string }): Promise<Order> {
    const { data, error } = await supabaseAdmin
      .from('razorpay_orders')
      .select('*')
      .eq('razorpay_order_id', razorPayOrderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return {} as Order;
      throw error;
    }

    return {
      userId: data.user_id,
      createTs: new Date(data.created_at).getTime(),
      razorPayOrderId: data.razorpay_order_id,
      paymentDetails: data.payment_details,
      status: data.status,
      amount: Number(data.amount),
    };
  }

  /**
   * Get order by user ID and create timestamp
   */
  static async getOrderByUserIdCreateTs({ userId, createTs }: { userId: string; createTs: number }): Promise<Order> {
    const { data, error } = await supabaseAdmin
      .from('razorpay_orders')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(createTs - 1000).toISOString())
      .lte('created_at', new Date(createTs + 1000).toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return {} as Order;
      throw error;
    }

    return {
      userId: data.user_id,
      createTs: new Date(data.created_at).getTime(),
      razorPayOrderId: data.razorpay_order_id,
      paymentDetails: data.payment_details,
      status: data.status,
      amount: Number(data.amount),
    };
  }

  /**
   * Edit user payment details
   */
  static async editUserPaymentDetails({
    userId,
    createTs,
    paymentDetails,
  }: {
    userId: string;
    createTs: number;
    paymentDetails: PaymentDetails[];
  }): Promise<any> {
    // Find the order first
    const { data: orders, error: findError } = await supabaseAdmin
      .from('razorpay_orders')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', new Date(createTs - 1000).toISOString())
      .lte('created_at', new Date(createTs + 1000).toISOString());

    if (findError) throw findError;
    if (!orders || orders.length === 0) {
      throw new Error('Order not found');
    }

    const { data, error } = await supabaseAdmin
      .from('razorpay_orders')
      .update({
        payment_details: paymentDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orders[0].id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Edit order status
   */
  static async editOrderStatus({ userId, createTs, status }: { userId: string; createTs: number; status: string }): Promise<Order> {
    const { data: orders, error: findError } = await supabaseAdmin
      .from('razorpay_orders')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', new Date(createTs - 1000).toISOString())
      .lte('created_at', new Date(createTs + 1000).toISOString());

    if (findError) throw findError;
    if (!orders || orders.length === 0) {
      throw new Error('Order not found');
    }

    const { data, error } = await supabaseAdmin
      .from('razorpay_orders')
      .update({
        status: status.toUpperCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orders[0].id)
      .select()
      .single();

    if (error) throw error;

    return {
      userId: data.user_id,
      createTs: new Date(data.created_at).getTime(),
      razorPayOrderId: data.razorpay_order_id,
      paymentDetails: data.payment_details,
      status: data.status,
      amount: Number(data.amount),
    };
  }

  /**
   * Get order list by user ID with date range
   */
  static async getOrderListByUserId({
    userId,
    startTs,
    endTs,
    exclusiveStartKey,
  }: {
    userId: string;
    startTs: number;
    endTs: number;
    exclusiveStartKey?: { userId: string; ts: number };
  }): Promise<any[]> {
    let query = supabaseAdmin
      .from('razorpay_orders')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(startTs).toISOString())
      .lte('created_at', new Date(endTs).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (exclusiveStartKey?.ts) {
      query = query.lt('created_at', new Date(exclusiveStartKey.ts).toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // CONSULTATION ORDER OPERATIONS
  // ============================================================

  /**
   * Create order (consultation)
   */
  static async createOrder(orderData: {
    user_id: string;
    astrologer_id: string;
    type: 'CHAT' | 'CALL' | 'VIDEO' | 'LIVESTREAM';
    amount: number;
    duration_minutes?: number;
    payment_id?: string;
  }): Promise<any> {
    // Check user balance first
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('balance')
      .eq('id', orderData.user_id)
      .single();

    if (userError) throw userError;

    if (Number(user.balance) < orderData.amount) {
      throw new Error('Insufficient balance');
    }

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        ...orderData,
        status: 'PENDING',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Deduct amount from user balance
    try {
      await UserDao.updateUserBalanceWithTransaction(
        orderData.user_id,
        orderData.amount,
        'debit',
        `Order #${order.id}`,
        order.id,
        'ORDER'
      );
    } catch (error) {
      // Rollback order creation if balance update fails
      await supabaseAdmin
        .from('orders')
        .delete()
        .eq('id', order.id);
      throw error;
    }

    return order;
  }

  /**
   * Get order by ID
   */
  static async getOrderById(orderId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        user:users(id, username, email, profile_image),
        astrologer:astrologers(*, user:users(username, profile_image))
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get user orders
   */
  static async getUserOrders(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        astrologer:astrologers(*, user:users(username, profile_image))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get astrologer orders
   */
  static async getAstrologerOrders(astrologerId: string, limit = 50, offset = 0): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        user:users(id, username, email, profile_image)
      `)
      .eq('astrologer_id', astrologerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(
    orderId: string,
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
  ): Promise<any> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'ACTIVE') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'COMPLETED' || status === 'CANCELLED') {
      updates.ended_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Start order (mark as active)
   */
  static async startOrder(orderId: string): Promise<any> {
    return this.updateOrderStatus(orderId, 'ACTIVE');
  }

  /**
   * Complete order
   */
  static async completeOrder(orderId: string, duration_minutes?: number): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'COMPLETED',
        ended_at: new Date().toISOString(),
        duration_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // Update astrologer's total consultations
    if (data.astrologer_id) {
      const { data: astrologer, error: astroFetchError } = await supabaseAdmin
        .from('astrologers')
        .select('total_consultations')
        .eq('id', data.astrologer_id)
        .single();

      if (!astroFetchError && astrologer) {
        await supabaseAdmin
          .from('astrologers')
          .update({
            total_consultations: (astrologer.total_consultations || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.astrologer_id);
      }
    }

    return data;
  }

  /**
   * Cancel order
   */
  static async cancelOrder(orderId: string, refund = false): Promise<any> {
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) throw fetchError;

    if (order.status === 'COMPLETED') {
      throw new Error('Cannot cancel completed order');
    }

    const newStatus = refund ? 'REFUNDED' : 'CANCELLED';

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        status: newStatus,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // Process refund if applicable
    if (refund && order.amount > 0) {
      await UserDao.updateUserBalanceWithTransaction(
        order.user_id,
        order.amount,
        'credit',
        `Refund for Order #${orderId}`,
        orderId,
        'REFUND'
      );
    }

    return data;
  }

  /**
   * Get active orders for astrologer
   */
  static async getActiveOrders(astrologerId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        user:users(id, username, email, profile_image)
      `)
      .eq('astrologer_id', astrologerId)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // USER ORDER OPERATIONS (Session Orders)
  // ============================================================

  /**
   * Create user order (for session tracking)
   */
  static async createUserOrder(userOrder: UserOrder): Promise<UserOrder> {
    const { data, error } = await supabaseAdmin
      .from('user_orders')
      .insert({
        user_id: userOrder.userId,
        host_id: userOrder.hostId,
        host_name: userOrder.hostName,
        user_name: userOrder.userName,
        amount: userOrder.amount,
        status: userOrder.status,
        order_start_ts: userOrder.ts,
        order_tentative_end_ts: userOrder.orderTentativeEndTs,
        order_end_ts: userOrder.orderEndTs,
        channel_type: userOrder.channelType,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToUserOrder(data);
  }

  /**
   * Update user order
   */
  static async updateUserOrder(userId: string, ts: number, updates: Partial<UserOrder>): Promise<UserOrder> {
    const { data, error } = await supabaseAdmin
      .from('user_orders')
      .update({
        status: updates.status,
        amount: updates.amount,
        order_end_ts: updates.orderEndTs,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('order_start_ts', ts)
      .select()
      .single();

    if (error) throw error;
    return this.mapToUserOrder(data);
  }

  /**
   * Get user orders by user ID
   */
  static async getUserOrdersByUserId(userId: string, limit = 50, offset = 0): Promise<UserOrder[]> {
    const { data, error } = await supabaseAdmin
      .from('user_orders')
      .select('*')
      .eq('user_id', userId)
      .order('order_start_ts', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []).map(this.mapToUserOrder);
  }

  // ============================================================
  // ASTROLOGER ORDER OPERATIONS
  // ============================================================

  /**
   * Create astrologer order
   */
  static async createAstrologerOrder(astrologerOrder: AstrologerOrder): Promise<AstrologerOrder> {
    const { data, error } = await supabaseAdmin
      .from('astrologer_orders')
      .insert({
        astrologer_id: astrologerOrder.astrologerId,
        customer_id: astrologerOrder.customerId,
        time_spent: astrologerOrder.timeSpent,
        order_ts: astrologerOrder.orderTs,
        order_type: astrologerOrder.orderType,
        sub_order_type: astrologerOrder.subOrderType,
        amount: astrologerOrder.amount,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      astrologerId: data.astrologer_id,
      customerId: data.customer_id,
      timeSpent: data.time_spent,
      orderTs: data.order_ts,
      orderType: data.order_type,
      subOrderType: data.sub_order_type,
      amount: Number(data.amount),
    };
  }

  /**
   * Get astrologer order stats
   */
  static async getAstrologerOrderStats(astrologerId: string, startDate?: string, endDate?: string): Promise<any> {
    let query = supabaseAdmin
      .from('orders')
      .select('status, amount, created_at')
      .eq('astrologer_id', astrologerId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total_orders: data?.length || 0,
      completed_orders: data?.filter(o => o.status === 'COMPLETED').length || 0,
      total_earnings: data
        ?.filter(o => o.status === 'COMPLETED')
        .reduce((sum, o) => sum + Number(o.amount), 0) || 0,
      active_orders: data?.filter(o => o.status === 'ACTIVE').length || 0,
      pending_orders: data?.filter(o => o.status === 'PENDING').length || 0,
      cancelled_orders: data?.filter(o => o.status === 'CANCELLED').length || 0,
    };

    return stats;
  }

  /**
   * Get user order stats
   */
  static async getUserOrderStats(userId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('status, amount')
      .eq('user_id', userId);

    if (error) throw error;

    const stats = {
      total_orders: data?.length || 0,
      completed_orders: data?.filter(o => o.status === 'COMPLETED').length || 0,
      total_spent: data
        ?.filter(o => o.status === 'COMPLETED')
        .reduce((sum, o) => sum + Number(o.amount), 0) || 0,
      active_orders: data?.filter(o => o.status === 'ACTIVE').length || 0,
      pending_orders: data?.filter(o => o.status === 'PENDING').length || 0,
    };

    return stats;
  }

  /**
   * Check if user has completed order with astrologer
   */
  static async hasCompletedOrder(userId: string, astrologerId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('astrologer_id', astrologerId)
      .eq('status', 'COMPLETED')
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map to UserOrder format
   */
  private static mapToUserOrder(data: any): UserOrder {
    return {
      userId: data.user_id,
      hostId: data.host_id,
      hostName: data.host_name,
      userName: data.user_name,
      ts: data.order_start_ts,
      amount: Number(data.amount),
      status: data.status,
      orderTentativeEndTs: data.order_tentative_end_ts,
      orderEndTs: data.order_end_ts,
      channelType: data.channel_type,
    };
  }
}

// Export individual functions for backwards compatibility
export const getAllOrders = async () => {
  const { data, error } = await supabaseAdmin.from('orders').select('*');
  if (error) throw error;
  return data;
};
export const getOrderByUserIdCreateTs = OrderDao.getOrderByUserIdCreateTs.bind(OrderDao);
export const getOrderByRazorPayId = OrderDao.getOrderByRazorPayId.bind(OrderDao);
export const initializePaymentOrder = OrderDao.initializePaymentOrder.bind(OrderDao);
export const editUserPaymentDetails = OrderDao.editUserPaymentDetails.bind(OrderDao);
export const editOrderStatus = OrderDao.editOrderStatus.bind(OrderDao);
export const getOrderListByUserId = OrderDao.getOrderListByUserId.bind(OrderDao);
