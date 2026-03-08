const CONFIG = {
    PRAYER_API: "https://api.aladhan.com/v1/timingsByAddress",
    QURAN_API: "https://api.alquran.cloud/v1/ayah/random/en.asad",
    NAMES_API: "https://api.aladhan.com/v1/asmaAlHusna"
};

let state = {
    tasbih: parseInt(localStorage.getItem('tasbih_count')) || 0,
    coords: null,
    timings: null
};

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initApp();
});

function initApp() {
    updateEnglishDate();
    updateTasbihDisplay();
    fetchVerse();
    requestLocation();
    
    // Bottom Nav
    document.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', () => navigate(el.dataset.nav));
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const theme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', theme);
        const icon = document.querySelector('#theme-toggle i');
        icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        lucide.createIcons();
    });

    // Tasbih
    document.getElementById('tasbih-trigger').addEventListener('click', () => {
        state.tasbih++;
        updateTasbihDisplay();
        localStorage.setItem('tasbih_count', state.tasbih);
        if(navigator.vibrate) navigator.vibrate(50);
    });

    document.getElementById('tasbih-reset').addEventListener('click', () => {
        if(confirm("রিসেট করবেন?")) { state.tasbih = 0; updateTasbihDisplay(); }
    });

    // Compass
    document.getElementById('enable-compass').addEventListener('click', showCalibration);
    document.getElementById('start-qibla-btn').addEventListener('click', startCompassSession);
}

function updateEnglishDate() {
    const today = new Date();
    document.getElementById('hijri-date').innerText = today.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function navigate(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.nav === id));
    document.getElementById(id).classList.add('active');
    if (id === 'names') load99Names();
    window.scrollTo(0, 0);
    lucide.createIcons();
}

// --- Compass & Qibla ---
function showCalibration() {
    document.getElementById('calibration-overlay').style.display = 'flex';
}

async function startCompassSession() {
    document.getElementById('calibration-overlay').style.display = 'none';
    document.getElementById('enable-compass').style.display = 'none';

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') startTracking();
    } else {
        startTracking();
    }
}

function startTracking() {
    const dial = document.getElementById('compass-dial');
    const fb = document.getElementById('qibla-feedback');

    window.addEventListener('deviceorientationabsolute', (e) => {
        let heading = e.webkitCompassHeading || (360 - e.alpha);
        dial.style.transform = `rotate(${-heading}deg)`;
        document.getElementById('qibla-degree').innerText = `${Math.round(heading)}°`;

        if (state.coords) {
            const qibla = calculateQibla(state.coords.lat, state.coords.lng);
            let diff = Math.abs(heading - qibla);
            if (diff > 180) diff = 360 - diff;
            
            if (diff < 10) {
                fb.innerText = "🕋 আপনি কাবার দিকে মুখ করে আছেন";
                fb.style.color = "var(--accent)";
            } else {
                fb.innerText = "ফোনটি ঘুরিয়ে কাবা আইকনটি তীরের নিচে আনুন";
                fb.style.color = "inherit";
            }
        }
    }, true);
}

function calculateQibla(lat, lng) {
    const m = { lat: 21.4225, lng: 39.8262 }; // Mecca
    const φ1 = lat * Math.PI/180; const φ2 = m.lat * Math.PI/180;
    const Δλ = (m.lng - lng) * Math.PI/180;
    return (Math.atan2(Math.sin(Δλ), Math.cos(φ1)*Math.tan(φ2) - Math.sin(φ1)*Math.cos(Δλ)) * 180/Math.PI + 360) % 360;
}

// --- Prayer & API Functions ---
function requestLocation() {
    navigator.geolocation.getCurrentPosition(pos => {
        state.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        fetchPrayers();
    }, () => fetchPrayers(23.8103, 90.4125));
}

async function fetchPrayers(lat = state.coords?.lat, lng = state.coords?.lng) {
    const res = await fetch(`${CONFIG.PRAYER_API}?address=${lat},${lng}&method=2`);
    const json = await res.json();
    state.timings = json.data.timings;
    document.getElementById('location-text').innerText = json.data.meta.timezone;
    renderPrayerList();
    startPrayerTimer();
    document.getElementById('sehri-time').innerText = state.timings.Fajr;
    document.getElementById('iftar-time').innerText = state.timings.Maghrib;
}

function renderPrayerList() {
    const list = document.getElementById('prayer-list');
    const p = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    list.innerHTML = p.map(n => `
        <div class="glass-card" style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <span>${n}</span><strong>${state.timings[n]}</strong>
        </div>`).join('');
}

function startPrayerTimer() {
    const pNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    setInterval(() => {
        if(!state.timings) return;
        const now = new Date();
        let next = null;
        for (let p of pNames) {
            const [h, m] = state.timings[p].split(':');
            const pt = new Date(); pt.setHours(h, m, 0);
            if (pt > now) { next = { name: p, time: pt }; break; }
        }
        if (!next) {
            const [h, m] = state.timings.Fajr.split(':');
            const pt = new Date(); pt.setDate(pt.getDate() + 1); pt.setHours(h, m, 0);
            next = { name: 'Fajr', time: pt };
        }
        const diff = next.time - now;
        const hh = Math.floor(diff/3600000).toString().padStart(2,'0');
        const mm = Math.floor((diff%3600000)/60000).toString().padStart(2,'0');
        const ss = Math.floor((diff%60000)/1000).toString().padStart(2,'0');
        document.getElementById('countdown').innerText = `${hh}:${mm}:${ss}`;
        document.getElementById('next-prayer-name').innerText = next.name;
    }, 1000);
}

async function fetchVerse() {
    try {
        const res = await fetch(CONFIG.QURAN_API);
        const json = await res.json();
        document.getElementById('verse-en').innerText = `"${json.data.text}"`;
    } catch (e) {}
}

async function load99Names() {
    const grid = document.getElementById('names-grid');
    if (grid.innerHTML !== "") return;
    const res = await fetch(CONFIG.NAMES_API);
    const json = await res.json();
    grid.innerHTML = json.data.map(n => `
        <div class="glass-card" style="padding:15px; margin:0;">
            <h3 style="margin:0; color:var(--accent);">${n.name}</h3>
            <small>${n.transliteration}</small>
        </div>`).join('');
}

function updateTasbihDisplay() { document.getElementById('tasbih-display').innerText = state.tasbih; }

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('Service Worker Registered!');
        }).catch(err => {
            console.log('Service Worker Failed!', err);
        });
    });
}

let deferredPrompt;
const installBtn = document.getElementById('install-app');

// ১. অ্যান্ড্রয়েড এবং ক্রোম ব্রাউজারের জন্য ইনস্টল ইভেন্ট ধরা
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
        installBtn.style.display = 'flex'; // বাটনটি দেখান
    }
});

// ২. বাটন ক্লিক করলে যা হবে
if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installBtn.style.display = 'none';
            }
            deferredPrompt = null;
        } else {
            // আইফোন বা অন্যান্য ব্রাউজারের জন্য ব্যাকআপ মেসেজ
            alert("To install: Tap the 'Share' icon and then 'Add to Home Screen'.");
        }
    });
}

// ৩. সফলভাবে ইনস্টল হয়ে গেলে বাটন সরিয়ে ফেলা
window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    console.log('App successfully installed!');
});
