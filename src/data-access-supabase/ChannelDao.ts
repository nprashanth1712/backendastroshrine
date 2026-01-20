import { supabaseAdmin } from '../services/supabaseClient';
import { UserDao } from './UserDao';
import { AstrologerDao } from './AstrologerDao';
import { ChatDao } from './ChatDao';
import { OrderDao } from './OrderDao';

// Types to match DynamoDB structure
interface TempHost {
  id: string;
  uid?: number;
  name?: string;
  status?: string;
  channelType?: string;
  subType?: string;
  startTime?: number;
  endTime?: number;
  terminationReason?: string;
  chatId?: string;
}

interface Waitlist {
  id: string;
  name?: string;
  channelType?: string;
  ts: number;
  status?: string;
  uid?: number;
}

interface Channel {
  channelId: string;
  channelType: string;
  host: any;
  rate: number;
  channelName?: string;
  recordingUid?: number;
  offer: number;
  rejectedSessionList?: any[];
  createTs: number;
  channelStatus: string;
  channelToken?: number;
  waitlist: Waitlist[];
  tempHost?: TempHost;
  tempHostsList?: TempHost[];
  ranking?: number;
  approxWaitTime?: number;
  viewerCount?: number;
  tags?: string[];
}

interface AstrologerCurrentChannel {
  livestream: { enabled: boolean; approxTime: number; channelCreateTs?: number };
  chat: { enabled: boolean; approxTime: number; channelCreateTs?: number };
  call: { enabled: boolean; approxTime: number; channelCreateTs?: number };
}

export class ChannelDao {
  // ============================================================
  // CHANNEL CRUD OPERATIONS
  // ============================================================

  /**
   * Enable/Create host channel (start livestream/call/chat channel)
   */
  static async enableHostChannel({
    channelId,
    deviceId,
    statusType,
    host,
    waitlist,
    createTs,
    rate,
    offer,
    astrologer,
    approxWaitTime,
  }: {
    channelId: string;
    deviceId: string;
    statusType: string;
    host: any;
    createTs: number;
    rate: number;
    offer: number;
    astrologer: any;
    waitlist: Waitlist[];
    approxWaitTime: number;
  }): Promise<Channel> {
    // End any existing live channels for this host to prevent duplicates
    await supabaseAdmin
      .from('channels')
      .update({ 
        status: 'ENDED', 
        ended_at: new Date().toISOString() 
      })
      .eq('host_id', astrologer.id)
      .eq('status', 'LIVE');
    
    // Get next channel token
    const channelToken = await this.nextChannelToken();

    // Get or create recording session
    let recordingUid = 0;
    const sessionData = await this.getOrCreateRecordingSession(channelId, deviceId);
    if (sessionData) {
      recordingUid = sessionData.uid || 0;
    }

    // Create channel
    const { data, error } = await supabaseAdmin
      .from('channels')
      .insert({
        host_id: astrologer.id,
        title: astrologer?.name || 'Live Session',
        description: '',
        status: 'LIVE',
        channel_type: statusType.toUpperCase(),
        rate: rate,
        offer: offer,
        channel_token: channelToken,
        recording_uid: recordingUid,
        ranking: astrologer?.ranking || 100,
        approx_wait_time: approxWaitTime,
        temp_host: {},
        temp_hosts_list: [],
        rejected_session_list: [],
        host_uid: host.uid,
        create_ts: createTs,
        agora_channel_name: channelId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update astrologer availability and waitlist
    const userPersonalWaitlist = {
      livestream: waitlist.filter(v => v.channelType?.toLowerCase() === 'livestream'),
      call: waitlist.filter(v => v.channelType?.toLowerCase() === 'call'),
      chat: waitlist.filter(v => v.channelType?.toLowerCase() === 'chat'),
    };

    await supabaseAdmin
      .from('astrologers')
      .update({
        available: 1,
        is_available: true,
        is_online: true,
        waitlist: userPersonalWaitlist,
        current_channel: astrologer.currentChannel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    // Insert waitlist entries
    for (const item of waitlist) {
      await supabaseAdmin
        .from('waitlist')
        .insert({
          channel_id: data.id,
          user_id: item.id,
          position: waitlist.indexOf(item) + 1,
          status: 'WAITING',
        });
    }

    return {
      channelId: data.agora_channel_name || data.id,
      channelType: data.channel_type,
      host: {
        id: astrologer.id,
        uid: host.uid,
        name: astrologer.name,
      },
      rate: Number(data.rate),
      channelName: astrologer?.name,
      recordingUid: data.recording_uid,
      offer: Number(data.offer),
      rejectedSessionList: [],
      createTs: data.create_ts || createTs,
      channelStatus: 'ACTIVE',
      channelToken: data.channel_token,
      waitlist: waitlist,
      tempHost: {} as TempHost,
      tempHostsList: [],
      ranking: data.ranking,
      approxWaitTime: data.approx_wait_time,
    };
  }

  /**
   * Get host channel by channelId and createTs
   */
  static async getHostChannel({ channelId, createTs }: { channelId: string; createTs: number }): Promise<Channel | null> {
    // Try to find by agora_channel_name first
    let { data, error } = await supabaseAdmin
      .from('channels')
      .select(`
        *,
        host:astrologers(*, user:users(username, profile_image))
      `)
      .eq('agora_channel_name', channelId)
      .eq('create_ts', createTs)
      .single();

    if (error && error.code === 'PGRST116') {
      // Try by host_id
      const result = await supabaseAdmin
        .from('channels')
        .select(`
          *,
          host:astrologers(*, user:users(username, profile_image))
        `)
        .eq('host_id', channelId)
        .eq('create_ts', createTs)
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToChannel(data);
  }

  /**
   * Get latest online host channel (alias: getLatestOnlineHostChannelList)
   */
  static async getLatestOnlineHostChannel({
    channelId,
    channelStatus = 'ACTIVE',
  }: {
    channelId: string;
    channelStatus?: string;
  }): Promise<Channel[]> {
    const { data, error } = await supabaseAdmin
      .from('channels')
      .select(`
        *,
        host:astrologers(*, user:users(username, profile_image))
      `)
      .or(`agora_channel_name.eq.${channelId},host_id.eq.${channelId}`)
      .eq('status', channelStatus === 'ACTIVE' ? 'LIVE' : channelStatus)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return (data || []).map(this.mapToChannel);
  }

  /**
   * Alias for getLatestOnlineHostChannel
   */
  static async getLatestOnlineHostChannelList({
    channelId,
  }: {
    channelId: string;
  }): Promise<Channel[]> {
    return this.getLatestOnlineHostChannel({ channelId });
  }

  /**
   * Get all online channels
   * Returns only the most recent channel per host to avoid duplicates
   */
  static async getAllOnlineChannels(): Promise<Channel[]> {
    const { data, error } = await supabaseAdmin
      .from('channels')
      .select(`
        *,
        host:astrologers(*, user:users(username, profile_image))
      `)
      .eq('status', 'LIVE')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Deduplicate by host_id - keep only the most recent channel per host
    const seenHosts = new Set<string>();
    const uniqueChannels = (data || []).filter(channel => {
      if (!channel.host_id || seenHosts.has(channel.host_id)) {
        return false;
      }
      seenHosts.add(channel.host_id);
      return true;
    });
    
    // Sort by viewer_count after deduplication
    uniqueChannels.sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
    
    return uniqueChannels.map(this.mapToChannel);
  }

  /**
   * Get channel by status and name
   */
  static async getChannelByChannelStatusName({
    channelStatus,
    channelName,
    channelType,
  }: {
    channelStatus: string;
    channelName: string;
    channelType?: string;
  }): Promise<Channel[]> {
    let query = supabaseAdmin
      .from('channels')
      .select(`
        *,
        host:astrologers(*, user:users(username, profile_image))
      `)
      .eq('status', channelStatus === 'ACTIVE' ? 'LIVE' : channelStatus)
      .ilike('title', `${channelName}%`);

    if (channelType) {
      query = query.eq('channel_type', channelType.toUpperCase());
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(this.mapToChannel);
  }

  /**
   * Update channel status
   */
  static async updateChannelStatus({
    channelId,
    createTs,
    value,
  }: {
    channelId: string;
    createTs: number;
    channelType?: string;
    value: string;
  }): Promise<any> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({
        status: value === 'ACTIVE' ? 'LIVE' : value,
      })
      .eq('id', channel.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update channel offer
   */
  static async updateChannelOffer({
    channelId,
    createTs,
    value,
  }: {
    channelId: string;
    createTs: number;
    channelType?: string;
    value: number;
  }): Promise<any> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({ offer: value })
      .eq('id', channel.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update channel approx wait time
   */
  static async updateChannelApproxTime({
    channelId,
    createTs,
    currentChannel,
    value,
  }: {
    channelId: string;
    createTs: number;
    currentChannel: AstrologerCurrentChannel;
    channelType?: string;
    value: number;
  }): Promise<any> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    // Update channel
    await supabaseAdmin
      .from('channels')
      .update({ approx_wait_time: value })
      .eq('id', channel.id);

    // Update astrologer current channel
    await supabaseAdmin
      .from('astrologers')
      .update({
        current_channel: currentChannel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    return { success: true };
  }

  /**
   * Update channel host info
   */
  static async updateChannelHostInfo({
    channelId,
    createTs,
    hostProfile,
  }: {
    channelId: string;
    createTs: number;
    hostProfile: any;
  }): Promise<any> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    // Update the channel with host info
    const { error } = await supabaseAdmin
      .from('channels')
      .update({
        host_id: hostProfile?.userId,
      })
      .eq('id', channel.id);

    if (error) throw error;
    return { success: true };
  }

  /**
   * Disable host channel
   */
  static async disableHostChannel({
    channelId,
    createTs,
    channelStatus,
    hostUserWaitlist,
    hostCurrentChannel,
  }: {
    channelId: string;
    createTs: number;
    channelStatus: string;
    hostUserWaitlist: any;
    hostCurrentChannel: AstrologerCurrentChannel;
    includedParams?: any[];
    returnParams?: boolean;
  }): Promise<any> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    // Update channel status
    await supabaseAdmin
      .from('channels')
      .update({
        status: channelStatus === 'INACTIVE' ? 'ENDED' : channelStatus,
        ended_at: new Date().toISOString(),
      })
      .eq('id', channel.id);

    // Update astrologer
    await supabaseAdmin
      .from('astrologers')
      .update({
        available: 0,
        is_available: false,
        is_online: false,
        waitlist: hostUserWaitlist,
        current_channel: hostCurrentChannel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    return { success: true };
  }

  // ============================================================
  // WAITLIST OPERATIONS
  // ============================================================

  /**
   * Update waitlist
   */
  static async updateWaitlist({
    updatedChannel,
    userJoinedChannelData,
  }: {
    updatedChannel: {
      channelId: string;
      createTs: number;
      waitlist: Waitlist[];
      rejectedSessionList?: any[];
    };
    userJoinedChannelData: {
      userId: string;
      joinedChannels: any[];
      rejectedList?: any[];
    };
    returnParams?: boolean;
  }): Promise<Channel> {
    const channel = await this.findChannelByIdAndTs(updatedChannel.channelId, updatedChannel.createTs);
    if (!channel) throw new Error('Channel not found');

    // Update channel waitlist
    const channelUpdate: any = {};
    if (updatedChannel.rejectedSessionList) {
      channelUpdate.rejected_session_list = updatedChannel.rejectedSessionList;
    }

    await supabaseAdmin
      .from('channels')
      .update(channelUpdate)
      .eq('id', channel.id);

    // Clear and re-insert waitlist
    await supabaseAdmin
      .from('waitlist')
      .delete()
      .eq('channel_id', channel.id);

    for (let i = 0; i < updatedChannel.waitlist.length; i++) {
      const item = updatedChannel.waitlist[i];
      await supabaseAdmin
        .from('waitlist')
        .insert({
          channel_id: channel.id,
          user_id: item.id,
          position: i + 1,
          status: 'WAITING',
        });
    }

    // Update user joined channels
    const userUpdate: any = {
      joined_channels: userJoinedChannelData.joinedChannels,
      updated_at: new Date().toISOString(),
    };

    if (userJoinedChannelData.rejectedList && userJoinedChannelData.rejectedList.length > 0) {
      userUpdate.rejected_session_list = userJoinedChannelData.rejectedList;
    }

    await supabaseAdmin
      .from('users')
      .update(userUpdate)
      .eq('id', userJoinedChannelData.userId);

    return {
      channelId: updatedChannel.channelId,
      createTs: updatedChannel.createTs,
      waitlist: updatedChannel.waitlist,
    } as Channel;
  }

  /**
   * Join waitlist
   */
  static async joinWaitlist(channelId: string, userId: string): Promise<any> {
    const { data: waitlist, error: fetchError } = await supabaseAdmin
      .from('waitlist')
      .select('position')
      .eq('channel_id', channelId)
      .order('position', { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    const nextPosition = waitlist && waitlist.length > 0 ? waitlist[0].position + 1 : 1;

    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .insert({
        channel_id: channelId,
        user_id: userId,
        position: nextPosition,
        status: 'WAITING',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get waitlist for channel
   */
  static async getWaitlist(channelId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .select(`
        *,
        user:users(id, username, profile_image)
      `)
      .eq('channel_id', channelId)
      .eq('status', 'WAITING')
      .order('position', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // TEMP HOST OPERATIONS
  // ============================================================

  /**
   * Update temp host
   */
  static async updateTempHost({
    channelId,
    createTs,
    tempHost,
  }: {
    channelId: string;
    createTs: number;
    tempHost: TempHost;
    includedParams?: any[];
  }): Promise<TempHost> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    // Update user availability and current order
    await supabaseAdmin
      .from('users')
      .update({
        available: 1,
        current_user_order: {
          channelId: channelId,
          channelCreateTs: createTs,
          channelType: tempHost?.channelType,
          tempHost: {
            status: tempHost?.status,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tempHost.id);

    // Update channel temp host
    await supabaseAdmin
      .from('channels')
      .update({
        temp_host: tempHost,
      })
      .eq('id', channel.id);

    // Insert/update temp_hosts table
    await supabaseAdmin
      .from('temp_hosts')
      .upsert({
        channel_id: channel.id,
        user_id: tempHost.id,
        uid: tempHost.uid,
        status: tempHost.status,
        channel_type: tempHost.channelType,
        sub_type: tempHost.subType,
        start_time: tempHost.startTime,
        updated_at: new Date().toISOString(),
      });

    return tempHost;
  }

  /**
   * Update temp host info
   */
  static async updateTempHostInfo({ channelId, createTs, tempHost }: Channel): Promise<any> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({ temp_host: tempHost })
      .eq('id', channel.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update temp host list (rejection/termination)
   */
  static async updateTempHostList({
    channelId,
    createTs,
    tempHost,
    rejectedUserSession,
    rejectedSessionForUser,
  }: {
    channelId: string;
    createTs: number;
    tempHost: TempHost;
    rejectedUserSession: any;
    rejectedSessionForUser: any;
  }): Promise<TempHost> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    // Update user
    const { data: userData, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('rejected_session_list')
      .eq('id', tempHost.id)
      .single();

    if (userFetchError) throw userFetchError;

    const userRejectedList = [...(userData.rejected_session_list || []), rejectedSessionForUser];

    await supabaseAdmin
      .from('users')
      .update({
        available: 0,
        current_user_order: {},
        rejected_session_list: userRejectedList,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tempHost.id);

    // Update channel
    const { data: channelData, error: channelFetchError } = await supabaseAdmin
      .from('channels')
      .select('temp_hosts_list, rejected_session_list')
      .eq('id', channel.id)
      .single();

    if (channelFetchError) throw channelFetchError;

    const tempHostsList = [...(channelData.temp_hosts_list || []), tempHost];
    const rejectedSessionList = [...(channelData.rejected_session_list || []), rejectedUserSession];

    await supabaseAdmin
      .from('channels')
      .update({
        temp_host: {},
        temp_hosts_list: tempHostsList,
        rejected_session_list: rejectedSessionList,
      })
      .eq('id', channel.id);

    // Update temp_hosts table
    await supabaseAdmin
      .from('temp_hosts')
      .update({
        status: tempHost.status,
        end_time: tempHost.endTime,
        termination_reason: tempHost.terminationReason,
        updated_at: new Date().toISOString(),
      })
      .eq('channel_id', channel.id)
      .eq('user_id', tempHost.id);

    return tempHost;
  }

  /**
   * Update temp host accepted (create user order, chat session)
   */
  static async updateTempHostAccepted({
    channelId,
    createTs,
    tempHost,
    userOrderData,
    timestamp,
    orderTentativeEndTs,
    chatExist,
  }: {
    channelId: string;
    createTs: number;
    tempHost: TempHost;
    userOrderData: any;
    timestamp: number;
    orderTentativeEndTs: number;
    chatExist: boolean;
  }): Promise<TempHost> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    // Get user and host data
    const userData = await UserDao.getUserById(tempHost.id);
    const hostData = await AstrologerDao.getAstrologerById(channelId);

    // Create user order
    await OrderDao.createUserOrder({
      userId: tempHost.id,
      hostId: channelId,
      hostName: hostData.name,
      userName: userData.name,
      ts: timestamp,
      amount: 0,
      status: 'INITIALIZED',
      orderTentativeEndTs: orderTentativeEndTs,
      orderEndTs: 0,
      channelType: tempHost?.channelType?.toUpperCase(),
    });

    // Update user
    await supabaseAdmin
      .from('users')
      .update({
        available: 1,
        current_user_order: {
          channelId: channelId,
          userOrderTs: timestamp,
          channelCreateTs: createTs,
          channelType: tempHost?.channelType?.toUpperCase(),
          tempHost: {
            status: tempHost?.status,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tempHost.id);

    // Handle chat session
    let chatId: string;
    const sortedUserListString = [channelId, tempHost.id].sort().join('#');

    if (!chatExist) {
      const chatSession = await ChatDao.initializeChat({
        id: '',
        status: 'ACTIVE',
        userList: sortedUserListString,
        users: [
          { id: tempHost.id, role: 'USER', lastRead: timestamp, lastReceived: timestamp },
          { id: channelId, role: 'ASTROLOGER', lastRead: timestamp, lastReceived: timestamp },
        ],
      });
      chatId = chatSession.id;
    } else {
      const existingChats = await ChatDao.getChatKeyByUserIds({ userIdListStr: sortedUserListString });
      if (existingChats.length > 0) {
        chatId = existingChats[0].id;
        await ChatDao.updateChatSessionStatus({ id: chatId, status: 'ACTIVE' });
      } else {
        chatId = '';
      }
    }

    // Update channel temp host
    await supabaseAdmin
      .from('channels')
      .update({
        temp_host: { ...tempHost, chatId },
      })
      .eq('id', channel.id);

    // Update temp_hosts table
    await supabaseAdmin
      .from('temp_hosts')
      .update({
        status: tempHost.status,
        chat_id: chatId,
        updated_at: new Date().toISOString(),
      })
      .eq('channel_id', channel.id)
      .eq('user_id', tempHost.id);

    return { ...tempHost, chatId };
  }

  /**
   * Update temp host terminated
   */
  static async updateTempHostTerminatedList({
    channelId,
    createTs,
    tempHost,
    balance,
    hostProfileUpdated,
    userOrderData,
    timeSpent,
    channelDisable,
    userAstrologerChatId,
  }: {
    channelId: string;
    createTs: number;
    tempHost: TempHost;
    balance: number;
    hostProfileUpdated: any;
    userOrderData: any;
    timeSpent: number;
    channelDisable: boolean;
    userAstrologerChatId: string;
    returnParams?: boolean;
  }): Promise<TempHost> {
    const channel = await this.findChannelByIdAndTs(channelId, createTs);
    if (!channel) throw new Error('Channel not found');

    // Update chat session status
    if (userAstrologerChatId) {
      await supabaseAdmin
        .from('chat_sessions')
        .update({ status: 'INACTIVE' })
        .eq('id', userAstrologerChatId);
    }

    // Update user
    await supabaseAdmin
      .from('users')
      .update({
        available: 0,
        current_user_order: {},
        balance: balance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tempHost.id);

    // Update channel
    const { data: channelData, error: channelFetchError } = await supabaseAdmin
      .from('channels')
      .select('temp_hosts_list')
      .eq('id', channel.id)
      .single();

    if (channelFetchError) throw channelFetchError;

    const tempHostsList = [...(channelData.temp_hosts_list || []), tempHost];

    await supabaseAdmin
      .from('channels')
      .update({
        temp_host: {},
        temp_hosts_list: tempHostsList,
      })
      .eq('id', channel.id);

    // Update astrologer
    const astrologerUpdate: any = {
      host_profile: hostProfileUpdated,
      updated_at: new Date().toISOString(),
    };

    if (channelDisable) {
      astrologerUpdate.available = 0;
      astrologerUpdate.is_available = false;
    }

    await supabaseAdmin
      .from('astrologers')
      .update(astrologerUpdate)
      .eq('id', channelId);

    // Create astrologer order if user order exists
    if (userOrderData.ts) {
      await OrderDao.createAstrologerOrder({
        astrologerId: channelId,
        customerId: tempHost.id,
        timeSpent: timeSpent,
        orderTs: tempHost?.endTime || Date.now(),
        orderType: tempHost?.channelType,
        subOrderType: tempHost?.subType,
        amount: userOrderData.amount,
      });

      // Update user order
      await OrderDao.updateUserOrder(tempHost.id, userOrderData.ts, {
        status: userOrderData.status,
        amount: userOrderData.amount,
        orderEndTs: tempHost?.endTime || Date.now(),
      });
    }

    // Update temp_hosts table
    await supabaseAdmin
      .from('temp_hosts')
      .update({
        status: tempHost.status || 'TERMINATED',
        end_time: tempHost.endTime,
        termination_reason: tempHost.terminationReason,
        updated_at: new Date().toISOString(),
      })
      .eq('channel_id', channel.id)
      .eq('user_id', tempHost.id);

    return tempHost;
  }

  // ============================================================
  // VIEWER OPERATIONS
  // ============================================================

  /**
   * Join channel (viewer)
   */
  static async joinChannel(channelId: string, userId: string): Promise<any> {
    const { error: viewerError } = await supabaseAdmin
      .from('channel_viewers')
      .upsert({
        channel_id: channelId,
        user_id: userId,
        joined_at: new Date().toISOString(),
      });

    if (viewerError && viewerError.code !== '23505') {
      throw viewerError;
    }

    // Increment viewer count
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('channels')
      .select('viewer_count, max_viewers')
      .eq('id', channelId)
      .single();

    if (fetchError) throw fetchError;

    const newViewerCount = (channel.viewer_count || 0) + 1;
    const newMaxViewers = Math.max(channel.max_viewers || 0, newViewerCount);

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({
        viewer_count: newViewerCount,
        max_viewers: newMaxViewers,
      })
      .eq('id', channelId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Leave channel (viewer)
   */
  static async leaveChannel(channelId: string, userId: string): Promise<any> {
    await supabaseAdmin
      .from('channel_viewers')
      .update({ left_at: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('channels')
      .select('viewer_count')
      .eq('id', channelId)
      .single();

    if (fetchError) throw fetchError;

    const newViewerCount = Math.max(0, (channel.viewer_count || 0) - 1);

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({ viewer_count: newViewerCount })
      .eq('id', channelId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get channel viewers
   */
  static async getChannelViewers(channelId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('channel_viewers')
      .select(`
        *,
        user:users(id, username, profile_image)
      `)
      .eq('channel_id', channelId)
      .is('left_at', null);

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // GIFT OPERATIONS
  // ============================================================

  /**
   * Send gift in channel
   */
  static async sendGift(giftData: {
    channel_id: string;
    sender_id: string;
    receiver_id: string;
    gift_id: string;
    quantity?: number;
  }): Promise<any> {
    const { data: gift, error: giftError } = await supabaseAdmin
      .from('gifts')
      .select('price')
      .eq('id', giftData.gift_id)
      .single();

    if (giftError) throw giftError;

    const quantity = giftData.quantity || 1;
    const totalAmount = Number(gift.price) * quantity;

    // Check sender balance
    const { data: sender, error: senderError } = await supabaseAdmin
      .from('users')
      .select('balance')
      .eq('id', giftData.sender_id)
      .single();

    if (senderError) throw senderError;

    if (Number(sender.balance) < totalAmount) {
      throw new Error('Insufficient balance');
    }

    // Create gift transaction
    const { data, error } = await supabaseAdmin
      .from('gift_transactions')
      .insert({
        ...giftData,
        quantity,
        total_amount: totalAmount,
      })
      .select()
      .single();

    if (error) throw error;

    // Deduct from sender
    await UserDao.updateUserBalanceWithTransaction(
      giftData.sender_id,
      totalAmount,
      'debit',
      'Gift sent in channel',
      data.id,
      'GIFT_SENT'
    );

    // Credit to receiver (70% to astrologer)
    await UserDao.updateUserBalanceWithTransaction(
      giftData.receiver_id,
      totalAmount * 0.7,
      'credit',
      'Gift received in channel',
      data.id,
      'GIFT_RECEIVED'
    );

    return data;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Get next channel token
   */
  static async nextChannelToken(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .rpc('get_next_sequence', { seq_name: 'channel_token' });

    if (error) throw error;
    return data;
  }

  /**
   * Get or create recording session
   * NOTE: Query by session_type and metadata instead of user_id because
   * user_id is UUID type and can't accept non-UUID strings like "RECORDING_xxx"
   */
  private static async getOrCreateRecordingSession(channelId: string, deviceId: string): Promise<any> {
    // Query by session_type and metadata instead of user_id (which is UUID type)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('session_type', 'RECORDING')
      .eq('device_id', deviceId)
      .contains('metadata', { channelId })
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existing) return existing;

    // Create new session
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: null,
        device_id: deviceId,
        uid: Math.floor(Math.random() * 1000000),
        session_type: 'RECORDING',
        status: 'ACTIVE',
        metadata: { channelId },
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find channel by ID and timestamp
   */
  private static async findChannelByIdAndTs(channelId: string, createTs: number): Promise<any> {
    // Try by agora_channel_name
    let { data, error } = await supabaseAdmin
      .from('channels')
      .select('*')
      .eq('agora_channel_name', channelId)
      .eq('create_ts', createTs)
      .single();

    if (error?.code === 'PGRST116') {
      // Try by host_id
      const result = await supabaseAdmin
        .from('channels')
        .select('*')
        .eq('host_id', channelId)
        .eq('create_ts', createTs)
        .single();
      data = result.data;
    }

    return data;
  }

  /**
   * Map Supabase data to Channel format
   */
  private static mapToChannel(data: any): Channel {
    if (!data) return {} as Channel;

    // Build host object with proper name field
    const hostData = data.host || {};
    const userData = hostData.user || {};
    
    const host = {
      id: hostData.id || data.host_id,
      uid: data.host_uid,
      name: hostData.display_name || hostData.name || userData.username || userData.name || 'Unknown',
      displayName: hostData.display_name,
      rating: hostData.rating,
      totalReviews: hostData.total_reviews,
      profileImage: hostData.host_profile?.profilePicture || userData.profile_image,
      hostProfile: hostData.host_profile,
      specialties: hostData.specialties,
      languages: hostData.languages,
      chatRate: hostData.chat_rate,
      callRate: hostData.call_rate,
      hourlyRate: hostData.hourly_rate,
      isOnline: hostData.is_online,
      isAvailable: hostData.is_available,
    };

    return {
      channelId: data.agora_channel_name || data.host_id || data.id,
      channelType: data.channel_type || 'LIVESTREAM',
      host,
      rate: Number(data.rate) || 0,
      channelName: data.title,
      recordingUid: data.recording_uid,
      offer: Number(data.offer) || 0,
      rejectedSessionList: data.rejected_session_list || [],
      createTs: data.create_ts || new Date(data.created_at).getTime(),
      channelStatus: data.status === 'LIVE' ? 'ACTIVE' : data.status,
      channelToken: data.channel_token,
      waitlist: [],
      tempHost: data.temp_host || {},
      tempHostsList: data.temp_hosts_list || [],
      ranking: data.ranking || 100,
      approxWaitTime: data.approx_wait_time || 0,
      viewerCount: data.viewer_count || 0,
      tags: hostData.tags || [],
    };
  }
}

// Export individual functions for backwards compatibility
export const enableHostChannel = ChannelDao.enableHostChannel.bind(ChannelDao);
export const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
export const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
export const getLatestOnlineHostChannelList = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
export const getAllOnlineChannels = ChannelDao.getAllOnlineChannels.bind(ChannelDao);
export const getChannelByChannelStatusName = ChannelDao.getChannelByChannelStatusName.bind(ChannelDao);
export const updateChannelStatus = ChannelDao.updateChannelStatus.bind(ChannelDao);
export const updateChannelOffer = ChannelDao.updateChannelOffer.bind(ChannelDao);
export const updateChannelApproxTime = ChannelDao.updateChannelApproxTime.bind(ChannelDao);
export const disableHostChannel = ChannelDao.disableHostChannel.bind(ChannelDao);
export const updateWaitlist = ChannelDao.updateWaitlist.bind(ChannelDao);
export const updateTempHost = ChannelDao.updateTempHost.bind(ChannelDao);
export const updateTempHostInfo = ChannelDao.updateTempHostInfo.bind(ChannelDao);
export const updateTempHostList = ChannelDao.updateTempHostList.bind(ChannelDao);
export const updateTempHostAccepted = ChannelDao.updateTempHostAccepted.bind(ChannelDao);
export const updateTempHostTerminatedList = ChannelDao.updateTempHostTerminatedList.bind(ChannelDao);
export const nextChannelToken = ChannelDao.nextChannelToken.bind(ChannelDao);
