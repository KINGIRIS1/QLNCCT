import { createClient } from '@supabase/supabase-js';

// --- HƯỚNG DẪN QUAN TRỌNG ---
// Bạn cần thay thế 2 giá trị dưới đây bằng thông tin từ Project Supabase của bạn.
// Vào: Project Settings -> API -> Lấy URL và "anon public" Key.

const SUPABASE_URL = 'https://dajjhubrhybodggbqapt.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhampodWJyaHlib2RnZ2JxYXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzM3MDUsImV4cCI6MjA4MDM0OTcwNX0.Te4JGaR7DnSiejugyZHV0_uQSWsG_TS_xTmRgxgM5-4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);