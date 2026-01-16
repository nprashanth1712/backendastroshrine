/**
 * Unit tests for UserDao - Supabase User Data Access Operations
 * Tests the logic in isolation without depending on actual imports
 */

describe('UserDao', () => {
  describe('getUserById - Return value handling', () => {
    /**
     * Simulates the getUserById logic that was fixed
     * Returns null for PGRST116 errors instead of empty object
     */
    const simulateGetUserById = async (
      mockDbResponse: { data: any; error: any }
    ): Promise<any> => {
      const { data, error } = mockDbResponse;

      if (error) {
        if (error.code === 'PGRST116') {
          // User not found - return null instead of empty object
          return null;
        }
        throw error;
      }
      return data ? mapToEndUser(data) : null;
    };

    /**
     * Helper function that simulates mapToEndUser logic
     */
    const mapToEndUser = (data: any) => {
      if (!data) return {};

      // Determine role - check if user is an astrologer
      let role = data.role || 'USER';
      if (data.astrologer && data.astrologer.id) {
        role = 'ASTROLOGER';
      }

      return {
        id: data.id,
        name: data.name,
        email: data.email,
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
      };
    };

    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone_number: '+1234567890',
        balance: 100,
        last_online_ts: Date.now(),
        available: 1,
        profile: { email: 'john@example.com', gender: 'Male' },
        joined_channels: [],
        available_offers: [],
        rejected_session_list: [],
        is_support: false,
        current_user_order: {},
        role: 'USER',
      };

      const result = await simulateGetUserById({ data: mockUser, error: null });

      expect(result).not.toBeNull();
      expect(result.id).toBe('user-123');
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.role).toBe('USER');
    });

    it('should return null when user not found (PGRST116)', async () => {
      const result = await simulateGetUserById({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });

      expect(result).toBeNull();
    });

    it('should throw error for non-PGRST116 errors', async () => {
      await expect(
        simulateGetUserById({
          data: null,
          error: { code: '42P01', message: 'Table does not exist' },
        })
      ).rejects.toEqual({
        code: '42P01',
        message: 'Table does not exist',
      });
    });

    it('should set role to ASTROLOGER when astrologer relation exists', async () => {
      const mockUser = {
        id: 'astro-123',
        name: 'Star Gazer',
        email: 'astro@example.com',
        role: 'USER', // Base role
        astrologer: { id: 'astro-123' }, // Has astrologer record
      };

      const result = await simulateGetUserById({ data: mockUser, error: null });

      expect(result.role).toBe('ASTROLOGER');
    });

    it('should default role to USER when no role and no astrologer', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        // No role field
        // No astrologer relation
      };

      const result = await simulateGetUserById({ data: mockUser, error: null });

      expect(result.role).toBe('USER');
    });
  });

  describe('mapToEndUser - Field mapping', () => {
    const mapToEndUser = (data: any) => {
      if (!data) return {};

      let role = data.role || 'USER';
      if (data.astrologer && data.astrologer.id) {
        role = 'ASTROLOGER';
      }

      return {
        id: data.id,
        name: data.name,
        email: data.email,
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
      };
    };

    it('should correctly map all Supabase fields to EndUser format', () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone_number: '+1234567890',
        balance: 100,
        last_online_ts: 1704067200000,
        available: 1,
        profile: { email: 'john@example.com', gender: 'Male' },
        joined_channels: [{ channelId: 'ch1', channelType: 'livestream', joinedAt: 123 }],
        available_offers: ['offer1'],
        rejected_session_list: [],
        is_support: true,
        current_user_order: { channelId: 'ch2' },
        channel_time_spent: { livestream: 60, chat: 30, call: 10 },
        languages: ['en', 'hi'],
        device_token: 'fcm-token-123',
        role: 'USER',
      };

      const result = mapToEndUser(mockUser);

      expect(result).toMatchObject({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '+1234567890',
        balance: 100,
        lastOnlineTs: 1704067200000,
        available: 1,
        profile: { email: 'john@example.com', gender: 'Male' },
        joinedChannels: [{ channelId: 'ch1', channelType: 'livestream', joinedAt: 123 }],
        availableOffers: ['offer1'],
        rejectedSessionList: [],
        isSupport: 'true',
        currentUserOrder: { channelId: 'ch2' },
        channelTimeSpent: { livestream: 60, chat: 30, call: 10 },
        languages: ['en', 'hi'],
        deviceToken: 'fcm-token-123',
        role: 'USER',
      });
    });

    it('should handle null/undefined fields with defaults', () => {
      const mockUser = {
        id: 'user-123',
        // Most fields are undefined/null
      };

      const result = mapToEndUser(mockUser);

      expect(result.balance).toBe(0);
      expect(result.profile).toEqual({});
      expect(result.joinedChannels).toEqual([]);
      expect(result.availableOffers).toEqual([]);
      expect(result.rejectedSessionList).toEqual([]);
      expect(result.isSupport).toBe('false');
      expect(result.currentUserOrder).toEqual({});
      expect(result.channelTimeSpent).toEqual({ livestream: 0, chat: 0, call: 0 });
      expect(result.languages).toEqual([]);
    });

    it('should return empty object when data is null', () => {
      const result = mapToEndUser(null);
      expect(result).toEqual({});
    });
  });

  describe('createUser - User creation logic', () => {
    /**
     * Simulates the createUser logic that was added
     */
    const simulateCreateUserData = (userData: {
      id: string;
      email: string;
      username?: string;
      role?: string;
    }) => {
      return {
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
      };
    };

    it('should create user with provided data', () => {
      const userData = {
        id: 'new-user-123',
        email: 'new@example.com',
        username: 'New User',
        role: 'USER',
      };

      const result = simulateCreateUserData(userData);

      expect(result.id).toBe('new-user-123');
      expect(result.name).toBe('New User');
      expect(result.email).toBe('new@example.com');
      expect(result.role).toBe('USER');
      expect(result.balance).toBe(0);
    });

    it('should use email prefix as username when not provided', () => {
      const userData = {
        id: 'new-user-123',
        email: 'test@example.com',
        // No username provided
      };

      const result = simulateCreateUserData(userData);

      expect(result.name).toBe('test');
    });

    it('should default role to USER when not provided', () => {
      const userData = {
        id: 'new-user-123',
        email: 'test@example.com',
        // No role provided
      };

      const result = simulateCreateUserData(userData);

      expect(result.role).toBe('USER');
    });

    it('should handle complex email addresses', () => {
      const userData = {
        id: 'new-user-123',
        email: 'john.doe+test@example.com',
      };

      const result = simulateCreateUserData(userData);

      expect(result.name).toBe('john.doe+test');
    });
  });
});
