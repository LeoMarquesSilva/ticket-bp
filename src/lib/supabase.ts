import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhgbrbarfpvgdaaznldj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoZ2JyYmFyZnB2Z2RhYXpubGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDU4MDMsImV4cCI6MjA3MzYyMTgwM30.QaaMs2MNbD05Lpm_H1qP25FJT3pT_mmPGvhZ1wsJNcA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database table names
export const TABLES = {
  USERS: 'app_c009c0e4f1_users',
  TICKETS: 'app_c009c0e4f1_tickets',
  CHAT_MESSAGES: 'app_c009c0e4f1_chat_messages',
};

// Database types
export interface DatabaseUser {
  id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  role: 'user' | 'support' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface DatabaseTicket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  created_by: string;
  created_by_name: string;
  assigned_to?: string;
  assigned_by?: string;
  assigned_at?: string;
  started_at?: string;
  resolved_at?: string;
  closed_at?: string;
  reopened_at?: string;
  nps_score?: number;
  nps_feedback?: string;
  nps_submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseChatMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}