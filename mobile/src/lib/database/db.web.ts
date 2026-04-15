// Web stub for database module — expo-sqlite is native-only.
// This file is used by Metro on web platform instead of db.ts.
import { DailyEntry, AppSettings, CustomSport, UserProfile, DEFAULT_SETTINGS } from './types';

const now = new Date().toISOString();

const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 1,
  ...DEFAULT_SETTINGS,
  createdAt: now,
  updatedAt: now,
};

export const initializeDatabase = async (): Promise<void> => {};

export const getDailyEntry = async (_date: string): Promise<DailyEntry | null> => null;

export const getAllDailyEntries = async (): Promise<DailyEntry[]> => [];

export const saveDailyEntry = async (_entry: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {};

export const deleteDailyEntry = async (_date: string): Promise<void> => {};

export const getSettings = async (): Promise<AppSettings | null> => DEFAULT_APP_SETTINGS;

export const updateSettings = async (_settings: Partial<Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {};

export const getAllCustomSports = async (): Promise<CustomSport[]> => [];

export const addCustomSport = async (_name: string): Promise<void> => {};

export const deleteCustomSport = async (_id: number): Promise<void> => {};

export const hasAnyUser = async (): Promise<boolean> => false;

export const getActiveUser = async (): Promise<UserProfile | null> => null;

export const getAllUsers = async (): Promise<UserProfile[]> => [];

export const createUser = async (_name: string): Promise<UserProfile | null> => null;

export const switchUser = async (_userId: number): Promise<boolean> => false;

export const getActiveUserId = (): number | null => null;

export const refreshActiveUserCache = async (): Promise<void> => {};

export const addCustomVariableColumn = async (_variableId: string): Promise<string> => '';

export const removeCustomVariableColumn = async (_variableId: string): Promise<void> => {};

export const getCustomVariableColumns = async (): Promise<{ id: string; columnName: string }[]> => [];

export const getCustomVariableValue = async (_date: string, _columnName: string): Promise<number> => 0;

export const getAllCustomVariableValues = async (_columnNames: string[]): Promise<Record<string, Record<string, number>>> => ({});

export const saveCustomVariableValue = async (_date: string, _columnName: string, _value: number): Promise<void> => {};

export default {} as any;
