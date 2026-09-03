
(function () {
  'use strict';
    const authToken = sessionStorage.getItem('teachtrack_token');

  if (!authToken) {
    window.location.replace('login.html');
    return;
  }

  try {
    var signedInUser = JSON.parse(sessionStorage.getItem('teachtrack_user') || '{}');
    if (signedInUser.name) {
      document.querySelectorAll('.sf-label').forEach(function (label) { label.textContent = signedInUser.name; });
      document.querySelectorAll('.sf-av').forEach(function (avatar) {
        avatar.textContent = signedInUser.name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part[0]; }).join('').toUpperCase();
      });
    }
  } catch (_) {
    /* The profile API will refresh this data on the profile page. */
  }

  document.addEventListener('click', function (event) {
    const logoutButton = event.target.closest('#logoutBtn');

    if (!logoutButton) return;

    sessionStorage.removeItem('teachtrack_token');
    sessionStorage.removeItem('teachtrack_user');
    window.location.replace('login.html');
  });

  /* ---------- theme toggle (light/dark) ---------- */
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById('themeToggle');
    var assistantFrame = document.querySelector('iframe[src="ai_assistant.html"]');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var savedTheme = localStorage.getItem('teachtrack_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      root.setAttribute('data-theme', savedTheme);
    } else if (prefersDark) {
      root.setAttribute('data-theme', 'dark');
    }
    function syncAssistantTheme() {
      if (assistantFrame && assistantFrame.contentDocument) {
        assistantFrame.contentDocument.documentElement.setAttribute('data-theme', root.getAttribute('data-theme') || 'light');
      }
    }
    if (assistantFrame) assistantFrame.addEventListener('load', syncAssistantTheme);
    syncAssistantTheme();
    if (btn) {
      btn.addEventListener('click', function () {
        var isDark = root.getAttribute('data-theme') === 'dark';
        var nextTheme = isDark ? 'light' : 'dark';
        root.setAttribute('data-theme', nextTheme);
        localStorage.setItem('teachtrack_theme', nextTheme);
        syncAssistantTheme();
      });
    }
  })();

  /* ---------- notifications popup ---------- */
  (function () {
    var button = document.getElementById('notificationButton');
    var popup = document.getElementById('notificationPopup');
    if (!button || !popup) return;
    function closeNotifications() {
      popup.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
    }
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = popup.classList.toggle('open');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    popup.addEventListener('click', function (event) { event.stopPropagation(); });
    document.addEventListener('click', closeNotifications);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeNotifications();
    });
  })();

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.rv'));

  function showAll () {
    for (var i = 0; i < cards.length; i++) cards[i].classList.add('in');
  }

  function init () {
    /* ---------- scroll-fade reveal ---------- */
    if (reduceMotion || !('IntersectionObserver' in window) || cards.length === 0) {
      showAll();
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);                       // reveal once
          var s = el.getAttribute('data-stagger');
          if (s !== null) {                       // stat cards: 80ms stagger
            setTimeout(function () { el.classList.add('in'); }, parseInt(s, 10) * 80);
          } else {
            el.classList.add('in');
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

      cards.forEach(function (c) { io.observe(c); });
    }

    /* ---------- background parallax ----------
       Primary path: CSS scroll-driven animations (see @supports block in CSS).
       JS only measures the document's scroll range on load/resize so the
       keyframe endpoints â€” and therefore the 0.15x / 0.3x rates â€” are exact.
       No scroll listeners on this path.
       Fallback path: rAF-throttled scroll listener for browsers without
       animation-timeline support. */
    if (!reduceMotion) {
      var rootEl = document.documentElement;
      var hasTimeline = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));

      if (hasTimeline) {
        var measure = function () {
          var ms = Math.max(0, rootEl.scrollHeight - window.innerHeight);
          rootEl.style.setProperty('--doc-scroll', ms + 'px');
        };
        var rTick = false;
        measure();
        window.addEventListener('resize', function () {
          if (!rTick) { rTick = true; requestAnimationFrame(function () { measure(); rTick = false; }); }
        }, { passive: true });
        window.addEventListener('load', measure);  // fonts/images may change scrollHeight
      } else {
        var grid = document.getElementById('bgGrid');
        var blobs = document.getElementById('bgBlobs');
        var blobsNear = document.getElementById('bgBlobsNear');
        if (grid && blobs && blobsNear) {
          var ticking = false;
          var paint = function () {
            var sy = window.pageYOffset;
            var gMax = window.innerHeight * 0.58;  // grid layer bleeds 60vh
            var bMax = window.innerHeight * 0.88;  // far-blob layer bleeds 90vh
            var nMax = window.innerHeight * 0.88;  // near-blob layer bleeds 90vh
            var g = Math.min(sy * 0.45, gMax);      // slow layer: 0.45x
            var b = Math.min(sy * 0.90, bMax);      // far-blob layer: 0.9x
            var n = Math.min(sy * 1.60, nMax);      // near-blob layer: 1.6x
            var scale = 1 + Math.min(sy / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1), 1) * 0.18;
            grid.style.transform     = 'translate3d(0,' + (-g).toFixed(1) + 'px,0)';
            blobs.style.transform    = 'translate3d(0,' + (-b).toFixed(1) + 'px,0)';
            blobsNear.style.transform = 'translate3d(0,' + (-n).toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ')';
            ticking = false;
          };
          window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(paint); }
          }, { passive: true });
          paint();
        }
      }
    }
  }

  /* Run after DOMContentLoaded; if anything throws, force everything visible
     so the page can never be left in a hidden/blank state. */
  function boot () {
    try { init(); } catch (e) { showAll(); }
  }

  /* ---------- Dashboard / Timetable view switch ----------
     Only these two nav items are handled here. Duties, Leaves, Calendar,
     Messages and the existing topbar controls are left untouched. */
  (function () {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.side a[data-page]'));
    var dashboard = document.getElementById('dashboardPage');
    var timetable = document.getElementById('timetablePage');
    var duties = document.getElementById('dutiesPage');
    var leaves = document.getElementById('leavesPage');
    var calendar = document.getElementById('calendarPage');
    var assistant = document.getElementById('assistantPage');
    var messages = document.getElementById('messagesPage');
    var profile = document.getElementById('profilePage');
    var title = document.getElementById('pageTitle');
    var date = document.getElementById('pageDate');

    /* The full single-page router is retained when every view is present.
       Individual page files skip only this router; their local controls still
       initialise below. */
    if (dashboard && timetable && duties && leaves && calendar && assistant && messages && profile && navLinks.length > 0) {

    function setPage(page) {
      var isTimetable = page === 'timetable';
      var isDuties = page === 'duties';
      var isLeaves = page === 'leaves';
      var isCalendar = page === 'calendar';
      var isAssistant = page === 'assistant';
      var isMessages = page === 'messages';
      var isProfile = page === 'profile';

      dashboard.classList.toggle('active', !isTimetable && !isDuties && !isLeaves && !isCalendar && !isAssistant && !isMessages && !isProfile);
      timetable.classList.toggle('active', isTimetable);
      duties.classList.toggle('active', isDuties);
      leaves.classList.toggle('active', isLeaves);
      calendar.classList.toggle('active', isCalendar);
      assistant.classList.toggle('active', isAssistant);
      messages.classList.toggle('active', isMessages);
      profile.classList.toggle('active', isProfile);

      dashboard.setAttribute('aria-hidden', isTimetable || isDuties || isLeaves || isCalendar || isAssistant || isMessages || isProfile ? 'true' : 'false');
      timetable.setAttribute('aria-hidden', isTimetable ? 'false' : 'true');
      duties.setAttribute('aria-hidden', isDuties ? 'false' : 'true');
      leaves.setAttribute('aria-hidden', isLeaves ? 'false' : 'true');
      calendar.setAttribute('aria-hidden', isCalendar ? 'false' : 'true');
      assistant.setAttribute('aria-hidden', isAssistant ? 'false' : 'true');
      messages.setAttribute('aria-hidden', isMessages ? 'false' : 'true');
      profile.setAttribute('aria-hidden', isProfile ? 'false' : 'true');

      if (title) title.textContent = isTimetable ? 'Timetable' : (isDuties ? 'Duties' : (isLeaves ? 'Leaves' : (isCalendar ? 'Calendar' : (isAssistant ? 'AI Assistant' : (isMessages ? 'Messages' : (isProfile ? 'Profile Settings' : 'Dashboard'))))));
      if (date) date.textContent = isTimetable
        ? 'Weekly schedule Â· Term 3'
        : (isDuties ? 'Manage and track your assigned academic responsibilities.' : (isLeaves ? 'Manage and track your leave applications.' : (isCalendar ? 'Tuesday, 11 August Â· Term 3' : 'Friday, 7 August Â· Term 3')));
      if (date) date.hidden = isDuties;

      if (date && isAssistant) date.textContent = 'Ask about your schedule, workload, or duties.';
      if (date && isMessages) date.textContent = 'Connect with colleagues and manage conversations.';
      if (date && isProfile) date.textContent = 'View and manage your account details.';

      navLinks.forEach(function (link) {
        if (link.getAttribute('data-page') === page) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });

      if (isTimetable) {
        timetable.querySelector('.tt-shell').style.animation = 'none';
        void timetable.querySelector('.tt-shell').offsetWidth;
        timetable.querySelector('.tt-shell').style.animation = '';
      }
      if (isDuties) {
        duties.classList.remove('duties-page-refresh');
        void duties.offsetWidth;
        duties.classList.add('duties-page-refresh');
      }
      if (isCalendar) {
        var calReveals = calendar.querySelectorAll('.cal-reveal');
        calReveals.forEach(function (el) {
          el.style.animation = 'none';
          void el.offsetWidth;
          el.style.animation = '';
        });
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.addEventListener('storage', function (event) {
      if (event.key === 'teachtrack_theme' && event.newValue) {
        document.documentElement.setAttribute('data-theme', event.newValue);
      }
    });

    navLinks.forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        var page = link.getAttribute('data-page');
        if (window.location.hash !== '#' + page) {
          window.location.hash = page;
        } else {
          setPage(page);
        }
      });
    });

    function openPageFromHash() {
      var page = window.location.hash.slice(1);
      var validPages = ['dashboard', 'timetable', 'duties', 'leaves', 'calendar', 'assistant', 'messages', 'profile'];
      setPage(validPages.indexOf(page) !== -1 ? page : 'dashboard');
    }

    window.addEventListener('hashchange', openPageFromHash);
    openPageFromHash();
    }

    /* Dashboard: render the authenticated user's live aggregate data. */
    (function () {
      var dashboard = document.getElementById('dashboardPage');
      if (!dashboard) return;
      var api = 'http://localhost:4000/api/dashboard';
      function when(value) { return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'; }
      function loadDashboard() {
        fetch(api, { headers: { Authorization: 'Bearer ' + authToken } }).then(function (response) { if (!response.ok) throw new Error(); return response.json(); }).then(function (data) {
          var stats = data.stats;
          var pending = stats.pendingDuties || 0;
          var total = stats.duties || 0;
          var status = document.getElementById('dashboardDutyStatus');
          if (status) status.innerHTML = pending ? (pending > 5 ? 'High' : 'Active') : 'Clear';
          var meter = document.getElementById('dashboardDutyMeter'); if (meter) meter.style.setProperty('--w', (total ? Math.min(100, Math.round(pending / total * 100)) : 0) + '%');
          var dutyFoot = document.getElementById('dashboardDutyFoot'); if (dutyFoot) dutyFoot.textContent = pending + ' pending of ' + total + ' assigned duties';
          var lessons = document.getElementById('dashboardLessonCount'); if (lessons) lessons.innerHTML = stats.scheduledLessons + '<small>lessons</small>';
          var lessonFoot = document.getElementById('dashboardLessonFoot'); if (lessonFoot) lessonFoot.textContent = stats.upcomingThisWeek + ' items this week';
          var leave = document.getElementById('dashboardLeaveBalance'); if (leave) leave.innerHTML = stats.approvedLeaveDays + '<small>days</small>';
          var leaveFoot = document.getElementById('dashboardLeaveFoot'); if (leaveFoot) leaveFoot.textContent = 'Approved leave days';
          var next = data.upcoming && data.upcoming[0];
          var nextItem = document.getElementById('dashboardNextItem'); if (nextItem) nextItem.textContent = next ? next.title : 'None';
          var nextFoot = document.getElementById('dashboardNextItemFoot'); if (nextFoot) nextFoot.textContent = next ? when(next.date) + ' · ' + next.kind : 'No upcoming events';
          var notice = document.getElementById('dashboardNotice'); if (notice) notice.innerHTML = '<b>' + pending + ' duties need attention</b> · ' + (stats.upcomingThisWeek || 0) + ' calendar items this week.';
          var count = document.getElementById('dashboardUpcomingCount'); if (count) count.textContent = (data.upcoming || []).length + ' items';
          var list = document.getElementById('dashboardUpcomingList');
          if (list) { list.innerHTML = ''; (data.upcoming || []).forEach(function (item) { var li = document.createElement('li'); li.className = 'uitem ' + (item.kind === 'duty' ? 'high' : 'norm'); var wrapper = document.createElement('div'); var title = document.createElement('b'); title.textContent = item.title; var date = document.createElement('span'); date.className = 'uwhen'; date.textContent = when(item.date); wrapper.appendChild(title); wrapper.appendChild(date); var tag = document.createElement('span'); tag.className = 'tag ' + (item.kind === 'duty' ? 'high' : 'norm'); tag.textContent = item.kind === 'duty' ? 'Duty' : 'Calendar'; li.appendChild(wrapper); li.appendChild(tag); list.appendChild(li); }); }
          var messages = document.getElementById('dashboardMessagesList');
          if (messages) { messages.innerHTML = ''; (data.messages || []).slice(0, 3).forEach(function (message, index) { var other = message.senderId === data.user.id ? message.receiver : message.sender; var link = document.createElement('a'); link.className = 'msg'; link.href = 'messages.html'; var avatar = document.createElement('span'); avatar.className = 'avatar a' + (index + 1); avatar.textContent = (other.name || '?').charAt(0).toUpperCase(); var body = document.createElement('span'); body.className = 'msg-body'; var name = document.createElement('b'); name.textContent = other.name; var preview = document.createElement('span'); preview.className = 'msg-prev'; preview.textContent = message.content; body.appendChild(name); body.appendChild(preview); var meta = document.createElement('span'); meta.className = 'msg-meta'; var time = document.createElement('time'); time.textContent = when(message.createdAt); meta.appendChild(time); link.appendChild(avatar); link.appendChild(body); link.appendChild(meta); messages.appendChild(link); }); }
          var bars = document.querySelectorAll('.tcol');
          var maxHours = Math.max(1, Math.max.apply(null, (data.weeks || []).map(function (w) { return w.hours; })));
          var avgHours = (data.weeks || []).reduce(function (sum, w) { return sum + w.hours; }, 0) / (data.weeks || []).length || 0;
          bars.forEach(function (bar, index) { var week = (data.weeks || [])[index]; if (week) { var height = (week.hours / maxHours * 100); bar.style.setProperty('--h', height + '%'); bar.setAttribute('aria-label', week.week + ': ' + week.hours + ' hours'); bar.querySelector('.tip').textContent = week.week + ' · ' + week.hours + ' hrs'; } });
          var avgElem = document.querySelector('.avg'); if (avgElem && avgHours > 0) avgElem.style.setProperty('--p', (avgHours / maxHours * 100) + '%'); if (avgElem) avgElem.querySelector('em').textContent = 'avg ' + Math.round(avgHours) + 'h';
          var breakdownRows = document.querySelectorAll('.drow');
          var breakdownData = data.breakdown || [];
          breakdownRows.forEach(function (row, index) { if (index < breakdownData.length) { row.style.display = ''; var item = breakdownData[index]; var dhead = row.querySelector('.dhead'); if (dhead) { var b = dhead.querySelector('b'); if (b) b.textContent = item.percentage + '%'; var label = dhead.textContent.split(/\d+%/)[0].trim(); dhead.textContent = ''; var dsw = document.createElement('span'); dsw.className = 'dsw c' + (index + 1); dhead.appendChild(dsw); dhead.appendChild(document.createTextNode(item.type + ' ')); var bb = document.createElement('b'); bb.textContent = item.percentage + '%'; dhead.appendChild(bb); } var dfill = row.querySelector('.dfill'); if (dfill) { dfill.style.setProperty('--w', item.percentage + '%'); dfill.style.setProperty('--d', (index * 120 + 100) + 'ms'); } } else { row.style.display = 'none'; } });
          var refreshed = document.getElementById('dashboardRefreshText'); if (refreshed) refreshed.textContent = 'TeachTrack · dashboard updated ' + new Date().toLocaleTimeString();
        }).catch(function () { var notice = document.getElementById('dashboardNotice'); if (notice) notice.textContent = 'Dashboard data is unavailable while the server is offline.'; });
      }
      var review = document.getElementById('dashboardReviewDuties'); if (review) review.addEventListener('click', function () { window.location.href = 'duties.html'; });
      document.addEventListener('teachtrack:dashboard-refresh', loadDashboard);
      loadDashboard();
      window.setInterval(function () { if (!document.hidden) loadDashboard(); }, 30000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) loadDashboard(); });
    })();

    /* Duties: admins assign work; teachers update their own status. */
    (function () {
      var filterBtn = document.getElementById('dutyFilterBtn');
      var filterMenu = document.getElementById('dutyFilterMenu');
      var statusFilter = document.getElementById('dutyStatusFilter');
      var body = document.getElementById('dutyBody');
      if (!body) return;
      var count = document.getElementById('dutyCount');
      var addDuty = document.getElementById('addDutyBtn');
      var duties = [];
      var dutyApi = 'http://localhost:4000/api/duties';
      var isAdmin = false;
      try { isAdmin = JSON.parse(sessionStorage.getItem('teachtrack_user') || '{}').role === 'ADMIN'; } catch (_) {}

      if (addDuty && !isAdmin) addDuty.style.display = 'none';
      function labelStatus(status) { return status === 'IN_PROGRESS' ? 'In progress' : status.charAt(0) + status.slice(1).toLowerCase(); }
      function renderDuties() {
        if (!body) return;
        var filter = statusFilter ? statusFilter.value : 'all';
        var visible = duties.filter(function (duty) { return filter === 'all' || duty.status.toLowerCase() === filter; });
        body.innerHTML = '';
        visible.forEach(function (duty) {
          var row = document.createElement('tr'); row.className = 'duty-row'; row.dataset.status = duty.status.toLowerCase();
          var title = document.createElement('td'); title.textContent = duty.title;
          var teacher = document.createElement('td'); teacher.textContent = duty.assignedTo ? duty.assignedTo.name : '—';
          var date = document.createElement('td'); date.textContent = duty.dueAt ? new Date(duty.dueAt).toLocaleDateString() : 'No due date';
          var statusCell = document.createElement('td');
          var status = document.createElement('select'); status.className = 'duty-status-select ' + duty.status.toLowerCase();
          ['PENDING', 'IN_PROGRESS', 'COMPLETED'].forEach(function (value) { var option = new Option(labelStatus(value), value); option.selected = value === duty.status; status.appendChild(option); });
          status.disabled = isAdmin;
          status.addEventListener('change', async function () {
            status.className = 'duty-status-select ' + status.value.toLowerCase();
            var response = await fetch(dutyApi + '/' + duty.id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken }, body: JSON.stringify({ status: status.value }) });
            if (response.ok) { duty.status = status.value; renderDuties(); renderDutyStats(); }
          });
          statusCell.appendChild(status);
          row.appendChild(title); row.appendChild(teacher); row.appendChild(date); row.appendChild(statusCell);
          if (isAdmin) {
            var actionCell = document.createElement('td');
            var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'duty-remove'; remove.textContent = 'Remove';
            remove.addEventListener('click', async function () {
              if (!window.confirm('Remove this assigned duty?')) return;
              var response = await fetch(dutyApi + '/' + duty.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + authToken } });
              if (response.ok) { duties = duties.filter(function (item) { return item.id !== duty.id; }); renderDuties(); renderDutyStats(); }
            });
            actionCell.appendChild(remove); row.appendChild(actionCell);
          }
          body.appendChild(row);
        });
        if (count) count.textContent = visible.length ? 'Showing 1 to ' + visible.length + ' of ' + duties.length + ' entries' : 'No duties match this filter';
      }
      function renderDutyStats() {
        var upcoming = duties.filter(function (duty) { return duty.status !== 'COMPLETED' && duty.dueAt && new Date(duty.dueAt) >= new Date(); }).length;
        var upcomingEl = document.getElementById('dutyUpcomingCount'); if (upcomingEl) upcomingEl.innerHTML = upcoming + ' <small>upcoming</small>';
        var totalEl = document.getElementById('dutyTotalCount'); if (totalEl) totalEl.innerHTML = duties.length + ' <small>assigned</small>';
      }
      async function loadDuties() {
        try { var response = await fetch(dutyApi, { headers: { Authorization: 'Bearer ' + authToken } }); if (!response.ok) return; duties = (await response.json()).duties || []; renderDuties(); renderDutyStats(); } catch (_) {}
      }

      function applyDutyFilter() {
        renderDuties();
      }

      if (filterBtn && filterMenu) {
        filterBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = filterMenu.classList.toggle('open');
          filterBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', function () {
          filterMenu.classList.remove('open');
          filterBtn.setAttribute('aria-expanded', 'false');
        });
        filterMenu.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      if (statusFilter) statusFilter.addEventListener('change', applyDutyFilter);

      if (addDuty) {
        addDuty.addEventListener('click', function () {
          var modal = document.getElementById('dutyModal'); if (modal) { modal.hidden = false; document.body.classList.add('tt-modal-open'); }
        });
      }
      var dutyModal = document.getElementById('dutyModal');
      var dutyForm = document.getElementById('dutyForm');
      async function loadTeachers() { var response = await fetch(dutyApi + '/teachers', { headers: { Authorization: 'Bearer ' + authToken } }); if (!response.ok) return; var select = document.getElementById('dutyTeacher'); select.innerHTML = ''; (await response.json()).teachers.forEach(function (teacher) { select.appendChild(new Option(teacher.name + ' (' + teacher.email + ')', teacher.id)); }); }
      function closeDutyModal() { if (dutyModal) dutyModal.hidden = true; document.body.classList.remove('tt-modal-open'); }
      if (dutyModal) { document.getElementById('dutyModalClose').addEventListener('click', closeDutyModal); document.getElementById('dutyModalCancel').addEventListener('click', closeDutyModal); dutyModal.addEventListener('click', function (event) { if (event.target === dutyModal) closeDutyModal(); }); }
      if (dutyForm) dutyForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var date = document.getElementById('dutyDueDate').value, time = document.getElementById('dutyDueTime').value;
        var payload = { assignedToId: document.getElementById('dutyTeacher').value, title: document.getElementById('dutyTitle').value, description: document.getElementById('dutyDescription').value };
        if (date) payload.dueAt = new Date(date + 'T' + (time || '09:00')).toISOString();
        var response = await fetch(dutyApi, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken }, body: JSON.stringify(payload) });
        if (!response.ok) { document.getElementById('dutyFormError').textContent = 'Could not assign this duty.'; return; }
        duties.unshift((await response.json()).duty); closeDutyModal(); dutyForm.reset(); renderDuties(); renderDutyStats();
      });
      if (isAdmin) loadTeachers();
      document.addEventListener('teachtrack:duty-updated', loadDuties);
      document.addEventListener('teachtrack:duty-deleted', loadDuties);
      loadDuties();
    })();

    /* Timetable: each signed-in user's lectures are stored through the API. */
    var search = document.getElementById('ttSearch');
    var dayFilter = document.getElementById('ttDayFilter');
    var classFilter = document.getElementById('ttClassFilter');
    var timetableSlots = Array.prototype.slice.call(document.querySelectorAll('.tt-slot'));
    var timetableModal = document.getElementById('ttModal');
    var timetableForm = document.getElementById('ttForm');
    var timetableEditingIndex = null;

    function slotInfo(index) {
      var days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      return { day: days[index % 7], time: ['09:00', '10:00', '11:00'][Math.floor(index / 7)] };
    }

    var timetableEntries = timetableSlots.length ? Array(timetableSlots.length).fill(null) : [];

    function enhanceTimetableSelect(select) {
      if (!select || select.dataset.enhanced) return;
      var wrapper = select.closest('.tt-select');
      if (!wrapper) return;
      select.dataset.enhanced = 'true';
      select.classList.add('tt-native-select');
      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'tt-select-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.textContent = select.options[select.selectedIndex].textContent;
      var menu = document.createElement('div');
      menu.className = 'tt-select-menu';
      menu.setAttribute('role', 'listbox');
      Array.prototype.forEach.call(select.options, function (option) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'tt-select-option';
        item.textContent = option.textContent;
        item.dataset.value = option.value;
        item.setAttribute('role', 'option');
        item.addEventListener('click', function () {
          select.value = option.value;
          trigger.textContent = option.textContent;
          wrapper.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        menu.appendChild(item);
      });
      trigger.addEventListener('click', function () {
        var isOpen = wrapper.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
    }

    enhanceTimetableSelect(dayFilter);
    enhanceTimetableSelect(classFilter);

    function classCode(label) {
      var known = { 'FY-CS-A': 'fy', 'SY-IT-B': 'sy', 'TY-CS-A': 'ty' };
      return known[label.toUpperCase()] || label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    function timetableApi(path, options) {
      options = options || {};
      options.headers = Object.assign({ Authorization: 'Bearer ' + authToken }, options.headers || {});
      return fetch('http://localhost:4000/api/timetable' + path, options);
    }
    function renderSlot(slot, entry, index) {
      var info = slotInfo(index);
      slot.className = 'tt-slot tt-reveal';
      slot.setAttribute('data-day', info.day);
      slot.setAttribute('data-time', info.time);
      if (!entry) {
        slot.classList.add('empty');
        slot.removeAttribute('data-class');
        slot.removeAttribute('data-subject');
        slot.innerHTML = '<span class="tt-plus">+</span><span class="tt-empty-label">Add lecture</span>';
        slot.setAttribute('aria-label', 'Add lecture on ' + info.day + ' at ' + info.time);
        return;
      }
      slot.classList.add('lecture', entry.type || 'teal');
      slot.setAttribute('data-class', classCode(entry.classLabel || entry.className));
      slot.setAttribute('data-subject', entry.subject);
      slot.innerHTML = '<span class="tt-dot"></span><b></b><small></small>';
      slot.querySelector('b').textContent = entry.subject;
      slot.querySelector('small').textContent = (entry.classLabel || entry.className) + ' · ' + entry.room;
      slot.setAttribute('aria-label', 'Edit ' + entry.subject + ' on ' + info.day + ' at ' + info.time);
    }
    function renderTimetable() {
      timetableSlots.forEach(function (slot, index) { renderSlot(slot, timetableEntries[index], index); });
      filterTimetable();
    }
    async function loadTimetable() {
      try {
        var response = await timetableApi('/');
        if (!response.ok) throw new Error('Unable to load timetable.');
        var data = await response.json();
        timetableEntries = Array(timetableSlots.length).fill(null);
        (data.lectures || []).forEach(function (lecture) {
          var index = indexFor(lecture.day, lecture.time);
          if (index >= 0) timetableEntries[index] = lecture;
        });
        renderTimetable();
      } catch (error) {
        console.error(error);
        var note = document.getElementById('ttFormError');
        if (note) note.textContent = 'Unable to load your timetable. Check that the backend is running.';
      }
    }

    function filterTimetable() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var day = dayFilter ? dayFilter.value : 'all';
      var cls = classFilter ? classFilter.value : 'all';
      var timetableGrid = document.querySelector('.tt-grid');
      var dayHeaders = Array.prototype.slice.call(document.querySelectorAll('.tt-day'));

      if (timetableGrid) {
        if (day === 'all') {
          timetableGrid.style.gridTemplateColumns = '';
          timetableGrid.style.minWidth = '';
        } else {
          timetableGrid.style.gridTemplateColumns = '70px minmax(220px, 1fr)';
          timetableGrid.style.minWidth = '320px';
        }
      }

      dayHeaders.forEach(function (header) {
        header.style.display = day === 'all' || header.getAttribute('data-day') === day ? '' : 'none';
      });

      timetableSlots.forEach(function (slot) {
        var text = slot.textContent.toLowerCase();
        var matchesSearch = !q || text.indexOf(q) !== -1;
        var matchesDay = day === 'all' || slot.getAttribute('data-day') === day;
        var matchesClass = cls === 'all' || !slot.getAttribute('data-class') ||
          slot.getAttribute('data-class') === cls;
        slot.style.display = matchesDay ? '' : 'none';
        slot.style.visibility = (matchesSearch && matchesClass) ? '' : 'hidden';
      });
    }

    if (search) search.addEventListener('input', filterTimetable);
    if (dayFilter) dayFilter.addEventListener('change', filterTimetable);
    if (classFilter) classFilter.addEventListener('change', filterTimetable);

    function openTimetableModal(index) {
      if (!timetableModal || !timetableForm) return;
      timetableEditingIndex = index;
      var entry = timetableEntries[index];
      var info = slotInfo(index);
      timetableForm.reset();
      document.getElementById('ttModalTitle').textContent = entry ? 'Edit lecture' : 'Add lecture';
      document.getElementById('ttSubject').value = entry ? entry.subject : '';
      document.getElementById('ttClass').value = entry ? (entry.classLabel || entry.className) : '';
      document.getElementById('ttRoom').value = entry ? entry.room : '';
      document.getElementById('ttType').value = entry ? entry.type : 'teal';
      document.getElementById('ttDay').value = info.day;
      document.getElementById('ttTime').value = info.time;
      document.getElementById('ttDeleteLecture').hidden = !entry;
      document.getElementById('ttFormError').textContent = '';
      timetableModal.hidden = false;
      document.body.classList.add('tt-modal-open');
      document.getElementById('ttSubject').focus();
    }
    function closeTimetableModal() {
      if (!timetableModal) return;
      timetableModal.hidden = true;
      document.body.classList.remove('tt-modal-open');
      timetableEditingIndex = null;
    }
    function indexFor(day, time) {
      var days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      return ['09:00', '10:00', '11:00'].indexOf(time) * 7 + days.indexOf(day);
    }
    if (timetableSlots.length) {
      renderTimetable();
      timetableSlots.forEach(function (slot, index) { slot.addEventListener('click', function () { openTimetableModal(index); }); });
      var addLecture = document.getElementById('ttAddLecture');
      if (addLecture) addLecture.addEventListener('click', function () {
        var firstEmpty = timetableEntries.findIndex(function (entry) { return !entry; });
        if (firstEmpty === -1) { window.alert('Every available timetable slot already has a lecture. Edit a slot to make space.'); return; }
        openTimetableModal(firstEmpty);
      });
      document.getElementById('ttModalClose').addEventListener('click', closeTimetableModal);
      document.getElementById('ttModalCancel').addEventListener('click', closeTimetableModal);
      timetableModal.addEventListener('click', function (event) { if (event.target === timetableModal) closeTimetableModal(); });
      document.getElementById('ttDeleteLecture').addEventListener('click', async function () {
        if (timetableEditingIndex === null) return;
        var entry = timetableEntries[timetableEditingIndex];
        try {
          var response = await timetableApi('/' + entry.id, { method: 'DELETE' });
          if (!response.ok) throw new Error('Unable to delete this lecture.');
          timetableEntries[timetableEditingIndex] = null;
          renderTimetable(); closeTimetableModal();
        } catch (error) {
          document.getElementById('ttFormError').textContent = error.message || 'Unable to delete this lecture.';
        }
      });
      timetableForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var targetIndex = indexFor(document.getElementById('ttDay').value, document.getElementById('ttTime').value);
        var formError = document.getElementById('ttFormError');
        if (targetIndex !== timetableEditingIndex && timetableEntries[targetIndex]) {
          formError.textContent = 'That time slot already has a lecture. Choose another time or edit that lecture.';
          return;
        }
        var payload = {
          subject: document.getElementById('ttSubject').value.trim(),
          className: document.getElementById('ttClass').value.trim(),
          room: document.getElementById('ttRoom').value.trim(),
          type: document.getElementById('ttType').value,
          day: document.getElementById('ttDay').value,
          time: document.getElementById('ttTime').value
        };
        try {
          var existing = timetableEntries[timetableEditingIndex];
          var response = await timetableApi(existing ? '/' + existing.id : '/', {
            method: existing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Unable to save this lecture.');
          timetableEntries[timetableEditingIndex] = null;
          timetableEntries[targetIndex] = data.lecture;
          renderTimetable(); closeTimetableModal();
        } catch (error) {
          formError.textContent = error.message || 'Unable to save this lecture.';
        }
      });
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !timetableModal.hidden) closeTimetableModal(); });
      renderTimetable();
      loadTimetable();
    }

    /* Profile: load and edit the authenticated account. */
    (function () {
      var profileName = document.getElementById('profileName');
      if (!profileName) return;
      var modal = document.getElementById('profileModal');
      var form = document.getElementById('profileForm');
      var currentUser = null;

      function profileApi(path, options) {
        options = options || {};
        options.headers = Object.assign({ Authorization: 'Bearer ' + authToken }, options.headers || {});
        return fetch('http://localhost:4000/api/auth' + path, options);
      }
      function initials(name) {
        return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part[0]; }).join('').toUpperCase() || '?';
      }
      function dateLabel(value) {
        if (!value) return 'Not available';
        return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }
      function setText(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }
      function renderProfile(user) {
        currentUser = user;
        var role = user.role === 'ADMIN' ? 'Administrator' : 'Teacher';
        setText('profileName', user.name);
        setText('profileRole', role + (user.department ? ' · ' + user.department : ''));
        setText('profileFullName', user.name);
        setText('profileEmail', user.email);
        setText('profileDepartment', user.department || 'Not set');
        setText('profileRoleValue', role);
        setText('profilePhone', user.phone || 'Not set');
        setText('profileAccountId', user.id ? user.id.slice(-8).toUpperCase() : '—');
        setText('profileJoined', dateLabel(user.createdAt));
        setText('profileLastLogin', dateLabel(user.lastLoginAt));
        var avatar = document.getElementById('profileAvatar');
        if (avatar) avatar.textContent = initials(user.name);
        Array.prototype.slice.call(document.querySelectorAll('.sf-av')).forEach(function (el) { el.textContent = initials(user.name); });
        Array.prototype.slice.call(document.querySelectorAll('.sf-label')).forEach(function (el) { el.textContent = user.name; });
      }
      function openProfileModal() {
        if (!currentUser) return;
        document.getElementById('profileInputName').value = currentUser.name || '';
        document.getElementById('profileInputEmail').value = currentUser.email || '';
        document.getElementById('profileInputDepartment').value = currentUser.department || '';
        document.getElementById('profileInputPhone').value = currentUser.phone || '';
        document.getElementById('profileInputCurrentPassword').value = '';
        document.getElementById('profileInputNewPassword').value = '';
        document.getElementById('profileFormMessage').textContent = '';
        modal.hidden = false;
        document.body.classList.add('profile-modal-open');
        document.getElementById('profileInputName').focus();
      }
      function closeProfileModal() { modal.hidden = true; document.body.classList.remove('profile-modal-open'); }
      async function loadProfile() {
        try {
          var response = await profileApi('/me');
          if (!response.ok) throw new Error('Unable to load your profile.');
          var data = await response.json();
          sessionStorage.setItem('teachtrack_user', JSON.stringify(data.user));
          renderProfile(data.user);
        } catch (error) {
          setText('profileName', 'Unable to load profile');
          setText('profileRole', 'Check that the backend is running, then refresh this page.');
        }
      }
      document.getElementById('profileEditButton').addEventListener('click', openProfileModal);
      document.getElementById('profileModalClose').addEventListener('click', closeProfileModal);
      document.getElementById('profileModalCancel').addEventListener('click', closeProfileModal);
      modal.addEventListener('click', function (event) { if (event.target === modal) closeProfileModal(); });
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        var message = document.getElementById('profileFormMessage');
        var saveButton = document.getElementById('profileSaveButton');
        var payload = {
          name: document.getElementById('profileInputName').value.trim(),
          email: document.getElementById('profileInputEmail').value.trim(),
          department: document.getElementById('profileInputDepartment').value.trim(),
          phone: document.getElementById('profileInputPhone').value.trim(),
          currentPassword: document.getElementById('profileInputCurrentPassword').value,
          newPassword: document.getElementById('profileInputNewPassword').value
        };
        if (payload.newPassword && !payload.currentPassword) { message.textContent = 'Enter your current password to set a new password.'; return; }
        saveButton.disabled = true;
        message.textContent = 'Saving…';
        try {
          var response = await profileApi('/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          var data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Unable to save your profile.');
          sessionStorage.setItem('teachtrack_user', JSON.stringify(data.user));
          renderProfile(data.user);
          closeProfileModal();
        } catch (error) {
          message.textContent = error.message || 'Unable to save your profile.';
        } finally { saveButton.disabled = false; }
      });
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !modal.hidden) closeProfileModal(); });
      loadProfile();
    })();

    /* Leaves interactions: application modal with validation + success feedback. */
    var applyLeaveBtn = document.getElementById('applyLeaveBtn');
    var leaveModal = document.getElementById('leaveModal');
    var leaveCancelBtn = document.getElementById('leaveCancelBtn');
    var leaveForm = document.getElementById('leaveForm');
    function closeLeaveModal(){ if(leaveModal) leaveModal.classList.remove('open'); }
    if(applyLeaveBtn && leaveModal) applyLeaveBtn.addEventListener('click', function(){ leaveModal.classList.add('open'); var f=document.getElementById('leaveFrom'); if(f) f.focus(); });
    if(leaveCancelBtn) leaveCancelBtn.addEventListener('click', closeLeaveModal);
    if(leaveModal) leaveModal.addEventListener('click', function(e){ if(e.target===leaveModal) closeLeaveModal(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeLeaveModal(); });
    if(false && leaveForm) leaveForm.addEventListener('submit', function(e){
      e.preventDefault();
      var from=document.getElementById('leaveFrom').value, to=document.getElementById('leaveTo').value;
      if(from && to && to < from){ alert('The To date cannot be earlier than the From date.'); return; }
      closeLeaveModal();
      leaveForm.reset();
      if(applyLeaveBtn){ applyLeaveBtn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg> Application Sent'; applyLeaveBtn.style.background='#087a71'; setTimeout(function(){applyLeaveBtn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Apply Leave'; applyLeaveBtn.style.background='';},1800); }
    });
  })();

  /* ============ Calendar page logic ============
     Workload-management themed sample data: duties, meetings, exams, leaves.
     Categories map to the same color language used across the app
     (teal = duty, purple = meeting, amber = exam, blue = leave). */
  (function () {
    var grid = document.getElementById('calGrid');
    if (!grid) return; // calendar markup not present

    var TODAY = new Date(2026, 7, 11); // 11 Aug 2026 â€” matches the app's "current" date

    var CATEGORY = {
      duty:    { label: 'Duty',    cls: 'duty',    icon: 'M5 4h14v17H5zM9 2h6v4H9zM9 13l2 2 4-4' },
      meeting: { label: 'Meeting', cls: 'meeting',  icon: 'M11 20A7 7 0 0 1 4 13c0-4 3-9 16-9-1 2-1 4-2 6-1.5 3-4 4-4 4' },
      exam:    { label: 'Exam',    cls: 'exam',     icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z' },
      leave:   { label: 'Leave',   cls: 'leave',    icon: 'M8 2v4M16 2v4M3 9h18M3 4h18v17H3z' }
    };

    var events = [
      { date: '2026-08-11', name: 'Parent-Teacher Conference', time: '10:00 AM â€“ 01:00 PM', location: 'Auditorium',        category: 'meeting', status: 'completed' },
      { date: '2026-08-11', name: 'Staff Briefing',            time: '08:30 AM â€“ 09:00 AM', location: 'Staff Room 1',      category: 'meeting', status: 'completed' },
      { date: '2026-08-12', name: 'Hall Monitoring Duty',      time: '12:30 PM â€“ 01:30 PM', location: 'North Wing',        category: 'duty',    status: 'upcoming' },
      { date: '2026-08-14', name: 'Maths Exam Invigilation',   time: '09:00 AM â€“ 11:00 AM', location: 'Main Hall',         category: 'exam',    status: 'upcoming' },
      { date: '2026-08-15', name: 'Curriculum Committee',      time: '02:00 PM â€“ 04:00 PM', location: 'Conference Room B', category: 'meeting', status: 'pending' },
      { date: '2026-08-18', name: 'Science Fair Duty',         time: '09:00 AM â€“ 04:00 PM', location: 'North Wing',        category: 'duty',    status: 'upcoming' },
      { date: '2026-08-20', name: 'Casual Leave',              time: 'All day',             location: 'â€”',                category: 'leave',   status: 'pending' }
    ];
    var calendarApi = 'http://localhost:4000/api/calendar';
    var editingEvent = null;

    var current = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    var selectedDate = fmt(TODAY);
    var currentView = 'month';
    var currentPage = 1;
    var PAGE_SIZE = 4;

    function fmt(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function eventsOn(dateStr) { return events.filter(function (e) { return e.date === dateStr; }); }
    function eventFromApi(event) {
      var start = new Date(event.startsAt);
      var category = event.type.toLowerCase();
      return {
        id: event.id, date: fmt(start), name: event.title,
        time: event.endsAt ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(event.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day',
        location: event.description || '—', category: CATEGORY[category] ? category : 'meeting',
        status: start < TODAY ? 'completed' : 'upcoming', description: event.description || '',
        startsAt: event.startsAt, endsAt: event.endsAt, reminderAt: event.reminderAt,
      };
    }
    async function loadCalendarEvents() {
      try {
        var response = await fetch(calendarApi, { headers: { Authorization: 'Bearer ' + authToken } });
        if (!response.ok) return;
        var data = await response.json();
        events = (data.events || []).map(eventFromApi);
        renderAll();
      } catch (_) { /* Keep the calendar usable if the API is unavailable. */ }
    }
    function startOfWeek(d) { var x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x; }
    function endOfWeek(d) { var x = startOfWeek(d); x.setDate(x.getDate() + 6); x.setHours(23,59,59,999); return x; }

    var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function renderMonthLabel() {
      var label = document.getElementById('calMonthLabel');
      if (label) label.textContent = MONTH_NAMES[current.getMonth()] + ' ' + current.getFullYear();
    }

    function renderGrid() {
      Array.prototype.slice.call(grid.querySelectorAll('.cal-day')).forEach(function (el) { el.remove(); });
      grid.classList.remove('week-view', 'day-view');

      var year = current.getFullYear(), month = current.getMonth();
      var firstDay = new Date(year, month, 1);
      var startOffset = firstDay.getDay(); // 0=Sun
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var daysInPrevMonth = new Date(year, month, 0).getDate();
      var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
      var dates = [];
      if (currentView === 'day') {
        dates = [new Date(selectedDate + 'T00:00:00')];
        grid.classList.add('day-view');
      } else if (currentView === 'week') {
        var weekStart = startOfWeek(new Date(selectedDate + 'T00:00:00'));
        for (var weekDay = 0; weekDay < 7; weekDay++) {
          var weekDate = new Date(weekStart);
          weekDate.setDate(weekStart.getDate() + weekDay);
          dates.push(weekDate);
        }
        grid.classList.add('week-view');
      } else {
        for (var monthCell = 0; monthCell < totalCells; monthCell++) {
          if (monthCell < startOffset) dates.push(new Date(year, month - 1, daysInPrevMonth - startOffset + monthCell + 1));
          else if (monthCell >= startOffset + daysInMonth) dates.push(new Date(year, month + 1, monthCell - startOffset - daysInMonth + 1));
          else dates.push(new Date(year, month, monthCell - startOffset + 1));
        }
      }
      var headers = Array.prototype.slice.call(grid.querySelectorAll('.cal-dow'));
      var headerNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      headers.forEach(function (header, index) {
        header.style.display = currentView === 'day' && index > 0 ? 'none' : '';
        if (currentView === 'month') header.textContent = headerNames[index];
        else if (currentView === 'week') header.textContent = headerNames[index] + ' ' + dates[index].getDate();
        else if (index === 0) header.textContent = headerNames[dates[0].getDay()] + ' ' + dates[0].getDate();
      });

      var frag = document.createDocumentFragment();

      for (var i = 0; i < dates.length; i++) {
        var cellDate = dates[i];
        var dayNum = cellDate.getDate();
        var isOther = currentView === 'month' && cellDate.getMonth() !== month;

        var dStr = fmt(cellDate);
        var isToday = dStr === fmt(TODAY);
        var isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
        var dayEvents = eventsOn(dStr);

        var cell = document.createElement('div');
        cell.className = 'cal-day' + (isOther ? ' other' : '') + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '') + (dStr === selectedDate ? ' selected' : '');
        cell.setAttribute('data-date', dStr);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', cellDate.toDateString() + (dayEvents.length ? ', ' + dayEvents.length + ' event(s)' : ''));

        var numEl = document.createElement('span');
        numEl.className = 'cal-daynum';
        numEl.textContent = dayNum;
        cell.appendChild(numEl);

        if (dayEvents.length) {
          var evtsWrap = document.createElement('div');
          evtsWrap.className = 'cal-evts';
          var shown = dayEvents.slice(0, 2);
          shown.forEach(function (ev) {
            var pill = document.createElement('span');
            pill.className = 'cal-pill ' + CATEGORY[ev.category].cls;
            pill.innerHTML = '<i></i><span>' + ev.name + '</span>';
            if (ev.id) pill.addEventListener('click', function (event) { event.stopPropagation(); openEventModal(ev); });
            evtsWrap.appendChild(pill);
          });
          if (dayEvents.length > 2) {
            var more = document.createElement('span');
            more.className = 'cal-more';
            more.textContent = '+' + (dayEvents.length - 2) + ' more';
            evtsWrap.appendChild(more);
          }
          cell.appendChild(evtsWrap);
        }

        cell.addEventListener('click', function () {
          selectedDate = this.getAttribute('data-date');
          renderGrid();
        });
        cell.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.click(); }
        });

        frag.appendChild(cell);
      }

      grid.appendChild(frag);
    }

    function renderStats() {
      var todayStr = fmt(TODAY);
      var wkStart = startOfWeek(TODAY), wkEnd = endOfWeek(TODAY);

      var todayCount = eventsOn(todayStr).length;
      var weekCount = events.filter(function (e) {
        var d = new Date(e.date + 'T00:00:00');
        return d >= wkStart && d <= wkEnd;
      }).length;

      // naive conflict check: 2+ events sharing the same date & overlapping "day" slot
      var byDate = {};
      events.forEach(function (e) { (byDate[e.date] = byDate[e.date] || []).push(e); });
      var conflicts = 0;
      Object.keys(byDate).forEach(function (d) { if (byDate[d].length > 1) conflicts += byDate[d].length - 1; });

      var elToday = document.getElementById('calEventsToday');
      var elWeek = document.getElementById('calEventsWeek');
      var elConf = document.getElementById('calConflicts');
      if (elToday) elToday.innerHTML = todayCount + '<small>scheduled</small>';
      if (elWeek) elWeek.innerHTML = weekCount + '<small>events</small>';
      if (elConf) elConf.innerHTML = conflicts + '<small>needs review</small>';
    }

    function statusLabel(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function renderTable() {
      var tbody = document.getElementById('calEventsBody');
      var showingText = document.getElementById('calShowingText');
      var pageBtnsWrap = document.getElementById('calPageBtns');
      if (!tbody) return;

      var sorted = events.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      var totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;

      var start = (currentPage - 1) * PAGE_SIZE;
      var pageItems = sorted.slice(start, start + PAGE_SIZE);

      tbody.innerHTML = '';
      pageItems.forEach(function (ev) {
        var cat = CATEGORY[ev.category];
        var dObj = new Date(ev.date + 'T00:00:00');
        var dateLabel = MONTH_NAMES[dObj.getMonth()].slice(0, 3) + ' ' + dObj.getDate() + ', ' + dObj.getFullYear();

        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><div class="cal-evtname">' +
            '<span class="cal-evticon ' + cat.cls + '" style="--evt-t:var(--' + (cat.cls === 'duty' ? 'teal-t' : cat.cls === 'meeting' ? 'purp-t' : cat.cls === 'exam' ? 'amber-t' : 'blue-t') + ');--evt-c:var(--' + (cat.cls === 'duty' ? 'teal-d' : cat.cls === 'meeting' ? 'purp' : cat.cls === 'exam' ? 'amber' : 'blue') + ')">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + cat.icon + '"/></svg>' +
            '</span>' + ev.name +
          '</div></td>' +
          '<td>' + dateLabel + '</td>' +
          '<td>' + ev.time + '</td>' +
          '<td>' + ev.location + '</td>' +
          '<td><span class="cal-status ' + ev.status + '">' + statusLabel(ev.status) + '</span></td>';
        tbody.appendChild(tr);
      });

      if (showingText) {
        var last = Math.min(start + PAGE_SIZE, sorted.length);
        showingText.textContent = sorted.length
          ? 'Showing ' + (start + 1) + ' to ' + last + ' of ' + sorted.length + ' entries'
          : 'No events to show';
      }

      if (pageBtnsWrap) {
        pageBtnsWrap.innerHTML = '';
        var prev = document.createElement('button');
        prev.type = 'button'; prev.textContent = '\u2039'; prev.setAttribute('aria-label', 'Previous page');
        prev.disabled = currentPage === 1;
        prev.addEventListener('click', function () { if (currentPage > 1) { currentPage--; renderTable(); } });
        pageBtnsWrap.appendChild(prev);

        for (var p = 1; p <= totalPages; p++) {
          (function (p) {
            var b = document.createElement('button');
            b.type = 'button'; b.textContent = p;
            if (p === currentPage) b.classList.add('active');
            b.addEventListener('click', function () { currentPage = p; renderTable(); });
            pageBtnsWrap.appendChild(b);
          })(p);
        }

        var next = document.createElement('button');
        next.type = 'button'; next.textContent = '\u203A'; next.setAttribute('aria-label', 'Next page');
        next.disabled = currentPage === totalPages;
        next.addEventListener('click', function () { if (currentPage < totalPages) { currentPage++; renderTable(); } });
        pageBtnsWrap.appendChild(next);
      }
    }

    function renderAll() {
      renderMonthLabel();
      renderGrid();
      renderStats();
      renderTable();
    }

    var prevBtn = document.getElementById('calPrevMonth');
    var nextBtn = document.getElementById('calNextMonth');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      renderMonthLabel(); renderGrid();
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      renderMonthLabel(); renderGrid();
    });

    var viewBtns = Array.prototype.slice.call(document.querySelectorAll('.cal-view-toggle button'));
    viewBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentView = btn.getAttribute('data-view');
        var viewDate = new Date(selectedDate + 'T00:00:00');
        current = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        renderMonthLabel();
        renderGrid();
      });
    });

    var addBtn = document.getElementById('calAddEventBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        openEventModal(null);
      });
    }

    var eventModal = document.getElementById('calendarEventModal');
    var eventForm = document.getElementById('calendarEventForm');
    function localDateTime(value) {
      if (!value) return '';
      var d = new Date(value);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    function openEventModal(event) {
      editingEvent = event;
      document.getElementById('calendarEventTitle').textContent = event ? 'Edit task or reminder' : 'Add task or reminder';
      document.getElementById('calendarEventName').value = event ? event.name : '';
      document.getElementById('calendarEventType').value = event ? event.category.toUpperCase() : 'REMINDER';
      document.getElementById('calendarEventDate').value = event ? event.date : (selectedDate || fmt(TODAY));
      document.getElementById('calendarEventTime').value = event && event.startsAt ? localDateTime(event.startsAt).slice(11) : '09:00';
      document.getElementById('calendarEventReminder').value = event ? localDateTime(event.reminderAt) : '';
      document.getElementById('calendarEventDescription').value = event ? event.description : '';
      document.getElementById('calendarEventDelete').style.display = event ? '' : 'none';
      document.getElementById('calendarEventError').textContent = '';
      eventModal.hidden = false;
      document.body.classList.add('tt-modal-open');
      document.getElementById('calendarEventName').focus();
    }
    function closeEventModal() { eventModal.hidden = true; document.body.classList.remove('tt-modal-open'); }
    document.getElementById('calendarEventClose').addEventListener('click', closeEventModal);
    document.getElementById('calendarEventCancel').addEventListener('click', closeEventModal);
    eventModal.addEventListener('click', function (event) { if (event.target === eventModal) closeEventModal(); });
    document.getElementById('calendarEventDelete').addEventListener('click', async function () {
      if (!editingEvent || !window.confirm('Remove this calendar item?')) return;
      var response = await fetch(calendarApi + '/' + editingEvent.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + authToken } });
      if (response.ok) { events = events.filter(function (item) { return item.id !== editingEvent.id; }); closeEventModal(); renderAll(); }
    });
    eventForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      var date = document.getElementById('calendarEventDate').value;
      var time = document.getElementById('calendarEventTime').value;
      var payload = {
        title: document.getElementById('calendarEventName').value,
        description: document.getElementById('calendarEventDescription').value,
        type: document.getElementById('calendarEventType').value,
        startsAt: new Date(date + 'T' + time).toISOString(),
        reminderAt: document.getElementById('calendarEventReminder').value ? new Date(document.getElementById('calendarEventReminder').value).toISOString() : undefined,
      };
      var response = await fetch(editingEvent ? calendarApi + '/' + editingEvent.id : calendarApi, {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
        body: JSON.stringify(payload),
      });
      if (!response.ok) { document.getElementById('calendarEventError').textContent = 'Could not save this calendar item.'; return; }
      var saved = eventFromApi((await response.json()).event);
      if (editingEvent) events = events.map(function (item) { return item.id === saved.id ? saved : item; }); else events.push(saved);
      selectedDate = saved.date; currentPage = 1; closeEventModal(); renderAll();
    });

    renderAll();
    loadCalendarEvents();
  })();

  /* ---------- API-backed leaves page ---------- */
  (function () {
    var page = document.getElementById('leavesPage');
    var history = document.getElementById('leaveHistory');
    var count = document.getElementById('leaveCount');
    var form = document.getElementById('leaveForm');
    var modal = document.getElementById('leaveModal');
    var applyButton = document.getElementById('applyLeaveBtn');
    var daysTaken = document.getElementById('leaveDaysTaken');
    var balance = document.getElementById('leaveBalance');
    if (!page || !history || !form) return;

    var user = {};
    try { user = JSON.parse(sessionStorage.getItem('teachtrack_user') || '{}'); } catch (e) {}
    var isAdmin = user.role === 'ADMIN';
    var apiBase = 'http://localhost:4000/api';

    if (isAdmin && applyButton) applyButton.style.display = 'none';

    function api(path, options) {
      options = options || {};
      options.headers = Object.assign({}, options.headers || {}, {
        Authorization: 'Bearer ' + authToken
      });
      return fetch(apiBase + path, options);
    }

    function formatDate(value) {
      return new Date(value).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    }

    function leaveDays(leave) {
      var start = new Date(leave.startDate);
      var end = new Date(leave.endDate);
      return Math.max(1, Math.round((end - start) / 86400000) + 1);
    }

    function clearHistory() {
      while (history.firstChild) history.removeChild(history.firstChild);
    }

    function actionButton(label, className, onClick) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    }

    async function reviewLeave(leave, status) {
      var note = window.prompt(
        status === 'APPROVED' ? 'Optional approval note:' : 'Reason for rejection:',
        ''
      );
      if (note === null) return;

      try {
        var response = await api('/leaves/' + leave.id + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: status, reviewerNote: note })
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to review this request.');
        loadLeaves();
      } catch (error) {
        window.alert(error.message || 'Unable to review this request.');
      }
    }

    function renderLeaves(leaves) {
      clearHistory();

      if (!leaves.length) {
        var empty = document.createElement('p');
        empty.className = 'leave-empty';
        empty.textContent = isAdmin ? 'No leave requests have been submitted yet.' : 'You have not submitted any leave requests yet.';
        history.appendChild(empty);
      }

      leaves.forEach(function (leave) {
        var row = document.createElement('article');
        row.className = 'leave-row ' + (
          leave.status === 'APPROVED' ? 'teal' : leave.status === 'REJECTED' ? 'red' : 'purp'
        );

        var icon = document.createElement('span');
        icon.className = 'leave-type-icon';
        icon.textContent = leave.status === 'APPROVED' ? '✓' : leave.status === 'REJECTED' ? '!' : '…';

        var main = document.createElement('div');
        main.className = 'leave-main';
        var summary = document.createElement('div');
        var type = document.createElement('div');
        type.className = 'leave-name';
        type.textContent = isAdmin && leave.teacher ? leave.teacher.name + ' · ' + leave.leaveType : leave.leaveType;
        var duration = document.createElement('div');
        duration.className = 'leave-days';
        duration.textContent = leaveDays(leave) + ' day' + (leaveDays(leave) === 1 ? '' : 's');
        summary.appendChild(type);
        summary.appendChild(duration);

        var details = document.createElement('div');
        var dates = document.createElement('div');
        dates.className = 'leave-date';
        dates.textContent = formatDate(leave.startDate) + ' – ' + formatDate(leave.endDate);
        var reason = document.createElement('div');
        reason.className = 'leave-reason';
        reason.textContent = leave.reason;
        details.appendChild(dates);
        details.appendChild(reason);
        main.appendChild(summary);
        main.appendChild(details);

        var status = document.createElement('span');
        status.className = 'leave-status ' + leave.status.toLowerCase();
        status.textContent = leave.status.charAt(0) + leave.status.slice(1).toLowerCase();

        row.appendChild(icon);
        row.appendChild(main);
        row.appendChild(status);

        if (isAdmin && leave.status === 'PENDING') {
          var actions = document.createElement('div');
          actions.className = 'leave-actions-inline';
          actions.appendChild(actionButton('Approve', 'approve', function () { reviewLeave(leave, 'APPROVED'); }));
          actions.appendChild(actionButton('Reject', 'reject', function () { reviewLeave(leave, 'REJECTED'); }));
          row.appendChild(actions);
        }

        history.appendChild(row);
      });

      if (count) count.textContent = 'Showing ' + leaves.length + ' leave request' + (leaves.length === 1 ? '' : 's');

      if (!isAdmin) {
        var approvedDays = leaves.filter(function (leave) { return leave.status === 'APPROVED'; })
          .reduce(function (total, leave) { return total + leaveDays(leave); }, 0);
        if (daysTaken) daysTaken.textContent = approvedDays;
        if (balance) balance.textContent = Math.max(0, 25 - approvedDays);
      }
    }

    async function loadLeaves() {
      try {
        var response = await api(isAdmin ? '/leaves' : '/leaves/my');
        var data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load leave requests.');
        renderLeaves(data.leaves || []);
      } catch (error) {
        clearHistory();
        var failure = document.createElement('p');
        failure.className = 'leave-empty';
        failure.textContent = error.message || 'Unable to load leave requests.';
        history.appendChild(failure);
        if (count) count.textContent = 'Unable to load requests';
      }
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (isAdmin) return;

      var submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;

      try {
        var response = await api('/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaveType: document.getElementById('leaveType').value,
            startDate: document.getElementById('leaveFrom').value,
            endDate: document.getElementById('leaveTo').value,
            reason: document.getElementById('leaveReason').value
          })
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to submit leave request.');
        form.reset();
        if (modal) modal.classList.remove('open');
        loadLeaves();
      } catch (error) {
        window.alert(error.message || 'Unable to submit leave request.');
      } finally {
        if (submit) submit.disabled = false;
      }
    });

    document.addEventListener('teachtrack:leave-updated', loadLeaves);
    loadLeaves();
  })();

    /* ---------- live notification bell ---------- */
  (function () {
    var notificationButton = document.getElementById('notificationButton');
    var notificationPopup = document.getElementById('notificationPopup');
    var notificationCount = notificationPopup
      ? notificationPopup.querySelector('.notification-count')
      : null;

    if (!notificationButton || !notificationPopup) return;

    var notifications = [];
    var apiBase = 'http://localhost:4000/api';

    function renderMessageBadge(count) {
      Array.prototype.slice.call(document.querySelectorAll('.nbadge')).forEach(function (badge) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = count ? '' : 'none';
      });
    }

    async function loadUnreadMessageCount() {
      try {
        var response = await fetch(apiBase + '/messages/unread-count', {
          headers: { Authorization: 'Bearer ' + authToken },
        });
        if (!response.ok) return;
        var data = await response.json();
        renderMessageBadge(data.count || 0);
      } catch {
        /* The message service may be temporarily unavailable. */
      }
    }

    function iconFor(type) {
      var icon = document.createElement('span');
      icon.className = 'notification-icon';
      icon.setAttribute('aria-hidden', 'true');

      if (type === 'LEAVE_APPROVED') {
        icon.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>';
      } else if (type === 'LEAVE_REJECTED') {
        icon.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      } else {
        icon.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></svg>';
      }

      return icon;
    }

    function renderNotifications() {
      Array.prototype.slice.call(
        notificationPopup.querySelectorAll('.notification-item'),
      ).forEach(function (item) {
        item.remove();
      });

      if (!notifications.length) {
        var empty = document.createElement('p');
        empty.className = 'notification-item';
        empty.textContent = 'No notifications yet.';
        notificationPopup.appendChild(empty);
      } else {
        notifications.forEach(function (notification) {
          var item = document.createElement('article');
          item.className = 'notification-item' + (
            notification.type === 'LEAVE_APPROVED' ? ' approval' : ''
          );

          var copy = document.createElement('div');
          copy.className = 'notification-copy';

          var title = document.createElement('b');
          title.textContent = notification.title;

          var message = document.createElement('p');
          message.textContent = notification.message;

          var time = document.createElement('time');
          time.textContent = notification.createdAt
            ? new Date(notification.createdAt).toLocaleString()
            : 'Just now';

          copy.appendChild(title);
          copy.appendChild(message);
          copy.appendChild(time);

          item.appendChild(iconFor(notification.type));
          item.appendChild(copy);
          notificationPopup.appendChild(item);
        });
      }

      var unread = notifications.filter(function (item) {
        return !item.isRead;
      }).length;

      if (notificationCount) {
        notificationCount.textContent = unread ? unread + ' new' : 'All caught up';
      }

      var dot = notificationButton.querySelector('.dot');
      if (dot) {
        dot.style.display = unread ? '' : 'none';
      }
    }

    async function loadNotifications() {
      try {
        var response = await fetch(apiBase + '/notifications', {
          headers: {
            Authorization: 'Bearer ' + authToken,
          },
        });

        if (!response.ok) return;

        var data = await response.json();
        notifications = data.notifications || [];
        renderNotifications();
      } catch {
        /* Backend may be temporarily unavailable. */
      }
    }

    async function markNotificationsRead() {
      var unread = notifications.some(function (item) {
        return !item.isRead;
      });

      if (!unread) return;

      notifications.forEach(function (item) {
        item.isRead = true;
      });
      renderNotifications();

      try {
        await fetch(apiBase + '/notifications/read-all', {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + authToken,
          },
        });
      } catch {
        /* A later refresh will reload the server state. */
      }
    }

    function connectSocket() {
      if (!window.io) {
        var script = document.createElement('script');
        script.src = 'http://localhost:4000/socket.io/socket.io.js';
        script.onload = connectSocket;
        document.head.appendChild(script);
        return;
      }

      var socket = window.io('http://localhost:4000', {
        auth: { token: authToken },
      });

      socket.on('notification:new', function (notification) {
        notifications.unshift({
          isRead: false,
          createdAt: new Date().toISOString(),
          ...notification,
        });
        renderNotifications();
        document.dispatchEvent(new CustomEvent('teachtrack:dashboard-refresh'));
      });

      socket.on('leave:updated', function (payload) {
        document.dispatchEvent(new CustomEvent('teachtrack:leave-updated', {
          detail: payload
        }));
        document.dispatchEvent(new CustomEvent('teachtrack:dashboard-refresh'));
      });

      socket.on('message:new', function () {
        loadUnreadMessageCount();
        document.dispatchEvent(new CustomEvent('teachtrack:dashboard-refresh'));
      });

      socket.on('message:read', function () {
        loadUnreadMessageCount();
        document.dispatchEvent(new CustomEvent('teachtrack:dashboard-refresh'));
      });

      socket.on('duty:updated', function () {
        document.dispatchEvent(new CustomEvent('teachtrack:duty-updated'));
        document.dispatchEvent(new CustomEvent('teachtrack:dashboard-refresh'));
      });

      socket.on('duty:deleted', function () {
        document.dispatchEvent(new CustomEvent('teachtrack:duty-deleted'));
        document.dispatchEvent(new CustomEvent('teachtrack:dashboard-refresh'));
      });

      socket.on('dashboard:updated', function () {
        document.dispatchEvent(new CustomEvent('teachtrack:dashboard-refresh'));
      });
    }

    notificationButton.addEventListener('click', function () {
      window.setTimeout(function () {
        if (notificationPopup.classList.contains('open')) {
          markNotificationsRead();
        }
      }, 0);
    });

    loadNotifications();
    loadUnreadMessageCount();
    window.setInterval(loadUnreadMessageCount, 15000);
    window.addEventListener('message', function (event) {
      if (event.origin === window.location.origin && event.data && event.data.type === 'teachtrack:messages-read') {
        loadUnreadMessageCount();
      }
    });
    connectSocket();
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
