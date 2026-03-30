import React, { useState, useEffect } from 'react';
import { User, UserFormData, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { Edit, Trash2, Plus, X, Loader2, Save } from 'lucide-react';

interface UserManagementProps {
  onClose: () => void;
  currentUser: User;
}

const UserManagement: React.FC<UserManagementProps> = ({ onClose, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    name: '',
    role: 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, name, role')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '', // Don't show existing password
        name: user.name,
        role: user.role
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        name: '',
        role: 'user'
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        // Update
        const updateData: any = {
          name: formData.name,
          role: formData.role
        };
        // Only update password if provided
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);
          
        if (error) throw error;
        setSuccess('Cập nhật người dùng thành công');
      } else {
        // Create
        if (!formData.password) {
          throw new Error('Vui lòng nhập mật khẩu cho người dùng mới');
        }
        
        const { error } = await supabase
          .from('users')
          .insert([{
            username: formData.username,
            password: formData.password,
            name: formData.name,
            role: formData.role
          }]);
          
        if (error) throw error;
        setSuccess('Thêm người dùng thành công');
      }
      
      setIsFormOpen(false);
      fetchUsers();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu người dùng');
    } finally {
      setLoading(false);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string, username: string) => {
    if (username === 'admin') {
      setError('Không thể xóa tài khoản admin mặc định');
      return;
    }
    
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', deleteConfirmId);
        
      if (error) throw error;
      setUsers(users.filter(u => u.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa người dùng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-bold text-[#003b5c]">Quản Lý Tài Khoản</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded text-sm">
              {success}
            </div>
          )}

          {!isFormOpen ? (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => handleOpenForm()}
                  className="bg-[#003b5c] text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-[#002a42] transition text-sm font-medium"
                >
                  <Plus size={16} /> Thêm Tài Khoản
                </button>
              </div>

              {loading && users.length === 0 ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-[#003b5c]" size={32} />
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 border-b">Tài khoản</th>
                        <th className="px-4 py-3 border-b">Họ tên</th>
                        <th className="px-4 py-3 border-b">Vai trò</th>
                        <th className="px-4 py-3 border-b text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{user.username}</td>
                          <td className="px-4 py-3">{user.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === 'admin' ? 'bg-red-100 text-red-800' :
                              user.role === 'subadmin' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role === 'admin' ? 'Quản Trị Viên' : 
                               user.role === 'subadmin' ? 'Phó Ban Quản Lý' : 'Chuyên Viên'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleOpenForm(user)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Sửa"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => user.id && handleDelete(user.id, user.username)}
                                disabled={user.username === 'admin'}
                                className={`p-1.5 rounded transition ${
                                  user.username === 'admin' 
                                    ? 'text-gray-300 cursor-not-allowed' 
                                    : 'text-red-600 hover:bg-red-50'
                                }`}
                                title="Xóa"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && !loading && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            Không có dữ liệu tài khoản
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="max-w-md mx-auto bg-gray-50 p-6 rounded border border-gray-200">
              <h3 className="text-lg font-bold mb-4 text-gray-800">
                {editingUser ? 'Cập Nhật Tài Khoản' : 'Thêm Tài Khoản Mới'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu {editingUser && <span className="text-gray-400 font-normal">(Để trống nếu không đổi)</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                    disabled={editingUser?.username === 'admin'}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="user">Chuyên Viên Tra Cứu (Chỉ xem)</option>
                    <option value="subadmin">Phó Ban Quản Lý (Thêm/Sửa)</option>
                    <option value="admin">Quản Trị Viên (Toàn quyền)</option>
                  </select>
                </div>
                
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-medium transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-[#003b5c] text-white rounded font-medium hover:bg-[#002a42] transition flex items-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Lưu
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa tài khoản này? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-medium transition"
                disabled={loading}
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition flex items-center gap-2"
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
