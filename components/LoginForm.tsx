import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { ShieldCheck, User as UserIcon, Lock } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

// Mock User Database
const MOCK_USERS = [
  { username: 'admin', password: '123', name: 'Quản Trị Viên', role: 'admin' as UserRole },
  { username: 'subadmin', password: '123', name: 'Phó Ban Quản Lý', role: 'subadmin' as UserRole },
  { username: 'user', password: '123', name: 'Chuyên Viên Tra Cứu', role: 'user' as UserRole },
];

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = MOCK_USERS.find(u => u.username === username && u.password === password);
    
    if (user) {
      onLogin({ username: user.username, name: user.name, role: user.role });
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
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
            className="w-full bg-[#003b5c] text-white py-2.5 rounded font-bold uppercase hover:bg-[#002a42] transition shadow-sm mt-2 text-sm"
          >
            Đăng Nhập
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="text-xs text-gray-500 space-y-1">
                <p><b>Tài khoản Demo & Quyền hạn:</b></p>
                <div className="grid grid-cols-1 gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span><b>admin</b> / 123</span>
                        <span className="text-blue-600 font-medium">Toàn quyền (Thêm/Sửa/Xóa/Reset)</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span><b>subadmin</b> / 123</span>
                        <span className="text-green-600 font-medium">Thêm & Sửa (Không Xóa)</span>
                    </div>
                    <div className="flex justify-between">
                        <span><b>user</b> / 123</span>
                        <span className="text-gray-500 font-medium">Chỉ xem & Tìm kiếm</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
      <div className="mt-4 text-xs text-gray-500">
        © 2024 Cổng thông tin đất đai điện tử
      </div>
    </div>
  );
};

export default LoginForm;