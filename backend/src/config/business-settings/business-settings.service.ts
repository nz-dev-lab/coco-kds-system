import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessSetting } from '../entities/business-setting.entity';

/**
 * Business Settings Service
 * 
 * Provides helper methods to read settings from business_settings table
 * Used by other services to get configuration values
 */
@Injectable()
export class BusinessSettingsService {
  private readonly logger = new Logger(BusinessSettingsService.name);

  constructor(
    @InjectRepository(BusinessSetting)
    private readonly businessSettingsRepo: Repository<BusinessSetting>,
  ) {}

  /**
   * Get a setting value by key
   * @param key - Setting key to retrieve
   * @returns Setting value as string or null if not found
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      const setting = await this.businessSettingsRepo.findOne({
        where: { key },
      });

      if (!setting) {
        this.logger.debug(`Setting not found: ${key}`);
        return null;
      }

      return setting.value;
    } catch (error) {
      this.logger.error(`Failed to get setting ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Get a setting value and parse as JSON
   * @param key - Setting key to retrieve
   * @returns Parsed JSON object or null
   */
  async getSettingAsJson<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.getSetting(key);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to parse setting ${key} as JSON:`, error.message);
      return null;
    }
  }

  /**
   * Get multiple settings by keys
   * @param keys - Array of setting keys
   * @returns Object with key-value pairs
   */
  async getMultipleSettings(keys: string[]): Promise<Record<string, string | null>> {
    try {
      const settings = await this.businessSettingsRepo
        .createQueryBuilder('setting')
        .where('setting.key IN (:...keys)', { keys })
        .getMany();

      const result: Record<string, string | null> = {};
      
      keys.forEach(key => {
        const setting = settings.find(s => s.key === key);
        result[key] = setting?.value || null;
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to get multiple settings:', error.message);
      return {};
    }
  }

  /**
   * Get Firebase service account credentials
   * Convenience method for the most commonly used setting
   */
  async getFirebaseCredentials(): Promise<any | null> {
    return this.getSettingAsJson('push_notification_service_file_content');
  }

  /**
   * Check if a setting exists
   * @param key - Setting key to check
   * @returns true if setting exists
   */
  async settingExists(key: string): Promise<boolean> {
    try {
      const count = await this.businessSettingsRepo.count({
        where: { key },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(`Failed to check if setting exists ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get all settings (use with caution - can be large)
   * @returns Array of all business settings
   */
  async getAllSettings(): Promise<BusinessSetting[]> {
    try {
      return await this.businessSettingsRepo.find();
    } catch (error) {
      this.logger.error('Failed to get all settings:', error.message);
      return [];
    }
  }
}