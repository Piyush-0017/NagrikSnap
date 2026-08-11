// ===== Jan Sevak - AI Chat Assistant =====
(function () {
  'use strict';

  // ---- Build the widget DOM ----
  const widget = document.createElement('div');
  widget.className = 'jansevak-widget';
  widget.innerHTML = `
    <button class="jansevak-toggle" id="jansevakToggle" aria-label="Chat with Jan Sevak">
      <span class="jansevak-toggle-icon">🤖</span>
      <span class="jansevak-toggle-close"><i class="fas fa-times"></i></span>
      <span class="jansevak-pulse"></span>
    </button>

    <div class="jansevak-window" id="jansevakWindow">
      <div class="jansevak-header">
        <div class="jansevak-avatar">🤖</div>
        <div class="jansevak-header-info">
          <strong>Jan Sevak</strong>
          <span class="jansevak-online">● Online — Ask me anything</span>
        </div>
<button class="jansevak-lang" id="jansevakLang" title="Switch language">🌐 <span id="jansevakLangLabel">EN</span></button>
        <button class="jansevak-minimize" id="jansevakMinimize"><i class="fas fa-minus"></i></button>
      </div>

      <div class="jansevak-messages" id="jansevakMessages"></div>

      <div class="jansevak-quick" id="jansevakQuick"></div>

      <div class="jansevak-input">
        <input type="text" id="jansevakInput" placeholder="Type your question... (Hindi/English)" />
        <button id="jansevakSend"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>
  `;

  document.body.appendChild(widget);

  // ---- Elements ----
  const toggle = document.getElementById('jansevakToggle');
  const windowEl = document.getElementById('jansevakWindow');
  const messagesEl = document.getElementById('jansevakMessages');
  const quickEl = document.getElementById('jansevakQuick');
  const inputEl = document.getElementById('jansevakInput');
  const sendBtn = document.getElementById('jansevakSend');
  const minimizeBtn = document.getElementById('jansevakMinimize');
  const langBtn = document.getElementById('jansevakLang');
  const langLabel = document.getElementById('jansevakLangLabel');

let isOpen = false;
  let greeted = false;

  // Chatbot language: follow the site-wide language (nagriksnap_lang) when set,
  // otherwise fall back to the chatbot's own saved choice, else English.
  function readLang() {
    const siteLang = localStorage.getItem('nagriksnap_lang');
    if (siteLang === 'hi') return 'hi';
    if (siteLang === 'en') return 'en';
    const saved = localStorage.getItem('jansevak_lang');
    return (saved === 'hi' || saved === 'en') ? saved : 'en';
  }
  let lang = readLang();

// ---- Helpers ----
  // Allow only safe inline/content tags; strip scripts, event handlers, iframes, etc.
  function sanitizeHtml(str) {
    const div = document.createElement('div');
    div.innerHTML = String(str || '');
    // Remove dangerous elements
    ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style'].forEach((tag) => {
      div.querySelectorAll(tag).forEach((el) => el.remove());
    });
    // Remove event handler attributes and javascript: URLs
    div.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) el.removeAttribute(attr.name);
        if ((name === 'href' || name === 'src') && /^javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return div.innerHTML;
  }

  function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `jansevak-msg ${sender === 'user' ? 'user' : 'bot'}`;
    if (sender === 'bot') {
      msg.innerHTML = `<div class="jansevak-msg-avatar">🤖</div><div class="jansevak-bubble">${sanitizeHtml(text)}</div>`;
    } else {
      msg.innerHTML = `<div class="jansevak-bubble">${text}</div>`;
    }
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'jansevak-msg bot';
    typing.id = 'jansevakTyping';
    typing.innerHTML = `
      <div class="jansevak-msg-avatar">🤖</div>
      <div class="jansevak-bubble jans-evak-typing">
        <span></span><span></span><span></span>
      </div>`;
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return typing;
  }

  function botReply(text) {
    const typing = showTyping();
    const delay = 500 + Math.random() * 600;
    setTimeout(() => {
      typing.remove();
      addMessage(text, 'bot');
    }, delay);
  }

  function renderQuick(chips) {
    quickEl.innerHTML = '';
    chips.forEach((label) => {
      const chip = document.createElement('button');
      chip.className = 'jansevak-chip';
      chip.textContent = label;
      chip.addEventListener('click', () => {
        inputEl.value = label;
        handleUserMessage(label);
      });
      quickEl.appendChild(chip);
    });
  }

  // ---- Knowledge base / common answers ----
  const KB = {
    greeting: [
      'Namaste! 🙏 Main Jan Sevak hoon, aapki civic complaints mein madad karne ke liye.',
      "Hello! I'm Jan Sevak 🤖, your civic assistant. I can help you report issues, track complaints & more. How can I help today?",
      'आपका स्वागत है! मैं जन सेवक हूं। बताइए, क्या मदद कर सकता हूं?'
    ],
    report: [
      '📸 Reporting is easy! Just follow these steps:\n\n1. Tap <strong>Report Issue</strong> in the menu\n2. Snap a photo 📷\n3. Describe the problem (Hindi/English)\n4. Add your location 📍\n5. Enter your 10-digit mobile number\n\nYou\'ll instantly get a Tracking ID! 🎉',
      'रिपोर्ट करने के लिए 🖱️ <strong>Report Issue</strong> पेज पर जाएं, फोटो लें, समस्या लिखें और मोबाइल नंबर डालें। तुरंत Tracking ID मिलेगी!'
    ],
    track: [
      '🔍 To track your complaint:\n\n• Go to <strong>Track Complaint</strong>\n• Enter your <strong>Tracking ID</strong> (e.g. NS123456789)\n• Or enter your <strong>mobile number</strong>\n\nYou\'ll see live status & timeline!',
      'अपनी शिकायत track करने के लिए <strong>Track Complaint</strong> पेज पर Tracking ID या मोबाइल नंबर डालें।'
    ],
    login: [
      '🔐 <strong>Login</strong> is simple:\n\n• <strong>Citizen:</strong> Just enter your name & 10-digit mobile number — no password needed!\n• <strong>Admin:</strong> Use username <code>admin</code> & password <code>nagriksnap123</code>',
      'लॉगिन के लिए नाम और मोबाइल नंबर डालें। Admin के लिए: admin / nagriksnap123'
    ],
    departments: [
      '🏢 Our platform automatically routes complaints to the right department:\n\n• 🛣️ Public Works / Roads\n• 🗑️ Sanitation / Waste\n• 💧 Water Supply\n• 💡 Electrical / Street Lights\n• 🌳 Parks & Horticulture\n• 🕳️ Drainage / Sewerage',
      'आपकी शिकायत स्वतः सही विभाग को जाएगी — सड़क, कचरा, पानी, लाइट, पार्क या नाला।'
    ],
priority: [
      '⚡ Complaints are prioritised as <strong>High</strong>, <strong>Medium</strong> or <strong>Low</strong> based on urgency. Dangerous or urgent issues like accidents get High priority automatically!',
      'जरूरी शिकायतों को High प्राथमिकता मिलती है ताकि वे जल्दी हल हों।'
    ],
    process: [
      '📋 Your complaint follows the <strong>CPGRAMS</strong> process flow:\n\n1️⃣ <strong>Registration</strong> — You file the complaint with photo, description & location. A unique Registration ID is generated instantly.\n2️⃣ <strong>Forwarding</strong> — It is forwarded to the concerned department/authority for action, with priority set by AI.\n3️⃣ <strong>Acceptance & Disposal</strong> — The authority accepts & resolves it. You get live status updates via Tracking ID & SMS.\n4️⃣ <strong>Appeal</strong> — If not satisfied, you can appeal and escalate for further review.',
      'आपकी शिकायत <strong>CPGRAMS</strong> प्रक्रिया से गुजरती है: 1. पंजीकरण 2. विभाग को भेजा जाना 3. स्वीकृति व समाधान 4. अपील।'
    ],
    help: [
      'I can help you with:\n\n• 📸 How to report an issue\n• 🔍 How to track a complaint\n• 🔐 Login help\n• 🏢 Departments & priority\n• ❓ Anything about NagrikSnap\n\nJust type your question below! 👇',
'मैं इनमें मदद कर सकता हूं: रिपोर्ट करना, Tracking, लॉगिन, विभाग। कोई भी सवाल पूछें!'
    ],
    thanks: [
      'You\'re welcome! 😊 Is there anything else I can help with?',
      'कोई बात नहीं! और कुछ मदद चाहिए? 😊'
    ],
    bye: [
      'Goodbye! 👋 Have a great day. Keep your city clean & safe! 🏙️',
      'अलविदा! 🙏 अपने शहर का ख्याल रखें।'
    ],
    fallback: [
      "Hmm, I'm not sure about that. 🤔 Try asking about:\n• <strong>How to report</strong>\n• <strong>Track complaint</strong>\n• <strong>Login</strong>\n• <strong>Departments</strong>",
      'मुझे समझ नहीं आया। 🙏 <strong>रिपोर्ट</strong>, <strong>Track</strong>, <strong>लॉगिन</strong>, या <strong>विभाग</strong> के बारे में पूछें।'
    ]
  };

  // ---- Hindi translations for common answers ----
  const HI = {
    greeting: ['आपका स्वागत है! मैं जन सेवक हूं। बताइए, क्या मदद कर सकता हूं?', 'नमस्ते! 🙏 मैं जन सेवक हूं, आपकी नागरिक शिकायतों में मदद के लिए। कोई भी सवाल पूछें!'],
    report: ['📸 रिपोर्ट करना आसान है! 🖱️ <strong>Report Issue</strong> पेज पर जाएं, फोटो लें, समस्या लिखें, लोकेशन जोड़ें और 10 अंकों का मोबाइल नंबर डालें। तुरंत Tracking ID मिलेगी!'],
    track: ['🔍 अपनी शिकायत track करने के लिए <strong>Track Complaint</strong> पेज पर Tracking ID या मोबाइल नंबर डालें।'],
    login: ['🔐 लॉगिन के लिए नाम और 10 अंकों का मोबाइल नंबर डालें। Admin के लिए: admin / nagriksnap123'],
    departments: ['🏢 आपकी शिकायत स्वतः सही विभाग को जाएगी — सड़क, कचरा, पानी, लाइट, पार्क, नाला, आवारा पशु, शोर, यातायात, अतिक्रमण, मच्छर या स्कूल/अस्पताल।'],
    priority: ['⚡ जरूरी शिकायतों को High प्राथमिकता मिलती है ताकि वे जल्दी हल हों।'],
    help: ['मैं इनमें मदद कर सकता हूं: रिपोर्ट करना, Tracking, लॉगिन, विभाग। कोई भी सवाल पूछें!'],
    thanks: ['कोई बात नहीं! और कुछ मदद चाहिए? 😊'],
    bye: ['अलविदा! 🙏 अपने शहर का ख्याल रखें।'],
    fallback: ['मुझे समझ नहीं आया। 🙏 <strong>रिपोर्ट</strong>, <strong>Track</strong>, <strong>लॉगिन</strong>, या <strong>विभाग</strong> के बारे में पूछें।']
  };

  // Return a random response for a key in the current language
  function t(key) {
    const arr = (lang === 'hi' && HI[key]) ? HI[key] : KB[key];
    return arr[Math.floor(Math.random() * arr.length)];
  }

// ---- How to resolve a complaint (by department) ----
  const RESOLUTION = {
    'Public Works / Roads': {
      en: `🛣️ <strong>How to solve a Road / Pothole issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report with a clear photo + exact location (road name / landmark / GPS pin)<br>
        • Mention severity (e.g. deep pothole, causing accidents)<br>
        • Share your mobile number for updates<br><br>
        <strong>How the department resolves it:</strong><br>
        • Public Works marks the pothole & barriers for safety<br>
        • Cold-mix / hot-mix asphalt patching is scheduled<br>
        • Usually fixed within 7–15 working days depending on severity`,
      hi: `🛣️ <strong>सड़क / गड्ढे की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • साफ फोटो और सही लोकेशन (सड़क का नाम / लैंडमार्क / GPS) के साथ रिपोर्ट करें<br>
        • गंभीरता बताएं (जैसे गहरा गड्ढा, दुर्घटना का खतरा)<br>
        • अपडेट के लिए मोबाइल नंबर दें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Public Works गड्ढे को चिह्नित कर सुरक्षा बैरियर लगाता है<br>
        • ठंडी/गर्म डामर से पैचिंग की जाती है<br>
        • गंभीरता के अनुसार 7–15 कार्य दिवसों में ठीक होती है`
    },
    'Sanitation / Waste Management': {
      en: `🗑️ <strong>How to solve a Garbage / Waste issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report the exact spot & photo of the pile-up<br>
        • Note if it's overflowing bins, illegal dumping, or stale waste<br>
        • Avoid setting it on fire — report instead<br><br>
        <strong>How the department resolves it:</strong><br>
        • Sanitation team is dispatched for collection & clearing<br>
        • Regular pickup schedule is added for hotspot areas<br>
        • Usually cleared within 24–72 hours`,
      hi: `🗑️ <strong>कचरा समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • सही जगह और कचरे की फोटो के साथ रिपोर्ट करें<br>
        • बताएं कि डिब्बा भरा है, अवैध डंपिंग है या पुराना कचरा है<br>
        • आग न लगाएं — रिपोर्ट करें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • सफाई दल उठाकर साफ करता है<br>
        • हॉटस्पॉट इलाकों में नियमित उठान का कार्यक्रम जोड़ा जाता है<br>
        • सामान्यतः 24–72 घंटे में साफ होता है`
    },
    'Water Supply': {
      en: `💧 <strong>How to solve a Water issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report pipe leakage, contamination, or no supply<br>
        • Specify the address & when it started<br>
        • Avoid drinking contaminated water — report ASAP<br><br>
        <strong>How the department resolves it:</strong><br>
        • Water Supply team inspects & repairs the leak / main line<br>
        • Water quality samples are tested for contamination<br>
        • Repairs usually within 24–48 hours`,
      hi: `💧 <strong>पानी की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • पाइप लीक, दूषित पानी या आपूर्ति न होने की रिपोर्ट करें<br>
        • पता और कब से शुरू हुई, बताएं<br>
        • दूषित पानी न पिएं — तुरंत रिपोर्ट करें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Water Supply दल लीक/मुख्य लाइन का निरीक्षण कर मरम्मत करता है<br>
        • दूषण के लिए पानी की जांच की जाती है<br>
        • सामान्यतः 24–48 घंटे में मरम्मत`
    },
    'Electrical / Street Lights': {
      en: `💡 <strong>How to solve a Electrical   /Street Light issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report the pole / light number & exact location<br>
        • Note if it's flickering, completely off, or a wire hazard<br>
        • Do NOT touch exposed wires — report immediately<br><br>
        <strong>How the department resolves it:</strong><br>
        • Electrical team replaces the bulb / ballast<br>
        • Faulty wiring is repaired for safety<br>
        • Usually fixed within 24–72 hours`,
      hi: `💡 <strong>स्ट्रीट लाइट की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • पोल/लाइट नंबर और सही लोकेशन बताएं<br>
        • बताएं कि झिलमिला रही है, बंद है या तार का खतरा है<br>
        • खुले तार को न छुएं — तुरंत रिपोर्ट करें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Electrical दल बल्ब/बैलास्ट बदलता है<br>
        • सुरक्षा हेतु खराब तारों की मरम्मत की जाती है<br>
        • सामान्यतः 24–72 घंटे में ठीक`
    },
    'Parks & Horticulture': {
      en: `🌳 <strong>How to solve a Park / Tree issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report fallen/dangerous trees, broken equipment, or overgrowth<br>
        • Share the park name & nearest landmark<br>
        • If a tree is about to fall, report as urgent/High<br><br>
        <strong>How the department resolves it:</strong><br>
        • Horticulture teams prune / remove dangerous trees<br>
        • Park equipment is repaired or replaced<br>
        • Usually within a few days depending on scope`,
      hi: `🌳 <strong>पार्क / पेड़ की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • गिरे/खतरनाक पेड़, टूटे उपकरण या अतिवृद्धि की रिपोर्ट करें<br>
        • पार्क का नाम और नजदीकी स्थल बताएं<br>
        • यदि पेड़ गिरने वाला हो तो High/जरूरी के रूप में रिपोर्ट करें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Horticulture दल खतरनाक पेड़ काटता/छांटता है<br>
        • पार्क के उपकरण मरम्मत/बदले जाते हैं<br>
        • कार्य की सीमा के अनुसार कुछ दिनों में`
    },
    'Drainage / Sewerage': {
      en: `🕳️ <strong>How to solve a Drain / Sewerage issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report blocked drains, overflowing manholes, or foul smell<br>
        • Give the exact street & nearest landmark<br>
        • Avoid wading through contaminated water<br><br>
        <strong>How the department resolves it:</strong><br>
        • Drainage team clears blockages with jetting / excavation<br>
        • Manholes are sealed & overflow cleaned<br>
        • Usually cleared within 24–72 hours`,
      hi: `🕳️ <strong>नाला / सीवरेज की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • बंद नाला, भरा मैनहोल या दुर्गंध की रिपोर्ट करें<br>
        • सही गली और नजदीकी स्थल बताएं<br>
        • दूषित पानी में न चलें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Drainage दल जेटिंग/खुदाई से रुकावट हटाता है<br>
        • मैनहोल सील कर भरे पानी को साफ किया जाता है<br>
        • सामान्यतः 24–72 घंटे में साफ`
    },
    'Animal Control / Veterinary': {
      en: `🐕 <strong>How to solve a Stray Animal issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report the location & number of stray/aggressive animals<br>
        • Note if they are injured, rabid, or attacking people<br>
        • Do NOT approach aggressive animals — keep distance<br><br>
        <strong>How the department resolves it:</strong><br>
        • Animal control team is dispatched for rescue/capture<br>
        • Injured animals are treated at veterinary centres<br>
        • Sterilization (ABC) program reduces stray population<br>
        • Usually responded within 24–48 hours`,
      hi: `🐕 <strong>आवारा जानवरों की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • आवारा/आक्रामक जानवरों की लोकेशन व संख्या बताएं<br>
        • बताएं कि घायल, रेबीज़ या हमलावर हैं<br>
        • आक्रामक जानवरों के पास न जाएं — दूरी बनाए रखें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Animal control दल बचाव/कब्जे के लिए भेजा जाता है<br>
        • घायल जानवरों का पशु चिकित्सालय में इलाज<br>
        • स्टरलाइज़ेशन (ABC) से आवारा संख्या घटती है<br>
        • सामान्यतः 24–48 घंटे में सहायता`
    },
    'Public Safety / Noise Control': {
      en: `🔊 <strong>How to solve a Noise issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report loud music, construction noise, or disturbance<br>
        • Share time, location & source of noise<br>
        • Note if it violates local noise limits<br><br>
        <strong>How the department resolves it:</strong><br>
        • Public Safety team inspects & issues warning/fine<br>
        • Sound level is measured against permitted limits<br>
        • Repeat offenders get stricter action<br>
        • Usually addressed within a few days`,
      hi: `🔊 <strong>शोर की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • तेज़ संगीत, निर्माण शोर या गड़बड़ी की रिपोर्ट करें<br>
        • समय, लोकेशन और शोर का स्रोत बताएं<br>
        • स्थानीय शोर सीमा का उल्लंघन बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Public Safety दल निरीक्षण कर चेतावनी/जुर्माना जारी करता है<br>
        • अनुमत सीमा से ध्वनि स्तर मापा जाता है<br>
        • बार-बार करने वालों पर सख्त कार्रवाई<br>
        • सामान्यतः कुछ दिनों में`
    },
    'Traffic / Transport': {
      en: `🚦 <strong>How to solve a Traffic issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report broken signals, traffic jams, or bad parking<br>
        • Give exact junction/road & peak timings<br>
        • Note if it's a safety hazard or obstruction<br><br>
        <strong>How the department resolves it:</strong><br>
        • Traffic police deploy personnel at congestion points<br>
        • Faulty signals are repaired by transport dept<br>
        • Regulation & enforcement improve flow<br>
        • Parking issues are resolved with enforcement`,
      hi: `🚦 <strong>यातायात की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • टूटे सिग्नल, जाम या खराब पार्किंग की रिपोर्ट करें<br>
        • सही चौराहा/सड़क और पीक समय बताएं<br>
        • सुरक्षा खतरा या रुकावट बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • यातायात पुलिस भीड़ वाली जगहों पर तैनात होती है<br>
        • परिवहन विभाग खराब सिग्नल ठीक करता है<br>
        • नियमन से यातायात सुगम होता है<br>
        • पार्किंग समस्या पर नियमन से कार्रवाई`
    },
    'Urban Planning / Building Dept': {
      en: `🏗️ <strong>How to solve an Encroachment / Building issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report illegal construction, encroachment, or violations<br>
        • Share exact address & what's being built/blocked<br>
        • Provide photos of the violation clearly<br><br>
        <strong>How the department resolves it:</strong><br>
        • Building dept verifies permits & drawings<br>
        • Illegal/unapproved construction is ordered for demolition<br>
        • Encroachments are removed with due process<br>
        • Fines are imposed on violators`,
      hi: `🏗️ <strong>अतिक्रमण / भवन समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • अवैध निर्माण, अतिक्रमण या उल्लंघन की रिपोर्ट करें<br>
        • सही पता और क्या बन/रोक रहा है बताएं<br>
        • उल्लंघन की साफ फोटो प्रदान करें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Building विभाग परमिट व नक्शे की जांच करता है<br>
        • अवैध/अनुमोदित निर्माण ध्वस्त करने का आदेश<br>
        • विधिवत प्रक्रिया से अतिक्रमण हटाया जाता है<br>
        • उल्लंघनकर्ताओं पर जुर्माना`
    },
    'Public Health / Pest Control': {
      en: `🦟 <strong>How to solve a Pest / Mosquito issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report mosquito breeding, pest infestation, or waste<br>
        • Give exact location & type of pest<br>
        • Share if it's a public health risk<br><br>
        <strong>How the department resolves it:</strong><br>
        • Public Health schedules fogging & spray in hotspots<br>
        • Breeding sites (stagnant water) are treated/cleared<br>
        • Pest control investigates recurring infestations<br>
        • Usually addressed within a few days`,
      hi: `🦟 <strong>मच्छर / कीट समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • मच्छर प्रजनन, कीट संक्रमण की रिपोर्ट करें<br>
        • सही लोकेशन और कीट का प्रकार बताएं<br>
        • सार्वजनिक स्वास्थ्य जोखिम बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Public Health हॉटस्पॉट में फॉगिंग/स्प्रे करता है<br>
        • प्रजनन स्थल (रुका पानी) उपचारित/साफ किए जाते हैं<br>
        • बार-बार संक्रमण की जांच<br>
        • सामान्यतः कुछ दिनों में`
    },
    'Education / Health Services': {
      en: `🏫 <strong>How to solve a School / Hospital issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report issues about schools, hospitals, or health services<br>
        • Share the institution name, location & specific problem<br>
        • Mention impact on students/patients/public<br><br>
        <strong>How the department resolves it:</strong><br>
        • Relevant authority inspects the institution<br>
        • Improvements/repairs are planned & executed<br>
        • Coordination with education/health officials<br>
        • Addressed based on urgency & scope`,
      hi: `🏫 <strong>स्कूल / अस्पताल समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • स्कूल, अस्पताल या स्वास्थ्य सेवा की समस्या बताएं<br>
        • संस्था का नाम, लोकेशन और विशेष समस्या दें<br>
        • विद्यार्थियों/मरीज़ों/जनता पर प्रभाव बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • संबंधित अधिकारी संस्था का निरीक्षण करता है<br>
• सुधार/मरम्मत की योजना बनाकर क्रियान्वित की जाती है<br>
        • शिक्षा/स्वास्थ्य अधिकारियों से समन्वय<br>
        • तात्कालिकता व क्षेत्र के अनुसार हल`
    },
    'Public Health / Food & Civil Supplies': {
      en: `🍚 <strong>How to solve a Hunger / Starvation / Ration issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report families/individuals without food, missed ration, or children going hungry<br>
        • Give the exact area, number of people affected & since when<br>
        • Note if it's acute (no food for days) — mark as High/urgent<br>
        • Include contact details so assistance can be arranged quickly<br><br>
        <strong>How the department resolves it:</strong><br>
        • Food & Civil Supplies verifies ration-card status & dispenses rations<br>
        • Public Health / Social Welfare arranges community kitchens or food relief<br>
        • Mid-day-meal / nutrition programs are activated for children<br>
        • NGOs & local volunteers are coordinated for immediate food aid<br>
        • Urgent cases are escalated to district authorities for same-day help`,
      hi: `🍚 <strong>भुखमरी / भूख / राशन की समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • बिना भोजन वाले परिवार/व्यक्ति, छूटा राशन या भूखे बच्चों की रिपोर्ट करें<br>
        • सही इलाका, प्रभावित लोगों की संख्या और कब से बताएं<br>
        • अत्यंत स्थिति (कई दिनों से भोजन नहीं) हो तो High/जरूरी बताएं<br>
        • त्वरित सहायता के लिए संपर्क विवरण दें<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Food & Civil Supplies राशन कार्ड की जांच कर राशन उपलब्ध कराता है<br>
        • Public Health / Social Welfare सामुदायिक रसोई या भोजन सहायता का प्रबंध करता है<br>
        • बच्चों के लिए मिड-डे मील / पोषण कार्यक्रम सक्रिय किए जाते हैं<br>
        • तत्काल भोजन सहायता के लिए NGO व स्वयंसेवकों से समन्वय<br>
        • गंभीर मामलों को उसी दिन सहायता हेतु जिला प्रशासन को भेजा जाता है`
    },
    'General Administration': {
      en: `🏛️ <strong>How to resolve this issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Provide a clear photo, exact location & full description<br>
        • Mention urgency and your contact number<br><br>
        <strong>How it gets resolved:</strong><br>
        • The complaint is routed to the relevant department<br>
        • You'll get status updates via your Tracking ID & SMS<br>
        • Track progress anytime on the Track Complaint page`,
      hi: `🏛️ <strong>इस समस्या को कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • साफ फोटो, सही लोकेशन और पूरा विवरण दें<br>
        • तात्कालिकता और अपना संपर्क नंबर बताएं<br><br>
        <strong>कैसे हल होती है:</strong><br>
        • शिकायत संबंधित विभाग को भेजी जाती है<br>
        • Tracking ID और SMS से स्टेटस अपडेट मिलते रहेंगे<br>
        • Track Complaint पेज पर कभी भी प्रगति देखें`
    },
    'Electricity / Power Distribution': {
      en: `⚡ <strong>How to solve a Power / Electricity issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report power cut, transformer failure, low voltage, or exposed wires<br>
        • Give exact street/area & how long the outage has lasted<br>
        • Note if it's a public safety risk (sparks, fallen poles)<br><br>
        <strong>How the department resolves it:</strong><br>
        • Electricity board dispatches a lineman to inspect<br>
        • Faulty transformer / lines are repaired or replaced<br>
        • Outages are restored, usually within 6–24 hours`,
      hi: `⚡ <strong>बिजली / विद्युत समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • कटौती, ट्रांसफार्मर खराबी, कम वोल्टेज या खुले तार की रिपोर्ट करें<br>
        • सही गली/इलाका और कब से कटौती है बताएं<br>
        • सार्वजनिक खतरा (चिंगारी, गिरा खंभा) बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • Electricity बोर्ड लाइनमैन भेजकर जांच करता है<br>
        • खराब ट्रांसफार्मर/लाइन ठीक या बदली जाती है<br>
        • सामान्यतः 6–24 घंटे में आपूर्ति बहाल`
    },
    'Environment / Air Quality': {
      en: `🌫️ <strong>How to solve an Air Quality / Pollution issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report heavy smoke, smog, dust, or burning of waste<br>
        • Give location, source & time of day<br>
        • Note health impact on residents<br><br>
        <strong>How the department resolves it:</strong><br>
        • Pollution control board inspects & measures air quality (AQI)<br>
        • Burning of garbage / factories is penalized<br>
        • Water sprinkling & action on polluting vehicles/sites<br>
        • Usually responded within a few days`,
      hi: `🌫️ <strong>वायु प्रदूषण समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • भारी धुआं, धुंध, धूल या कचरे जलाने की रिपोर्ट करें<br>
        • लोकेशन, स्रोत और दिन का समय बताएं<br>
        • निवासियों पर स्वास्थ्य प्रभाव बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • प्रदूषण नियंत्रण बोर्ड निरीक्षण कर AQI मापता है<br>
        • कचरा/कारखाना जलाने पर जुर्माना<br>
        • पानी का छिड़काव व प्रदूषणकारी स्रोतों पर कार्रवाई<br>
        • सामान्यतः कुछ दिनों में`
    },
    'Fire & Emergency Services': {
      en: `🔥 <strong>How to handle a Fire / Spark issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Call 101 (fire) or 112 (emergency) IMMEDIATELY if active fire<br>
        • Do NOT touch or approach electrical sparks — keep distance<br>
        • Report location & what is burning clearly<br><br>
        <strong>How the department resolves it:</strong><br>
        • Fire brigade is dispatched as High priority<br>
        • Area is evacuated & fire is controlled<br>
        • Source (gas leak / electrical short) is investigated & fixed`,
      hi: `🔥 <strong>आग / चिंगारी की स्थिति कैसे संभालें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • सक्रिय आग होने पर तुरंत 101 (आग) या 112 (आपातकाल) पर कॉल करें<br>
        • बिजली की चिंगारी को न छुएं — दूरी बनाए रखें<br>
        • लोकेशन और क्या जल रहा है स्पष्ट बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • दमकल को High प्राथमिकता से भेजा जाता है<br>
        • इलाका खाली कराकर आग बुझाई जाती है<br>
        • स्रोत (गैस लीक / शॉर्ट सर्किट) की जांच कर ठीक किया जाता है`
    },
    'Telecom / Broadband': {
      en: `📶 <strong>How to solve a Telecom / Internet issue:</strong><br><br>
        <strong>You should:</strong><br>
        • Report poor network, no internet, or a faulty mobile tower<br>
        • Give location, operator & issue timing<br>
        • Note if a tower is tilted / unsafe<br><br>
        <strong>How the department resolves it:</strong><br>
        • Telecom provider checks tower & signal strength<br>
        • Faulty equipment / backhaul is repaired<br>
        • Unsafe towers are inspected & fixed<br>
        • Usually restored within 24–48 hours`,
      hi: `📶 <strong>टेलीकॉम / इंटरनेट समस्या कैसे हल करें:</strong><br><br>
        <strong>आपको करना चाहिए:</strong><br>
        • खराब नेटवर्क, इंटरनेट न आना या टावर खराबी की रिपोर्ट करें<br>
        • लोकेशन, ऑपरेटर और समय बताएं<br>
        • टावर झुका/असुरक्षित हो तो बताएं<br><br>
        <strong>विभाग कैसे हल करता है:</strong><br>
        • टेलीकॉम प्रदाता टावर व सिग्नल जांचता है<br>
        • खराब उपकरण ठीक किया जाता है<br>
        • असुरक्षित टावर की जांच व मरम्मत<br>
        • सामान्यतः 24–48 घंटे में बहाल`
    }
  };

// ---- Specific issue types (identify from full sentence) ----
  const ISSUE_TYPES = [
    {
      type: 'Pothole / Road Damage',
      dept: 'Public Works / Roads',
      priority: 'High',
keywords: ['pothole', 'pot hole', 'cracked road', 'damaged road', 'broken road', 'road damage', 'potholes', 'dip in road', 'uneven road', 'road broken', 'dirt road', 'गड्ढा', 'गड्ढे', 'सड़क टूटी', 'सड़क खराब', 'सड़क में गड्ढा', 'सड़क टूट गई', 'सड़क खराब है', 'रास्ता टूटा'],
      how: `<strong>Type of issue:</strong> 🕳️ Pothole / Road Damage<br>`,
      you: `<strong>You should:</strong><br>• Report exact location + photo showing depth/size<br>• Mention if it causes accidents (raises priority)<br>• Give nearest landmark & street name`,
      fix: `<strong>How it gets solved:</strong><br>• Dept. barriers off the pothole for safety<br>• Cold/hot-mix asphalt patching done<br>• Fixed within 7–15 working days`
    },
    {
      type: 'Garbage / Waste Pile-up',
      dept: 'Sanitation / Waste Management',
      keywords: ['garbage', 'rubbish', 'trash', 'waste', 'overflowing bin', 'dumping', 'बिन', 'litter', 'bins', 'dustbin', 'सफाई', 'कूड़ा', 'कचरा', 'कचरे का ढेर', 'कूड़ेदान', 'कूड़ा नहीं उठाया', 'कचरा जमा'],
      you: `<strong>You should:</strong><br>• Report exact spot + photo of the pile<br>• Mention if bin is overflowing or illegal dumping<br>• Do not burn waste — report instead`,
      fix: `<strong>How it gets solved:</strong><br>• Sanitation team clears the pile<br>• Hotspot added to regular pickup schedule<br>• Cleared within 24–72 hours`
    },
    {
      type: 'Water Supply / Leakage',
      dept: 'Water Supply',
keywords: ['water', 'pipe', 'leak', 'no water', 'pipeline', 'water supply', 'contaminated water', 'dirty water', 'water tanker', 'पानी', 'नल', 'पाइप', 'लीक', 'पानी नहीं', 'पानी की समस्या', 'गंदा पानी', 'पानी का रिसाव', 'पानी की आपूर्ति'],
      you: `<strong>You should:</strong><br>• Report leak / contamination / no supply<br>• Give address & when it started<br>• Avoid drinking contaminated water`,
      fix: `<strong>How it gets solved:</strong><br>• Team repairs leak / main line<br>• Water quality samples tested<br>• Repaired within 24–48 hours`
    },
    {
      type: 'Street Light / Electrical Fault',
      dept: 'Electrical / Street Lights',
keywords: ['street light', 'light not', 'light broken', 'flicker', 'pole', 'wire', 'streetlight', 'bulb', 'lamp', 'dark street', 'बत्ती', 'लाइट', 'स्ट्रीट लाइट', 'बत्ती नहीं', 'लाइट टूटी', 'अंधेरा', 'लाइट खराब'],
      you: `<strong>You should:</strong><br>• Report pole/light number + location<br>• Mention flickering / off / wire hazard<br>• Never touch exposed wires`,
      fix: `<strong>How it gets solved:</strong><br>• Bulb/ballast replaced by electrical team<br>• Faulty wiring repaired for safety<br>• Fixed within 24–72 hours`
    },
    {
      type: 'Park / Tree Issue',
      dept: 'Parks & Horticulture',
keywords: ['tree', 'fallen tree', 'park', 'branch', 'overgrown', 'swing', 'broken bench', 'पेड़', 'पार्क', 'डाल', 'पेड़ गिरा', 'झूला', 'बेंच', 'पार्क की समस्या', 'पेड़ टूटा', 'घास'],
      you: `<strong>You should:</strong><br>• Report fallen/dangerous tree or broken park equipment<br>• Give park name & landmark<br>• If a tree may fall, mark as High/urgent`,
      fix: `<strong>How it gets solved:</strong><br>• Horticulture prunes/removes the tree<br>• Park equipment repaired or replaced<br>• Done within a few days`
    },
{
      type: 'Drain / Sewerage Blockage',
      dept: 'Drainage / Sewerage',
keywords: ['drain', 'sewage', 'sewer', 'manhole', 'overflow', 'blocked drain', 'नाला', 'सीवर', 'सीवरेज', 'मैनहोल', 'नाला बंद', 'नाले का पानी', 'गंदा पानी नाला', 'नाला भरा', 'सीवर ओवरफ्लो', 'दुर्गंध'],
      you: `<strong>You should:</strong><br>• Report blocked drain / overflowing manhole<br>• Give exact street + landmark<br>• Avoid wading in contaminated water`,
      fix: `<strong>How it gets solved:</strong><br>• Drainage team jets/clears the blockage<br>• Manhole sealed & overflow cleaned<br>• Cleared within 24–72 hours`
    },
    {
      type: 'Stray Animal Issue',
      dept: 'Animal Control / Veterinary',
keywords: ['stray', 'animal', 'dog', 'cattle', 'cow', 'aggressive', 'आवारा', 'जानवर', 'कुत्ता', 'पशु', 'कुत्ते का झुंड', 'आवारा कुत्ता', 'गाय', 'बंदर', 'हमला किया', 'काटा', 'monkey'],
      you: `<strong>You should:</strong><br>• Report location & number of stray/aggressive animals<br>• Note if injured, rabid, or attacking people<br>• Keep distance — do not approach`,
      fix: `<strong>How it gets solved:</strong><br>• Animal control team rescues/relocates<br>• Injured animals treated at vet centre<br>• ABC sterilization reduces strays<br>• Responded within 24–48 hours`
    },
    {
      type: 'Noise Disturbance',
      dept: 'Public Safety / Noise Control',
keywords: ['noise', 'loud', 'music', 'disturbance', 'sound', 'शोर', 'आवाज', 'तेज संगीत', 'लाउडस्पीकर', 'शोर मचा', 'आवाज़', 'पटाखे', 'निर्माण शोर', 'construction noise', 'party noise'],
      you: `<strong>You should:</strong><br>• Report source, time & location of noise<br>• Note if it violates local noise limits<br>• Give the type (music/construction/party)`,
      fix: `<strong>How it gets solved:</strong><br>• Public Safety inspects & issues warning/fine<br>• Sound level measured vs permitted limits<br>• Repeat offenders get stricter action`
    },
    {
      type: 'Traffic / Parking Issue',
      dept: 'Traffic / Transport',
      keywords: ['traffic', 'signal', 'jam', 'parking', 'congestion', 'सिग्नल', 'यातायात', 'जाम', 'पार्किंग'],
      you: `<strong>You should:</strong><br>• Report broken signal / jam / bad parking<br>• Give exact junction & peak timings<br>• Note if it's a safety hazard`,
      fix: `<strong>How it gets solved:</strong><br>• Traffic police deployed at congestion<br>• Faulty signals repaired by transport dept<br>• Enforcement improves flow & parking`
    },
    {
      type: 'Encroachment / Illegal Building',
      dept: 'Urban Planning / Building Dept',
      keywords: ['encroach', 'illegal', 'building', 'construction', 'violation', 'अतिक्रमण', 'निर्माण', 'अवैध', 'भवन'],
      you: `<strong>You should:</strong><br>• Report illegal construction / encroachment<br>• Share exact address & photos<br>• Describe what is being built/blocked`,
      fix: `<strong>How it gets solved:</strong><br>• Building dept verifies permits & drawings<br>• Illegal construction ordered for demolition<br>• Encroachment removed + fines imposed`
    },
    {
      type: 'Mosquito / Pest Problem',
      dept: 'Public Health / Pest Control',
      keywords: ['mosquito', 'pest', 'insect', 'fogging', 'cockroach', 'breeding', 'मच्छर', 'कीट', 'फॉगिंग'],
      you: `<strong>You should:</strong><br>• Report breeding site / infestation location<br>• Give type of pest<br>• Note if it's a public health risk`,
      fix: `<strong>How it gets solved:</strong><br>• Public Health schedules fogging & spray<br>• Stagnant water / breeding sites cleared<br>• Pest control investigates recurrences`
    },
{
      type: 'School / Hospital Issue',
      dept: 'Education / Health Services',
      keywords: ['school', 'hospital', 'clinic', 'health', 'स्कूल', 'अस्पताल', 'क्लिनिक', 'स्वास्थ्य'],
      you: `<strong>You should:</strong><br>• Report the institution & specific problem<br>• Share name, location & impact on people<br>• Mention urgency / public risk`,
      fix: `<strong>How it gets solved:</strong><br>• Relevant authority inspects institution<br>• Improvements/repairs planned & executed<br>• Coordinated with education/health officials`
    },
    {
      type: 'Power Cut / Electricity Issue',
      dept: 'Electricity / Power Distribution',
      priority: 'High',
keywords: ['power', 'electricity', 'electrical', 'electrician', 'power cut', 'blackout', 'transformer', 'voltage', 'current', 'no power', 'electricity issue', 'electrical issue', 'electricity mistake', 'electrical mistake', 'power problem', 'electricity problem', 'electrical problem', 'power outage', 'power supply', 'short circuit', 'wiring', 'electric pole', 'fuse', 'meter', 'power failure', 'no current', 'lights not working', 'no light', 'light not coming', 'no electricity', 'electrical fault', 'बिजली', 'कटौती', 'लाइट नहीं', 'वोल्टेज', 'ट्रांसफार्मर', 'बिजली नहीं', 'बिजली की समस्या', 'विद्युत', 'शॉर्ट सर्किट', 'वायरिंग', 'करंट', 'फ्यूज', 'बत्ती नहीं', 'बिजली नहीं आ रही', 'लाइट नहीं आ रही', 'करंट नहीं', 'बिजली गुल'],
      you: `<strong>You should:</strong><br>• Report power cut / transformer issue + exact area<br>• Mention how long & if it's a safety hazard<br>• Share your contact for updates`,
      fix: `<strong>How it gets solved:</strong><br>• Electricity board dispatches a lineman<br>• Transformer / lines repaired or replaced<br>• Power restored within 6–24 hours`
    },
    {
      type: 'Air Quality / Pollution',
      dept: 'Environment / Air Quality',
      keywords: ['air', 'pollution', 'smoke', 'smog', 'smelly', 'dust', 'fumes', 'aqi', 'burning of waste', 'वायु', 'प्रदूषण', 'धुआं', 'धुंध', 'धूल', 'गंध'],
      you: `<strong>You should:</strong><br>• Report source, location & time of pollution<br>• Note burning of waste / factory smoke<br>• Mention health impact on residents`,
      fix: `<strong>How it gets solved:</strong><br>• Pollution board inspects & measures AQI<br>• Illegal burning is penalized<br>• Sprinkling & action on polluting sources`
    },
    {
      type: 'Fire / Safety Hazard',
      dept: 'Fire & Emergency Services',
      priority: 'High',
      keywords: ['fire', 'burning', 'spark', 'blaze', 'smoke from', 'आग', 'जल रहा', 'चिंगारी', 'आग लगी'],
      you: `<strong>You should:</strong><br>• Call 101 / 112 IMMEDIATELY for active fire<br>• Keep distance from sparks & flames<br>• Report exact location & what is burning`,
      fix: `<strong>How it gets solved:</strong><br>• Fire brigade dispatched as High priority<br>• Area evacuated & fire controlled<br>• Source (gas/electrical short) investigated`
    },
    {
      type: 'Telecom / Internet Issue',
      dept: 'Telecom / Broadband',
      keywords: ['network', 'internet', 'mobile', 'signal', 'wifi', 'broadband', 'tower', 'call drop', 'data', 'नेटवर्क', 'इंटरनेट', 'सिग्नल', 'वाईफाई', 'टावर', 'मोबाइल'],
      you: `<strong>You should:</strong><br>• Report poor network / no internet + location<br>• Mention operator & issue timing<br>• Note if a tower is tilted / unsafe`,
fix: `<strong>How it gets solved:</strong><br>• Provider checks tower & signal strength<br>• Faulty equipment repaired<br>• Unsafe towers inspected & fixed`
    },
    {
      type: 'Food / Starvation / Hunger',
      dept: 'Public Health / Food & Civil Supplies',
      priority: 'High',
      keywords: ['starvation', 'hunger', 'hungry', 'no food', 'food crisis', 'food shortage', 'starv', 'ration', 'ration card', 'no ration', 'mid day meal', 'midday meal', 'food relief', 'community kitchen', 'food aid', 'भूख', 'भुखमरी', 'भूखा', 'भूखे', 'राशन', 'राशन नहीं', 'राशन कार्ड', 'खाना नहीं', 'भोजन नहीं', 'मिड-डे मील', 'भोजन की कमी', 'अन्न', 'खाद्य'],
      you: `<strong>You should:</strong><br>• Report families/individuals without food, missed ration, or hungry children<br>• Give exact area, number affected & since when<br>• Mark as urgent if no food for days<br>• Share contact so help can reach quickly`,
      fix: `<strong>How it gets solved:</strong><br>• Food & Civil Supplies dispenses ration / food relief<br>• Community kitchens & mid-day-meal programs activated<br>• NGOs & volunteers coordinated for immediate aid<br>• Urgent cases escalated to district authorities`
    }
  ];

  // Match a keyword against text: word-boundary for English single words,
  // substring for Hindi and multi-word phrases (avoids false positives e.g. "air" in "chair").
  function wordMatch(t, k) {
    if (/[\u0900-\u097F]/.test(k) || k.includes(' ')) {
      return t.includes(k);
    }
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + escaped + '\\b').test(t);
  }

  // Detect the specific issue from a full sentence
  function detectIssue(text) {
    const t = text.toLowerCase();
    let best = null;
    let bestScore = 0;
    ISSUE_TYPES.forEach((item) => {
      let score = 0;
      item.keywords.forEach((k) => { if (wordMatch(t, k)) score++; });
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    });
    return best;
  }

  // Detect priority words from the sentence
  function detectPriority(text) {
    const t = text.toLowerCase();
    if (/(urgent|danger|accident|severe|emergency|जरूरी|खतरा|दुर्घटना|immediate)/.test(t)) return 'High';
    if (/(minor|small|slight|छोटा|थोड़ा)/.test(t)) return 'Low';
    return 'Medium';
  }

  // Build a full rich answer with issue type + how to solve
  function buildIssueAnswer(text) {
    const issue = detectIssue(text) || {
      type: 'General Civic Issue',
      dept: 'General Administration',
      you: `<strong>You should:</strong><br>• Provide a clear photo, exact location & full description<br>• Mention urgency and your contact number`,
      fix: `<strong>How it gets solved:</strong><br>• Routed to the relevant department<br>• Status updates via Tracking ID & SMS`
    };
// Use the detected issue type's default priority when set, else detect from text
    const priority = (issue && issue.priority) ? issue.priority : detectPriority(text);
    const isHindi = /[\u0900-\u097F]/.test(text);

    if (isHindi) {
      const hHow = {
        'Pothole / Road Damage': 'सड़क/गड्ढे की समस्या — जल्दी रिपोर्ट करें, फोटो + लोकेशन दें। Public Works विभाग गड्ढा भरता है।',
        'Garbage / Waste Pile-up': 'कचरे की समस्या — सफाई दल इसे 24-72 घंटे में उठाता है।',
        'Water Supply / Leakage': 'पानी की समस्या — विभाग लीक ठीक करता है, गुणवत्ता जांचता है।',
        'Street Light / Electrical Fault': 'बत्ती की समस्या — Electrical दल मरम्मत करता है।',
        'Park / Tree Issue': 'पार्क/पेड़ की समस्या — Horticulture दल ठीक करता है।',
        'Drain / Sewerage Blockage': 'नाले की समस्या — Drainage दल रुकावट हटाता है।',
        'Stray Animal Issue': 'आवारा जानवरों की समस्या — Animal Control दल बचाव करता है, घायलों का इलाज करता है।',
        'Noise Disturbance': 'शोर की समस्या — Public Safety चेतावनी/जुर्माना जारी कर शोर सीमा लागू करता है।',
        'Traffic / Parking Issue': 'यातायात/पार्किंग समस्या — यातायात पुलिस तैनात होकर जाम हटाती व सिग्नल ठीक कराती है।',
        'Encroachment / Illegal Building': 'अतिक्रमण/अवैध भवन — Building विभाग परमिट जांच कर अवैध निर्माण ध्वस्त करता है।',
        'Mosquito / Pest Problem': 'मच्छर/कीट समस्या — Public Health फॉगिंग करता है, प्रजनन स्थल साफ करता है।',
        'School / Hospital Issue': 'स्कूल/अस्पताल समस्या — संबंधित अधिकारी निरीक्षण कर सुधार करते हैं।',
        'Power Cut / Electricity Issue': 'बिजली/कटौती समस्या — Electricity बोर्ड लाइनमैन भेजकर ट्रांसफार्मर/लाइन ठीक करता है, 6–24 घंटे में आपूर्ति बहाल।',
        'Air Quality / Pollution': 'वायु प्रदूषण — प्रदूषण बोर्ड निरीक्षण कर AQI जांचता है, कचरा/धुआं जलाने पर जुर्माना।',
'Fire / Safety Hazard': 'आग/चिंगारी — तुरंत 101/112 पर कॉल करें, दमकल High प्राथमिकता से आग बुझाता है।',
        'Telecom / Internet Issue': 'नेटवर्क/इंटरनेट — टेलीकॉम प्रदाता टावर व सिग्नल जांच कर ठीक करता है, 24–48 घंटे।',
        'Food / Starvation / Hunger': 'भुखमरी/भूख/राशन — Food & Civil Supplies राशन व भोजन सहायता देता है, सामुदायिक रसोई व मिड-डे मील सक्रिय की जाती है। गंभीर मामले जिला प्रशासन को भेजे जाते हैं।'
      };
      return `🤖 <strong>Jan Sevak AI Analysis</strong><br><br>` +
        `🎯 <strong>Pahchana gaya issue:</strong> ${issue.type}<br>` +
        `🏢 <strong>Vibhag:</strong> ${issue.dept}<br>` +
        `⚡ <strong>Priority:</strong> <span class="jansevak-priority status-${priority.toLowerCase()}">${priority}</span><br><br>` +
        `📋 <strong>Kaise jaldi hal ho & kaise solve:</strong><br>${hHow[issue.type] || 'Riport karke Tracking ID lein, SMS updates milenge.'}<br><br>` +
        `👉 Isse <strong>Report Issue</strong> pe file karein aur Tracking ID payein!`;
    }

    return `🤖 <strong>Jan Sevak AI Analysis</strong><br><br>` +
      `🎯 <strong>Issue detected:</strong> ${issue.type}<br>` +
      `🏢 <strong>Department:</strong> ${issue.dept}<br>` +
      `⚡ <strong>Priority:</strong> <span class="jansevak-priority status-${priority.toLowerCase()}">${priority}</span><br><br>` +
      `${issue.you}<br><br>` +
      `${issue.fix}<br><br>` +
      `👉 Want to file this? Go to <strong>Report Issue</strong> and submit it to get a Tracking ID!`;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---- Intent detection ----
  function getIntent(text) {
    const t = text.toLowerCase();

    if (/(hi|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|हैलो|hello|सलाम)/.test(t)) return 'greeting';
    if (/(report|submit|file|complain|shikayat|रिपोर्ट|शिकायत|report issue|new snap)/.test(t)) return 'report';
    if (/(track|status|where is|kahan|ट्रैक|status of|tracking id|progress)/.test(t)) return 'track';
    if (/(login|log in|sign in|password|username|account|लॉगिन|लोगिन|पासवर्ड)/.test(t)) return 'login';
if (/(department|department|विभाग|road|pothole|garbage|water|light|tree|park|sewage|drain|department)/.test(t)) return 'departments';
    if (/(process|how it works|procedure|steps|how to|kaise|प्रक्रिया|कैसे|चरण|process flow)/.test(t)) return 'process';
if (/(priority|urgent|high|जरूरी|प्राथमिकता|priority)/.test(t)) return 'priority';
    if (/(help|support|menu|options|suggest|मदद|सहायता|option)/.test(t)) return 'help';
    if (/(thank|thanks|dhanyavaad|शुक्रिया|धन्यवाद|thank you)/.test(t)) return 'thanks';
    if (/(bye|goodbye|bye bye|alvida|अलविदा|बाय|quit)/.test(t)) return 'bye';

    return 'fallback';
  }

  // ---- Handle user message ----
  function handleUserMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    addMessage(escapeHtml(trimmed), 'user');
    inputEl.value = '';

// If it looks like a complaint description, offer classification
    const tw = trimmed.toLowerCase();
    const complaintKeywords = ['pothole', 'road', 'garbage', 'rubbish', 'water', 'pipe', 'light', 'streetlight', 'tree', 'park', 'sewage', 'drain', 'गड्ढा', 'सड़क', 'कचरा', 'कूड़ा', 'पानी', 'बत्ती', 'लाइट', 'stray', 'animal', 'dog', 'cattle', 'कुत्ता', 'जानवर', 'आवारा', 'noise', 'loud', 'शोर', 'आवाज', 'traffic', 'signal', 'jam', 'parking', 'सिग्नल', 'यातायात', 'encroach', 'illegal', 'building', 'construction', 'अतिक्रमण', 'निर्माण', 'mosquito', 'pest', 'insect', 'fogging', 'मच्छर', 'कीट', 'school', 'hospital', 'स्कूल', 'अस्पताल', 'bridge', 'पुल', 'leak', 'लीक', 'waste', 'overflow', 'manhole', 'मैनहोल', 'power', 'बिजली', 'electricity', 'electrical', 'electrician', 'transformer', 'blackout', 'voltage', 'वोल्टेज', 'कटौती', 'विद्युत', 'short circuit', 'wiring', 'fuse', 'meter', 'power outage', 'power supply', 'power failure', 'electrical fault', 'no current', 'no electricity', 'शॉर्ट सर्किट', 'वायरिंग', 'करंट', 'फ्यूज', 'बिजली गुल', 'बिजली नहीं आ रही', 'लाइट नहीं आ रही', 'air', 'pollution', 'smoke', 'smog', 'dust', 'fumes', 'प्रदूषण', 'धुआं', 'धुंध', 'धूल', 'fire', 'burning', 'spark', 'आग', 'जल', 'चिंगारी', 'network', 'internet', 'mobile', 'wifi', 'broadband', 'tower', 'इंटरनेट', 'नेटवर्क', 'सिग्नल', 'टावर', 'starvation', 'hunger', 'hungry', 'no food', 'ration', 'food shortage', 'mid day meal', 'भूख', 'भुखमरी', 'भूखा', 'राशन', 'खाना नहीं', 'भोजन नहीं', 'मिड-डे मील'];
    const looksLikeComplaint = complaintKeywords.some(k => tw.includes(k)) && tw.length > 8;

if (looksLikeComplaint) {
      botReply(buildIssueAnswer(trimmed));
      renderQuick(['📸 Report this issue', 'ℹ️ How is it solved?', '🔍 Track a complaint', 'ℹ️ Help']);
      return;
    }

const intent = getIntent(trimmed);
    botReply(t(intent));

    // Update quick chips based on intent
renderQuick(lang === 'hi'
      ? ['📸 रिपोर्ट', '🔍 Track शिकायत', '🔐 लॉगिन', '🏢 विभाग', '🔁 प्रक्रिया', 'ℹ️ मदद']
      : ['📸 How to report', '🔍 Track complaint', '🔐 Login help', '🏢 Departments', '🔁 How it works', 'ℹ️ More help']);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Open / close ----
  function openChat() {
    isOpen = true;
    windowEl.classList.add('open');
    toggle.classList.add('active');
    inputEl.focus();

    if (!greeted) {
      greeted = true;
      setTimeout(() => {
        addMessage(t('greeting'), 'bot');
        renderQuick(lang === 'hi'
          ? ['📸 रिपोर्ट', '🔍 Track शिकायत', '🔐 लॉगिन', 'ℹ️ मदद']
          : ['📸 How to report', '🔍 Track complaint', '🔐 Login help', 'ℹ️ Help']);
      }, 300);
    }
  }

  function closeChat() {
    isOpen = false;
    windowEl.classList.remove('open');
    toggle.classList.remove('active');
  }

  toggle.addEventListener('click', () => (isOpen ? closeChat() : openChat()));
  minimizeBtn.addEventListener('click', closeChat);

  sendBtn.addEventListener('click', () => handleUserMessage(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUserMessage(inputEl.value);
  });

// ---- Language toggle ----
  function setLang(label) {
    lang = label;
    localStorage.setItem('jansevak_lang', label);
    // Also sync the site-wide language so the navbar selector matches.
    localStorage.setItem('nagriksnap_lang', label);
    langLabel.textContent = label === 'hi' ? 'हिं' : 'EN';
    langBtn.title = label === 'hi' ? 'Switch to English' : 'हिंदी में बदलें';
    const siteSel = document.getElementById('langSelect');
    if (siteSel && siteSel.value !== label) siteSel.value = label;
    if (isOpen) {
      messagesEl.innerHTML = '';
      greeted = false;
      openChat();
      botReply(t('help'));
    }
  }

  // Initialize the toggle label to match the current chatbot language.
  langLabel.textContent = lang === 'hi' ? 'हिं' : 'EN';
  langBtn.title = lang === 'hi' ? 'Switch to English' : 'हिंदी में बदलें';

  // Listen for site-wide language changes (navbar selector) and update the chatbot.
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'langSelect') {
      const next = e.target.value === 'hi' ? 'hi' : 'en';
      if (next !== lang) {
        lang = next;
        localStorage.setItem('jansevak_lang', next);
        setLang(next);
      }
    }
  });

  langBtn.addEventListener('click', () => setLang(lang === 'hi' ? 'en' : 'hi'));

  // Don't auto-open on load; let user click the floating button.
})();
