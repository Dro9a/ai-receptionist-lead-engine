// ================================================================
//  AI RECEPTIONIST - FRONTEND APPLICATION
//  Connects to Backend at http://127.0.0.1:8000
// ================================================================

const API_BASE = 'http://127.0.0.1:8000';

// =================== STATE ===================
let allLeads = [];
let allFollowups = [];
let conversationHistory = []; // <-- Add this around Line 11
let currentFilter = 'all';
let sortField = 'score';
let sortDir = 'desc';
let messageCount = 0;

// =================== INITIALIZATION ===================
document.addEventListener('DOMContentLoaded', () => {
    // Common init
    updateClock();
    setInterval(updateClock, 1000);
    updateGreeting();

    // Page-specific init
    if (document.querySelector('.chat-page')) {
        initChat();
    }
    if (document.querySelector('.dashboard-page')) {
        initDashboard();
    }
});

// =================== UTILITY FUNCTIONS ===================
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    const dateStr = now.toLocaleDateString('en-IN', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    document.querySelectorAll('.live-clock').forEach(el => el.textContent = timeStr);
    document.querySelectorAll('#currentDate, #empCurrentDate').forEach(el => el.textContent = dateStr);
}

function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good Evening';
    if (hour < 12) greeting = 'Good Morning';
    else if (hour < 17) greeting = 'Good Afternoon';

    const el = document.getElementById('greeting');
    if (el) el.textContent = greeting;
}

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// =================== CHAT FUNCTIONS ===================
function initChat() {
    const input = document.getElementById('messageInput');
    if (input) {
        input.addEventListener('input', () => {
            // Auto-resize
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            // Char count
            const count = document.getElementById('charCount');
            if (count) count.textContent = `${input.value.length} / 500`;
        });
    }

    // Clear chat button
    const clearBtn = document.getElementById('clearChat');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const messages = document.getElementById('chatMessages');
            messages.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon"><i class="fas fa-hand-sparkles"></i></div>
                    <h2>Chat Cleared</h2>
                    <p>Start a new conversation</p>
                </div>
            `;
            messageCount = 0;
            conversationHistory = [];
            resetMetrics();
        });
    }

    // Check backend health
    checkHealth();
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function sendQuickMessage(text) {
    const input = document.getElementById('messageInput');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message) return;

    const customerId = document.getElementById('customerId').value.trim() || 'anonymous';
    const name = document.getElementById('customerName').value.trim() || 'Customer';
    const phone = document.getElementById('customerPhone').value.trim() || '0000000000';

    // Clear input
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('charCount').textContent = '0 / 500';

    // Remove welcome message
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    // Add user message
    addMessage('user', message);
    messageCount++;

    // Keep track of message context history
    conversationHistory.push({ role: 'user', content: message });

    // Show typing indicator
    showTyping(true);

    // Send to API
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: customerId,
                name: name,
                phone: phone,
                message: message
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Hide typing
        showTyping(false);

        // Add AI response
        const aiReply = data.reply || data.response || data.message || 'I received your message.';
        addMessage('ai', aiReply);

        // Update metrics
        updateChatMetrics(data);

        // Check for hot lead
        if (data.lead_score >= 90 || data.is_hot_lead) {
            showHotLeadAlert();
            showToast('warning', '🔥 Hot Lead!', `${name} scored ${data.lead_score || 90}+!`);
        }

        // Check for follow-up trigger
        if (data.followup_triggered || data.trigger_followup) {
            showFollowupAlert();
            showToast('info', '📅 Follow-up Scheduled', `Auto follow-up created for ${name}`);
        }

    } catch (error) {
        showTyping(false);
        console.error('Chat error:', error);
        addMessage('ai', "I'm sorry, I couldn't connect to the server. Please make sure the backend is running at " + API_BASE);
        showToast('error', 'Connection Error', 'Could not reach the backend server');
    }
}

function addMessage(type, text) {
    const container = document.getElementById('chatMessages');
    const now = new Date();

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    const avatarIcon = type === 'ai' ? 'fa-robot' : 'fa-user';

    msgDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-bubble">${escapeHtml(text)}</div>
            <span class="message-time">${formatTime(now)}</span>
        </div>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function showTyping(show) {
    const container = document.getElementById('chatMessages');
    const statusEl = document.getElementById('typingStatus');
    const existing = document.getElementById('typingMsg');

    if (show) {
        if (existing) return;
        statusEl.classList.add('typing');
        statusEl.querySelector('.status-text').textContent = 'AI is thinking';

        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingMsg';
        typingDiv.className = 'message ai';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
            </div>
        `;
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;
    } else {
        if (existing) existing.remove();
        statusEl.classList.remove('typing');
        statusEl.querySelector('.status-text').textContent = 'Ready to help';
    }
}

function updateChatMetrics(data) {
    // Lead Score
    const score = (data.lead_score && typeof data.lead_score === 'object') 
    ? (data.lead_score.score_numerical || 0) 
    : (data.lead_score || data.score || 0);
    const scoreValue = document.getElementById('leadScoreValue');
    const scoreFill = document.getElementById('leadScoreFill');
    if (scoreValue) {
        scoreValue.textContent = score;
        scoreValue.classList.add('counter-animate');
        setTimeout(() => scoreValue.classList.remove('counter-animate'), 500);
    }
    if (scoreFill) scoreFill.style.width = `${score}%`;

    // Sentiment
    const sentiment = data.sentiment || 'neutral';
    const badge = document.getElementById('sentimentBadge');
    if (badge) {
        const sentimentIcons = {
            interested: 'fa-smile-beam',
            confused: 'fa-meh',
            urgent: 'fa-exclamation-circle',
            neutral: 'fa-minus-circle'
        };
        const sentimentLabels = {
            interested: 'Interested',
            confused: 'Confused',
            urgent: 'Urgent',
            neutral: 'Neutral'
        };
        badge.className = `sentiment-badge ${sentiment}`;
        badge.innerHTML = `<i class="fas ${sentimentIcons[sentiment] || sentimentIcons.neutral}"></i> ${sentimentLabels[sentiment] || 'Neutral'}`;
    }

    // Engagement
    const engagement = Math.min(messageCount, 5);
    const engValue = document.getElementById('engagementValue');
    if (engValue) engValue.textContent = messageCount;
    const dots = document.querySelectorAll('#engagementDots .dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i < engagement);
    });
}

function showHotLeadAlert() {
    const alert = document.getElementById('hotLeadAlert');
    if (alert) {
        alert.style.display = 'block';
        alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function showFollowupAlert() {
    const alert = document.getElementById('followupAlert');
    if (alert) {
        alert.style.display = 'block';
    }
}

function resetMetrics() {
    document.getElementById('leadScoreValue').textContent = '--';
    document.getElementById('leadScoreFill').style.width = '0%';
    document.getElementById('sentimentBadge').className = 'sentiment-badge';
    document.getElementById('sentimentBadge').innerHTML = '<i class="fas fa-minus-circle"></i> Waiting';
    document.getElementById('engagementValue').textContent = '0';
    document.querySelectorAll('#engagementDots .dot').forEach(d => d.classList.remove('active'));
    document.getElementById('hotLeadAlert').style.display = 'none';
    document.getElementById('followupAlert').style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
            showToast('success', 'Connected', 'Backend server is online');
        }
    } catch {
        showToast('error', 'Offline', 'Backend server is not reachable');
    }
}

// =================== DASHBOARD FUNCTIONS ===================
function initDashboard() {
    loadLeads();
    loadFollowups();
    checkServerHealth();

    // Auto-refresh every 30 seconds
    setInterval(() => {
        loadLeads();
        loadFollowups();
    }, 30000);
}

function refreshAllData() {
    const btn = document.getElementById('refreshDashboard');
    if (btn) {
        btn.querySelector('i').style.animation = 'spin 0.5s ease';
        setTimeout(() => btn.querySelector('i').style.animation = '', 500);
    }
    loadLeads();
    loadFollowups();
    checkServerHealth();
    showToast('info', 'Refreshing', 'Updating dashboard data...');
}

async function checkServerHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        const dot = document.getElementById('serverStatus');
        const text = document.getElementById('serverStatusText');
        const health = document.getElementById('systemHealth');

        if (res.ok) {
            if (dot) { dot.className = 'status-dot online'; }
            if (text) text.textContent = 'Connected';
            if (health) health.textContent = 'Healthy';
        } else {
            throw new Error();
        }
    } catch {
        const dot = document.getElementById('serverStatus');
        const text = document.getElementById('serverStatusText');
        const health = document.getElementById('systemHealth');
        if (dot) { dot.className = 'status-dot'; dot.style.background = 'var(--danger)'; }
        if (text) text.textContent = 'Disconnected';
        if (health) { health.textContent = 'Offline'; health.style.color = 'var(--danger)'; }
    }
}

async function loadLeads() {
    try {
        const res = await fetch(`${API_BASE}/leads`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Handle different response formats
        allLeads = Array.isArray(data) ? data : (data.leads || []);
        
        renderLeads();
        updateKPIs();
        updateChart();
        updateEmployeeDashboard();

    } catch (error) {
        console.error('Failed to load leads:', error);
        const tbody = document.getElementById('leadsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10">
                        <div class="no-data">
                            <i class="fas fa-plug"></i>
                            <h4>Could not load leads</h4>
                            <p>Make sure the backend is running at ${API_BASE}</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

async function loadFollowups() {
    try {
        const res = await fetch(`${API_BASE}/followups`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        allFollowups = Array.isArray(data) ? data : (data.followups || []);
        
        renderFollowups();

    } catch (error) {
        console.error('Failed to load followups:', error);
        const grid = document.getElementById('followupGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-bell-slash"></i>
                    <h4>Could not load follow-ups</h4>
                    <p>Backend may be offline</p>
                </div>
            `;
        }
    }
}

function refreshFollowups() {
    loadFollowups();
}

function renderLeads() {
    const tbody = document.getElementById('leadsTableBody');
    const empTbody = document.getElementById('empLeadsTableBody');
    if (!tbody) return;

    let filtered = [...allLeads];

    // Apply score filter
    if (currentFilter === 'hot') {
        filtered = filtered.filter(l => (l.lead_score || l.score || 0) >= 90);
    } else if (currentFilter === 'warm') {
        filtered = filtered.filter(l => {
            const s = l.lead_score || l.score || 0;
            return s >= 50 && s < 90;
        });
    } else if (currentFilter === 'cold') {
        filtered = filtered.filter(l => (l.lead_score || l.score || 0) < 50);
    }

    // Apply search
    const search = document.getElementById('leadsSearch');
    if (search && search.value.trim()) {
        const q = search.value.toLowerCase();
        filtered = filtered.filter(l => 
            (l.customer_id || '').toLowerCase().includes(q) ||
            (l.name || '').toLowerCase().includes(q) ||
            (l.phone || '').toLowerCase().includes(q)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        let valA, valB;
        if (sortField === 'score') {
            valA = a.lead_score || a.score || 0;
            valB = b.lead_score || b.score || 0;
        } else if (sortField === 'name') {
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
        } else {
            valA = (a.customer_id || '').toLowerCase();
            valB = (b.customer_id || '').toLowerCase();
        }
        if (sortDir === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="no-data">
                        <i class="fas fa-inbox"></i>
                        <h4>No leads found</h4>
                        <p>Start chatting to generate leads!</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = filtered.map(lead => {
            const score = lead.lead_score || lead.score || 0;
            const scoreClass = score >= 90 ? 'hot' : score >= 50 ? 'warm' : 'cold';
            const scoreEmoji = score >= 90 ? '🔥' : score >= 50 ? '🟡' : '🔵';
            const sentiment = lead.sentiment || 'neutral';
            const sentimentBadge = getSentimentHtml(sentiment);
            const interest = lead.interest || lead.interest_score || '--';
            const budget = lead.budget || lead.budget_score || '--';
            const urgency = lead.urgency || lead.urgency_score || '--';
            const status = score >= 90 ? 'hot' : lead.followup_triggered ? 'followup' : 'active';
            const statusLabel = score >= 90 ? '🔥 Hot Lead' : lead.followup_triggered ? '📅 Follow-up' : '✅ Active';

            return `
                <tr onclick="showLeadDetail('${lead.customer_id || ''}')">
                    <td>
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">
                            ${escapeHtml(lead.customer_id || 'N/A')}
                        </span>
                    </td>
                    <td><strong>${escapeHtml(lead.name || 'Unknown')}</strong></td>
                    <td>${escapeHtml(lead.phone || 'N/A')}</td>
                    <td>
                        <span class="score-badge ${scoreClass}">
                            ${scoreEmoji} ${score}
                        </span>
                    </td>
                    <td>${sentimentBadge}</td>
                    <td>${interest}</td>
                    <td>${budget}</td>
                    <td>${urgency}</td>
                    <td><span class="status-badge ${status === '🔥 Hot Lead' ? 'hot' : status}">${statusLabel}</span></td>
                    <td>
                        <button class="table-action-btn" onclick="event.stopPropagation(); showLeadDetail('${lead.customer_id || ''}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update count badges
    const badge = document.getElementById('leadsCountBadge');
    if (badge) badge.textContent = filtered.length;
    const info = document.getElementById('tableInfo');
    if (info) info.textContent = `Showing ${filtered.length} of ${allLeads.length} leads`;

    // Employee table
    if (empTbody) {
        empTbody.innerHTML = filtered.slice(0, 10).map(lead => {
            const score = lead.lead_score || lead.score || 0;
            const scoreClass = score >= 90 ? 'hot' : score >= 50 ? 'warm' : 'cold';
            const sentiment = lead.sentiment || 'neutral';

            return `
                <tr>
                    <td><strong>${escapeHtml(lead.name || 'Unknown')}</strong></td>
                    <td>${escapeHtml(lead.phone || 'N/A')}</td>
                    <td><span class="score-badge ${scoreClass}">${score}</span></td>
                    <td>${getSentimentHtml(sentiment)}</td>
                    <td><span class="status-badge active">Active</span></td>
                    <td>
                        <button class="table-action-btn" onclick="window.location.href='chat.html'">
                            <i class="fas fa-comment"></i> Chat
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function getSentimentHtml(sentiment) {
    const configs = {
        interested: { icon: 'fa-smile-beam', label: 'Interested', class: 'interested' },
        confused: { icon: 'fa-meh', label: 'Confused', class: 'confused' },
        urgent: { icon: 'fa-exclamation-circle', label: 'Urgent', class: 'urgent' },
        neutral: { icon: 'fa-minus-circle', label: 'Neutral', class: 'neutral' }
    };
    const cfg = configs[sentiment] || configs.neutral;
    return `<span class="sentiment-badge ${cfg.class}"><i class="fas ${cfg.icon}"></i> ${cfg.label}</span>`;
}

function renderFollowups() {
    const grid = document.getElementById('followupGrid');
    if (!grid) return;

    const badge = document.getElementById('followupBadge');
    if (badge) badge.textContent = allFollowups.length;

    const countEl = document.getElementById('followupsCount');
    if (countEl) {
        countEl.textContent = allFollowups.length;
        countEl.classList.add('counter-animate');
        setTimeout(() => countEl.classList.remove('counter-animate'), 500);
    }

    if (allFollowups.length === 0) {
        grid.innerHTML = `
            <div class="no-data" style="grid-column: 1 / -1;">
                <i class="fas fa-check-double"></i>
                <h4>All caught up!</h4>
                <p>No pending follow-ups</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = allFollowups.map((fu, idx) => {
        const priority = fu.priority || (fu.lead_score >= 90 ? 'high' : fu.lead_score >= 50 ? 'medium' : 'low');
        const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);

        return `
            <div class="followup-card ${priority === 'high' ? 'urgent' : ''}" style="animation-delay: ${idx * 0.1}s">
                <div class="followup-card-header">
                    <h4>
                        <i class="fas fa-user-circle"></i>
                        ${escapeHtml(fu.name || fu.customer_id || 'Customer')}
                    </h4>
                    <span class="priority-tag ${priority}">${priorityLabel}</span>
                </div>
                <p>${escapeHtml(fu.reason || fu.message || 'Customer expressed interest - needs follow-up')}</p>
                <div class="followup-card-footer">
                    <span class="time">
                        <i class="fas fa-clock"></i>
                        ${fu.scheduled_time || fu.date || 'Today'}
                    </span>
                    <span>Score: ${fu.lead_score || fu.score || '--'}</span>
                </div>
            </div>
        `;
    }).join('');

    // Update employee followups count
    const empFu = document.getElementById('empFollowups');
    if (empFu) empFu.textContent = allFollowups.length;
}

function updateKPIs() {
    const total = allLeads.length;
    const hotLeads = allLeads.filter(l => (l.lead_score || l.score || 0) >= 90).length;
    const avgScore = total > 0 
        ? Math.round(allLeads.reduce((sum, l) => sum + (l.lead_score || l.score || 0), 0) / total) 
        : 0;

    // Conversion Rate (hot leads / total)
    const convRate = total > 0 ? Math.round((hotLeads / total) * 100) : 0;

    // Revenue estimate (hot leads * avg budget)
    const revenue = hotLeads * 3000; // Estimated avg budget

    // Animate values
    animateValue('totalLeads', total);
    animateValue('hotLeads', hotLeads);
    animateValue('aiHandled', total);

    const convEl = document.getElementById('conversionRate');
    if (convEl) convEl.textContent = `${convRate}%`;

    const revEl = document.getElementById('revenueEstimate');
    if (revEl) revEl.textContent = `₹${revenue.toLocaleString('en-IN')}`;

    // Avg score
    const avgEl = document.getElementById('avgScore');
    const avgFill = document.getElementById('avgScoreFill');
    if (avgEl) avgEl.textContent = avgScore;
    if (avgFill) avgFill.style.width = `${avgScore}%`;

    // Update employee dashboard
    const empChats = document.getElementById('empLiveChats');
    if (empChats) empChats.textContent = total;
    const empAi = document.getElementById('empAiHandled');
    if (empAi) empAi.textContent = total;
    const empLeads = document.getElementById('empLeadsReceived');
    if (empLeads) empLeads.textContent = total;
    const empHandoffs = document.getElementById('empHandoffs');
    if (empHandoffs) empHandoffs.textContent = Math.max(0, Math.floor(total * 0.1));
    const empPerf = document.getElementById('empPerformance');
    if (empPerf) empPerf.textContent = total > 0 ? 'Good' : '--';
}

function animateValue(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 600;
    const start = performance.now();

    function update(timestamp) {
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(current + (target - current) * eased);
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = target;
            el.classList.add('counter-animate');
            setTimeout(() => el.classList.remove('counter-animate'), 500);
        }
    }

    requestAnimationFrame(update);
}

function updateChart() {
    const total = allLeads.length;
    if (total === 0) return;

    const hot = allLeads.filter(l => (l.lead_score || l.score || 0) >= 90).length;
    const warm = allLeads.filter(l => {
        const s = l.lead_score || l.score || 0;
        return s >= 50 && s < 90;
    }).length;
    const cold = total - hot - warm;

    const circumference = 2 * Math.PI * 80; // r=80

    const hotPct = hot / total;
    const warmPct = warm / total;
    const coldPct = cold / total;

    const hotSegment = document.getElementById('hotSegment');
    const warmSegment = document.getElementById('warmSegment');
    const coldSegment = document.getElementById('coldSegment');

    if (hotSegment) {
        hotSegment.setAttribute('stroke-dasharray', `${hotPct * circumference} ${circumference}`);
        hotSegment.setAttribute('stroke-dashoffset', '0');
    }
    if (warmSegment) {
        warmSegment.setAttribute('stroke-dasharray', `${warmPct * circumference} ${circumference}`);
        warmSegment.setAttribute('stroke-dashoffset', `${-hotPct * circumference}`);
    }
    if (coldSegment) {
        coldSegment.setAttribute('stroke-dasharray', `${coldPct * circumference} ${circumference}`);
        coldSegment.setAttribute('stroke-dashoffset', `${-(hotPct + warmPct) * circumference}`);
    }

    // Update legend values
    const totalEl = document.getElementById('donutTotal');
    if (totalEl) totalEl.textContent = total;
    const hotCount = document.getElementById('hotCount');
    if (hotCount) hotCount.textContent = hot;
    const warmCount = document.getElementById('warmCount');
    if (warmCount) warmCount.textContent = warm;
    const coldCount = document.getElementById('coldCount');
    if (coldCount) coldCount.textContent = cold;
}

function updateEmployeeDashboard() {
    // Action Queue
    const queue = document.getElementById('actionQueue');
    if (!queue) return;

    const hotLeads = allLeads.filter(l => (l.lead_score || l.score || 0) >= 90);
    const actions = [];

    hotLeads.forEach(lead => {
        actions.push({
            type: 'hot',
            icon: 'fa-fire',
            title: `Hot Lead: ${lead.name || lead.customer_id}`,
            desc: `Score: ${lead.lead_score || lead.score} - Immediate attention needed`,
            time: 'Now'
        });
    });

    allFollowups.forEach(fu => {
        actions.push({
            type: 'followup',
            icon: 'fa-phone',
            title: `Follow-up: ${fu.name || fu.customer_id}`,
            desc: fu.reason || 'Scheduled follow-up call',
            time: fu.scheduled_time || 'Today'
        });
    });

    const badge = document.getElementById('actionQueueBadge');
    if (badge) badge.textContent = actions.length;

    if (actions.length === 0) {
        queue.innerHTML = `
            <div class="no-data">
                <i class="fas fa-check-double"></i>
                <h4>No pending actions</h4>
                <p>You're all caught up!</p>
            </div>
        `;
        return;
    }

    queue.innerHTML = actions.map(action => `
        <div class="action-item">
            <div class="action-icon ${action.type}">
                <i class="fas ${action.icon}"></i>
            </div>
            <div class="action-info">
                <h4>${escapeHtml(action.title)}</h4>
                <p>${escapeHtml(action.desc)}</p>
            </div>
            <span class="action-time">${action.time}</span>
        </div>
    `).join('');
}

// =================== FILTERS & SORTING ===================
function filterByScore(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderLeads();
}

function filterLeads() {
    renderLeads();
}

function sortTable(field) {
    if (sortField === field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDir = 'desc';
    }
    renderLeads();
}

// =================== ROLE SWITCHER ===================
function switchRole(role) {
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });

    const managerDash = document.getElementById('managerDashboard');
    const employeeDash = document.getElementById('employeeDashboard');

    if (role === 'manager') {
        managerDash.style.display = 'block';
        employeeDash.style.display = 'none';
    } else {
        managerDash.style.display = 'none';
        employeeDash.style.display = 'block';
    }
}

// =================== MODAL ===================
function showLeadDetail(customerId) {
    const lead = allLeads.find(l => l.customer_id === customerId);
    if (!lead) return;

    const modal = document.getElementById('leadModal');
    const body = document.getElementById('modalBody');

    const score = lead.lead_score || lead.score || 0;
    const scoreClass = score >= 90 ? 'hot' : score >= 50 ? 'warm' : 'cold';

    body.innerHTML = `
        <div class="modal-field">
            <label>Customer ID</label>
            <span style="font-family: 'JetBrains Mono', monospace;">${escapeHtml(lead.customer_id || 'N/A')}</span>
        </div>
        <div class="modal-field">
            <label>Name</label>
            <span>${escapeHtml(lead.name || 'Unknown')}</span>
        </div>
        <div class="modal-field">
            <label>Phone</label>
            <span>${escapeHtml(lead.phone || 'N/A')}</span>
        </div>
        <div class="modal-field">
            <label>Lead Score</label>
            <span><span class="score-badge ${scoreClass}">${score}/100</span></span>
        </div>
        <div class="modal-field">
            <label>Sentiment</label>
            <span>${getSentimentHtml(lead.sentiment || 'neutral')}</span>
        </div>
        <div class="modal-field">
            <label>Interest Score</label>
            <span>${lead.interest || lead.interest_score || '--'}/25</span>
        </div>
        <div class="modal-field">
            <label>Budget Score</label>
            <span>${lead.budget || lead.budget_score || '--'}/25</span>
        </div>
        <div class="modal-field">
            <label>Urgency Score</label>
            <span>${lead.urgency || lead.urgency_score || '--'}/25</span>
        </div>
        <div class="modal-field">
            <label>Engagement Score</label>
            <span>${lead.engagement || lead.engagement_score || '--'}/25</span>
        </div>
        ${lead.followup_triggered ? `
        <div class="modal-field">
            <label>Follow-up</label>
            <span style="color: var(--warning);"><i class="fas fa-bell"></i> Follow-up Scheduled</span>
        </div>
        ` : ''}
    `;

    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('leadModal');
    if (modal) modal.style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'leadModal') {
        closeModal();
    }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// =================== 3D TILT EFFECT ===================
document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.kpi-card, .quick-stat');
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -5;
            const rotateY = ((x - centerX) / centerX) * 5;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
        } else {
            card.style.transform = '';
        }
    });
});

// =================== SPARKLINE EFFECT (CSS-based) ===================
function createSparkline(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const bars = 12;
    container.style.display = 'flex';
    container.style.alignItems = 'flex-end';
    container.style.gap = '2px';

    for (let i = 0; i < bars; i++) {
        const bar = document.createElement('div');
        const height = 20 + Math.random() * 80;
        bar.style.cssText = `
            flex: 1;
            height: ${height}%;
            background: linear-gradient(to top, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.5));
            border-radius: 2px;
            transition: height 0.5s ease;
        `;
        container.appendChild(bar);
    }
}

// Create sparklines on load
if (document.querySelector('.dashboard-page')) {
    setTimeout(() => {
        createSparkline('leadsSparkline');
        createSparkline('conversionSparkline');
        createSparkline('hotSparkline');
    }, 500);
}

// =================== EXPORT CHAT ===================
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportChat');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const messages = document.querySelectorAll('.message');
            let text = 'AI Receptionist - Chat Export\n';
            text += '================================\n\n';

            messages.forEach(msg => {
                const type = msg.classList.contains('user') ? 'Customer' : 'AI';
                const bubble = msg.querySelector('.message-bubble');
                const time = msg.querySelector('.message-time');
                if (bubble) {
                    text += `[${time?.textContent || ''}] ${type}: ${bubble.textContent}\n\n`;
                }
            });

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-export-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);

            showToast('success', 'Exported', 'Chat history downloaded');
        });
    }
});