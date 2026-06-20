# PRD — PintAR v2: Lab Sains Virtual dengan WebAR

## 1. Overview

**PintAR v2** adalah aplikasi web Progressive Web App (PWA) untuk praktikum sains interaktif bagi siswa SMP/SMA di Indonesia. Aplikasi menampilkan eksperimen fisika & kimia dalam 2 mode: **Simulasi 2D** (tanpa kamera) dan **AR 3D** (scan image target dengan kamera HP).

### Goals
- AR yang **benar-benar kompatibel** di iOS Safari & Android Chrome
- UI modern, responsive, mobile-first
- Bisa diakses tanpa install (PWA)
- Performa ringan di HP budget

### Target Users
- Siswa SMP/SMA Indonesia (13-18 tahun)
- Guru sains yang ingin demo eksperimen virtual
- Device: HP Android budget (RAM 3-4GB) dan iPhone (iOS 15+)

---

## 2. Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| Build Tool | Vite | ^5.4 |
| UI Framework | React | ^18.3 |
| Routing | React Router DOM | ^6.26 |
| AR Engine | MindAR.js | ^1.2.5 |
| 3D Rendering | Three.js | ^0.158 |
| Styling | Tailwind CSS | ^3.4 |
| PWA | vite-plugin-pwa | ^0.20 |
| Deploy | Vercel / Netlify / GitHub Pages | - |

### Kenapa MindAR.js (bukan AR.js)?
- Aktif maintained (2024)
- Image tracking lebih stabil dari marker-based
- Tidak inject inline style ke body (penyebab bug di AR.js)
- Support iOS Safari tanpa bug half-screen
- Bisa custom target image (tidak terbatas Hiro marker)

---

## 3. Fitur Utama

### 3.1 Mode Simulasi (2D Canvas)
- Canvas rendering dengan requestAnimationFrame
- Kontrol parameter via slider/dropdown
- Grafik realtime
- Data live (periode, kecepatan, dll)
- Shake/tilt HP untuk interaksi (sensor)

### 3.2 Mode AR (3D via Kamera)
- Scan image target → munculkan objek 3D
- Fullscreen kamera feed
- Objek 3D interaktif (animasi, label)
- Tombol "Tutup AR" selalu accessible
- Transisi mulus AR ↔ Simulasi (tanpa reload)

### 3.3 Eksperimen (8 total)
1. **Bandul (Pendulum)** — T = 2π√(L/g)
2. **Gerak Jatuh Bebas** — h = ½gt²
3. **Reaksi Kimia** — perubahan pH, suhu, warna
4. **Pembiasan Cahaya** — Hukum Snell
5. **Hukum Archimedes** — gaya apung
6. **Rangkaian Listrik** — Hukum Ohm
7. **Tata Surya** — Hukum Kepler III
8. **Reaksi Redoks** — potensial sel

### 3.4 Fitur Pendukung
- LKS Digital (Lembar Kerja Siswa) — catat hasil, kirim ke guru
- Quiz per eksperimen
- Tutorial onboarding
- Dark/light mode
- Offline support (PWA)

---

## 4. Arsitektur

```
pintar-v2/
├── public/
│   ├── targets/           ← Image target untuk MindAR (.mind files)
│   ├── models/            ← 3D models (.glb/.gltf)
│   └── icons/             ← PWA icons
├── src/
│   ├── main.jsx           ← Entry point
│   ├── App.jsx            ← Router setup
│   ├── index.css          ← Tailwind directives
│   ├── components/
│   │   ├── ARScene.jsx        ← MindAR + Three.js wrapper
│   │   ├── SimCanvas.jsx      ← 2D canvas simulation wrapper
│   │   ├── ModeSwitch.jsx     ← Toggle Simulasi/AR
│   │   ├── ExperimentLayout.jsx ← Shared layout (header, controls, data bar)
│   │   ├── ControlPanel.jsx   ← Slider/dropdown controls
│   │   ├── DataBar.jsx        ← Live data display
│   │   ├── Graph.jsx          ← Realtime graph
│   │   └── Navbar.jsx         ← Top navigation
│   ├── experiments/
│   │   ├── Pendulum.jsx
│   │   ├── FreeFall.jsx
│   │   ├── Chemistry.jsx
│   │   ├── Refraction.jsx
│   │   ├── Archimedes.jsx
│   │   ├── Circuit.jsx
│   │   ├── SolarSystem.jsx
│   │   └── Redox.jsx
│   ├── hooks/
│   │   ├── useAR.js           ← MindAR lifecycle hook
│   │   ├── useSensors.js      ← DeviceMotion/Orientation
│   │   └── useSimulation.js   ← Physics loop hook
│   ├── pages/
│   │   └── Home.jsx           ← Landing page + experiment grid
│   └── utils/
│       ├── physics.js         ← Shared physics formulas
│       └── constants.js       ← Gravitasi, densitas, dll
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 5. Komponen Kunci

### 5.1 `ARScene.jsx` — MindAR Wrapper

```jsx
// Pseudocode structure
function ARScene({ targetSrc, children3D, onDetected, onLost }) {
  const containerRef = useRef();
  
  useEffect(() => {
    // 1. Init MindAR with image target
    // 2. Init Three.js scene + camera + renderer
    // 3. Add 3D content (children3D) to anchor
    // 4. Start MindAR
    // 5. On unmount → stop MindAR, dispose Three.js, stop camera
  }, []);

  return <div ref={containerRef} className="fixed inset-0 z-50" />;
}
```

### 5.2 `useAR.js` — Custom Hook

```js
// Manages MindAR lifecycle
function useAR() {
  const [arActive, setArActive] = useState(false);
  const [markerDetected, setMarkerDetected] = useState(false);
  
  const startAR = async (targetSrc) => { /* init MindAR */ };
  const stopAR = () => { /* cleanup everything */ };
  
  return { arActive, markerDetected, startAR, stopAR };
}
```

### 5.3 `ModeSwitch.jsx`

```jsx
function ModeSwitch({ mode, onModeChange }) {
  return (
    <div className="flex gap-2">
      <button active={mode === 'sim'}>📱 Simulasi</button>
      <button active={mode === 'ar'}>📷 Mode AR</button>
    </div>
  );
}
```

---

## 6. AR Flow (MindAR)

```
User tap "Mode AR"
  → Check HTTPS + camera support
  → Request camera permission
  → Load MindAR engine + image target (.mind file)
  → Show fullscreen camera feed
  → Detect image target → show 3D objects
  → User tap "Tutup AR"
    → Stop MindAR
    → Stop camera tracks
    → Dispose Three.js renderer
    → Unmount AR component
    → Show simulation mode (no reload needed)
```

### Image Target vs Marker
- AR.js: hanya support Hiro/Kanji marker (limited)
- MindAR: support **custom image** sebagai target
- Kita bisa bikin target image berupa logo PintAR atau gambar eksperimen

---

## 7. Persyaratan Non-Fungsional

| Requirement | Target |
|-------------|--------|
| First Load | < 3 detik (3G) |
| AR Init | < 2 detik setelah permission |
| FPS saat AR | 30+ fps |
| Offline | Semua simulasi bisa offline |
| Bundle Size | < 500KB (tanpa AR library) |
| Browser Support | iOS Safari 15+, Chrome Android 90+, Desktop Chrome/Firefox |
| Accessibility | Touch target min 44px, font min 14px |

---

## 8. Milestone

| Phase | Deliverable | Durasi |
|-------|-------------|--------|
| 1 | Project setup + 1 experiment (Pendulum) dengan Sim + AR | 1 minggu |
| 2 | 3 experiment tambahan + PWA + offline | 1 minggu |
| 3 | Semua 8 experiment + quiz + LKS | 2 minggu |
| 4 | Polish UI + testing iOS/Android + deploy | 1 minggu |

---

## 9. Referensi

- MindAR.js: https://hiukim.github.io/mind-ar-js-doc/
- Three.js: https://threejs.org/docs/
- Vite: https://vitejs.dev/
- React: https://react.dev/
- Tailwind CSS: https://tailwindcss.com/
