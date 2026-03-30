import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { LandRecord, LandRecordFormData, User, UserRole } from './types';
import RecordForm from './components/RecordForm';
import LoginForm from './components/LoginForm';
import UserManagement from './components/UserManagement';
import ChangePassword from './components/ChangePassword';
import { supabase } from './supabaseClient';
import { read, utils, writeFile } from 'xlsx';
import { Search, Plus, Edit, Trash2, FileText, Lock, Unlock, MapPin, Printer, ArrowRight, Filter, XCircle, LogOut, UserCircle, Calendar, Building2, Info, RefreshCw, Loader2, WifiOff, Upload, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShieldAlert, CheckCircle2, LayoutDashboard, Copy, Check, X, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, Clock } from 'lucide-react';

// CẤU HÌNH PHÂN QUYỀN
const ROLE_PERMISSIONS: Record<UserRole, {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  restore_db: boolean;
}> = {
  admin: {
    view: true,
    add: true,
    edit: true,
    delete: true,
    export: true,
    restore_db: true,
  },
  subadmin: {
    view: true,
    add: true,
    edit: true,
    delete: false,
    export: true,
    restore_db: false,
  },
  user: {
    view: true,
    add: false,
    edit: false,
    delete: false,
    export: true,
    restore_db: false,
  }
};

// Dữ liệu danh sách xã/phường
const PREDEFINED_NEW_COMMUNES = [
  'Bình Long', 'An Lộc'
].sort((a, b) => a.localeCompare(b, 'vi'));

const PREDEFINED_OLD_COMMUNES = [
  'Hưng Chiến', 'An Lộc', 'Thanh Lương', 'Phú Thịnh', 'Thanh Phú', 'Phú Đức'
].sort((a, b) => a.localeCompare(b, 'vi'));

const PAGE_SIZE = 20; // Số lượng bản ghi trên mỗi trang

// --- SQL FIX COMMAND (PHIÊN BẢN CƯỜNG HÓA - MULTI CONDITION SEARCH) ---
// Thay đổi: Thêm các tham số p_map_sheet, p_plot_number, p_commune để tìm kiếm chính xác
const FIX_SQL_COMMAND = `
-- 0. Tạo bảng users nếu chưa có
CREATE TABLE IF NOT EXISTS users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'subadmin', 'user')),
    created_at timestamptz DEFAULT now()
);

-- Thêm user mặc định nếu bảng trống
INSERT INTO users (username, password, name, role)
SELECT 'admin', '123', 'Quản Trị Viên', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (username, password, name, role)
SELECT 'subadmin', '123', 'Phó Ban Quản Lý', 'subadmin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'subadmin');

INSERT INTO users (username, password, name, role)
SELECT 'user', '123', 'Chuyên Viên Tra Cứu', 'user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'user');

-- 1. Đảm bảo bảng có cột created_by (Người nhập)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_records' AND column_name = 'created_by') THEN
        ALTER TABLE land_records ADD COLUMN created_by text;
    END IF;
END $$;

DROP FUNCTION IF EXISTS search_land_records;

CREATE OR REPLACE FUNCTION search_land_records(
  keyword text,
  page_number int,
  page_size int,
  sort_column text DEFAULT 'created_at',
  sort_order text DEFAULT 'desc',
  p_map_sheet text DEFAULT NULL,    -- Tham số tìm kiếm Tờ
  p_plot_number text DEFAULT NULL,  -- Tham số tìm kiếm Thửa
  p_commune text DEFAULT NULL       -- Tham số tìm kiếm Xã (Cũ hoặc Mới)
)
RETURNS TABLE (
  id text,
  owners jsonb,
  issue_number text,
  cert_number text,
  issue_date date,
  area numeric,
  plot_number text,
  map_sheet_number text,
  hamlet text,
  old_commune text,
  new_commune text,
  blocking_documents jsonb,
  unblock_doc text,
  notes text,
  is_unblocked boolean,
  created_at timestamptz,
  created_by text,               -- Trả về thêm người nhập
  total_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  _total_rows bigint;
  _search_term text := '%' || keyword || '%';
BEGIN
  -- 1. Đếm tổng số bản ghi thỏa mãn điều kiện tìm kiếm đa chiều
  SELECT COUNT(*) INTO _total_rows
  FROM land_records lr
  WHERE
    -- Điều kiện từ khóa chung (nếu có)
    (keyword IS NULL OR keyword = '' OR
        lr.owners::text ILIKE _search_term 
        OR lr.issue_number ILIKE _search_term 
        OR lr.cert_number ILIKE _search_term 
        OR lr.blocking_documents::text ILIKE _search_term
        OR lr.unblock_doc ILIKE _search_term
        OR lr.notes ILIKE _search_term
        -- Nếu không nhập tờ/thửa cụ thể thì tìm tờ/thửa trong keyword luôn
        OR (p_map_sheet IS NULL AND lr.map_sheet_number ILIKE _search_term)
        OR (p_plot_number IS NULL AND lr.plot_number ILIKE _search_term)
        OR (p_commune IS NULL AND (lr.old_commune ILIKE _search_term OR lr.new_commune ILIKE _search_term))
    )
    -- Điều kiện chính xác từng trường (Kết hợp AND)
    AND (p_map_sheet IS NULL OR p_map_sheet = '' OR lr.map_sheet_number = p_map_sheet)
    AND (p_plot_number IS NULL OR p_plot_number = '' OR lr.plot_number = p_plot_number)
    AND (p_commune IS NULL OR p_commune = '' OR lr.old_commune = p_commune OR lr.new_commune = p_commune);

  -- 2. Trả về dữ liệu chi tiết
  RETURN QUERY
  SELECT
    lr.id::text,
    to_jsonb(lr.owners),
    lr.issue_number::text,
    lr.cert_number::text,
    NULLIF(lr.issue_date::text, '')::date,
    lr.area::numeric,
    lr.plot_number::text,
    lr.map_sheet_number::text,
    lr.hamlet::text,
    lr.old_commune::text,
    lr.new_commune::text,
    to_jsonb(lr.blocking_documents),
    lr.unblock_doc::text,
    lr.notes::text,
    lr.is_unblocked::boolean,
    lr.created_at::timestamptz,
    lr.created_by::text,
    _total_rows
  FROM land_records lr
  WHERE
    (keyword IS NULL OR keyword = '' OR
        lr.owners::text ILIKE _search_term 
        OR lr.issue_number ILIKE _search_term 
        OR lr.cert_number ILIKE _search_term 
        OR lr.blocking_documents::text ILIKE _search_term
        OR lr.unblock_doc ILIKE _search_term
        OR lr.notes ILIKE _search_term
        OR (p_map_sheet IS NULL AND lr.map_sheet_number ILIKE _search_term)
        OR (p_plot_number IS NULL AND lr.plot_number ILIKE _search_term)
        OR (p_commune IS NULL AND (lr.old_commune ILIKE _search_term OR lr.new_commune ILIKE _search_term))
    )
    AND (p_map_sheet IS NULL OR p_map_sheet = '' OR lr.map_sheet_number = p_map_sheet)
    AND (p_plot_number IS NULL OR p_plot_number = '' OR lr.plot_number = p_plot_number)
    AND (p_commune IS NULL OR p_commune = '' OR lr.old_commune = p_commune OR lr.new_commune = p_commune)
  ORDER BY
    CASE WHEN sort_column = 'issue_date' AND sort_order = 'asc' THEN lr.issue_date END ASC,
    CASE WHEN sort_column = 'issue_date' AND sort_order = 'desc' THEN lr.issue_date END DESC,
    
    CASE WHEN sort_column = 'plot_number' AND sort_order = 'asc' THEN lr.plot_number END ASC,
    CASE WHEN sort_column = 'plot_number' AND sort_order = 'desc' THEN lr.plot_number END DESC,
    
    CASE WHEN sort_column = 'map_sheet_number' AND sort_order = 'asc' THEN lr.map_sheet_number END ASC,
    CASE WHEN sort_column = 'map_sheet_number' AND sort_order = 'desc' THEN lr.map_sheet_number END DESC,
    
    -- Mặc định hoặc created_at
    CASE WHEN sort_column NOT IN ('issue_date', 'plot_number', 'map_sheet_number') THEN lr.created_at END DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;
`;

// --- HÀM TIỆN ÍCH XỬ LÝ LỖI ---
const getErrorMessage = (error: any): string => {
  if (error === null || error === undefined) return 'Lỗi không xác định';
  if (typeof error === 'string') {
     if (error.includes('invalid input syntax for type date') || error.includes('date/time field value out of range')) {
        return 'Lỗi định dạng ngày tháng: Hệ thống phát hiện định dạng ngày (vd: 15/07/2015) không hợp lệ. Vui lòng kiểm tra file Excel.';
     }
     return error;
  }
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object') {
    const msg = error.message || error.error_description || error.details || error.msg;
    if (msg) {
        if (msg.includes('invalid input syntax for type date') || msg.includes('date/time field value out of range')) {
            return `Lỗi định dạng ngày tháng (${msg}): Dữ liệu ngày tháng không chuẩn ISO (YYYY-MM-DD).`;
        }
        return msg;
    }
    if (error.code) return `Mã lỗi hệ thống: ${error.code} ${error.hint ? `(${error.hint})` : ''}`;
    try {
      return JSON.stringify(error); 
    } catch {
      return 'Lỗi dữ liệu (Object không thể đọc)';
    }
  }
  return String(error);
};

// Hàm chuẩn hóa Date gửi lên DB
const toDbDate = (value: string | undefined | null) => {
    if (!value || typeof value !== 'string' || value.trim() === '') {
        return null;
    }
    return value.trim();
};

// Hàm format ngày giờ hiển thị
const formatDateTime = (isoString: string | undefined) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('vi-VN', { 
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return isoString;
    }
};

type SortKey = 'created_at' | 'issue_date' | 'plot_number' | 'map_sheet_number';
type SortDirection = 'asc' | 'desc';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // State dữ liệu & Phân trang
  const [records, setRecords] = useState<LandRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // State sắp xếp
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
      key: 'created_at', 
      direction: 'desc' 
  });
  
  // State Thống kê
  const [stats, setStats] = useState({ total: 0, blocked: 0, unblocked: 0 });
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSqlFix, setShowSqlFix] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandRecord | undefined>(undefined);
  
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  
  // State tìm kiếm và lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); 
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter States (Giờ dùng cho Advanced Search)
  const [filterStatus, setFilterStatus] = useState<'all' | 'blocked' | 'unblocked'>('all');
  const [filterAgency, setFilterAgency] = useState('');
  
  // Advanced Search Specific Fields
  const [advSearchSheet, setAdvSearchSheet] = useState(''); // Tờ
  const [advSearchPlot, setAdvSearchPlot] = useState('');   // Thửa
  const [advSearchCommune, setAdvSearchCommune] = useState(''); // Xã
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); 
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset trang về 1 khi thay đổi filter
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterAgency, advSearchSheet, advSearchPlot, advSearchCommune]);

  // Handle Sort Click
  const handleSort = (key: SortKey) => {
      setSortConfig(prev => {
          if (prev.key === key) {
              return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
          }
          return { key, direction: 'asc' };
      });
  };

  // Helper render sort icon
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="text-gray-400 opacity-50" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp size={12} className="text-blue-600 font-bold" />
          : <ArrowDown size={12} className="text-blue-600 font-bold" />;
  };

  // --- SUPABASE HELPERS ---
  
  const mapDbToRecord = (item: any): LandRecord => ({
    id: item.id,
    owners: Array.isArray(item.owners) ? item.owners : [],
    issueNumber: item.issue_number || '',
    certNumber: item.cert_number || '',
    issueDate: item.issue_date || '', 
    area: Number(item.area) || 0,
    plotNumber: item.plot_number || '',
    mapSheetNumber: item.map_sheet_number || '',
    hamlet: item.hamlet || '',
    oldCommune: item.old_commune || '',
    newCommune: item.new_commune || '',
    blockingDocuments: Array.isArray(item.blocking_documents) 
        ? item.blocking_documents.map((d: any) => ({
            ...d,
            date: d.date || '' 
          })) 
        : [],
    unblockDoc: item.unblock_doc || '',
    notes: item.notes || '',
    isUnblocked: !!item.is_unblocked,
    createdAt: item.created_at || '',
    createdBy: item.created_by || ''
  });

  const mapRecordToDb = (item: LandRecord) => ({
    id: item.id,
    owners: item.owners,
    issue_number: item.issueNumber,
    cert_number: item.certNumber,
    issue_date: toDbDate(item.issueDate), 
    area: item.area,
    plot_number: item.plotNumber,
    map_sheet_number: item.mapSheetNumber,
    hamlet: item.hamlet,
    old_commune: item.oldCommune,
    new_commune: item.newCommune,
    blocking_documents: item.blockingDocuments.map(doc => ({
        ...doc,
        date: toDbDate(doc.date)
    })),
    unblock_doc: item.unblockDoc,
    notes: item.notes,
    is_unblocked: item.isUnblocked,
    created_by: item.createdBy // Lưu người nhập
  });

  const fetchStats = useCallback(async () => {
    try {
        const [totalRes, blockedRes, unblockedRes] = await Promise.all([
            supabase.from('land_records').select('*', { count: 'exact', head: true }),
            supabase.from('land_records').select('*', { count: 'exact', head: true }).eq('is_unblocked', false),
            supabase.from('land_records').select('*', { count: 'exact', head: true }).eq('is_unblocked', true)
        ]);

        setStats({
            total: totalRes.count || 0,
            blocked: blockedRes.count || 0,
            unblocked: unblockedRes.count || 0
        });
    } catch (err) {
        console.error("Lỗi tải thống kê:", err);
    }
  }, []);

  const buildBaseQuery = () => {
    let query = supabase
      .from('land_records')
      .select('*', { count: 'exact' });

    if (filterStatus === 'blocked') query = query.eq('is_unblocked', false);
    if (filterStatus === 'unblocked') query = query.eq('is_unblocked', true);
    
    // Áp dụng các bộ lọc nâng cao nếu có (cho trường hợp không dùng RPC - fallback)
    if (advSearchSheet) query = query.eq('map_sheet_number', advSearchSheet);
    if (advSearchPlot) query = query.eq('plot_number', advSearchPlot);
    if (advSearchCommune) query = query.or(`old_commune.eq.${advSearchCommune},new_commune.eq.${advSearchCommune}`);

    // Áp dụng sắp xếp
    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });

    return query;
  };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setShowSqlFix(false);

    try {
      let dataResult: any[] = [];
      let countResult = 0;

      // Sử dụng RPC cho tìm kiếm (kể cả khi không có keyword nhưng có các điều kiện lọc)
      // Điều này giúp tận dụng logic tìm kiếm đa điều kiện
      const shouldUseRpc = debouncedSearchTerm || advSearchSheet || advSearchPlot || advSearchCommune;

      if (shouldUseRpc) {
         const { data, error } = await supabase.rpc('search_land_records', {
            keyword: debouncedSearchTerm,
            page_number: currentPage,
            page_size: PAGE_SIZE,
            sort_column: sortConfig.key,
            sort_order: sortConfig.direction,
            p_map_sheet: advSearchSheet || null,
            p_plot_number: advSearchPlot || null,
            p_commune: advSearchCommune || null
         });

         if (error) {
             if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('structure') || error.message?.includes('p_map_sheet')) {
                 setShowSqlFix(true);
                 throw new Error('Cấu trúc Database cần cập nhật để hỗ trợ tìm kiếm đa điều kiện và cột Người nhập. Vui lòng chạy lệnh SQL (Fix) bên dưới.');
             }
             throw error;
         }

         if (data && data.length > 0) {
             dataResult = data;
             countResult = Number(data[0].total_count) || 0; 
         }
      } 
      // TRƯỜNG HỢP: LỌC/XEM THƯỜNG (STANDARD SELECT)
      else {
          const query = buildBaseQuery();
          const from = (currentPage - 1) * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;

          const { data, count, error } = await query
            .range(from, to);

          if (error) throw error;
          dataResult = data || [];
          countResult = count || 0;
      }

      // Mapping Client
      let mappedRecords = dataResult.map(mapDbToRecord);
      
      // Filter Agency phía Client
      if (filterAgency) {
          mappedRecords = mappedRecords.filter(r => 
              r.blockingDocuments.some(d => d.agency.toLowerCase().includes(filterAgency.toLowerCase()))
          );
      }

      setRecords(mappedRecords);
      setTotalCount(countResult);
      setTotalPages(Math.ceil(countResult / PAGE_SIZE));

    } catch (err: any) {
      console.error('Lỗi tải dữ liệu:', err);
      setErrorMsg(getErrorMessage(err)); 
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentPage, debouncedSearchTerm, filterStatus, filterAgency, advSearchSheet, advSearchPlot, advSearchCommune, sortConfig]);

  useEffect(() => {
    if (currentUser) {
      fetchRecords();
      fetchStats(); 
    }
  }, [fetchRecords, fetchStats]);

  const handleLogout = () => {
    setCurrentUser(null);
    setRecords([]);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(FIX_SQL_COMMAND);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const clearSearch = () => {
      setSearchTerm('');
      setDebouncedSearchTerm('');
      if(searchInputRef.current) searchInputRef.current.focus();
  };

  const handleAddRecord = async (data: LandRecordFormData) => {
    setLoading(true);
    try {
      const newRecord: LandRecord = { ...data, id: Date.now().toString() };
      const dbPayload = mapRecordToDb(newRecord);
      const { error } = await supabase.from('land_records').insert([dbPayload]);
      if (error) throw error;
      
      alert('Thêm mới thành công!');
      setIsFormOpen(false);
      fetchRecords(); 
      fetchStats(); 
    } catch (err: any) {
      console.error('Lỗi thêm mới:', err);
      alert('Lỗi khi lưu dữ liệu: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecord = async (data: LandRecordFormData) => {
    if (!editingRecord) return;
    setLoading(true);
    try {
      const updatedRecord: LandRecord = { ...data, id: editingRecord.id };
      const dbPayload = mapRecordToDb(updatedRecord);
      const { error } = await supabase.from('land_records').update(dbPayload).eq('id', editingRecord.id);
      if (error) throw error;

      alert('Cập nhật thành công!');
      setEditingRecord(undefined);
      setIsFormOpen(false);
      fetchRecords(); 
      fetchStats();
    } catch (err: any) {
      console.error('Lỗi cập nhật:', err);
      alert('Lỗi khi cập nhật: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm('Xác nhận xóa hồ sơ này khỏi hệ thống?')) {
      setLoading(true);
      try {
        const { error } = await supabase.from('land_records').delete().eq('id', id);
        if (error) throw error;
        setRecords(prev => prev.filter(r => r.id !== id));
        setTotalCount(prev => prev - 1);
        fetchStats(); 
      } catch (err: any) {
        alert('Không thể xóa bản ghi: ' + getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
  };

  const startEdit = (record: LandRecord) => {
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const resetToFactorySettings = async () => {
      if(window.confirm('CẢNH BÁO: Hành động này sẽ XÓA SẠCH toàn bộ dữ liệu. Bạn có chắc chắn không?')) {
          setLoading(true);
          try {
             const { error } = await supabase.from('land_records').delete().neq('id', '0');
             if (error) throw error;
             alert('Đã xóa dữ liệu.');
             fetchRecords();
             fetchStats();
          } catch (err: any) {
              alert('Lỗi: ' + getErrorMessage(err));
          } finally {
              setLoading(false);
          }
      }
  };

  // --- EXCEL IMPORT LOGIC ---
  const excelDateToJSDate = (serial: any) => {
      if (!serial) return null; 
      if (typeof serial === 'number') {
          try {
              const utc_days  = Math.floor(serial - 25569);
              const utc_value = utc_days * 86400;                                        
              const date_info = new Date(utc_value * 1000);
              if (isNaN(date_info.getTime())) return null; 
              return date_info.toISOString().split('T')[0];
          } catch (e) {
              return null;
          }
      }
      if (typeof serial === 'string') {
          const trimmed = serial.trim();
          if (!trimmed) return null;
          const dmyRegex = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/;
          const match = trimmed.match(dmyRegex);
          if (match) {
              const day = match[1].padStart(2, '0');
              const month = match[2].padStart(2, '0');
              const year = match[3];
              return `${year}-${month}-${day}`;
          }
          const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (isoRegex.test(trimmed)) return trimmed;
      }
      return null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm('Bạn có chắc chắn muốn nhập dữ liệu từ file này?')) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      setLoading(true);
      try {
          const data = await file.arrayBuffer();
          const workbook = read(data);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData: any[] = utils.sheet_to_json(sheet);

          if (jsonData.length === 0) {
              alert('File Excel không có dữ liệu!');
              return;
          }

          const recordsToInsert = jsonData.map((row: any) => {
              const owners = row["ChuSuDung"] ? row["ChuSuDung"].toString().split(/[\r\n;]+/).map((s: string) => s.trim()).filter((s: string) => s !== '') : [];
              const blockingDoc = {
                  docNumber: row["SoVanBanNganChan"]?.toString() || '',
                  date: excelDateToJSDate(row["NgayVanBan"]),
                  agency: row["CoQuanBanHanh"]?.toString() || '',
                  note: row["NoiDungNganChan"]?.toString() || ''
              };
              const blockingDocuments = blockingDoc.docNumber ? [blockingDoc] : [];
              const unblockDoc = row["VanBanGiaiToa"]?.toString() || '';

              return mapRecordToDb({
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                  owners: owners,
                  issueNumber: row["SoPhatHanh"]?.toString() || '',
                  certNumber: row["SoVaoSo"]?.toString() || '',
                  issueDate: excelDateToJSDate(row["NgayCap"]) || '',
                  area: Number(row["DienTich"]) || 0,
                  plotNumber: row["ThuaSo"]?.toString() || '',
                  mapSheetNumber: row["ToSo"]?.toString() || '',
                  hamlet: row["ApKhuPho"]?.toString() || '',
                  oldCommune: row["XaPhuongCu"]?.toString() || '',
                  newCommune: row["XaPhuongMoi"]?.toString() || '',
                  blockingDocuments: blockingDocuments,
                  unblockDoc: unblockDoc,
                  notes: row["GhiChu"]?.toString() || '',
                  isUnblocked: !!unblockDoc,
                  // Khi import Excel, mặc định người tạo là "Excel Import" hoặc tên user
                  createdBy: currentUser?.name || 'Excel Import'
              });
          });

          const batchSize = 100;
          for (let i = 0; i < recordsToInsert.length; i += batchSize) {
              const batch = recordsToInsert.slice(i, i + batchSize);
              const { error } = await supabase.from('land_records').insert(batch);
              if (error) throw error;
          }

          alert(`Đã nhập thành công ${recordsToInsert.length} hồ sơ!`);
          fetchRecords(); 
          fetchStats(); 

      } catch (err: any) {
          console.error("Lỗi nhập Excel:", err);
          alert("Lỗi khi xử lý file Excel: " + getErrorMessage(err));
      } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleImportExcelClick = () => {
      fileInputRef.current?.click();
  };

  const resetFilters = () => {
    if (window.confirm('Xóa toàn bộ điều kiện lọc?')) {
        setFilterStatus('all');
        setFilterAgency('');
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setAdvSearchSheet('');
        setAdvSearchPlot('');
        setAdvSearchCommune('');
    }
  };

  const handleExportCSV = async () => {
    setLoading(true);
    try {
        const query = buildBaseQuery();
        const { data, error } = await query.limit(2000); 
        
        if (error) throw error;
        if (!data || data.length === 0) {
            alert('Không có dữ liệu để xuất.');
            return;
        }

        const fullRecords = data.map(mapDbToRecord);

        const escapeCsv = (str: string | number | null | undefined) => {
            if (str === null || str === undefined) return '""';
            const stringValue = String(str);
            const escaped = stringValue.replace(/"/g, '""');
            return `"${escaped}"`;
        };

        const headers = [
            "STT", "Chủ Sử Dụng", "Số Phát Hành", "Số Vào Sổ", "Ngày Cấp",
            "Diện Tích (m2)", "Tờ Số", "Thửa Số", "Địa Chỉ",
            "Xã/Phường Cũ", "Xã/Phường Mới",
            "Chi Tiết VB Ngăn Chặn (Số - Ngày - CQ - Nội dung)", 
            "Văn Bản Giải Ngăn Chặn", "Trạng Thái", "Ghi Chú Chung",
            "Người Nhập", "Ngày Nhập"
        ];

        const rows = fullRecords.map((record, index) => {
            const docString = record.blockingDocuments.map(d => {
                const notePart = d.note ? `[${d.note}]` : '';
                return `${d.docNumber} (${d.date}) - ${d.agency} ${notePart}`;
            }).join('; ');

            return [
                index + 1,
                record.owners.join(', '),
                record.issueNumber,
                record.certNumber,
                record.issueDate,
                record.area,
                record.mapSheetNumber,
                record.plotNumber,
                record.hamlet,
                record.oldCommune,
                record.newCommune,
                docString,
                record.unblockDoc,
                record.isUnblocked ? 'Đã giải ngăn chặn' : 'Đang ngăn chặn',
                record.notes,
                record.createdBy,
                formatDateTime(record.createdAt)
            ].map(escapeCsv).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Bao_cao_ngan_chan_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (err: any) {
        alert('Có lỗi khi xuất dữ liệu: ' + getErrorMessage(err));
    } finally {
        setLoading(false);
    }
  };

  const permissions = useMemo(() => {
    if (!currentUser) return null;
    return ROLE_PERMISSIONS[currentUser.role];
  }, [currentUser]);

  if (!currentUser || !permissions) {
    return <LoginForm onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-sm">
      <header className="bg-[#003b5c] text-white shadow-md">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-full shadow-inner">
               <FileText className="text-[#003b5c]" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold uppercase tracking-wide">Hệ Thống Quản Lý Ngăn Chặn Đất Đai</h1>
              <div className="flex items-center gap-2">
                <p className="text-blue-200 text-xs">Sổ theo dõi ngăn chặn & biến động</p>
                <span className="bg-green-600 text-[10px] px-1.5 py-0.5 rounded text-white font-bold flex items-center gap-1">
                   Server-Side Pagination <WifiOff size={10} className="hidden"/>
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold flex items-center gap-2 justify-end">
                <UserCircle size={16}/> {currentUser.name}
              </div>
              <div className="text-xs text-blue-300 uppercase bg-[#002a42] px-2 py-0.5 rounded inline-block mt-0.5">
                {currentUser.role === 'admin' ? 'Quản trị viên' : currentUser.role === 'subadmin' ? 'Phó ban' : 'Chuyên viên'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => setShowUserManagement(true)}
                  className="flex items-center gap-1 text-blue-200 hover:text-white hover:bg-blue-900/50 px-3 py-1.5 rounded transition text-xs font-medium border border-transparent hover:border-blue-400"
                  title="Quản lý người dùng"
                >
                  <UserPlus size={14} /> Quản lý
                </button>
              )}
              <button
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-1 text-blue-200 hover:text-white hover:bg-blue-900/50 px-3 py-1.5 rounded transition text-xs font-medium border border-transparent hover:border-blue-400"
                title="Đổi mật khẩu"
              >
                <Lock size={14} /> Đổi mật khẩu
              </button>
              <div className="h-8 w-px bg-blue-800 mx-1"></div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 text-red-200 hover:text-white hover:bg-red-900/50 px-3 py-1.5 rounded transition text-xs font-medium border border-transparent hover:border-red-400"
                title="Đăng xuất"
              >
                 <LogOut size={14} /> Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 space-y-4">
        
        {/* DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-sm border border-gray-300 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Tổng số hồ sơ</p>
                    <p className="text-2xl font-bold text-[#003b5c]">{stats.total.toLocaleString()}</p>
                </div>
                <div className="bg-blue-100 p-2.5 rounded text-[#003b5c]">
                    <LayoutDashboard size={24}/>
                </div>
            </div>

            <div className="bg-white p-4 rounded-sm border border-gray-300 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
                <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Đang ngăn chặn</p>
                    <p className="text-2xl font-bold text-red-700">{stats.blocked.toLocaleString()}</p>
                </div>
                <div className="bg-red-100 p-2.5 rounded text-red-700">
                    <ShieldAlert size={24}/>
                </div>
            </div>

            <div className="bg-white p-4 rounded-sm border border-gray-300 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-600"></div>
                <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Đã giải ngăn chặn</p>
                    <p className="text-2xl font-bold text-green-700">{stats.unblocked.toLocaleString()}</p>
                </div>
                <div className="bg-green-100 p-2.5 rounded text-green-700">
                    <CheckCircle2 size={24}/>
                </div>
            </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-4 rounded shadow-sm relative space-y-3" role="alert">
            <div className="flex items-start gap-2">
                <ShieldAlert className="text-red-600 shrink-0 mt-0.5" size={18}/>
                <div>
                    <strong className="font-bold block text-red-700 mb-1">Cảnh báo hệ thống:</strong>
                    <span className="block text-sm">{errorMsg}</span>
                </div>
            </div>

            {showSqlFix && (
                <div className="bg-white p-3 rounded border border-gray-300 mt-2">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Lệnh SQL Sửa Lỗi & Nâng Cấp DB (Copy & Chạy trong Supabase SQL Editor)
                        </label>
                        <button 
                            onClick={handleCopySql}
                            className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-all ${copiedSql ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {copiedSql ? <Check size={12}/> : <Copy size={12}/>}
                            {copiedSql ? 'Đã sao chép!' : 'Sao chép SQL'}
                        </button>
                    </div>
                    <textarea 
                        readOnly 
                        className="w-full h-32 text-[10px] font-mono bg-gray-100 border border-gray-200 p-2 rounded outline-none resize-none text-gray-600"
                        value={FIX_SQL_COMMAND}
                        onClick={(e) => e.currentTarget.select()}
                    />
                    <div className="mt-2 text-[10px] text-gray-500">
                        <span className="font-bold">Hướng dẫn:</span> Đăng nhập Supabase ➔ SQL Editor ➔ New Query ➔ Dán lệnh trên ➔ Nhấn Run.
                    </div>
                </div>
            )}
          </div>
        )}

        {/* Toolbar & Filter */}
        <div className="bg-white border border-gray-300 shadow-sm rounded-sm">
           <div className="flex flex-col md:flex-row justify-between items-center gap-3 p-3">
              <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
                <div className="relative flex-1 md:max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="block w-full pl-9 pr-8 py-2 border border-gray-400 rounded-sm leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 sm:text-sm text-gray-900 transition-shadow"
                    placeholder="Tìm Tên, Số tờ/thửa, GCN, Số VB, Địa chỉ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  
                  {/* Trạng thái Loading hoặc Nút xóa */}
                  <div className="absolute right-2 top-2.5 flex items-center gap-1">
                      {loading ? (
                          <Loader2 size={16} className="animate-spin text-blue-600"/>
                      ) : searchTerm ? (
                          <button onClick={clearSearch} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-0.5 transition-colors">
                              <X size={14} />
                          </button>
                      ) : null}
                  </div>
                </div>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-sm border transition-colors text-sm font-medium ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                >
                  <Filter size={16} /> <span className="hidden sm:inline">Tìm kiếm nâng cao</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                  {permissions.add && (
                    <>
                      <button
                        onClick={() => { setEditingRecord(undefined); setIsFormOpen(true); }}
                        disabled={loading}
                        className="flex items-center gap-2 bg-[#006699] text-white px-4 py-2 rounded-sm hover:bg-[#004d73] transition text-sm font-medium shadow-sm uppercase whitespace-nowrap disabled:opacity-50"
                      >
                        <Plus size={16} /> Thêm Mới
                      </button>

                      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                      <button
                        onClick={handleImportExcelClick}
                        disabled={loading}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-sm hover:bg-indigo-700 transition text-sm font-medium shadow-sm uppercase whitespace-nowrap disabled:opacity-50"
                      >
                        <Upload size={16} /> Excel
                      </button>
                    </>
                  )}
                  
                  {permissions.export && (
                    <button 
                        onClick={handleExportCSV}
                        disabled={loading}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-sm transition text-sm font-medium shadow-sm uppercase whitespace-nowrap disabled:opacity-50"
                    >
                        <Printer size={16} /> Xuất DS
                    </button>
                  )}
              </div>
           </div>
           
           {/* Advanced Filter Panel (NÂNG CẤP) */}
           {showFilters && (
             <div className="p-4 border-t border-gray-200 bg-gray-50 animate-in slide-in-from-top-2 duration-200">
               <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <Filter size={14}/> Tìm kiếm đa điều kiện
                  </h3>
                  <div className="flex gap-4">
                      {permissions.restore_db && (
                        <button onClick={resetToFactorySettings} disabled={loading} className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1 hover:underline font-semibold disabled:opacity-50" title="Xóa hết dữ liệu đã nhập">
                            <RefreshCw size={14} /> Reset Dữ Liệu Gốc
                        </button>
                      )}
                      <button onClick={resetFilters} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 hover:underline">
                          <XCircle size={14} /> Xóa điều kiện lọc
                      </button>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Số Tờ</label>
                    <input
                      type="text"
                      value={advSearchSheet}
                      onChange={(e) => setAdvSearchSheet(e.target.value)}
                      placeholder="Tìm chính xác tờ..."
                      className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:border-blue-600 outline-none bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Số Thửa</label>
                    <input
                      type="text"
                      value={advSearchPlot}
                      onChange={(e) => setAdvSearchPlot(e.target.value)}
                      placeholder="Tìm chính xác thửa..."
                      className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:border-blue-600 outline-none bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Xã/Phường</label>
                    <select 
                      value={advSearchCommune}
                      onChange={(e) => setAdvSearchCommune(e.target.value)}
                      className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:border-blue-600 outline-none bg-white text-gray-900"
                    >
                       <option value="">Tất cả</option>
                       {/* Merge 2 danh sách xã cũ mới */}
                       {[...new Set([...PREDEFINED_OLD_COMMUNES, ...PREDEFINED_NEW_COMMUNES])].sort().map(c => (
                         <option key={c} value={c}>{c}</option>
                       ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Trạng thái hồ sơ</label>
                    <select 
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:border-blue-600 outline-none bg-white text-gray-900"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="blocked">Đang ngăn chặn</option>
                      <option value="unblocked">Đã giải ngăn chặn</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Cơ quan ban hành (Từ khóa)</label>
                    <input
                      type="text"
                      value={filterAgency}
                      onChange={(e) => setFilterAgency(e.target.value)}
                      placeholder="Nhập tên cơ quan..."
                      className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:border-blue-600 outline-none bg-white text-gray-900"
                    />
                  </div>
               </div>
             </div>
           )}
        </div>

        {/* Data Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm relative min-h-[400px] flex flex-col">
          {loading && (
             <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center flex-col gap-2">
                 <Loader2 className="animate-spin text-blue-600" size={32} />
                 <span className="text-blue-600 font-semibold text-sm">Đang tải dữ liệu từ Cloud...</span>
             </div>
          )}
          
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-blue-800 text-gray-700 text-xs uppercase font-bold tracking-wider">
                  <th className="px-3 py-3 border-r border-gray-300 w-10 text-center">STT</th>
                  
                  {/* Cột Chủ Sử Dụng */}
                  <th className="px-3 py-3 border-r border-gray-300 text-left w-64">
                      Chủ Sử Dụng & GCN
                      <div 
                        onClick={() => handleSort('issue_date')}
                        className="mt-1 flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors"
                        title="Sắp xếp theo Ngày cấp"
                      >
                         <span className="text-[10px] font-normal lowercase tracking-normal bg-gray-200 px-1 rounded flex items-center gap-1">
                            Sắp xếp: Ngày cấp <SortIcon columnKey="issue_date" />
                         </span>
                      </div>
                  </th>

                  {/* Cột Đặc Điểm & Vị Trí */}
                  <th className="px-3 py-3 border-r border-gray-300 text-left w-56">
                      Đặc Điểm & Vị Trí
                      <div className="flex gap-2 mt-1">
                        <div 
                            onClick={() => handleSort('map_sheet_number')}
                            className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors bg-gray-200 px-1 rounded"
                            title="Sắp xếp theo Tờ số"
                        >
                            <span className="text-[10px] font-normal lowercase tracking-normal">Tờ</span> <SortIcon columnKey="map_sheet_number" />
                        </div>
                        <div 
                            onClick={() => handleSort('plot_number')}
                            className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors bg-gray-200 px-1 rounded"
                            title="Sắp xếp theo Thửa số"
                        >
                            <span className="text-[10px] font-normal lowercase tracking-normal">Thửa</span> <SortIcon columnKey="plot_number" />
                        </div>
                      </div>
                  </th>
                  
                  <th className="px-3 py-3 border-r border-gray-300 text-left">Nội Dung Ngăn Chặn</th>
                  <th className="px-3 py-3 border-r border-gray-300 text-center w-28">Trạng Thái</th>
                  
                  {/* MỚI: Cột Người Nhập & Ngày Nhập */}
                  <th className="px-3 py-3 border-r border-gray-300 text-left w-32">
                     <div className="flex items-center gap-1"><UserPlus size={14}/> Người Nhập</div>
                  </th>
                  <th className="px-3 py-3 border-r border-gray-300 text-left w-32">
                     <div className="flex items-center gap-1"><Clock size={14}/> Ngày Nhập</div>
                  </th>

                  {(permissions.edit || permissions.delete) && (
                    <th className="px-3 py-3 text-center w-20">Tác Vụ</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm text-gray-800">
                {records.length > 0 ? (
                  records.map((record, index) => (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-blue-50 transition-colors ${!record.isUnblocked ? 'bg-red-50/30' : ''}`}
                    >
                      <td className="px-3 py-2 border-r border-gray-300 text-center font-medium text-gray-500">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 align-top">
                        <div className="font-bold text-[#003b5c] uppercase mb-1">
                          {record.owners.join(', ')}
                        </div>
                        <div className="text-xs space-y-0.5 text-gray-600">
                             <div className="flex justify-between"><span>Số PH:</span> <span className="font-medium text-black">{record.issueNumber}</span></div>
                             <div className="flex justify-between"><span>Số vào sổ:</span> <span className="font-medium text-black">{record.certNumber}</span></div>
                             <div className="flex justify-between">
                                 <span>Ngày cấp:</span> 
                                 <span className={sortConfig.key === 'issue_date' ? 'font-bold text-blue-700 bg-blue-50 px-1 rounded' : ''}>
                                     {record.issueDate}
                                 </span>
                             </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 align-top">
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2 pb-2 border-b border-gray-200">
                           <div className={`bg-gray-50 border border-gray-200 rounded p-1 text-center ${sortConfig.key === 'map_sheet_number' ? 'ring-1 ring-blue-400 bg-blue-50' : ''}`}>
                              <span className="block text-[10px] text-gray-500 uppercase">Tờ số</span>
                              <b className="text-black text-sm">{record.mapSheetNumber}</b>
                           </div>
                           <div className={`bg-gray-50 border border-gray-200 rounded p-1 text-center ${sortConfig.key === 'plot_number' ? 'ring-1 ring-blue-400 bg-blue-50' : ''}`}>
                              <span className="block text-[10px] text-gray-500 uppercase">Thửa số</span>
                              <b className="text-black text-sm">{record.plotNumber}</b>
                           </div>
                           <div className="col-span-2 text-center text-xs">
                              Diện tích: <b className="text-[#003b5c]">{record.area}</b> m²
                           </div>
                        </div>
                        
                        <div className="text-xs space-y-1">
                             <div className="flex items-start gap-1 font-semibold text-gray-800">
                                <MapPin size={12} className="mt-0.5 text-red-500 flex-shrink-0"/>
                                <span>{record.hamlet}</span>
                             </div>
                             
                             <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center justify-between bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase w-8">CŨ</span>
                                    <span className="text-gray-600 italic text-right flex-1">{record.oldCommune}</span>
                                </div>
                                
                                <div className="flex justify-center text-gray-400 -my-1.5 z-10">
                                   <ArrowRight size={10} className="rotate-90"/>
                                </div>

                                <div className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                    <span className="text-[9px] font-bold text-blue-600 uppercase w-8">MỚI</span>
                                    <span className="text-blue-800 font-bold text-right flex-1">{record.newCommune}</span>
                                </div>
                             </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 align-top">
                         <div className="space-y-2 mb-2">
                             {record.blockingDocuments.map((doc, docIndex) => (
                                 <div key={docIndex} className="bg-red-50 border border-red-100 p-1.5 rounded-sm">
                                     <div className="text-red-700 font-semibold text-xs uppercase flex items-center gap-1">
                                        <FileText size={12}/> VB: {doc.docNumber}
                                     </div>
                                     <div className="text-xs mt-0.5 pl-4 text-gray-600 flex flex-wrap gap-x-2">
                                        <span className="flex items-center gap-1"><Calendar size={10}/> {doc.date}</span>
                                        <span className="flex items-center gap-1 font-medium"><Building2 size={10}/> {doc.agency}</span>
                                     </div>
                                     {doc.note && (
                                         <div className="mt-1 ml-4 text-xs text-red-800 italic flex items-start gap-1">
                                             <Info size={10} className="mt-0.5 flex-shrink-0"/> <span>{doc.note}</span>
                                         </div>
                                     )}
                                 </div>
                             ))}
                         </div>
                         
                         {record.isUnblocked && (
                           <div className="mt-2 pt-2 border-t border-dashed border-gray-300">
                               <div className="text-green-700 font-semibold text-xs uppercase flex items-center gap-1">
                                  <Unlock size={12}/> VB Hủy bỏ: {record.unblockDoc}
                                </div>
                           </div>
                         )}

                         {record.notes && (
                            <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 p-1.5 border border-yellow-200 rounded-sm italic">
                                Lưu ý: {record.notes}
                            </div>
                         )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center align-middle">
                        {record.isUnblocked ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded border border-green-200 bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wide">
                                Đã giải ngăn chặn
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded border border-red-200 bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wide animate-pulse">
                                Ngăn chặn
                            </span>
                        )}
                      </td>

                      {/* Hiển thị Người Nhập & Ngày Nhập */}
                      <td className="px-3 py-2 border-r border-gray-300 text-xs text-gray-700">
                          {record.createdBy && (
                              <div className="font-semibold">{record.createdBy}</div>
                          )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-xs text-gray-600 whitespace-nowrap">
                          {formatDateTime(record.createdAt)}
                      </td>

                      {(permissions.edit || permissions.delete) && (
                        <td className="px-3 py-2 text-center align-middle">
                            <div className="flex justify-center gap-1">
                                {permissions.edit && (
                                    <button 
                                        onClick={() => startEdit(record)}
                                        className="text-blue-600 hover:text-white hover:bg-blue-600 p-1.5 rounded transition"
                                        title="Chỉnh sửa hồ sơ"
                                    >
                                        <Edit size={16} />
                                    </button>
                                )}
                                {permissions.delete && (
                                    <button 
                                        onClick={() => handleDeleteRecord(record.id)}
                                        className="text-gray-500 hover:text-white hover:bg-red-600 p-1.5 rounded transition"
                                        title="Xóa hồ sơ"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={permissions.edit || permissions.delete ? 8 : 7} className="px-6 py-10 text-center text-gray-500 italic">
                      {loading ? 'Đang tải...' : 'Không tìm thấy hồ sơ nào phù hợp điều kiện tìm kiếm.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t border-gray-300 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-3">
             <div className="text-xs text-gray-600">
                Hiển thị <b>{(currentPage - 1) * PAGE_SIZE + 1}</b> đến <b>{Math.min(currentPage * PAGE_SIZE, totalCount)}</b> trong tổng số <b>{totalCount}</b> hồ sơ.
             </div>
             
             <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Trang đầu"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <span className="mx-2 text-sm font-bold text-gray-700">
                  Trang {currentPage} / {totalPages || 1}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                  className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                  className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Trang cuối"
                >
                  <ChevronsRight size={16} />
                </button>
             </div>
          </div>
        </div>
      </main>

      {/* Modal Form */}
      {isFormOpen && currentUser && (
        <RecordForm
          initialData={editingRecord}
          currentUser={currentUser}
          onSubmit={editingRecord ? handleUpdateRecord : handleAddRecord}
          onCancel={() => { setIsFormOpen(false); setEditingRecord(undefined); }}
        />
      )}

      {/* User Management Modal */}
      {showUserManagement && currentUser.role === 'admin' && (
        <UserManagement 
          onClose={() => setShowUserManagement(false)} 
          currentUser={currentUser}
        />
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePassword 
          onClose={() => setShowChangePassword(false)} 
          user={currentUser}
        />
      )}
    </div>
  );
}

export default App;