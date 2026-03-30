import { createClient } from '@supabase/supabase-js';

// --- HƯỚNG DẪN QUAN TRỌNG ---
// Bạn cần thay thế 2 giá trị dưới đây bằng thông tin từ Project Supabase của bạn.
// Vào: Project Settings -> API -> Lấy URL và "anon public" Key.

const SUPABASE_URL = 'https://ogrronmwdpryokbyoeda.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncnJvbm13ZHByeW9rYnlvZWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDgwMjMsImV4cCI6MjA5MDQyNDAyM30.D91hzb7jEtrN1l72qTB1H4Cm63ImiRQDX_ffI5IVw3o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);