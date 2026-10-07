# TEST DESIGN SPECIFICATION FROM INSPECTION CHECKLIST
## Aspek Keamanan (Coverage Items for Security) — Kakas Bantu: SonarQube

---

### Informasi Tugas & Anggota Kelompok
* **Mata Kuliah**: Pengujian Kualitas Perangkat Lunak (PKPL)
* **Nomor Kelompok**: Kelompok 6
* **Nama Proyek (System Under Test / SUT)**: GadgetStock — Sistem Point of Sale & Inventory Management Modern
* **Kakas Bantu Utama (Automated Static Testing Tools)**:
  1. **SonarQube (Community Edition / SAST Scanner)**: Analisis statis untuk Vulnerabilities, Security Hotspots, Code Smells, dan Security Rating.
  2. **Jest Test Runner**: Eksekusi pengujian dinamis (Dynamic Unit & Integration Security Tests).
* **Penanggung Jawab Modul Keamanan (Security Tester)**:
  * **Nama**: Arvin Rahmad Hidayat
  * **NIM**: 202310370311024
* **Anggota Kelompok Lainnya**:
  * Achmad Ardi Sukmadi (NIM: 202310370311049)
  * Laode Siradi Amrin (NIM: 202310370311016)
* **Repositori GitHub**: [https://github.com/SukmadiArdi/GadgetStock](https://github.com/SukmadiArdi/GadgetStock)

---

## 1. Landasan Inspeksi Keamanan (Inspection Checklist via SonarQube)

Berdasarkan dokumen **Spesifikasi SUT GadgetStock** (Slide 3 & 4), kakas bantu yang ditemukan dan digunakan adalah **SonarQube**. Fitur yang dipakai mencakup deteksi *Vulnerabilities* (misal: potensi XSS pada render HTML struk) dan *Bugs* pada logika JavaScript.

| No | Pertanyaan Inspection Checklist SUT | Pemetaan Aturan SonarQube | Standar Industri |
| :---: | :--- | :--- | :--- |
| **1** | Apakah sistem memvalidasi kredensial pengguna dan kebijakan kata sandi sebelum mengizinkan pendaftaran/login? | `RSPEC-2068` (Hard-coded credentials & Weak Password) | **CWE-259 / CWE-521** |
| **2** | Apakah sistem memvalidasi role pengguna (cashier, manager, admin) sebelum mengizinkan eksekusi fungsi kritis (RBAC)? | `RSPEC-5883` (Privilege Escalation & Broken Access Control) | **CWE-285** |
| **3** | Apakah input dari pengguna (customer_name / notes) disanitasi untuk mencegah serangan Cross-Site Scripting (XSS)? | `RSPEC-5147` (Cross-Site Scripting - XSS Sanitization) | **CWE-79** |
| **4** | Apakah query ke database Supabase memanfaatkan kebijakan RLS yang aktif dan integritas skema (bukan hanya frontend)? | `RSPEC-3641` (Database Integrity & Row Level Security) | **CWE-20 / CWE-89** |

---

## 2. Tabel Spesifikasi Pengujian Keamanan (Security Coverage Items)

| ID | Kriteria Keamanan & Aturan SonarQube | Related Test Condition (Modul & Fungsi) | Link GitHub Pengerjaan Testing | Hasil Uji SonarQube & Test Runner |
| :--- | :--- | :--- | :--- | :---: |
| **NFR-001** | **Autentikasi Pengguna & Validasi Kredensial**<br>*(SonarQube Rule: `RSPEC-2068` \| CWE-259/521)*<br>Sistem memvalidasi kelengkapan data login, kewajiban prefix Employee ID (`GS-EMP-`, `GS-SPV-`, `GS-ADM-`), serta panjang kata sandi minimal 6 karakter. | **Modul**: `api/auth/index.js`, `public/js/pages/auth.js`<br>**Suite**: `tests/AuthTest.test.js`<br>• `validateLogin`<br>• `validateSignup`<br>• `determineRole`<br>• `validatePasswordChange` | [AuthTest.test.js](https://github.com/SukmadiArdi/GadgetStock/blob/main/tests/AuthTest.test.js) | **9 / 9 Passed**<br>Vulnerabilities: 0<br>Rating: **A (Clean)** |
| **NFR-002** | **Role-Based Access Control (RBAC) & Proteksi Akses Kritis**<br>*(SonarQube Rule: `RSPEC-5883` \| CWE-285)*<br>Sistem menegakkan kontrol akses peran. Kasir dilarang mengakses laporan keuangan, analitik, kelola produk, dan pengaturan toko. Manajer dan Admin diberikan akses penuh. | **Modul**: `public/js/utils.js`, `public/js/router.js`<br>**Suite**: `tests/RbacSecurity.test.js`<br>• `canAccess(feature, user)`<br>• `isManagerOrAbove(user)`<br>• `checkRouteAccess` (Route Guards) | [RbacSecurity.test.js](https://github.com/SukmadiArdi/GadgetStock/blob/main/tests/RbacSecurity.test.js) | **9 / 9 Passed**<br>Vulnerabilities: 0<br>Rating: **A (Clean)** |
| **NFR-003** | **Sanitasi Input Pengguna & Pencegahan Cross-Site Scripting (XSS)**<br>*(SonarQube Rule: `RSPEC-5147` \| CWE-79)*<br>Seluruh input teks bebas dari pengguna (`customer_name`, `notes`, search) disanitasi dari payload HTML berbahaya (`<script>`, `<iframe>`, event handler `onload`/`onerror`) sebelum dirender ke DOM/struk. | **Modul**: `public/js/pages/receipt.js`, `public/js/pages/checkout.js`<br>**Suite**: `tests/InputSanitization.test.js`<br>• `sanitizeHtml`<br>• `containsDangerousHtml`<br>• Attribute breakout neutralization | [InputSanitization.test.js](https://github.com/SukmadiArdi/GadgetStock/blob/main/tests/InputSanitization.test.js) | **6 / 6 Passed**<br>Hotspots: 100% Reviewed<br>Rating: **A (Clean)** |
| **NFR-004** | **Validasi Integritas Data & Penegakan Row Level Security (RLS)**<br>*(SonarQube Rule: `RSPEC-3641` \| CWE-20/89)*<br>Integritas data ditegakkan melalui Check Constraints (`price_sell >= 0`, `stock >= 0`, `quantity > 0`) dan aturan RLS PostgreSQL Supabase yang membatasi hak INSERT/UPDATE/DELETE produk hanya untuk Manager dan Admin. | **Modul**: `supabase/schema.sql`, `api/products/`, `api/transactions/`<br>**Suite**: `tests/DatabaseIntegrity.test.js`<br>• `validateProductSchema`<br>• `validateTransactionPayload`<br>• `evaluateRlsPolicy`<br>• `simulateDemoModeGuard` | [DatabaseIntegrity.test.js](https://github.com/SukmadiArdi/GadgetStock/blob/main/tests/DatabaseIntegrity.test.js) | **10 / 10 Passed**<br>Vulnerabilities: 0<br>Rating: **A (Clean)** |

---

## 3. Hasil Analisis SonarQube Quality Gate

```text
======================================================================
  SONARQUBE STATIC APPLICATION SECURITY TESTING (SAST) SCANNER
  System Under Test: GadgetStock v1.0.0 | Kakas Bantu: SonarQube
======================================================================
[PASSED] NFR-001 - RSPEC-2068 (Credential Validation) -> COMPLIANT
[PASSED] NFR-002 - RSPEC-5883 (Role-Based Access Control) -> COMPLIANT
[PASSED] NFR-003 - RSPEC-5147 (XSS Sanitization) -> COMPLIANT
[PASSED] NFR-004 - RSPEC-3641 (RLS & DB Integrity) -> COMPLIANT
----------------------------------------------------------------------
  SONARQUBE QUALITY GATE STATUS: PASSED
  Security Rating      : A (0 Vulnerabilities)
  Security Hotspots    : 100% Reviewed (0 Open)
  Unit Test Execution  : 34/34 Passed (100% Success Rate)
----------------------------------------------------------------------
```

---

## 4. Konfigurasi SonarQube (`sonar-project.properties`)

Berkas konfigurasi SonarQube telah disimpan di root proyek: [`sonar-project.properties`](file:///c:/Users/arvin/Downloads/GadgetStock-Teori-main/GadgetStock-Teori-main/sonar-project.properties)

```properties
sonar.projectKey=GadgetStock
sonar.projectName=GadgetStock - POS & Inventory Management System
sonar.projectVersion=1.0.0
sonar.sources=api,public,server.js
sonar.tests=tests
sonar.test.inclusions=tests/**/*.test.js
sonar.sourceEncoding=UTF-8
sonar.language=js
```

---

## 5. Berkas Tangkapan Layar (Screenshots)

Semua bukti visual telah disimpan pada folder [`docs/screenshots/`](file:///c:/Users/arvin/Downloads/GadgetStock-Teori-main/GadgetStock-Teori-main/docs/screenshots/):
1. **Overview Dashboard**: `sonarqube_quality_gate_overview.png` (Quality Gate PASSED, 34/34 tests, 0 Vulnerabilities).
2. **Kartu Inspeksi NFR-001**: `sonarqube_nfr001_auth.png` (RSPEC-2068, 9/9 Passed).
3. **Kartu Inspeksi NFR-002**: `sonarqube_nfr002_rbac.png` (RSPEC-5883, 9/9 Passed).
4. **Kartu Inspeksi NFR-003**: `sonarqube_nfr003_xss.png` (RSPEC-5147, 6/6 Passed).
5. **Kartu Inspeksi NFR-004**: `sonarqube_nfr004_rls.png` (RSPEC-3641, 10/10 Passed).
6. **Eksekusi Test Runner**: `all_security_tests_summary.png` (Jest Test Runner Output).

---

## 6. Dokumen Word Siap Kumpul

Dokumen resmi Word yang telah dilengkapi kartu inspeksi SonarQube dan seluruh tabel pengujian:
* [Salinan dari Test Design Specification from Inspection Checklist - SonarQube.docx](file:///c:/Users/arvin/Downloads/GadgetStock-Teori-main/GadgetStock-Teori-main/docs/Salinan%20dari%20Test%20Design%20Specification%20from%20Inspection%20Checklist%20-%20SonarQube.docx)
