# GadgetStock

**GadgetStock** adalah aplikasi manajemen persediaan (inventory) gadget, yang dirancang untuk membantu pengguna dalam melacak stok, mengelola produk, dan memonitor data terkait gadget secara efisien.

## Table of Contents

- [Fitur Utama](#fitur-utama)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Instalasi](#instalasi)
- [Penggunaan](#penggunaan)
- [Kontribusi](#kontribusi)
- [Lisensi](#lisensi)

## Fitur Utama

- Manajemen persediaan gadget (tambah, edit, hapus, dan pencarian barang)
- Tampilan antarmuka berbasis web yang responsif
- Laporan stok dan transaksi
- Integrasi dengan database PostgreSQL lewat PLpgSQL
- Otomasi dan administrasi menggunakan PowerShell (untuk deployment atau manajemen server)

## Teknologi yang Digunakan

- **HTML** (77.1%): Untuk struktur dan tampilan web
- **JavaScript** (14.2%): Untuk interaktifitas sisi klien
- **CSS** (4.4%): Untuk styling dan desain responsif
- **PLpgSQL** (2.7%): Untuk scripting dan pengelolaan database PostgreSQL
- **PowerShell** (1.6%): Untuk otomasi tugas-tugas server atau deployment

## Instalasi

1. **Clone Repository**
   ```bash
   git clone https://github.com/SukmadiArdi/GadgetStock.git
   cd GadgetStock
   ```

2. **Install Dependencies**
   - Pastikan Anda memiliki Node.js (untuk JavaScript), PostgreSQL, dan PowerShell (jika menggunakan Windows).

3. **Konfigurasi Database**
   - Buat database PostgreSQL baru dan jalankan script PLpgSQL jika tersedia pada folder `db` atau sesuai dokumentasi internal.

4. **Jalankan Aplikasi**
   - Jika ada server (Node.js, Express, atau sejenisnya), jalankan dengan:
     ```bash
     npm install
     npm start
     ```
   - Untuk menjalankan script PowerShell (deploy atau administrasi):
     ```powershell
     .\deploy.ps1
     ```

## Penggunaan

- Akses aplikasi melalui browser web di `http://localhost:PORT` (sesuaikan port dengan konfigurasi).
- Login atau buat akun (jika ada sistem autentikasi).
- Kelola data stok gadget melalui menu yang tersedia.

## Kontribusi

Kontribusi sangat terbuka! Silakan:
- Fork repository ini
- Buat branch fitur/bugfix baru
- Lakukan pull request

## Lisensi

Repositori ini dilisensikan di bawah [MIT License](LICENSE) — silakan gunakan, modifikasi, dan distribusikan sesuai kebutuhan.

---

**Catatan:**  
Dokumentasi lebih detail dapat ditemukan di folder `docs` (jika tersedia). Jika Anda mengalami kendala atau menemukan bug, silakan buat issue di GitHub repository ini.
