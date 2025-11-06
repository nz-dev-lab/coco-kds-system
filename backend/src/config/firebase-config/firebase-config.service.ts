import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { BusinessSetting } from '../entities/business-setting.entity';

/**
 * Firebase Configuration Service
 * 
 * Responsibilities:
 * - Load Firebase credentials from business_settings table
 * - Initialize Firebase Admin SDK on app startup
 * - Provide Firebase Messaging instance to other services
 */
@Injectable()
export class FirebaseConfigService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseConfigService.name);
  private firebaseApp: admin.app.App | null = null;
  private isInitialized = false;

  constructor(
    @InjectRepository(BusinessSetting)
    private readonly businessSettingsRepo: Repository<BusinessSetting>,
  ) {
    this.logger.log('🔧 FirebaseConfigService constructor called');
  }

  /**
   * Initialize Firebase on module startup
   */
  async onModuleInit() {
    try {
      await this.initializeFirebase();
    } catch (error) {
      this.logger.error('Failed to initialize Firebase on startup:', error.message);
      // Don't throw - allow app to start even if Firebase fails
      // Notifications just won't work until Firebase is configured
    }
  }

  /**
   * Initialize Firebase Admin SDK with credentials from database
   */
  private async initializeFirebase(): Promise<void> {
    try {
      this.logger.log('🔥 Initializing Firebase from database...');

      // Fetch Firebase service account from business_settings table
      const setting = await this.businessSettingsRepo.findOne({
        where: { key: 'push_notification_service_file_content' },
      });

      if (!setting || !setting.value) {
        this.logger.warn('⚠️  Firebase credentials not found in business_settings table');
        this.logger.warn('Key: push_notification_service_file_content');
        return;
      }

      // Parse the JSON service account
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(setting.value);
      } catch (parseError) {
        this.logger.error('Failed to parse Firebase credentials JSON:', parseError.message);
        return;
      }

      // Validate required fields
      const requiredFields = ['project_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !serviceAccount[field]);
      
      if (missingFields.length > 0) {
        this.logger.error(`Missing required Firebase fields: ${missingFields.join(', ')}`);
        return;
      }

      // Check if already initialized
      if (this.isInitialized && this.firebaseApp) {
        this.logger.log('Firebase already initialized, skipping...');
        return;
      }

      // Initialize Firebase Admin SDK
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
      });

      this.isInitialized = true;

      this.logger.log(`✅ Firebase initialized successfully!`);
      this.logger.log(`   Project ID: ${serviceAccount.project_id}`);
      this.logger.log(`   Client Email: ${serviceAccount.client_email}`);
    } catch (error) {
      this.logger.error('❌ Firebase initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Get Firebase app instance
   * @throws Error if Firebase is not initialized
   */
  getFirebaseApp(): admin.app.App {
    if (!this.firebaseApp || !this.isInitialized) {
      throw new Error('Firebase is not initialized. Check logs for initialization errors.');
    }
    return this.firebaseApp;
  }

  /**
   * Get Firebase Messaging instance for sending notifications
   * @throws Error if Firebase is not initialized
   */
  getMessaging(): admin.messaging.Messaging {
    return this.getFirebaseApp().messaging();
  }

  /**
   * Check if Firebase is ready to use
   */
  isFirebaseReady(): boolean {
    return this.isInitialized && this.firebaseApp !== null;
  }

  /**
   * Reload Firebase credentials (useful if they change)
   * Deletes existing app and reinitializes
   */
  async reloadCredentials(): Promise<void> {
    this.logger.log('🔄 Reloading Firebase credentials...');
    
    if (this.firebaseApp) {
      await this.firebaseApp.delete();
      this.firebaseApp = null;
      this.isInitialized = false;
    }

    await this.initializeFirebase();
  }
}