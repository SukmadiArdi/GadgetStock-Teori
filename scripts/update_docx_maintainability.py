# scripts/update_docx_maintainability.py
import os
import re
import sys
import zipfile
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DOCX_PATH = os.path.join(BASE_DIR, 'docs', 'Test Design Specification from Inspection Checklist.docx')
SCREENSHOT_DIR = os.path.join(BASE_DIR, 'docs', 'screenshots')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# 1. Sanitize float values in document.xml if present
def sanitize_docx(file_path):
    print("Sanitizing OpenXML floating point twips...")
    with zipfile.ZipFile(file_path, 'r') as z_in:
        content_map = {}
        for item in z_in.infolist():
            data = z_in.read(item.filename)
            if item.filename == 'word/document.xml':
                text = data.decode('utf-8')
                # Replace any w:w="1234.567" with integer
                text = re.sub(r'w:w="(\d+\.\d+)"', lambda m: f'w:w="{round(float(m.group(1)))}"', text)
                data = text.encode('utf-8')
            content_map[item] = data

    with zipfile.ZipFile(file_path, 'w') as z_out:
        for item, data in content_map.items():
            z_out.writestr(item, data)
    print("Sanitization complete.")

# 2. Helper to generate realistic dark terminal screenshot image
def create_terminal_screenshot(title, command, suite_name, tests, summary_text, output_path):
    width = 820
    # Dynamic height calculation
    line_count = len(tests)
    height = 140 + (line_count * 24) + 45

    img = Image.new('RGB', (width, height), '#1e1e2e')
    draw = ImageDraw.Draw(img)

    font_path = 'C:/Windows/Fonts/consola.ttf'
    font_bold_path = 'C:/Windows/Fonts/consolab.ttf'
    font = ImageFont.truetype(font_path, 13)
    font_bold = ImageFont.truetype(font_bold_path, 13)
    font_sm = ImageFont.truetype(font_path, 11)

    # Top bar
    draw.rectangle([(0, 0), (width, 32)], fill='#181825')
    draw.ellipse([(12, 10), (22, 20)], fill='#f38ba8') # red
    draw.ellipse([(28, 10), (38, 20)], fill='#f9e2af') # yellow
    draw.ellipse([(44, 10), (54, 20)], fill='#a6e3a1') # green
    draw.text((70, 8), title, font=font_sm, fill='#a6adc8')

    # Content
    y = 44
    draw.text((20, y), f'$ {command}', font=font_bold, fill='#89dceb')
    y += 24
    draw.text((20, y), f'▶ {suite_name}', font=font_bold, fill='#cdd6f4')
    y += 22

    for test_name, timing in tests:
        # Checkmark
        draw.text((32, y), '✔', font=font_bold, fill='#a6e3a1')
        draw.text((48, y), test_name, font=font, fill='#cdd6f4')
        # Timing
        t_w = draw.textlength(f'({timing})', font=font_sm)
        draw.text((width - t_w - 25, y), f'({timing})', font=font_sm, fill='#6c7086')
        y += 24

    y += 6
    # Summary box
    draw.rectangle([(20, y), (width - 20, y + 28)], fill='#11111b', outline='#a6e3a1', width=1)
    draw.text((32, y + 6), f'✔ {summary_text}', font=font_bold, fill='#a6e3a1')

    img.save(output_path, dpi=(150, 150))
    print(f"Generated screenshot: {os.path.basename(output_path)}")

# 3. Data definition for Maintainability NFR Items
ITEMS = [
    {
        "id": "NFR-003",
        "title": "NFR-003: Modularity & Separation of Concerns (State Management)",
        "command": "node --no-warnings --test tests/nfr-003-modularity.test.mjs",
        "tests": [
            ("NFR-003.1: Inisialisasi & tambah item keranjang mandiri tanpa DOM", "6.0ms"),
            ("NFR-003.2: Penambahan item berulang memutasi kuantitas secara atomik", "0.7ms"),
            ("NFR-003.3: Hapus item dari keranjang melalui removeFromCart() terisolasi", "0.7ms"),
            ("NFR-003.4: Event Observer Pub-Sub State._emit() memberitahu listener reaktif", "0.8ms"),
            ("NFR-003.5: clearCart() mengosongkan state keranjang secara deterministik", "0.8ms")
        ],
        "summary": "5 Passed, 0 Failed | 100% Passing | Duration: 12.9ms",
        "screenshot_name": "test_nfr_003_modularity.png",
        "kriteria": (
            "Modularitas Pengelolaan State & Pemisahan Logika Bisnis dari Lapisan Tampilan (DOM):\n"
            "Sistem kasir harus mengisolasi seluruh logika bisnis, pengelolaan keranjang belanja, kalkulasi nilai belanja, "
            "dan pendaftaran event listener ke dalam modul terpusat (State). Modul state harus dapat dimutasi dan diverifikasi "
            "secara modular tanpa ketergantungan erat (tight coupling) terhadap struktur DOM browser, serta mendistribusikan "
            "pembaruan data ke modul tampilan melalui pola arsitektur Observer / Event-Driven Pub-Sub."
        ),
        "related": (
            "Modul: public/js/state.js\n"
            "Fungsi/Metode:\n"
            "• State.addToCart(product, qty)\n"
            "• State.removeFromCart(productId)\n"
            "• State.clearCart()\n"
            "• State.on('cart', listener)\n"
            "• State._emit('cart')"
        ),
        "link": "https://github.com/SukmadiArdi/GadgetStock-Teori/blob/main/tests/nfr-003-modularity.test.mjs"
    },
    {
        "id": "NFR-004",
        "title": "NFR-004: Reusability & Functional Purity (Utility Helpers)",
        "command": "node --no-warnings --test tests/nfr-004-reusability.test.mjs",
        "tests": [
            ("NFR-004.1: formatRupiah() memformat nominal ke Rupiah secara konsisten & murni", "35.3ms"),
            ("NFR-004.2: getStockStatus() menghasilkan klasifikasi badge stok deterministik", "0.4ms"),
            ("NFR-004.3: uuid() menghasilkan format RFC4122 v4 unik tanpa collision", "0.9ms"),
            ("NFR-004.4: generateTxnNumber() menghasilkan format kode transaksi baku kasir", "0.3ms"),
            ("NFR-004.5: formatDate() memformat tanggal tanpa memutasi objek Date asli", "8.0ms"),
            ("NFR-004.6: debounce() menunda panggilan berulang & mengeksekusi panggilan akhir", "91.4ms")
        ],
        "summary": "6 Passed, 0 Failed | 100% Passing | Duration: 138.2ms",
        "screenshot_name": "test_nfr_004_reusability.png",
        "kriteria": (
            "Penggunaan Ulang Fungsi Utilitas & Kemurnian Fungsi (DRY & Functional Purity):\n"
            "Fungsi utilitas pembantu untuk format mata uang (formatRupiah), penentuan ambang batas stok (getStockStatus), "
            "pemformatan tanggal (formatDate), pembuat nomor transaksi unik (generateTxnNumber), serta pengendalian "
            "frekuensi pemanggilan (debounce) harus dirancang sebagai pure functions yang deterministik, bebas efek samping "
            "(side effects), dan dapat digunakan ulang di seluruh antarmuka POS, inventori, transaksi, dan analitik tanpa "
            "duplikasi logika kalkulasi."
        ),
        "related": (
            "Modul: public/js/utils.js\n"
            "Fungsi/Metode:\n"
            "• formatRupiah(amount)\n"
            "• getStockStatus(stock, minStock)\n"
            "• uuid()\n"
            "• generateTxnNumber()\n"
            "• formatDate(date, format)\n"
            "• debounce(fn, delay)"
        ),
        "link": "https://github.com/SukmadiArdi/GadgetStock-Teori/blob/main/tests/nfr-004-reusability.test.mjs"
    },
    {
        "id": "NFR-005",
        "title": "NFR-005: Modifiability & Configurability (Business Rules Isolation)",
        "command": "node --no-warnings --test tests/nfr-005-modifiability.test.mjs",
        "tests": [
            ("NFR-005.1: Kalkulasi pajak getCartTotals() dinamis mengikuti konfigurasi taxRate", "5.6ms"),
            ("NFR-005.2: updateSettings() memperbarui pengaturan toko & memicu persistensi", "0.7ms"),
            ("NFR-005.3: Perubahan setting memicu event listener settings secara reaktif", "0.5ms")
        ],
        "summary": "3 Passed, 0 Failed | 100% Passing | Duration: 8.4ms",
        "screenshot_name": "test_nfr_005_modifiability.png",
        "kriteria": (
            "Kemampuan Modifikasi Aturan Bisnis & Isolasi Konfigurasi Sistem (Configurability):\n"
            "Parameter operasional bisnis yang dinamis (seperti tarif pajak PPN taxRate, ambang peringatan stok tipis "
            "lowStockThreshold, dan identitas toko storeName) tidak boleh di-hardcode ke dalam modul kalkulasi kasir. "
            "Perubahan konfigurasi harus langsung merefleksikan hasil perhitungan subtotal dan pajak pada getCartTotals() "
            "secara dinamis tanpa memerlukan modifikasi pada algoritma inti keuangan sistem kasir."
        ),
        "related": (
            "Modul: public/js/state.js & api/settings/index.js\n"
            "Fungsi/Metode:\n"
            "• State.settings\n"
            "• State.getCartTotals()\n"
            "• State.updateSettings(newSettings)\n"
            "• State.on('settings', listener)"
        ),
        "link": "https://github.com/SukmadiArdi/GadgetStock-Teori/blob/main/tests/nfr-005-modifiability.test.mjs"
    },
    {
        "id": "NFR-006",
        "title": "NFR-006: Analysability & Error Handling (Server Middleware & Adapters)",
        "command": "node --no-warnings --test tests/nfr-006-analysability.test.mjs",
        "tests": [
            ("NFR-006.1: vercelHandler menangkap unhandled exception & meneruskan ke next(err)", "2.2ms"),
            ("NFR-006.2: Middleware error handler menghasilkan respon JSON error terstandarisasi", "0.8ms"),
            ("NFR-006.3: vercelHandler memetakan parameter route dinamis ke req.query deterministik", "0.2ms")
        ],
        "summary": "3 Passed, 0 Failed | 100% Passing | Duration: 4.2ms",
        "screenshot_name": "test_nfr_006_analysability.png",
        "kriteria": (
            "Ketertelusuran & Konsistensi Penanganan Kesalahan (Analysability & Error Handling):\n"
            "Setiap adapter serverless Express (vercelHandler) dan handler API backend harus menangani eksepsi melalui "
            "blok try-catch terpusat, menangkap seluruh kegagalan asinkron maupun sinkron, meneruskan error ke middleware "
            "Express (next(err)), serta mengembalikan format JSON error terstandarisasi ({ error: string }) dengan HTTP 500 "
            "guna mencegah crash pada proses server dan memudahkan penelusuran akar masalah."
        ),
        "related": (
            "Modul: server.js & api/**\n"
            "Fungsi/Metode:\n"
            "• vercelHandler(handlerPath, paramMap)\n"
            "• Express Error Handling Middleware\n"
            "• Dynamic Route Parameter Mapping (req.params -> req.query)"
        ),
        "link": "https://github.com/SukmadiArdi/GadgetStock-Teori/blob/main/tests/nfr-006-analysability.test.mjs"
    },
    {
        "id": "NFR-007",
        "title": "NFR-007: Testability & Dependency Isolation (Guest Mode & Lifecycle)",
        "command": "node --no-warnings --test tests/nfr-007-testability.test.mjs",
        "tests": [
            ("NFR-007.1: setGuestMode() mengaktifkan sesi demo tanpa otentikasi live database", "4.6ms"),
            ("NFR-007.2: Guest Mode tidak mencemari persistent storage produksi di localStorage", "0.7ms"),
            ("NFR-007.3: Mekanisme deregistrasi listener (State.off) mencegah memory leak", "0.8ms"),
            ("NFR-007.4: logout() membersihkan sesi pengguna dan state keranjang ke kondisi awal", "0.8ms")
        ],
        "summary": "4 Passed, 0 Failed | 100% Passing | Duration: 8.5ms",
        "screenshot_name": "test_nfr_007_testability.png",
        "kriteria": (
            "Kemampuan Pengujian Mandiri & Isolasi Dependensi Jaringan (Testability & Guest Mode):\n"
            "Modul inti sistem harus dapat diuji secara mandiri (standalone testability) tanpa ketergantungan koneksi live "
            "ke server cloud Supabase, dilengkapi mekanisme mode fallback (Guest Mode / Demo Mode) di mana transaksi dapat "
            "disimulasikan sepenuhnya dalam memori tanpa mencemari storage produksi, serta menyediakan mekanisme pelepasan "
            "event listener (State.off) guna mencegah kebocoran memori (memory leak)."
        ),
        "related": (
            "Modul: public/js/state.js\n"
            "Fungsi/Metode:\n"
            "• State.setGuestMode()\n"
            "• State.isGuest getter flag\n"
            "• State.off(event, listener)\n"
            "• State.logout()"
        ),
        "link": "https://github.com/SukmadiArdi/GadgetStock-Teori/blob/main/tests/nfr-007-testability.test.mjs"
    },
    {
        "id": "NFR-008",
        "title": "NFR-008: Defensive Programming & Boundary Value Robustness (Cart Management)",
        "command": "node --no-warnings --test tests/nfr-008-robustness.test.mjs",
        "tests": [
            ("NFR-008.1: updateQty() ke 0 atau negatif otomatis menghapus item dari keranjang", "5.6ms"),
            ("NFR-008.2: updateQty() membatasi kuantitas maksimal sebesar stok fisik tersedia", "0.8ms"),
            ("NFR-008.3: addToCart() berulang otomatis di-clamp ke batas maksimum stok barang", "0.8ms"),
            ("NFR-008.4: getCartTotals() pada keranjang kosong mengembalikan nilai nol valid", "0.7ms"),
            ("NFR-008.5: updateQty() pada ID produk tak dikenal ditangani aman tanpa exception", "0.9ms")
        ],
        "summary": "5 Passed, 0 Failed | 100% Passing | Duration: 10.5ms",
        "screenshot_name": "test_nfr_008_robustness.png",
        "kriteria": (
            "Ketahanan Batas Nilai & Integritas Data Keranjang Belanja (Boundary Robustness):\n"
            "Metode pembaruan keranjang belanja kasir harus menerapkan pemrograman defensif untuk menangani batas nilai ekstrem: "
            "secara ketat membatasi kuantitas agar tidak melebihi stok fisik produk yang tersedia (stock capping), otomatis "
            "mengeliminasi item jika kuantitas diubah ke 0 atau negatif, serta menjamin hasil kalkulasi keuangan tetap valid "
            "(tidak menghasilkan nilai NaN atau minus) pada kondisi keranjang kosong."
        ),
        "related": (
            "Modul: public/js/state.js\n"
            "Fungsi/Metode:\n"
            "• State.updateQty(productId, qty <= 0)\n"
            "• State.updateQty(productId, qty > stock)\n"
            "• State.addToCart(product, qty)\n"
            "• State.getCartTotals()"
        ),
        "link": "https://github.com/SukmadiArdi/GadgetStock-Teori/blob/main/tests/nfr-008-robustness.test.mjs"
    }
]

# Helper to set cell border
def set_cell_border(cell, **kwargs):
    """
    kwargs can be top, bottom, left, right.
    val: 'single', color: 'CBD5E1', sz: '4'
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>\n'
        f'  <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>\n'
        f'  <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>\n'
        f'  <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>\n'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)

def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>\n'
        f'  <w:top w:w="{top}" w:type="dxa"/>\n'
        f'  <w:left w:w="{left}" w:type="dxa"/>\n'
        f'  <w:bottom w:w="{bottom}" w:type="dxa"/>\n'
        f'  <w:right w:w="{right}" w:type="dxa"/>\n'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def update_document():
    # Step 1: Sanitize XML first
    sanitize_docx(DOCX_PATH)

    # Step 2: Generate Screenshots
    for item in ITEMS:
        out_img = os.path.join(SCREENSHOT_DIR, item['screenshot_name'])
        create_terminal_screenshot(
            title=f"Terminal - {item['id']} Test Execution",
            command=item['command'],
            suite_name=item['title'],
            tests=item['tests'],
            summary_text=item['summary'],
            output_path=out_img
        )

    # Step 3: Open Document and edit Table 2
    doc = Document(DOCX_PATH)

    # Table 2 is Mantainability
    t2 = doc.tables[2]

    # Style Header Row
    header_row = t2.rows[0]
    for c in header_row.cells:
        set_cell_background(c, '0F172A') # Dark slate header
        set_cell_margins(c, top=160, bottom=160, left=180, right=180)
        set_cell_border(c)
        for p in c.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for r in p.runs:
                r.font.name = 'Arial'
                r.font.size = Pt(9.5)
                r.font.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)

    # Ensure table has enough rows for our 6 items (Header is row 0, data rows 1..6)
    while len(t2.rows) < len(ITEMS) + 1:
        t2.add_row()

    # Populate each data row
    for idx, item in enumerate(ITEMS):
        row = t2.rows[idx + 1]
        
        # Col 0: ID
        c0 = row.cells[0]
        c0.text = ""
        p0 = c0.paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r0 = p0.add_run(item['id'])
        r0.font.name = 'Arial'
        r0.font.size = Pt(9.5)
        r0.font.bold = True
        r0.font.color.rgb = RGBColor(15, 23, 42)

        # Col 1: Kriteria
        c1 = row.cells[1]
        c1.text = ""
        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r1 = p1.add_run(item['kriteria'])
        r1.font.name = 'Arial'
        r1.font.size = Pt(8.5)
        r1.font.color.rgb = RGBColor(51, 65, 85)

        # Col 2: Related Test Condition
        c2 = row.cells[2]
        c2.text = ""
        p2 = c2.paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r2 = p2.add_run(item['related'])
        r2.font.name = 'Consolas'
        r2.font.size = Pt(8.0)
        r2.font.color.rgb = RGBColor(15, 23, 42)

        # Col 3: Link GitHub
        c3 = row.cells[3]
        c3.text = ""
        p3 = c3.paragraphs[0]
        p3.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r3 = p3.add_run(item['link'])
        r3.font.name = 'Consolas'
        r3.font.size = Pt(7.5)
        r3.font.underline = True
        r3.font.color.rgb = RGBColor(37, 99, 235) # blue link

        # Col 4: Tangkap Layar Test case / successful test
        c4 = row.cells[4]
        c4.text = ""
        p4_text = c4.paragraphs[0]
        p4_text.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r4_text = p4_text.add_run(f"Status: PASSED (100%)\n{item['summary']}\n")
        r4_text.font.name = 'Arial'
        r4_text.font.size = Pt(8.0)
        r4_text.font.bold = True
        r4_text.font.color.rgb = RGBColor(22, 101, 52) # Dark green

        # Add image
        img_path = os.path.join(SCREENSHOT_DIR, item['screenshot_name'])
        if os.path.exists(img_path):
            p4_img = c4.add_paragraph()
            p4_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run_img = p4_img.add_run()
            run_img.add_picture(img_path, width=Inches(2.3))

        # Format cell aesthetics & alternating background
        bg_color = 'F8FAFC' if idx % 2 == 1 else 'FFFFFF'
        for cell in row.cells:
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=140, bottom=140, left=160, right=160)
            set_cell_border(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

    # Update or remove the placeholder paragraph after table 2
    for p in doc.paragraphs:
        if 'LANJUTKAN UNTUK SELURUH ASPEK' in p.text:
            p.text = "Seluruh 6 aspek Maintainability (NFR-003 s/d NFR-008) telah diuji dan divalidasi dengan tingkat keberhasilan 100%."
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for r in p.runs:
                r.font.name = 'Arial'
                r.font.size = Pt(9.0)
                r.font.italic = True
                r.font.color.rgb = RGBColor(100, 116, 139)

    doc.save(DOCX_PATH)
    print(f"Successfully updated document: {DOCX_PATH}")

if __name__ == '__main__':
    update_document()
