# PROMPT — Scaffold PintAR v2 (Vite + React + MindAR.js)

Gunakan prompt di bawah ini di ChatGPT, Claude, Cursor, atau AI coding assistant lainnya untuk membuat project ini dari awal.

---

## PROMPT (Copy-paste ini)

```
Saya mau membuat project WebAR edukasi sains bernama "PintAR v2" dari awal. Berikut spesifikasinya:

## Tech Stack
- Vite 5 sebagai build tool
- React 18 untuk UI
- React Router DOM 6 untuk routing
- MindAR.js 1.2+ untuk AR (image tracking)
- Three.js 0.158+ untuk 3D rendering
- Tailwind CSS 3.4 untuk styling
- PWA support (vite-plugin-pwa)

## Deskripsi Aplikasi
Aplikasi lab sains virtual untuk siswa SMP/SMA Indonesia. Ada 8 eksperimen (pendulum, freefall, chemistry, refraction, archimedes, circuit, solarsystem, redox). Setiap eksperimen punya 2 mode:
1. Mode Simulasi: Canvas 2D interaktif dengan slider parameter
2. Mode AR: Kamera HP scan image target → muncul objek 3D di atas target

## Yang Perlu Dibuatkan

### 1. Project Setup
- package.json dengan semua dependencies
- vite.config.js
- tailwind.config.js + postcss.config.js
- index.html (meta viewport, PWA meta)

### 2. Struktur Folder
```
src/
  main.jsx
  App.jsx (router)
  index.css (tailwind)
  components/
    ARScene.jsx      — MindAR + Three.js integration
    SimCanvas.jsx    — 2D canvas wrapper (requestAnimationFrame)
    ModeSwitch.jsx   — toggle Simulasi/AR
    ExperimentLayout.jsx — shared layout
    ControlPanel.jsx — slider/dropdown controls
    DataBar.jsx      — live data display
  experiments/
    Pendulum.jsx     — contoh lengkap simulasi + AR
    SolarSystem.jsx  — contoh kedua
  hooks/
    useAR.js         — MindAR lifecycle (start, stop, cleanup)
    useSimulation.js — physics loop with RAF
  pages/
    Home.jsx         — landing + grid eksperimen
```

### 3. ARScene Component (PALING PENTING)
Komponen React yang:
- Mount → init MindAR image tracking + Three.js scene
- Render camera feed FULLSCREEN (100vw x 100vh, position:fixed)
- Detect image target → tampilkan children 3D (Three.js objects)
- Ada tombol "Tutup AR" (fixed, z-index tinggi, selalu clickable)
- Unmount → BERSIH cleanup:
  * Stop MindAR
  * Stop semua video track (camera)
  * Dispose Three.js renderer + scene + geometries + materials
  * Remove semua DOM elements yang di-inject
  * JANGAN tinggalkan inline style di body/html

### 4. Contoh Eksperimen: Pendulum
- Mode Sim: Canvas 2D menggambar pendulum berayun
- Kontrol: panjang tali (slider), massa (slider), gravitasi (dropdown)
- Data live: periode teori vs aktual
- Mode AR: Scan target → tampilkan pendulum 3D (tiang + tali + bola berayun)
- Transisi Sim ↔ AR tanpa reload halaman

### 5. Contoh Eksperimen: Solar System
- Mode Sim: Canvas 2D orbit planet
- Mode AR: Scan target → tampilkan matahari + 6 planet berputar + ring orbit

### 6. Styling
- Mobile-first responsive
- Dark mode support
- Tombol besar (touch-friendly, min 44px)
- Font: system font stack
- Warna brand: primary #0066FF, secondary #00C853

### 7. Critical Requirements
- HARUS jalan di iOS Safari 15+ (ini yang paling sering bug)
- HARUS jalan di Chrome Android 90+
- Setelah tutup AR, halaman HARUS kembali normal (tidak rusak)
- Camera feed HARUS fullscreen (tidak half-screen)
- Offline mode untuk simulasi (service worker cache)

### 8. MindAR Image Target
- Gunakan image target file .mind (compile dari gambar menggunakan MindAR compiler)
- Untuk development, bisa pakai contoh target dari MindAR docs
- Target image bisa di-host di /public/targets/

### 9. Jangan Lakukan
- JANGAN pakai AR.js (bug di iOS, unmaintained)
- JANGAN pakai MutationObserver untuk override style video/canvas
- JANGAN inject inline style ke document.body
- JANGAN pakai A-Frame (terlalu berat, sering conflict)
- JANGAN pakai class component (hooks only)

## Output yang Diharapkan
Berikan SEMUA file lengkap yang bisa langsung saya copy ke project dan jalankan dengan:
```bash
npm install
npm run dev
```

Pastikan setelah npm install dan npm run dev, saya bisa:
1. Buka localhost:3000
2. Lihat halaman home dengan grid eksperimen
3. Klik eksperimen Pendulum
4. Mode simulasi: canvas pendulum berayun
5. Tap "Mode AR" → kamera nyala fullscreen
6. Scan image target → objek 3D muncul
7. Tap "Tutup AR" → kembali ke simulasi tanpa bug
```

---

## Tips Penggunaan Prompt

1. **Di ChatGPT/Claude**: Paste seluruh prompt di atas. Minta dia generate file satu per satu kalau terlalu panjang.

2. **Di Cursor/Windsurf**: Buat folder kosong, init git, lalu paste prompt sebagai instruction. AI akan generate semua file.

3. **Di Kiro**: Mulai session baru, paste prompt, Kiro akan scaffold + build semuanya.

4. **Iterasi**: Setelah scaffold jadi, bisa minta:
   - "Tambahkan eksperimen FreeFall"
   - "Buat image target compiler page"
   - "Tambahkan quiz component"
   - "Deploy ke Vercel"
