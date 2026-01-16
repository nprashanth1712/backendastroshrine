import { supabaseAdmin } from '../services/supabaseClient';

// Types to match DynamoDB structure
type MetaDataType = 'gift' | 'advertisement' | 'avatar' | 'page' | 'config';

interface MetaData {
  id: string;
  name: string;
  metadataType: MetaDataType;
  content: any;
  status: 'ACTIVE' | 'INACTIVE';
  createTs: number;
}

interface GiftMetaDataContent {
  imageUrl: string;
  amount: number;
}

interface AdvertisementMetaDataContent {
  imageUrl: string;
  link?: string;
  position?: number;
}

interface AvatarMetaDataContent {
  imageUrl: string;
}

export class MetadataDao {
  // ============================================================
  // METADATA OPERATIONS
  // ============================================================

  /**
   * Get metadata list by status
   */
  static async getMetadataListByStatus({ status }: { status: 'ACTIVE' | 'INACTIVE' }): Promise<MetaData[]> {
    // In Supabase, metadata is stored in app_metadata table
    const { data, error } = await supabaseAdmin
      .from('app_metadata')
      .select('*');

    if (error) throw error;

    // Filter by status in the value JSON
    return (data || [])
      .filter(item => item.value?.status === status)
      .map(this.mapToMetaData);
  }

  /**
   * Get metadata list by type and status
   */
  static async getMetadataListByTypeStatus({
    metadataType,
    status,
  }: {
    metadataType: string;
    status: 'ACTIVE' | 'INACTIVE';
  }): Promise<MetaData[]> {
    const { data, error } = await supabaseAdmin
      .from('app_metadata')
      .select('*')
      .eq('key', metadataType);

    if (error) throw error;

    // Return the items array from the value, filtered by status
    if (data && data.length > 0) {
      const items = data[0].value?.items || [];
      return items
        .filter((item: any) => item.status === status)
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          metadataType: metadataType as MetaDataType,
          content: item.content,
          status: item.status,
          createTs: item.createTs || Date.now(),
        }));
    }

    return [];
  }

  /**
   * Add metadata
   */
  static async addMetaData({
    id,
    name,
    content,
    metadataType,
  }: {
    id: string;
    name: string;
    content: GiftMetaDataContent | AdvertisementMetaDataContent | AvatarMetaDataContent;
    metadataType: MetaDataType;
  }): Promise<MetaData> {
    const currentTime = Date.now();
    const newItem = {
      id,
      name,
      content,
      status: 'ACTIVE',
      createTs: currentTime,
    };

    // Get existing metadata for this type
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('app_metadata')
      .select('*')
      .eq('key', metadataType)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let items = [];
    if (existing) {
      items = existing.value?.items || [];
      items.push(newItem);

      const { error: updateError } = await supabaseAdmin
        .from('app_metadata')
        .update({
          value: { items },
          updated_at: new Date().toISOString(),
        })
        .eq('key', metadataType);

      if (updateError) throw updateError;
    } else {
      items = [newItem];

      const { error: insertError } = await supabaseAdmin
        .from('app_metadata')
        .insert({
          key: metadataType,
          value: { items },
          description: `${metadataType} metadata`,
        });

      if (insertError) throw insertError;
    }

    return {
      id,
      name,
      metadataType,
      content,
      status: 'ACTIVE',
      createTs: currentTime,
    };
  }

  /**
   * Get metadata by key
   */
  static async getMetadataByKey(key: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('app_metadata')
      .select('*')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data?.value;
  }

  /**
   * Set metadata by key
   */
  static async setMetadataByKey(key: string, value: any, description?: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('app_metadata')
      .upsert({
        key,
        value,
        description,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update metadata item status
   */
  static async updateMetadataItemStatus({
    metadataType,
    itemId,
    status,
  }: {
    metadataType: string;
    itemId: string;
    status: 'ACTIVE' | 'INACTIVE';
  }): Promise<MetaData | null> {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('app_metadata')
      .select('*')
      .eq('key', metadataType)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') return null;
      throw fetchError;
    }

    const items = existing.value?.items || [];
    const itemIndex = items.findIndex((item: any) => item.id === itemId);

    if (itemIndex === -1) return null;

    items[itemIndex].status = status;

    const { error: updateError } = await supabaseAdmin
      .from('app_metadata')
      .update({
        value: { items },
        updated_at: new Date().toISOString(),
      })
      .eq('key', metadataType);

    if (updateError) throw updateError;

    return {
      id: items[itemIndex].id,
      name: items[itemIndex].name,
      metadataType: metadataType as MetaDataType,
      content: items[itemIndex].content,
      status: items[itemIndex].status,
      createTs: items[itemIndex].createTs,
    };
  }

  /**
   * Delete metadata item
   */
  static async deleteMetadataItem({
    metadataType,
    itemId,
  }: {
    metadataType: string;
    itemId: string;
  }): Promise<void> {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('app_metadata')
      .select('*')
      .eq('key', metadataType)
      .single();

    if (fetchError) throw fetchError;

    const items = (existing.value?.items || []).filter((item: any) => item.id !== itemId);

    const { error: updateError } = await supabaseAdmin
      .from('app_metadata')
      .update({
        value: { items },
        updated_at: new Date().toISOString(),
      })
      .eq('key', metadataType);

    if (updateError) throw updateError;
  }

  /**
   * Get all app metadata
   */
  static async getAllMetadata(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('app_metadata')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Map Supabase data to MetaData format
   */
  private static mapToMetaData(data: any): MetaData {
    if (!data) return {} as MetaData;

    return {
      id: data.key,
      name: data.key,
      metadataType: data.key as MetaDataType,
      content: data.value,
      status: data.value?.status || 'ACTIVE',
      createTs: new Date(data.created_at).getTime(),
    };
  }
}

// Export individual functions for backwards compatibility
export const getMetadataListByStatus = MetadataDao.getMetadataListByStatus.bind(MetadataDao);
export const getMetadataListByTypeStatus = MetadataDao.getMetadataListByTypeStatus.bind(MetadataDao);
export const addMetaData = MetadataDao.addMetaData.bind(MetadataDao);
