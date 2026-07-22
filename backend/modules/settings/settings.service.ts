/**
 * @file backend/modules/settings/settings.service.ts
 * @description Services for user-specific notification preferences and system-wide configurations.
 */

import { db } from "../../../database/db";
import { notificationSettings, systemSettings } from "../../../database/schema/auth.schema";
import { eq } from "drizzle-orm";

export class SettingsService {
  /**
   * Get notification settings for a user.
   */
  async getNotificationSettings(userId: number) {
    let settings = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1)
      .then((rows) => rows[0]);

    // If not found, create default
    if (!settings) {
      const newSettings = {
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        absentAlertEnabled: true,
        attendanceConfirmEnabled: true,
        lowAttendanceEnabled: true,
        reportEmailEnabled: false,
        updatedAt: new Date(),
      };
      
      const inserted = await db
        .insert(notificationSettings)
        .values(newSettings)
        .returning();
      
      settings = inserted[0];
    }
    return settings;
  }

  /**
   * Update notification settings for a user.
   */
  async updateNotificationSettings(userId: number, data: Partial<typeof notificationSettings.$inferInsert>) {
    // Ensure row exists
    await this.getNotificationSettings(userId);

    const updated = await db
      .update(notificationSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notificationSettings.userId, userId))
      .returning();

    return updated[0];
  }

  /**
   * Get all system settings.
   */
  async getSystemSettings() {
    return db.select().from(systemSettings);
  }

  /**
   * Get a specific system setting by key.
   */
  async getSystemSetting(key: string, defaultValue?: any) {
    const setting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1)
      .then((rows) => rows[0]);

    return setting ? setting.value : defaultValue;
  }

  /**
   * Update or create a system setting.
   */
  async setSystemSetting(key: string, value: any, category = "general", description = "", updatedBy?: number) {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      const updated = await db
        .update(systemSettings)
        .set({
          value,
          description: description || existing.description,
          category: category || existing.category,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(systemSettings)
        .values({
          key,
          value,
          category,
          description,
          updatedAt: new Date(),
          updatedBy,
        })
        .returning();
      return inserted[0];
    }
  }
}

export const settingsService = new SettingsService();
