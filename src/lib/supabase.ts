import { createClient } from '@supabase/supabase-js';
import { supabaseOptions } from './supabaseConfig';

const supabaseUrl = 'https://jhgbrbarfpvgdaaznldj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoZ2JyYmFyZnB2Z2RhYXpubGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDU4MDMsImV4cCI6MjA3MzYyMTgwM30.QaaMs2MNbD05Lpm_H1qP25FJT3pT_mmPGvhZ1wsJNcA';
// Adicione sua chave service_role aqui (você precisará adicionar ao .env)
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// Gerar um ID único para esta instância do aplicativo
const instanceId = `app-${Math.random().toString(36).substring(2, 9)}`;

// Tabelas do banco de dados
export const TABLES = {
  USERS: 'app_c009c0e4f1_users',
  TICKETS: 'app_c009c0e4f1_tickets',
  CHAT_MESSAGES: 'app_c009c0e4f1_chat_messages',
  CATEGORIES: 'app_c009c0e4f1_categories',
  SUBCATEGORIES: 'app_c009c0e4f1_subcategories',
  TAGS: 'app_c009c0e4f1_tags',
  ROLES: 'app_c009c0e4f1_roles',
  ROLE_PERMISSIONS: 'app_c009c0e4f1_role_permissions',
  DEPARTMENTS: 'app_c009c0e4f1_departments',
};

// Database types
export interface DatabaseUser {
  id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  role: 'user' | 'support' | 'admin' | 'lawyer';
  is_online?: boolean;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseTicket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  subcategory?: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved'; // Removido 'closed'
  created_by: string;
  created_by_name: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_by?: string;
  assigned_at?: string;
  started_at?: string;
  resolved_at?: string;
  // Removido closed_at?: string;
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

// Criar um armazenamento customizado com prefixo único para evitar conflitos
// Logs reduzidos - só mostra operações importantes
const customStorage = {
  getItem: (key: string) => {
    const prefixedKey = `${instanceId}-${key}`;
    const item = localStorage.getItem(prefixedKey);
    // Só logar se não for token de auth (reduzir spam)
    if (!key.includes('auth-token')) {
      console.log(`Storage get: ${prefixedKey} = ${item ? '[data]' : 'null'}`);
    }
    return item;
  },
  setItem: (key: string, value: string) => {
    const prefixedKey = `${instanceId}-${key}`;
    // Só logar se não for token de auth (reduzir spam)
    if (!key.includes('auth-token')) {
      console.log(`Storage set: ${prefixedKey}`);
    }
    localStorage.setItem(prefixedKey, value);
  },
  removeItem: (key: string) => {
    const prefixedKey = `${instanceId}-${key}`;
    console.log(`Storage remove: ${prefixedKey}`);
    localStorage.removeItem(prefixedKey);
  }
};

// ✅ CORREÇÃO: Habilitar detecção de sessão na URL para reset de senha
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // ✅ HABILITADO para permitir reset de senha
    storage: customStorage,
    flowType: 'pkce' // ✅ Usar PKCE flow para maior segurança
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-app-instance': instanceId
    }
  }
});

// Cliente admin com a chave service_role
// ATENÇÃO: Usar a chave service_role no frontend é um RISCO DE SEGURANÇA
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default supabase;