import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessSetting } from './entities/business-setting.entity';
import { FirebaseConfigService } from './firebase-config/firebase-config.service';
import { BusinessSettingsService } from './business-settings/business-settings.service';

/**
 * Config Module
 * 
 * Marked as @Global() so it's available everywhere without importing
 * 
 * Provides:
 * - Firebase initialization and messaging
 * - Business settings access
 * 
 * Usage in other modules:
 * 
 * @Injectable()
 * export class SomeService {
 *   constructor(
 *     private firebaseConfig: FirebaseConfigService,
 *     private businessSettings: BusinessSettingsService,
 *   ) {}
 * }
 */
@Global()
@Module({
  imports: [
    // Register BusinessSetting entity with TypeORM
    TypeOrmModule.forFeature([BusinessSetting]),
  ],
  providers: [
    FirebaseConfigService,
    BusinessSettingsService,
  ],
  exports: [
    // Export services so other modules can use them
    FirebaseConfigService,
    BusinessSettingsService,
  ],
})
export class AppConfigModule {}