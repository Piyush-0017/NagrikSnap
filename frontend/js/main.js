// ===== NagrikSnap Main JS =====

// Create floating particles (shatter vibe)
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  // Reduce particle count on small screens for performance
  const isMobile = window.innerWidth <= 640;
  const count = isMobile ? 10 : 25;

  const colors = ['#0ea5e9', '#14b8a6', '#f97316', '#38bdf8'];
  
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.width = (Math.random() * 6 + 3) + 'px';
    particle.style.height = particle.style.width;
    particle.style.animationDuration = (Math.random() * 10 + 8) + 's';
    particle.style.animationDelay = (Math.random() * 5) + 's';
    particle.style.willChange = 'transform, opacity';
    container.appendChild(particle);
  }
}

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
  createParticles();

  const menuBtn = document.getElementById('menuBtn');
  const navLinks = document.querySelector('.nav-links');
  
if (menuBtn && navLinks) {
    function closeMenu() {
      navLinks.classList.remove('mobile-open');
      if (window.innerWidth <= 640) navLinks.style.display = 'none';
      else navLinks.style.display = 'flex';
    }

    menuBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('mobile-open');
      navLinks.style.display = open ? 'flex' : (window.innerWidth <= 640 ? 'none' : 'flex');
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '60px';
      navLinks.style.right = '20px';
      navLinks.style.background = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f172a' : 'white';
      navLinks.style.padding = '20px';
      navLinks.style.borderRadius = '16px';
      navLinks.style.boxShadow = '0 10px 40px rgba(0,0,0,0.15)';
      navLinks.style.gap = '16px';
    });

    // Close the mobile menu when resizing to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 640) {
        navLinks.classList.remove('mobile-open');
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = '';
        navLinks.style.position = '';
        navLinks.style.top = '';
        navLinks.style.right = '';
        navLinks.style.background = '';
        navLinks.style.padding = '';
        navLinks.style.borderRadius = '';
        navLinks.style.boxShadow = '';
        navLinks.style.gap = '';
      }
    });

    // Close the mobile menu when clicking a link inside it
    navLinks.addEventListener('click', (e) => {
      if (window.innerWidth <= 640 && e.target.closest('a')) closeMenu();
    });
  }
});

// ===== Voice Recognition Helper =====
let recognition = null;
let isListening = false;

function initVoiceRecognition(textareaId, buttonId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('Speech Recognition not supported');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'hi-IN'; // Default Hindi, can switch
  recognition.continuous = false;
  recognition.interimResults = true;

  const textarea = document.getElementById(textareaId);
  const btn = document.getElementById(buttonId);

  if (!textarea || !btn) return;

  // Track current voice language (default Hindi, toggled on each idle click)
  let voiceLang = 'hi-IN';

  function resetBtnUI() {
    btn.innerHTML = '<i class="fas fa-microphone"></i> Voice Input' +
      (voiceLang === 'hi-IN' ? ' (\u0939\u093f\u0902\u0926\u0940)' : ' (English)');
    btn.title = 'Click to start. Click again while idle to switch language.';
  }

  btn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      isListening = false;
      btn.classList.remove('listening');
      resetBtnUI();
      return;
    }

    // Toggle language instead of using a blocking confirm() dialog
    voiceLang = voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    recognition.lang = voiceLang;

    recognition.start();
    isListening = true;
    btn.classList.add('listening');
    btn.innerHTML = '<i class="fas fa-stop"></i> Listening ' +
      (voiceLang === 'hi-IN' ? '(\u0939\u093f\u0902\u0926\u0940)' : '(English)') + '...';
  });

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    textarea.value = transcript;
  };

  recognition.onend = () => {
    isListening = false;
    btn.classList.remove('listening');
    resetBtnUI();
  };

  recognition.onerror = () => {
    isListening = false;
    btn.classList.remove('listening');
    resetBtnUI();
  };

  resetBtnUI();
}

// ===== Generate Tracking ID =====
function generateTrackingId() {
  const prefix = 'NS';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100);
  return `${prefix}${timestamp}${random}`;
}

// ===== Simple AI Classification (mock for frontend demo) =====
function classifyComplaint(text) {
  const lower = text.toLowerCase();
  
  let department = 'General Administration';
  let priority = 'Medium';

  // Department detection
  if (lower.includes('pothole') || lower.includes('road') || lower.includes('गड्ढा') || lower.includes('सड़क')) {
    department = 'Public Works / Roads';
  } else if (lower.includes('garbage') || lower.includes('rubbish') || lower.includes('कचरा') || lower.includes('कूड़ा')) {
    department = 'Sanitation / Waste Management';
  } else if (lower.includes('water') || lower.includes('pipe') || lower.includes('पानी') || lower.includes('नल')) {
    department = 'Water Supply';
  } else if (lower.includes('light') || lower.includes('streetlight') || lower.includes('बत्ती') || lower.includes('लाइट')) {
    department = 'Electrical / Street Lights';
  } else if (lower.includes('tree') || lower.includes('park') || lower.includes('पेड़') || lower.includes('पार्क')) {
    department = 'Parks & Horticulture';
  } else if (lower.includes('sewage') || lower.includes('drain') || lower.includes('नाला') || lower.includes('सीवर')) {
    department = 'Drainage / Sewerage';
  }

  // Priority detection
  if (lower.includes('urgent') || lower.includes('danger') || lower.includes('accident') || 
      lower.includes('जरूरी') || lower.includes('खतरा') || lower.includes('दुर्घटना')) {
    priority = 'High';
  } else if (lower.includes('minor') || lower.includes('small') || lower.includes('छोटा')) {
    priority = 'Low';
  }

  return { department, priority };
}

// Export for other pages
window.NagrikSnap = {
  initVoiceRecognition,
  generateTrackingId,
  classifyComplaint
};

// ===== Shared Auth UI Helper =====
function updateNavForUser() {
  const nav = document.querySelector('.nav-links');
  if (!nav) return;

  const admin = localStorage.getItem('nagriksnap_admin');
  const citizen = localStorage.getItem('nagriksnap_user');

  // Keep existing links, just enhance Login area
  const loginLink = nav.querySelector('a[href="login.html"]');
  if (admin) {
    if (loginLink) {
      loginLink.textContent = 'Admin Panel';
      loginLink.href = 'admin.html';
    }
  } else if (citizen) {
    const user = JSON.parse(citizen);
    if (loginLink) {
      loginLink.textContent = 'My Complaints';
      loginLink.href = 'my-complaints.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', updateNavForUser);



// ===== Reviews (backend + localStorage fallback) =====
window.NagrikReviews = {
  API: 'http://localhost:8000',

  listLocal() {
    try { return JSON.parse(localStorage.getItem('nagriksnap_reviews') || '[]'); }
    catch { return []; }
  },

  saveLocal(reviews) {
    localStorage.setItem('nagriksnap_reviews', JSON.stringify(reviews));
  },

  hasReviewed(complaintId) {
    return this.listLocal().some(r => (r.complaintId || r.complaint_id) === complaintId);
  },

  /** Save review: try backend first, always mirror to localStorage */
  async save({ complaintId, rating, comment, name, phone, department }) {
    if (!complaintId || !rating) return { ok: false, error: 'Missing data' };
    if (this.hasReviewed(complaintId)) return { ok: false, error: 'Already reviewed' };

    const payload = {
      complaint_id: complaintId,
      rating: Number(rating),
      comment: (comment || '').trim(),
      name: name || 'Citizen',
      phone: phone || '',
      department: department || ''
    };

    let backendReview = null;
    try {
      const res = await fetch(this.API + '/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        backendReview = data.review;
      } else if (res.status === 400 && data.detail) {
        // If backend says already reviewed / not resolved — surface message
        // but if complaint only exists in localStorage, still allow local save
        if (String(data.detail).toLowerCase().includes('already')) {
          return { ok: false, error: data.detail };
        }
      }
    } catch (e) {
      console.log('Backend review unavailable, using local storage', e);
    }

    // Local mirror (same shape as before + snake_case ids for compatibility)
    const reviews = this.listLocal();
    const entry = backendReview ? {
      id: backendReview.id,
      complaintId: backendReview.complaint_id,
      complaint_id: backendReview.complaint_id,
      rating: backendReview.rating,
      comment: backendReview.comment,
      name: backendReview.name,
      phone: backendReview.phone,
      department: backendReview.department,
      createdAt: backendReview.created_at,
      created_at: backendReview.created_at,
      source: 'backend'
    } : {
      id: 'rv_' + Date.now(),
      complaintId,
      complaint_id: complaintId,
      rating: Number(rating),
      comment: (comment || '').trim(),
      name: name || 'Citizen',
      phone: phone || '',
      department: department || '',
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      source: 'local'
    };
    reviews.unshift(entry);
    this.saveLocal(reviews);
    return { ok: true, review: entry, backend: !!backendReview };
  },

  /** Load reviews for public page: backend first, merge with local */
  async fetchAll() {
    let remote = [];
    try {
      const res = await fetch(this.API + '/reviews');
      if (res.ok) {
        const data = await res.json();
        remote = (data.reviews || []).map(r => ({
          id: r.id,
          complaintId: r.complaint_id,
          complaint_id: r.complaint_id,
          rating: r.rating,
          comment: r.comment,
          name: r.name,
          phone: r.phone,
          department: r.department,
          createdAt: r.created_at,
          created_at: r.created_at,
          source: 'backend'
        }));
      }
    } catch (e) {
      console.log('Backend reviews unavailable');
    }
    const local = this.listLocal();
    // Merge by complaint id (prefer backend)
    const map = new Map();
    local.forEach(r => map.set(r.complaintId || r.complaint_id, r));
    remote.forEach(r => map.set(r.complaintId || r.complaint_id, r));
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
    );
    return merged;
  }
};


// ===== Nearby admin assignment (client-side fallback) =====
window.NagrikAssign = {
  haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = d => d * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },
  findNearestAdmin(lat, lng, department) {
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('nagriksnap_accounts') || '[]'); } catch(e) {}
    const admins = accounts.filter(a => a.role === 'admin' && a.lat != null && a.lng != null);
    if (!admins.length) return null;
    let best = null, bestScore = Infinity;
    admins.forEach(a => {
      const d = this.haversineKm(Number(lat), Number(lng), Number(a.lat), Number(a.lng));
      const same = department && a.department && String(a.department).toLowerCase().includes(String(department).toLowerCase());
      const score = d + (same ? 0 : 50);
      if (score < bestScore) {
        bestScore = score;
        best = {
          admin_id: a.id,
          admin_name: a.name,
          admin_phone: a.phone,
          admin_department: a.department,
          distance_km: Math.round(d * 100) / 100
        };
      }
    });
    return best;
  }
};
