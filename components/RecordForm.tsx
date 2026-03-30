import React, { useState, useEffect } from 'react';
import { LandRecord, LandRecordFormData, BlockingDocument, User } from '../types';
import { Plus, Trash2, X, Save, AlertCircle, FileText } from 'lucide-react';

interface RecordFormProps {
  initialData?: LandRecord;
  currentUser: User; // Thêm prop này để biết ai đang nhập
  onSubmit: (data: LandRecordFormData) => void;
  onCancel: () => void;
}

// Dữ liệu danh sách xã/phường (Giống như trong App.tsx để đồng bộ)
const PREDEFINED_NEW_COMMUNES = [
  'Chơn Thành', 
  'Minh Hưng', 
  'Nha Bích'
].sort((a, b) => a.localeCompare(b, 'vi'));

const PREDEFINED_OLD_COMMUNES = [
  'Hưng Long',
  'Minh Hưng',
  'Minh Lập',
  'Minh Long',
  'Minh Thắng',
  'Minh Thành',
  'Nha Bích',
  'Thành Tâm'
].sort((a, b) => a.localeCompare(b, 'vi'));

const RecordForm: React.FC<RecordFormProps> = ({ initialData, currentUser, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<LandRecordFormData>({
    owners: [''],
    issueNumber: '',
    certNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    area: 0,
    plotNumber: '',
    mapSheetNumber: '',
    hamlet: '',
    oldCommune: '',
    newCommune: '',
    blockingDocuments: [{ docNumber: '', date: new Date().toISOString().split('T')[0], agency: '', note: '' }],
    unblockDoc: '',
    notes: '',
    isUnblocked: false,
    createdBy: currentUser.name, // Mặc định lấy tên người đăng nhập
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        // Đảm bảo các trường date không bị null/undefined khi load vào form
        issueDate: initialData.issueDate || '',
        blockingDocuments: initialData.blockingDocuments.map(d => ({
            ...d,
            date: d.date || ''
        })),
        createdBy: initialData.createdBy || currentUser.name // Giữ nguyên người tạo cũ hoặc lấy user hiện tại nếu chưa có
      });
    }
  }, [initialData, currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // --- Owners Logic ---
  const handleOwnerChange = (index: number, value: string) => {
    const newOwners = [...formData.owners];
    newOwners[index] = value;
    setFormData(prev => ({ ...prev, owners: newOwners }));
  };

  const addOwnerField = () => {
    setFormData(prev => ({ ...prev, owners: [...prev.owners, ''] }));
  };

  const removeOwnerField = (index: number) => {
    if (formData.owners.length > 1) {
      const newOwners = formData.owners.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, owners: newOwners }));
    }
  };

  // --- Blocking Documents Logic ---
  const handleBlockingDocChange = (index: number, field: keyof BlockingDocument, value: string) => {
    const newDocs = [...formData.blockingDocuments];
    newDocs[index] = { ...newDocs[index], [field]: value };
    setFormData(prev => ({ ...prev, blockingDocuments: newDocs }));
  };

  const addBlockingDoc = () => {
    setFormData(prev => ({
      ...prev,
      blockingDocuments: [...prev.blockingDocuments, { docNumber: '', date: new Date().toISOString().split('T')[0], agency: '', note: '' }]
    }));
  };

  const removeBlockingDoc = (index: number) => {
    if (formData.blockingDocuments.length > 1) {
      const newDocs = formData.blockingDocuments.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, blockingDocuments: newDocs }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 font-sans">
      <div className="bg-white shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col rounded-sm overflow-hidden">
        {/* Header Modal */}
        <div className="flex justify-between items-center px-6 py-4 bg-[#003b5c] text-white border-b border-blue-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide">
              {initialData ? 'CẬP NHẬT THÔNG TIN HỒ SƠ' : 'NHẬP LIỆU HỒ SƠ NGĂN CHẶN MỚI'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-blue-200 opacity-80">
                <span>Người nhập liệu: <b>{formData.createdBy}</b></span>
            </div>
          </div>
          <button onClick={onCancel} className="text-white hover:text-red-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <form id="recordForm" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Group 1: Thông tin chủ & GCN */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-bold text-[#003b5c] text-sm uppercase flex items-center gap-2">
                    <span className="bg-[#003b5c] text-white w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
                    Thông tin Chủ Sử Dụng & Giấy Chứng Nhận
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="md:col-span-2 space-y-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase">Tên chủ sử dụng (Viết hoa)</label>
                        {formData.owners.map((owner, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              required
                              value={owner}
                              onChange={(e) => handleOwnerChange(index, e.target.value.toUpperCase())}
                              placeholder="NGUYỄN VĂN A"
                              className="flex-1 border border-gray-300 px-3 py-2 text-sm rounded-sm focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none uppercase text-gray-900 bg-white"
                            />
                            {formData.owners.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOwnerField(index)}
                                className="text-red-500 hover:bg-red-50 px-2 rounded border border-transparent hover:border-red-200"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addOwnerField}
                          className="text-xs text-blue-700 hover:underline flex items-center gap-1 font-medium mt-1"
                        >
                          <Plus size={12} /> Thêm đồng sở hữu
                        </button>
                     </div>

                     <div className="grid grid-cols-3 gap-3 md:col-span-2 border-t border-gray-100 pt-3 mt-1">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Số phát hành (Serial)</label>
                            <input
                                type="text"
                                name="issueNumber"
                                value={formData.issueNumber}
                                onChange={handleChange}
                                className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Số vào sổ cấp GCN</label>
                            <input
                                type="text"
                                name="certNumber"
                                value={formData.certNumber}
                                onChange={handleChange}
                                className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Ngày cấp</label>
                            <input
                                type="date"
                                name="issueDate"
                                max="9999-12-31"
                                value={formData.issueDate || ''}
                                onChange={handleChange}
                                className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                            />
                        </div>
                     </div>
                </div>
            </div>

            {/* Group 2: Thông tin thửa đất */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-bold text-[#003b5c] text-sm uppercase flex items-center gap-2">
                    <span className="bg-[#003b5c] text-white w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span>
                    Đặc điểm Thửa Đất
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Tờ bản đồ số</label>
                        <input
                            type="text"
                            name="mapSheetNumber"
                            value={formData.mapSheetNumber}
                            onChange={handleChange}
                            className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none font-medium text-gray-900 bg-white"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Thửa đất số</label>
                        <input
                            type="text"
                            name="plotNumber"
                            value={formData.plotNumber}
                            onChange={handleChange}
                            className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none font-medium text-gray-900 bg-white"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Diện tích (m²)</label>
                        <input
                            type="number"
                            name="area"
                            value={formData.area}
                            onChange={handleChange}
                            className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                        />
                     </div>

                     <div className="md:col-span-3 grid grid-cols-3 gap-3">
                         <div className="col-span-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Ấp/Khu phố</label>
                            <input
                                type="text"
                                name="hamlet"
                                value={formData.hamlet}
                                onChange={handleChange}
                                className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                            />
                         </div>
                         <div className="col-span-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Xã/Phường (Trước sát nhập)</label>
                            <select
                                name="oldCommune"
                                value={formData.oldCommune}
                                onChange={handleChange}
                                className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none bg-white text-gray-900"
                            >
                                <option value="">-- Chọn Xã Cũ --</option>
                                {PREDEFINED_OLD_COMMUNES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                         </div>
                         <div className="col-span-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Xã/Phường (Hiện tại)</label>
                            <select
                                name="newCommune"
                                value={formData.newCommune}
                                onChange={handleChange}
                                className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none bg-white text-gray-900"
                            >
                                <option value="">-- Chọn Xã Mới --</option>
                                {PREDEFINED_NEW_COMMUNES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                         </div>
                     </div>
                </div>
            </div>

            {/* Group 3: Tình trạng ngăn chặn (Đã cập nhật để hỗ trợ nhiều văn bản) */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm">
                <div className="bg-red-50 px-4 py-2 border-b border-red-200 font-bold text-red-800 text-sm uppercase flex justify-between items-center">
                    <div className="flex items-center gap-2">
                         <span className="bg-red-700 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs">3</span>
                         Nội dung Ngăn Chặn
                    </div>
                    <button
                        type="button"
                        onClick={addBlockingDoc}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded border border-red-200 flex items-center gap-1 transition-colors"
                    >
                        <Plus size={12} /> Thêm văn bản
                    </button>
                </div>
                
                <div className="p-4 space-y-4">
                    {formData.blockingDocuments.map((doc, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border-b border-gray-100 pb-4 last:border-0 last:pb-0 relative">
                             {/* Indicator Line */}
                             <div className="hidden md:block absolute left-[-16px] top-2 bottom-0 w-1 bg-red-100 rounded-r"></div>

                             <div className="md:col-span-4">
                                <label className="block text-xs font-bold text-red-700 mb-1 uppercase">
                                    Số văn bản ngăn chặn {formData.blockingDocuments.length > 1 ? `#${index + 1}` : ''} (*)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={doc.docNumber}
                                    onChange={(e) => handleBlockingDocChange(index, 'docNumber', e.target.value)}
                                    className="w-full border border-red-300 bg-red-50 px-3 py-2 text-sm rounded-sm focus:border-red-600 outline-none font-semibold text-red-900"
                                    placeholder="Nhập số CV/QĐ..."
                                />
                             </div>
                             <div className="md:col-span-3">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Ngày văn bản</label>
                                <input
                                    type="date"
                                    max="9999-12-31"
                                    value={doc.date || ''}
                                    onChange={(e) => handleBlockingDocChange(index, 'date', e.target.value)}
                                    className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                                />
                             </div>
                             <div className="md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Cơ quan ban hành</label>
                                <input
                                    type="text"
                                    value={doc.agency}
                                    onChange={(e) => handleBlockingDocChange(index, 'agency', e.target.value)}
                                    className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                                    placeholder="Tòa án/THADS..."
                                />
                             </div>
                             
                             <div className="md:col-span-1 flex items-end justify-center pt-6">
                                {formData.blockingDocuments.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeBlockingDoc(index)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition"
                                        title="Xóa văn bản này"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                             </div>

                             {/* Ghi chú riêng cho văn bản */}
                             <div className="md:col-span-12">
                                <input
                                    type="text"
                                    value={doc.note}
                                    onChange={(e) => handleBlockingDocChange(index, 'note', e.target.value)}
                                    className="w-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs rounded-sm focus:border-blue-600 outline-none italic text-gray-600"
                                    placeholder="Nhập nội dung trích yếu/lý do ngăn chặn riêng cho văn bản này..."
                                />
                             </div>
                        </div>
                    ))}
                    
                    <div className="pt-2 border-t border-gray-100">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Ghi chú chung hồ sơ</label>
                        <textarea
                            name="notes"
                            rows={2}
                            value={formData.notes}
                            onChange={handleChange}
                            className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:border-blue-600 outline-none text-gray-900 bg-white"
                            placeholder="Ghi chú chung cho toàn bộ hồ sơ..."
                        />
                    </div>
                </div>
            </div>

            {/* Group 4: Giải tỏa */}
            <div className={`border shadow-sm rounded-sm transition-colors ${formData.isUnblocked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="isUnblocked"
                            name="isUnblocked"
                            checked={formData.isUnblocked}
                            onChange={handleChange}
                            className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                        />
                        <label htmlFor="isUnblocked" className={`font-bold uppercase text-sm cursor-pointer select-none ${formData.isUnblocked ? 'text-green-800' : 'text-gray-500'}`}>
                            Đã có văn bản giải ngăn chặn / Hủy ngăn chặn
                        </label>
                    </div>
                </div>
                
                {formData.isUnblocked && (
                    <div className="p-4 border-t border-green-200 animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-xs font-bold text-green-800 mb-1 uppercase">Số văn bản hủy bỏ / Giải tỏa</label>
                        <input
                            type="text"
                            name="unblockDoc"
                            value={formData.unblockDoc}
                            onChange={handleChange}
                            className="w-full border border-green-300 px-3 py-2 text-sm rounded-sm focus:border-green-600 outline-none font-medium text-gray-900 bg-white"
                            placeholder="Nhập số văn bản..."
                            required={formData.isUnblocked}
                        />
                    </div>
                )}
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-white text-gray-700 border border-gray-300 rounded-sm hover:bg-gray-100 transition-colors text-sm font-medium uppercase"
          >
            Đóng
          </button>
          <button
            type="submit"
            form="recordForm"
            className="px-5 py-2 bg-[#00507d] text-white rounded-sm hover:bg-[#003b5c] transition-colors text-sm font-bold uppercase shadow-sm flex items-center gap-2"
          >
            <Save size={16} /> Lưu Dữ Liệu
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordForm;