// ===== NagrikSnap AI Help Assistant (low version) =====
(function () {
  const API = 'http://localhost:8000';

  const FAQ = [
    {
      keys: ['report', 'how to report', 'complaint kaise', 'शिकायत', 'रिपोर्ट', 'snap', 'problem bata', 'दर्ज'],
      reply_en: 'To report an issue:\n1) Open Report Issue\n2) Snap a photo\n3) Describe in Hindi/English\n4) Set location\n5) Submit — you get a Tracking ID + SMS.',
      reply_hi: 'समस्या रिपोर्ट करने के लिए:\n1) Report Issue खोलें\n2) फोटो लें\n3) हिंदी/अंग्रेजी में लिखें\n4) स्थान सेट करें\n5) Submit करें — Tracking ID + SMS मिलेगा।'
    },
    {
      keys: ['track', 'tracking', 'status', 'कहाँ', 'ट्रैक', 'id', 'शिकायत कहाँ'],
      reply_en: 'To track: go to Track Complaint and enter your Tracking ID (e.g. NS123…) or registered mobile number.',
      reply_hi: 'ट्रैक करने के लिए Track Complaint पर जाएँ और Tracking ID (जैसे NS123…) या रजिस्टर्ड मोबाइल नंबर डालें।'
    },
    {
      keys: ['pothole', 'road', 'गड्ढा', 'सड़क', 'footpath'],
      reply_en: 'Road / pothole issues usually go to Public Works / Roads. Use Report Issue and mention the exact location.',
      reply_hi: 'सड़क / गड्ढे की समस्या आमतौर पर Public Works / Roads विभाग को जाती है। Report Issue से फोटो और स्थान भेजें।'
    },
    {
      keys: ['garbage', 'waste', 'कचरा', 'कूड़ा', 'safai'],
      reply_en: 'Garbage / waste → Sanitation department. Snap a photo and report with your location.',
      reply_hi: 'कचरा / सफाई → Sanitation विभाग। फोटो लेकर Report Issue से शिकायत दर्ज करें।'
    },
    {
      keys: ['water', 'pipe', 'पानी', 'नल', 'leak'],
      reply_en: 'Water supply / leakage → Water Supply department. Report with photo and address.',
      reply_hi: 'पानी / लीकेज → Water Supply विभाग। फोटो और पता के साथ रिपोर्ट करें।'
    },
    {
      keys: ['light', 'streetlight', 'बत्ती', 'लाइट', 'bijli'],
      reply_en: 'Street light issues → Electrical / Street Lights. Report the pole location if possible.',
      reply_hi: 'स्ट्रीट लाइट → Electrical / Street Lights विभाग। खंभे का स्थान बताकर रिपोर्ट करें।'
    },
    {
      keys: ['login', 'password', 'otp', 'signup', 'register', 'लॉगिन', 'पासवर्ड', 'भूल'],
      reply_en: 'Use Login page: Sign up (name, phone, password) or Forgot password (phone + OTP). Admin needs department on signup.',
      reply_hi: 'Login पेज पर Sign up करें (नाम, फोन, पासवर्ड) या Forgot password (फोन + OTP)। Admin को विभाग भी चुनना होता है।'
    },
    {
      keys: ['review', 'rating', 'feedback', 'रिव्यू', 'रेटिंग'],
      reply_en: 'After Admin marks your complaint Resolved, open Track page to submit a star rating. All reviews are on the Reviews page in the footer.',
      reply_hi: 'जब शिकायत Resolved हो जाए, Track पेज पर जाकर स्टार रेटिंग दें। सभी रिव्यू Footer में Reviews पेज पर दिखते हैं।'
    },
    {
      keys: ['hello', 'hi', 'hey', 'namaste', 'नमस्ते', 'help', 'मदद', 'sahayata'],
      reply_en: 'Namaste! I am NagrikSnap Help. Ask about Report, Track, departments (road, water, garbage…), Login, or Reviews.',
      reply_hi: 'नमस्ते! मैं NagrikSnap सहायक हूँ। Report, Track, विभाग (सड़क, पानी, कचरा…), Login या Reviews के बारे में पूछें।'
    },
    {
      keys: ['admin', 'department', 'विभाग'],
      reply_en: 'Admins log in from Login → Admin tab. They can update complaint status. Departments are assigned by AI from your description.',
      reply_hi: 'Admin Login → Admin टैब से लॉगिन करें और स्टेटस अपडेट कर सकते हैं। विभाग आपकी समस्या के वर्णन से AI तय करता है।'
    }
  ];

  function isHindi(text) {
    return /[\u0900-\u097F]/.test(text);
  }

  function ruleReply(message) {
    const lower = message.toLowerCase();
    const hi = isHindi(message);
    for (const item of FAQ) {
      if (item.keys.some(k => lower.includes(k.toLowerCase()) || message.includes(k))) {
        return hi ? item.reply_hi : item.reply_en;
      }
    }
    return null;
  }

  function ensureWidget() {
    if (document.getElementById('nsChatRoot')) return;

    const root = document.createElement('div');
    root.id = 'nsChatRoot';
    root.innerHTML = `
      <button type="button" id="nsChatToggle" aria-label="Help chat">
        <i class="fas fa-comments"></i>
        <span>Help</span>
      </button>
      <div id="nsChatPanel" hidden>
        <div class="ns-chat-head">
          <div>
            <strong>NagrikSnap Assistant</strong>
            <div class="ns-chat-sub">Civic help · EN / हिंदी</div>
          </div>
          <button type="button" id="nsChatClose" aria-label="Close">×</button>
        </div>
        <div id="nsChatMessages"></div>
        <div class="ns-chat-quick">
          <button type="button" data-q="How do I report?">Report</button>
          <button type="button" data-q="Track my complaint">Track</button>
          <button type="button" data-q="पोटहोल की शिकायत">गड्ढा</button>
          <button type="button" data-q="Login help">Login</button>
        </div>
        <form id="nsChatForm">
          <input id="nsChatInput" type="text" placeholder="Type your question..." autocomplete="off" />
          <button type="submit"><i class="fas fa-paper-plane"></i></button>
        </form>
      </div>
    `;
    document.body.appendChild(root);

    const panel = document.getElementById('nsChatPanel');
    const toggle = document.getElementById('nsChatToggle');
    const closeBtn = document.getElementById('nsChatClose');
    const form = document.getElementById('nsChatForm');
    const input = document.getElementById('nsChatInput');
    const msgs = document.getElementById('nsChatMessages');

    function addMsg(text, who) {
      const div = document.createElement('div');
      div.className = 'ns-msg ns-msg-' + who;
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function open() {
      panel.hidden = false;
      toggle.classList.add('open');
      if (!msgs.dataset.welcomed) {
        addMsg('Namaste! Ask about NagrikSnap (report, track, login) or any general question — I will try to help.', 'bot');
        msgs.dataset.welcomed = '1';
      }
      input.focus();
    }
    function close() {
      panel.hidden = true;
      toggle.classList.remove('open');
    }

    toggle.addEventListener('click', () => panel.hidden ? open() : close());
    closeBtn.addEventListener('click', close);

    document.querySelectorAll('.ns-chat-quick button').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.getAttribute('data-q');
        form.requestSubmit();
      });
    });

    async function ask(message) {
      addMsg(message, 'user');
      const local = ruleReply(message);
      // Try backend (rules + optional Groq)
      try {
        const res = await fetch(API + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, lang: isHindi(message) ? 'hi' : 'en' })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reply) {
            addMsg(data.reply, 'bot');
            return;
          }
        }
      } catch (e) {}

      if (local) {
        addMsg(local, 'bot');
      } else {
        addMsg(
          isHindi(message)
            ? 'सामान्य सवालों के लिए Backend + GROQ_API_KEY चालू करें। बिना AI के मैं Report, Track, Login, रिव्यू में मदद कर सकता/सकती हूँ।'
            : 'For general questions, start the backend with GROQ_API_KEY. Offline I can still help with Report, Track, Login, and Reviews.',
          'bot'
        );
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await ask(text);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureWidget);
  } else {
    ensureWidget();
  }
})();
