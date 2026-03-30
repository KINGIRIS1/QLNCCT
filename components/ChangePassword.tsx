import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../supabaseClient';
import { X, Loader2, Save, Lock } from 'lucide-react';

interface ChangePasswordProps {
  user: User;
  onClose: () => void;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ user, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp');
      return;
    }

    if (newPassword.length < 3) {
      setError('Mật khẩu mới phải có ít nhất 3 ký tự');
      return;
    }

    setLoading(true);

    try {
      // Xác thực mật khẩu cũ
      const { data: authData, error: authError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .eq('password', currentPassword)
        .single();

      if (authError || !authData) {
        throw new Error('Mật khẩu hiện tại không chính xác');
      }

      // Cập nhật mật khẩu mới
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Lỗi khi đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-bold text-[#003b5c] flex items-center gap-2">
            <Lock size={20} /> Đổi Mật Khẩu
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded text-sm text-center font-medium">
              Đổi mật khẩu thành công! Đang đóng...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập mật khẩu hiện tại..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập mật khẩu mới..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập lại mật khẩu mới..."
              />
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-medium transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading || success}
                className="px-4 py-2 bg-[#003b5c] text-white rounded font-medium hover:bg-[#002a42] transition flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Đổi Mật Khẩu
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
