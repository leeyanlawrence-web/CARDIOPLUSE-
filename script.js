// Firebase Config
firebase.initializeApp({
    apiKey: "AIzaSyATPrS6_diZvJxUpQvIc9bU9QW7eBSABhY",
    authDomain: "neropluse-a7493.firebaseapp.com",
    projectId: "neropluse-a7493",
    storageBucket: "neropluse-a7493.firebasestorage.app",
    messagingSenderId: "639558885755",
    appId: "1:639558885755:web:ce4e9ecc3bdf1dd38c1dde"
});

const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const $ = id => document.getElementById(id);
const LS = $('loginScreen');
const app = $('app');
const fb = $('fbStatus');
const email = $('email');
const pass = $('pass');
const loginError = $('loginError');
const userSpan = $('userEmail');
const box = $('box');
const status = $('status');
const rt = $('reaction');
const hrSpan = $('hr');
const l1 = $('l1');
const l2 = $('l2');
const l3 = $('l3');
const startBtn = $('startBtn');
const resetBtn = $('resetBtn');
const led = $('activeLed');
const timerSpan = $('timer');
const fatigueSpan = $('fatigue');
const soundSpan = $('sound');
const avg = $('avg');
const best = $('best');
const risk = $('risk');
const hrAvg = $('hrAvg');
const hrv = $('hrv');
const fatigueScore = $('fatigueScore');
const std = $('std');
const advice = $('advice');
const history = $('history');

// State
let user = null;
let state = 'idle';
let times = [384, 412, 398, 405, 391];
let heart = [79, 82, 78, 80, 81, 79, 77];
let level = 1;
let streak = 0;
let timer = null;
let start = 0;
let tap = 0;
let session = Date.now();
let sound = true;
let chart;

// Chart setup
const ctx = $('hrChart').getContext('2d');
chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: heart.map((_, i) => i + 1),
        datasets: [{
            data: heart,
            borderColor: '#0066a1',
            backgroundColor: 'rgba(0,102,161,0.05)',
            tension: 0.3,
            pointRadius: 2,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { min: 40, max: 120, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b' } },
            x: { ticks: { color: '#64748b' } }
        }
    }
});

// Sound function
const play = t => {
    if (!sound) return;
    try {
        let a = new (AudioContext || webkitAudioContext)();
        if (a.state === 'suspended') a.resume();
        let o = a.createOscillator();
        let g = a.createGain();
        o.connect(g);
        g.connect(a.destination);
        g.gain.value = 0.2;
        o.frequency.value = t === 'ready' ? 600 : t === 'success' ? 800 : 300;
        o.start();
        o.stop(a.currentTime + 0.15);
    } catch (e) { }
};

// Helper calculations
const avgFn = () => times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
const bestFn = () => times.length ? Math.min(...times) : 0;
const hrvFn = () => {
    if (heart.length < 3) return 42;
    let m = heart.reduce((a, b) => a + b, 0) / heart.length;
    return Math.round(Math.sqrt(heart.map(v => Math.pow(v - m, 2)).reduce((a, b) => a + b, 0) / heart.length));
};
const stdFn = () => {
    if (times.length < 2) return 0;
    let m = times.reduce((a, b) => a + b, 0) / times.length;
    return Math.round(Math.sqrt(times.map(v => Math.pow(v - m, 2)).reduce((a, b) => a + b, 0) / times.length));
};

// Update UI
const update = () => {
    avg.textContent = avgFn() || '—';
    best.textContent = bestFn() || '—';
    std.textContent = stdFn();
    let f = Math.min(100, streak * 5);
    fatigueSpan.textContent = f + '%';
    fatigueScore.textContent = f + '%';
    let h = +hrSpan.textContent;
    let bg = '#f1f9ff';
    let t = '✅ HEART STATUS: NORMAL';
    if (h > 100) {
        bg = '#ffebee';
        t = '⚠️ HEART STATUS: ELEVATED - REST';
    } else if (h < 60) {
        bg = '#fff3e0';
        t = '⚠️ HEART STATUS: LOW - MONITOR';
    } else if (avgFn() > 500) {
        bg = '#fff3e0';
        t = '⚠️ SIGNAL: PROLONGED RESPONSE';
    } else if (f > 50) {
        bg = '#fff3e0';
        t = '⚠️ FATIGUE STATUS: ELEVATED';
    }
    advice.textContent = t;
    advice.style.background = bg;
    risk.textContent = h > 100 ? 'HIGH' : h < 60 ? 'MOD' : 'LOW';

    [l1, l2, l3].forEach(b => b.classList.remove('selected'));
    (level == 1 ? l1 : level == 2 ? l2 : l3).classList.add('selected');

    hrAvg.textContent = h;
    hrv.textContent = hrvFn();

    history.innerHTML = '';
    [...times].slice(-5).reverse().forEach((t, i) => {
        let e = document.createElement('div');
        e.className = 'history-item';
        e.innerHTML = `<span>❤️ ${heart[heart.length - 1 - i] || 79} BPM</span><span>${t} ms</span>`;
        history.appendChild(e);
    });
};

// Firebase Save/Load
const save = async () => {
    if (!user || user.isAnonymous) return;
    await db.collection('users').doc(user.uid).set({ times, heart, streak, level }, { merge: true });
    fb.textContent = '💾 synced';
    setTimeout(() => fb.textContent = '💾 synced to cloud', 1000);
};

const load = async uid => {
    let d = await db.collection('users').doc(uid).get();
    if (d.exists) {
        let data = d.data();
        times = data.times || times;
        heart = data.heart || heart;
        streak = data.streak || 0;
        level = data.level || 1;
    }
    update();
};

// Show login screen
const showLogin = () => {
    app.classList.remove('visible');
    LS.style.display = 'flex';
    if (timer) clearTimeout(timer);
    state = 'idle';
    led.classList.remove('active');
};

// Email/Password Login
$('loginBtn').onclick = async () => {
    try {
        loginError.textContent = '...';
        await auth.signInWithEmailAndPassword(email.value, pass.value);
    } catch {
        loginError.textContent = 'denied';
    }
};

// Guest button (anonymous login)
$('guestBtn').onclick = async () => {
    try {
        loginError.textContent = 'starting guest session...';
        const result = await auth.signInAnonymously();
        console.log("Guest session started:", result.user.uid);
    } catch (error) {
        console.error(error);
        loginError.textContent = 'guest access failed';
    }
};

$('logoutBtn').onclick = async () => {
    if (user && !user.isAnonymous) await save();
    await auth.signOut();
    showLogin();
};

// Auth state observer
auth.onAuthStateChanged(async u => {
    if (u) {
        user = u;
        LS.style.display = 'none';
        app.classList.add('visible');

        if (u.isAnonymous) {
            userSpan.textContent = 'GUEST-ANON';
            fb.textContent = '💾 anonymous (no save)';
            times = [384, 412, 398, 405, 391];
            heart = [79, 82, 78, 80, 81, 79, 77];
            streak = 0;
            level = 1;
            update();
        } else {
            userSpan.textContent = u.email.split('@')[0].toUpperCase();
            fb.textContent = '💾 loading...';
            await load(u.uid);
            fb.textContent = '💾 synced';
        }
        session = Date.now();
    } else {
        showLogin();
    }
});

// Level buttons
l1.onclick = () => { level = 1; update(); if (user && !user.isAnonymous) save(); };
l2.onclick = () => { level = 2; update(); if (user && !user.isAnonymous) save(); };
l3.onclick = () => { level = 3; update(); if (user && !user.isAnonymous) save(); };

// Start trial
startBtn.onclick = () => {
    if (state != 'idle') return;
    state = 'waiting';
    tap = 0;
    startBtn.textContent = '⏳';
    status.textContent = 'awaiting signal...';
    led.classList.add('active');
    timer = setTimeout(() => {
        state = 'ready';
        box.classList.add('ready');
        status.textContent = level == 3 ? 'AWAITING DOUBLE TAP' : 'TAP NOW';
        start = Date.now();
        startBtn.textContent = 'START';
        play('ready');
    }, 1500 + Math.random() * 2000);
};

// Box click
box.onclick = () => {
    if (state == 'idle') return;
    if (state == 'waiting') {
        clearTimeout(timer);
        status.textContent = '⚠️ PREMATURE SIGNAL';
        startBtn.textContent = 'START';
        box.classList.remove('ready');
        state = 'idle';
        streak = 0;
        update();
        led.classList.remove('active');
        play('early');
        if (user && !user.isAnonymous) save();
        return;
    }
    if (state == 'ready') {
        if (level == 3 && ++tap < 2) {
            status.textContent = 'AWAITING SECOND TAP';
            return;
        }
        let r = Date.now() - start;
        times.push(r);
        rt.textContent = r;
        streak++;
        update();
        status.textContent = 'HEART STATUS: GOOD';
        startBtn.textContent = 'START';
        box.classList.remove('ready');
        state = 'idle';
        led.classList.remove('active');
        play('success');
        if (user && !user.isAnonymous) save();
    }
};

// Reset button
resetBtn.onclick = () => {
    times = [384, 412, 398, 405, 391];
    heart = [79, 82, 78, 80, 81, 79, 77];
    streak = 0;
    state = 'idle';
    clearTimeout(timer);
    rt.textContent = '384';
    status.textContent = 'HEART STATUS: GOOD';
    startBtn.textContent = 'START';
    box.classList.remove('ready');
    update();
    led.classList.remove('active');
    if (user && !user.isAnonymous) save();
};

// Sound toggle
soundSpan.parentElement.onclick = () => {
    sound = !sound;
    soundSpan.textContent = sound ? 'on' : 'off';
};

// Heart rate simulation
setInterval(() => {
    if (!app.classList.contains('visible')) return;
    let h = Math.round(75 + Math.random() * 15);
    heart.push(h);
    if (heart.length > 10) heart.shift();
    hrSpan.textContent = h;
    chart.data.labels = heart.map((_, i) => i + 1);
    chart.data.datasets[0].data = heart;
    chart.update();
    update();
    if (user && !user.isAnonymous) save();
}, 3000);

// Timer
setInterval(() => {
    if (!app.classList.contains('visible')) return;
    let e = Math.floor((Date.now() - session) / 1000);
    timerSpan.textContent = `${Math.floor(e / 60).toString().padStart(2, '0')}:${(e % 60).toString().padStart(2, '0')}`;
}, 1000);

// Pre-create demo account (silent)
auth.createUserWithEmailAndPassword('cardiologist@hospital.org', 'cardio2024').catch(() => { });

// Initial setup
showLogin();
update();
