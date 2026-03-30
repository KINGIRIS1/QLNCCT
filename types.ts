// Định nghĩa chi tiết văn bản ngăn chặn
export interface BlockingDocument {
  docNumber: string; // Số hiệu văn bản
  date: string; // Ngày ban hành
  agency: string; // Cơ quan ban hành
  note: string; // Ghi chú riêng cho văn bản này
}

// Định nghĩa cấu trúc dữ liệu cho một hồ sơ đất đai
export interface LandRecord {
  id: string;
  owners: string[]; // Mảng chứa tên các chủ sử dụng
  issueNumber: string; // Số phát hành (Serial sổ đỏ)
  certNumber: string; // Số vào sổ cấp giấy
  issueDate: string; // Ngày cấp
  area: number; // Diện tích (m2)
  plotNumber: string; // Số thửa
  mapSheetNumber: string; // Số tờ
  hamlet: string; // Ấp/Khu phố
  oldCommune: string; // Xã/Phường trước sát nhập
  newCommune: string; // Xã/Phường sau sát nhập
  
  // Thay đổi: Hỗ trợ nhiều văn bản ngăn chặn
  blockingDocuments: BlockingDocument[];
  
  unblockDoc: string; // Văn bản hủy ngăn chặn (nếu có)
  notes: string; // Ghi chú chung cho cả hồ sơ
  isUnblocked: boolean; // Trạng thái: true = đã giải tỏa, false = đang ngăn chặn

  // Mới: Thông tin audit
  createdAt?: string; // Ngày nhập vào hệ thống
  createdBy?: string; // Người nhập liệu
}

// Kiểu dữ liệu cho Form (không có ID vì ID tự sinh)
export type LandRecordFormData = Omit<LandRecord, 'id' | 'createdAt'>;

// Định nghĩa Role và User
export type UserRole = 'admin' | 'subadmin' | 'user';

export interface User {
  id?: string;
  username: string;
  name: string;
  role: UserRole;
}

export interface UserFormData {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
}