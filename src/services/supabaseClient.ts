import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Use service role key for backend
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://enyjwovvnsctgsxfigyo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_Emh8P_sofnJOdYn_6tXBFg_sFLtwSoi';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is not set. Some operations may fail.');
}

// Create Supabase admin client
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Verify JWT token from frontend
export const verifySupabaseToken = async (token: string) => {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

// Database helper functions
export const getUserById = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*, astrologer:astrologers(*)')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

export const getAstrologerById = async (astrologerId: string) => {
  const { data, error } = await supabaseAdmin
    .from('astrologers')
    .select('*, user:users(*)')
    .eq('id', astrologerId)
    .single();
  
  if (error) throw error;
  return data;
};

export const createOrder = async (orderData: any) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateOrder = async (orderId: string, updates: any) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const createChatSession = async (sessionData: any) => {
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .insert(sessionData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const sendMessage = async (messageData: any) => {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert(messageData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getMessages = async (sessionId: string, limit = 50, offset = 0) => {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return data;
};

export const updateUserBalance = async (userId: string, amount: number, type: 'credit' | 'debit') => {
  // Start a transaction
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single();
  
  if (userError) throw userError;
  
  const newBalance = type === 'credit' 
    ? Number(user.balance) + amount 
    : Number(user.balance) - amount;
  
  if (newBalance < 0) {
    throw new Error('Insufficient balance');
  }
  
  // Update user balance
  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from('users')
    .update({ balance: newBalance })
    .eq('id', userId)
    .select()
    .single();
  
  if (updateError) throw updateError;
  
  // Create wallet transaction
  const { error: transactionError } = await supabaseAdmin
    .from('wallet_transactions')
    .insert({
      user_id: userId,
      type: type === 'credit' ? 'CREDIT' : 'DEBIT',
      amount,
      balance_after: newBalance,
      description: `Balance ${type}`,
    });
  
  if (transactionError) throw transactionError;
  
  return updatedUser;
};

export const getOnlineAstrologers = async () => {
  const { data, error } = await supabaseAdmin
    .from('astrologers')
    .select('*, user:users(*)')
    .eq('is_online', true)
    .eq('is_available', true);
  
  if (error) throw error;
  return data;
};

export const createNotification = async (notificationData: any) => {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert(notificationData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getLiveChannels = async () => {
  const { data, error } = await supabaseAdmin
    .from('channels')
    .select('*, host:astrologers(*, user:users(*))')
    .eq('status', 'LIVE');
  
  if (error) throw error;
  return data;
};

export const updateChannelViewerCount = async (channelId: string, increment: boolean) => {
  const { data: channel, error: fetchError } = await supabaseAdmin
    .from('channels')
    .select('viewer_count')
    .eq('id', channelId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const newCount = increment 
    ? (channel.viewer_count || 0) + 1 
    : Math.max(0, (channel.viewer_count || 0) - 1);
  
  const { data, error } = await supabaseAdmin
    .from('channels')
    .update({ viewer_count: newCount })
    .eq('id', channelId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
