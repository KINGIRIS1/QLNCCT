import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheck, User as UserIcon, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
      } else {
        onLogin({ id: data.id, username: data.username, name: data.name, role: data.role });
      }
    } catch (err) {
      setError('Đã xảy ra lỗi khi kết nối đến máy chủ.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col justify-center items-center font-sans">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md border-t-4 border-[#003b5c]">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-[#003b5c] p-3 rounded-full text-white mb-3">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-xl font-bold text-[#003b5c] uppercase text-center leading-tight">
            Hệ Thống <br/> Quản Lý Ngăn Chặn Đất Đai
          </h1>
          <h2 className="text-md font-bold text-[#003b5c] mt-2 uppercase">Chi nhánh Bình Long</h2>
          <p className="text-gray-500 text-sm mt-2">Đăng nhập hệ thống</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded border border-red-200 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tài khoản</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition text-sm text-gray-900 bg-white"
                placeholder="Nhập tài khoản..."
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition text-sm text-gray-900 bg-white"
                placeholder="Nhập mật khẩu..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#003b5c] text-white py-2.5 rounded font-bold uppercase hover:bg-[#002a42] transition shadow-sm mt-2 text-sm flex justify-center items-center"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Đăng Nhập'}
          </button>
        </form>
      </div>
      <div className="mt-4 text-xs text-gray-500">
        © 2026 Cổng thông tin đất đai điện tử
      </div>
    </div>
  );
};

export default LoginForm;