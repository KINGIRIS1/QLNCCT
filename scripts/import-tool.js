
/**
 * TOOL IMPORT DỮ LIỆU SỐ LƯỢNG LỚN TỪ EXCEL VÀO SUPABASE (ES MODULE VERSION)
 * -------------------------------------------------------
 * Cách dùng:
 * 1. Cài đặt: npm install @supabase/supabase-js xlsx
 * 2. Đặt file Excel cần nhập cùng thư mục hoặc sửa đường dẫn FILE_PATH
 * 3. Điền URL và KEY của Supabase vào bên dưới
 * 4. Chạy lệnh: node scripts/import-tool.js
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import path from 'path';

// --- CẤU HÌNH (BẠN CẦN ĐIỀN THÔNG TIN VÀO ĐÂY) ---
const SUPABASE_URL = 'https://dajjhubrhybodggbqapt.supabase.co'; 
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY_OR_ANON_KEY'; 
// Lưu ý: Để import số lượng lớn an toàn, nên dùng "service_role" key (trong Project Settings -> API) 
// để bỏ qua các giới hạn RLS (Row Level Security), hoặc dùng Anon Key nếu đã tắt RLS.

// CẬP NHẬT: Dùng dấu gạch chéo (/) cho đường dẫn Windows để tránh lỗi ký tự đặc biệt (ví dụ \t bị hiểu là Tab)
const FILE_PATH = 'D:/test/import_data.xlsx'; 
const BATCH_SIZE = 100; // Số lượng bản ghi gửi mỗi lần (Giảm xuống nếu mạng yếu)

// Khởi tạo Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Hàm chuyển đổi ngày Excel sang YYYY-MM-DD
function excelDateToJSDate(serial) {
    if (!serial) return null;
    if (typeof serial === 'string') return serial;
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;                                        
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().split('T')[0];
}

async function importData() {
    console.log(`⏳ Đang đọc file: ${FILE_PATH}...`);
    
    let workbook;
    try {
        workbook = XLSX.readFile(FILE_PATH);
    } catch (e) {
        console.error(`❌ Lỗi: Không tìm thấy file hoặc không đọc được file tại: '${FILE_PATH}'`);
        console.error(`👉 Mẹo: Hãy chắc chắn đường dẫn dùng dấu '/' hoặc '\\\\' thay vì '\\' đơn lẻ.`);
        return;
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    if (jsonData.length === 0) {
        console.log("⚠️ File Excel không có dữ liệu.");
        return;
    }

    console.log(`✅ Đã đọc ${jsonData.length} dòng dữ liệu. Đang xử lý...`);

    // Biến đổi dữ liệu sang định dạng Database
    const records = jsonData.map((row, index) => {
        // Xử lý mảng Chủ sử dụng
        // Tách bằng Regex /[\r\n;]+/ để bắt cả dấu xuống dòng (Alt+Enter) và dấu chấm phẩy
        const owners = row["ChuSuDung"] 
            ? row["ChuSuDung"].toString().split(/[\r\n;]+/).map(s => s.trim()).filter(s => s !== '')
            : [];

        // Xử lý Văn bản ngăn chặn (Tạo mảng đối tượng JSON)
        const blockingDoc = {
            docNumber: row["SoVanBanNganChan"]?.toString() || '',
            date: excelDateToJSDate(row["NgayVanBan"]),
            agency: row["CoQuanBanHanh"]?.toString() || '',
            note: row["NoiDungNganChan"]?.toString() || ''
        };

        // Chỉ thêm vào mảng nếu có số hiệu văn bản
        const blockingDocuments = blockingDoc.docNumber ? [blockingDoc] : [];
        const unblockDoc = row["VanBanGiaiToa"]?.toString() || '';

        // Mapping dữ liệu
        return {
            // id: Để Supabase tự sinh (nếu cột id trong DB là uuid/bigint auto) 
            // hoặc tự tạo string ID như app React đang làm:
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5) + index, 
            
            owners: owners, // Supabase sẽ tự convert sang JSONB
            issue_number: row["SoPhatHanh"]?.toString() || '',
            cert_number: row["SoVaoSo"]?.toString() || '',
            issue_date: excelDateToJSDate(row["NgayCap"]),
            area: Number(row["DienTich"]) || 0,
            plot_number: row["ThuaSo"]?.toString() || '',
            map_sheet_number: row["ToSo"]?.toString() || '',
            hamlet: row["ApKhuPho"]?.toString() || '',
            old_commune: row["XaPhuongCu"]?.toString() || '',
            new_commune: row["XaPhuongMoi"]?.toString() || '',
            
            blocking_documents: blockingDocuments, // JSONB
            
            unblock_doc: unblockDoc,
            notes: row["GhiChu"]?.toString() || '',
            is_unblocked: !!unblockDoc
        };
    });

    // Bắt đầu gửi dữ liệu theo từng đợt (Batching)
    console.log(`🚀 Bắt đầu đẩy dữ liệu lên Supabase (Batch size: ${BATCH_SIZE})...`);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('land_records').insert(batch);

        if (error) {
            console.error(`❌ Lỗi tại batch ${i} - ${i + BATCH_SIZE}:`, error.message);
            errorCount += batch.length;
        } else {
            successCount += batch.length;
            process.stdout.write(`\r✅ Đã nhập: ${successCount}/${records.length} hồ sơ...`);
        }
    }

    console.log("\n------------------------------------------------");
    console.log("🎉 HOÀN TẤT!");
    console.log(`✅ Thành công: ${successCount}`);
    console.log(`❌ Thất bại:   ${errorCount}`);
}

importData();
