
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

  window.addEventListener('message', function (event) {
    var assistantFrame = document.querySelector('#assistantPage iframe');
    if (!assistantFrame || event.source !== assistantFrame.contentWindow || !event.data || event.data.type !== 'teachtrack:assistant-back') return;
    var returnPage = sessionStorage.getItem('teachtrack_assistant_return') || 'dashboard';
    sessionStorage.removeItem('teachtrack_assistant_return');
    window.location.hash = returnPage;
  });

  /* ---------- theme toggle (light/dark) ---------- */
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById('themeToggle');
    var assistantFrame = document.querySelector('iframe[src="ai_assistant.html"]');
    var messagesFrame = document.querySelector('iframe[src="message.html"]');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var savedTheme = localStorage.getItem('teachtrack_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      root.setAttribute('data-theme', savedTheme);
    } else if (prefersDark) {
      root.setAttribute('data-theme', 'dark');
    }
    function syncFrameTheme(frame) {
      if (frame && frame.contentDocument) {
        frame.contentDocument.documentElement.setAttribute('data-theme', root.getAttribute('data-theme') || 'light');
      }
    }
    function syncFramesTheme() {
      syncFrameTheme(assistantFrame);
      syncFrameTheme(messagesFrame);
    }
    if (assistantFrame) assistantFrame.addEventListener('load', syncFramesTheme);
    if (messagesFrame) messagesFrame.addEventListener('load', syncFramesTheme);
    syncFramesTheme();
    if (btn) {
      btn.addEventListener('click', function () {
        var isDark = root.getAttribute('data-theme') === 'dark';
        var nextTheme = isDark ? 'light' : 'dark';
        root.setAttribute('data-theme', nextTheme);
        localStorage.setItem('teachtrack_theme', nextTheme);
        syncFramesTheme();
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

    document.addEventListener('click', function (event) {
      var employeeButton = event.target.closest('.employee-name-button');
      if (!employeeButton) return;
      event.preventDefault();
      event.stopPropagation();
      openEmployeeDetails({ name: employeeButton.dataset.employeeName, email: employeeButton.dataset.employeeEmail });
    });

    navLinks.forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        var page = link.getAttribute('data-page');
        if (page === 'assistant') {
          sessionStorage.setItem('teachtrack_assistant_return', window.location.hash.slice(1) || 'dashboard');
        }
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

    function openEmployeeDetails(employee) {
      if (!employee) return;
      var modal = document.getElementById('employeeDetailsModal');
      if (!modal) {
        modal = document.createElement('section');
        modal.id = 'employeeDetailsModal';
        modal.className = 'employee-details-modal';
        modal.hidden = true;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'employeeDetailsTitle');
        modal.innerHTML = '<div class="employee-details-card"><div class="employee-details-head"><div><span class="kick">Staff directory</span><h2 id="employeeDetailsTitle">Employee details</h2></div><button type="button" class="employee-details-close" aria-label="Close employee details">&times;</button></div><div class="employee-details-body"><div class="employee-details-avatar" aria-hidden="true"></div><div><p class="employee-details-label">Name</p><p class="employee-details-name"></p><p class="employee-details-label">Email</p><a class="employee-details-email"></a></div></div></div>';
        document.body.appendChild(modal);
      }
      if (!modal.dataset.bound) {
        modal.querySelector('.employee-details-close').addEventListener('click', function () { modal.hidden = true; });
        modal.addEventListener('click', function (event) { if (event.target === modal) modal.hidden = true; });
        modal.dataset.bound = 'true';
      }
      var name = String(employee.name || 'Employee');
      var email = String(employee.email || 'Email unavailable');
      modal.querySelector('.employee-details-avatar').textContent = name.charAt(0).toUpperCase();
      modal.querySelector('.employee-details-name').textContent = name;
      var emailLink = modal.querySelector('.employee-details-email');
      emailLink.textContent = email;
      emailLink.href = employee.email ? 'mailto:' + employee.email : '#';
      modal.hidden = false;
      modal.querySelector('.employee-details-close').focus();
    }
    window.openEmployeeDetails = openEmployeeDetails;

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        var employeeModal = document.getElementById('employeeDetailsModal');
        if (employeeModal) employeeModal.hidden = true;
      }
    });

    /* Dashboard: render the authenticated user's live aggregate data. */
    (function () {
      var dashboard = document.getElementById('dashboardPage');
      if (!dashboard) return;
      var api = window.TEACHTRACK_API_ORIGIN + '/api/dashboard';
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
          var lessons = document.getElementById('dashboardLessonCount'); if (lessons) lessons.innerHTML = (Number(stats.weeklyHours) || 0) + '<small>hours</small>';
          var lessonFoot = document.getElementById('dashboardLessonFoot'); if (lessonFoot) lessonFoot.textContent = (stats.scheduledLessons || 0) + ' lessons · ' + (stats.upcomingThisWeek || 0) + ' scheduled items this week';
          var allowance = stats.monthlyLeaveAllowance || 6;
          var leave = document.getElementById('dashboardLeaveBalance'); if (leave) leave.innerHTML = stats.leaveBalance + '<small>days/month</small>';
          var leaveUsed = Math.max(0, Number(stats.leaveDaysTaken) || 0);
          var leaveFoot = document.getElementById('dashboardLeaveFoot'); if (leaveFoot) leaveFoot.textContent = leaveUsed > allowance ? allowance + ' of ' + allowance + ' days used · ' + (leaveUsed - allowance) + ' over allowance' : leaveUsed + ' of ' + allowance + ' days taken this month';
          var next = data.upcoming && data.upcoming[0];
          var nextItem = document.getElementById('dashboardNextItem'); if (nextItem) nextItem.textContent = next ? next.title : 'None';
          var nextFoot = document.getElementById('dashboardNextItemFoot'); if (nextFoot) nextFoot.textContent = next ? when(next.date) + ' · ' + next.kind : 'No upcoming events';
          var notice = document.getElementById('dashboardNotice'); if (notice) notice.innerHTML = '<b>' + pending + ' duties need attention</b> · ' + (stats.upcomingThisWeek || 0) + ' scheduled items this week.';
          var count = document.getElementById('dashboardUpcomingCount'); if (count) count.textContent = (data.upcoming || []).length + ' items';
          var list = document.getElementById('dashboardUpcomingList');
          if (list) { list.innerHTML = ''; (data.upcoming || []).forEach(function (item) { var urgentDuty = item.kind === 'duty' && item.isUrgent; var li = document.createElement('li'); li.className = 'uitem ' + (urgentDuty ? 'high' : 'norm'); var wrapper = document.createElement('div'); var title = document.createElement('b'); title.textContent = item.title; var date = document.createElement('span'); date.className = 'uwhen'; date.textContent = when(item.date); wrapper.appendChild(title); wrapper.appendChild(date); var tag = document.createElement('span'); tag.className = 'tag ' + (urgentDuty ? 'high' : 'norm'); tag.textContent = urgentDuty ? 'Urgent duty' : item.kind === 'duty' ? 'Duty' : 'Calendar'; li.appendChild(wrapper); li.appendChild(tag); list.appendChild(li); }); }
          var messages = document.getElementById('dashboardMessagesList');
          if (messages) { messages.innerHTML = ''; (data.messages || []).slice(0, 3).forEach(function (message, index) { var other = message.senderId === data.user.id ? message.receiver : message.sender; var link = document.createElement('a'); link.className = 'msg'; link.href = 'messages.html'; var avatar = document.createElement('span'); avatar.className = 'avatar a' + (index + 1); avatar.textContent = (other.name || '?').charAt(0).toUpperCase(); var body = document.createElement('span'); body.className = 'msg-body'; var name = document.createElement('b'); name.textContent = other.name; var preview = document.createElement('span'); preview.className = 'msg-prev'; preview.textContent = message.content; body.appendChild(name); body.appendChild(preview); var meta = document.createElement('span'); meta.className = 'msg-meta'; var time = document.createElement('time'); time.textContent = when(message.createdAt); meta.appendChild(time); link.appendChild(avatar); link.appendChild(body); link.appendChild(meta); messages.appendChild(link); }); }
          var barsContainer = document.querySelector('.bars');
          if (barsContainer) {
            barsContainer.textContent = '';
            (data.weeks || []).forEach(function (week, index) {
              var bar = document.createElement('button');
              bar.type = 'button';
              bar.className = 'tcol' + (week.isCurrent ? ' cur' : '');
              bar.style.setProperty('--h', '0%');
              bar.setAttribute('aria-label', week.week + ': ' + week.hours + ' hours');
              var fill = document.createElement('span'); fill.className = 'tfill'; fill.style.setProperty('--d', (index * 90) + 'ms');
              var tip = document.createElement('span'); tip.className = 'tip'; tip.textContent = week.week + ' · ' + week.hours + ' hrs';
              var label = document.createElement('span'); label.className = 'tx'; label.textContent = week.week + (week.isCurrent ? ' · now' : '');
              bar.appendChild(fill); bar.appendChild(tip); bar.appendChild(label); barsContainer.appendChild(bar);
            });
          }
          var period = document.getElementById('weeklyTrendPeriod'); if (period) period.textContent = data.trendPeriod || 'Current calendar month';
          var bars = document.querySelectorAll('.tcol');
          var highestHours = Math.max.apply(null, (data.weeks || []).map(function (w) { return w.hours; }).concat([0]));
          var maxHours = Math.max(10, Math.ceil(highestHours / 10) * 10);
          var avgHours = (data.weeks || []).reduce(function (sum, w) { return sum + w.hours; }, 0) / (data.weeks || []).length || 0;
          bars.forEach(function (bar, index) { var week = (data.weeks || [])[index]; if (week) { var height = (week.hours / maxHours * 100); bar.style.setProperty('--h', height + '%'); bar.setAttribute('aria-label', week.week + ': ' + week.hours + ' hours'); bar.querySelector('.tip').textContent = week.week + ' · ' + week.hours + ' hrs'; } });
          var avgElem = document.querySelector('.avg'); if (avgElem && avgHours > 0) avgElem.style.setProperty('--p', (avgHours / maxHours * 100) + '%'); if (avgElem) avgElem.querySelector('em').textContent = 'avg ' + Math.round(avgHours) + 'h';
          var yAxis = document.querySelector('.yaxis');
          if (yAxis) {
            Array.prototype.forEach.call(yAxis.querySelectorAll('span'), function (label, index) {
              label.textContent = String(Math.round(maxHours - index * maxHours / 4));
            });
          }
          var breakdownRows = document.querySelectorAll('.drow');
          var breakdownData = data.breakdown || [];
          breakdownRows.forEach(function (row, index) { if (index < breakdownData.length) { row.style.display = ''; var item = breakdownData[index]; var dhead = row.querySelector('.dhead'); if (dhead) { var b = dhead.querySelector('b'); if (b) b.textContent = item.percentage + '%'; var label = dhead.textContent.split(/\d+%/)[0].trim(); dhead.textContent = ''; var dsw = document.createElement('span'); dsw.className = 'dsw c' + (index + 1); dhead.appendChild(dsw); dhead.appendChild(document.createTextNode(item.type + ' ')); var bb = document.createElement('b'); bb.textContent = item.percentage + '%'; dhead.appendChild(bb); } var dfill = row.querySelector('.dfill'); if (dfill) { dfill.style.setProperty('--w', item.percentage + '%'); dfill.style.setProperty('--d', (index * 120 + 100) + 'ms'); } } else { row.style.display = 'none'; } });
          var refreshed = document.getElementById('dashboardRefreshText'); if (refreshed) refreshed.textContent = 'TeachTrack · dashboard updated ' + new Date().toLocaleTimeString();
        }).catch(function () {
          var notice = document.getElementById('dashboardNotice');
          if (notice) notice.textContent = 'Dashboard data is unavailable while the server is offline.';
          var upcomingList = document.getElementById('dashboardUpcomingList');
          if (upcomingList) upcomingList.innerHTML = '<li class="empty-state">No dashboard items available.</li>';
          var messages = document.getElementById('dashboardMessagesList');
          if (messages) messages.innerHTML = '<p class="empty-state">No messages available.</p>';
        });
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
      var summaryDuties = [];
      var dutyPage = 1;
      var dutyPageSize = 4;
      var dutyApi = window.TEACHTRACK_API_ORIGIN + '/api/duties';
      var isAdmin = false;
      try { isAdmin = String(JSON.parse(sessionStorage.getItem('teachtrack_user') || '{}').role || '').toUpperCase() === 'ADMIN'; } catch (_) {}

      function confirmDutyRemoval(message) {
        var modal = document.getElementById('dutyConfirmModal');
        var messageEl = document.getElementById('dutyConfirmMessage');
        var yes = modal && modal.querySelector('.duty-confirm-yes');
        var no = modal && modal.querySelector('.duty-confirm-no');
        if (!modal || !yes || !no) return Promise.resolve(false);
        messageEl.textContent = message;
        modal.hidden = false;
        document.body.classList.add('tt-modal-open');
        yes.focus();
        return new Promise(function (resolve) {
          function finish(result) {
            modal.hidden = true;
            document.body.classList.remove('tt-modal-open');
            yes.removeEventListener('click', accept);
            no.removeEventListener('click', decline);
            modal.removeEventListener('click', outside);
            document.removeEventListener('keydown', escape);
            resolve(result);
          }
          function accept() { finish(true); }
          function decline() { finish(false); }
          function outside(event) { if (event.target === modal) finish(false); }
          function escape(event) { if (event.key === 'Escape') finish(false); }
          yes.addEventListener('click', accept);
          no.addEventListener('click', decline);
          modal.addEventListener('click', outside);
          document.addEventListener('keydown', escape);
        });
      }

      if (addDuty && !isAdmin) addDuty.style.display = 'none';
      var primaryLabel = document.getElementById('dutyPrimaryLabel');
      var secondaryLabel = document.getElementById('dutySecondaryLabel');
      if (isAdmin) {
        if (primaryLabel) primaryLabel.textContent = 'Due This Week';
        if (secondaryLabel) secondaryLabel.textContent = 'Active Assignments';
      }
      function labelStatus(status) { return status === 'IN_PROGRESS' ? 'In progress' : status.charAt(0) + status.slice(1).toLowerCase(); }
      function labelDutyType(type) { return String(type || 'LECTURES').charAt(0) + String(type || 'LECTURES').slice(1).toLowerCase(); }
      function renderDuties() {
        if (!body) return;
        var filter = statusFilter ? statusFilter.value : 'all';
        var visible = duties.filter(function (duty) { return filter === 'all' || duty.status.toLowerCase() === filter; });
        var pageCount = Math.max(1, Math.ceil(visible.length / dutyPageSize));
        dutyPage = Math.min(dutyPage, pageCount);
        var pageStart = (dutyPage - 1) * dutyPageSize;
        var pageItems = visible.slice(pageStart, pageStart + dutyPageSize);
        body.innerHTML = '';
        pageItems.forEach(function (duty) {
          var row = document.createElement('tr'); row.className = 'duty-row'; row.dataset.status = duty.status.toLowerCase();
          var type = document.createElement('td'); type.textContent = labelDutyType(duty.dutyType);
          var title = document.createElement('td'); title.textContent = duty.title;
          var teacher = document.createElement('td');
          if (duty.assignedTo) {
            var teacherButton = document.createElement('button');
            teacherButton.type = 'button';
            teacherButton.className = 'employee-name-button';
            teacherButton.textContent = duty.assignedTo.name;
            teacherButton.dataset.employeeName = duty.assignedTo.name || '';
            teacherButton.dataset.employeeEmail = duty.assignedTo.email || '';
            teacherButton.addEventListener('click', function () { openEmployeeDetails(duty.assignedTo); });
            teacher.appendChild(teacherButton);
          } else {
            teacher.textContent = '—';
          }
          var date = document.createElement('td'); date.textContent = duty.dueAt ? new Date(duty.dueAt).toLocaleDateString() : 'No due date';
          var statusCell = document.createElement('td');
          var status = document.createElement('select'); status.className = 'duty-status-select ' + duty.status.toLowerCase();
          ['PENDING', 'IN_PROGRESS', 'COMPLETED'].forEach(function (value) { var option = new Option(labelStatus(value), value); option.selected = value === duty.status; status.appendChild(option); });
          status.disabled = isAdmin;
          status.addEventListener('change', async function () {
            status.className = 'duty-status-select ' + status.value.toLowerCase();
            var response = await fetch(dutyApi + '/' + duty.id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken }, body: JSON.stringify({ status: status.value }) });
            if (response.ok) { duty.status = status.value; summaryDuties.forEach(function (item) { if (item.id === duty.id) item.status = status.value; }); renderDuties(); renderDutyStats(); }
          });
          statusCell.appendChild(status);
          row.appendChild(type); row.appendChild(title); row.appendChild(teacher); row.appendChild(date); row.appendChild(statusCell);
          if (isAdmin) {
            var actionCell = document.createElement('td');
            var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'duty-remove'; remove.textContent = 'Remove';
            remove.addEventListener('click', async function () {
              if (!await confirmDutyRemoval('This will remove the assigned duty.')) return;
              var response = await fetch(dutyApi + '/' + duty.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + authToken } });
              if (response.ok) { duties = duties.filter(function (item) { return item.id !== duty.id; }); renderDuties(); renderDutyStats(); }
            });
            actionCell.appendChild(remove); row.appendChild(actionCell);
          } else {
            var historyCell = document.createElement('td');
            var hideHistory = document.createElement('button'); hideHistory.type = 'button'; hideHistory.className = 'duty-remove'; hideHistory.textContent = 'Remove';
            hideHistory.addEventListener('click', async function () {
              if (!await confirmDutyRemoval('Remove this duty from your history? Its status and totals will not change.')) return;
              var response = await fetch(dutyApi + '/' + duty.id + '/history', { method: 'DELETE', headers: { Authorization: 'Bearer ' + authToken } });
              if (response.ok) { duties = duties.filter(function (item) { return item.id !== duty.id; }); renderDuties(); }
            });
            historyCell.appendChild(hideHistory); row.appendChild(historyCell);
          }
          body.appendChild(row);
        });
        if (count) {
          count.textContent = visible.length
            ? 'Showing ' + (pageStart + 1) + ' to ' + Math.min(pageStart + dutyPageSize, visible.length) + ' of ' + visible.length + ' entries'
            : 'No duties match this filter';
        }
        var pageNav = document.querySelector('.duty-pages');
        if (pageNav) {
          var previousButton = pageNav.querySelector('[aria-label="Previous page"]');
          var nextButton = pageNav.querySelector('[aria-label="Next page"]');
          pageNav.querySelectorAll('[data-page]').forEach(function (button) { button.remove(); });
          for (var page = 1; page <= pageCount; page++) {
            var pageButton = document.createElement('button');
            pageButton.className = 'duty-page-btn' + (page === dutyPage ? ' active' : '');
            pageButton.type = 'button';
            pageButton.dataset.page = String(page);
            pageButton.textContent = String(page);
            pageButton.addEventListener('click', (function (selectedPage) {
              return function () { dutyPage = selectedPage; renderDuties(); };
            })(page));
            pageNav.insertBefore(pageButton, nextButton);
          }
          if (previousButton) {
            previousButton.disabled = dutyPage === 1;
            previousButton.onclick = function () { if (dutyPage > 1) { dutyPage--; renderDuties(); } };
          }
          if (nextButton) {
            nextButton.disabled = dutyPage === pageCount;
            nextButton.onclick = function () { if (dutyPage < pageCount) { dutyPage++; renderDuties(); } };
          }
        }
      }
      function renderDutyStats() {
        var now = new Date();
        var weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + 7);
        var dutyStats = summaryDuties.length ? summaryDuties : duties;
        var upcoming = dutyStats.filter(function (duty) { return duty.status !== 'COMPLETED' && duty.dueAt && new Date(duty.dueAt) >= now; }).length;
        var dueThisWeek = dutyStats.filter(function (duty) { return duty.status !== 'COMPLETED' && duty.dueAt && new Date(duty.dueAt) >= now && new Date(duty.dueAt) < weekEnd; }).length;
        var active = dutyStats.filter(function (duty) { return duty.status !== 'COMPLETED'; }).length;
        var completed = dutyStats.filter(function (duty) { return duty.status === 'COMPLETED'; }).length;
        var primaryEl = document.getElementById('dutyUpcomingCount');
        var secondaryEl = document.getElementById('dutyTotalCount');
        if (primaryEl) primaryEl.innerHTML = (isAdmin ? dueThisWeek : upcoming) + ' <small>' + (isAdmin ? 'due this week' : 'upcoming') + '</small>';
        if (secondaryEl) secondaryEl.innerHTML = (isAdmin ? active : completed) + ' <small>' + (isAdmin ? 'active' : 'completed') + '</small>';
      }
      async function loadDuties() {
        var cacheKey = 'teachtrack_duties_cache';
        try {
          var cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
          if (cached && Array.isArray(cached.duties)) {
            duties = cached.duties;
            summaryDuties = Array.isArray(cached.summaryDuties) ? cached.summaryDuties : duties;
            renderDuties();
            renderDutyStats();
          }
        } catch (_) {}
        try {
          var response = await fetch(dutyApi, { headers: { Authorization: 'Bearer ' + authToken } });
          if (!response.ok) throw new Error('The duties service returned ' + response.status + '.');
          var data = await response.json();
          duties = data.duties || [];
          summaryDuties = data.summaryDuties || duties;
          sessionStorage.setItem(cacheKey, JSON.stringify({ duties: duties, summaryDuties: summaryDuties }));
          renderDuties();
          renderDutyStats();
        } catch (error) {
          if (!duties.length) {
            body.innerHTML = '<tr><td colspan="6" class="empty-state">Unable to load duties. Please try again.</td></tr>';
          }
          console.error('Unable to load duties:', error);
        }
      }

      function applyDutyFilter() {
        dutyPage = 1;
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
          var modal = document.getElementById('dutyModal');
          var dueDate = document.getElementById('dutyDueDate');
          var today = new Date();
          var todayValue = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
          if (dueDate) dueDate.min = todayValue;
          if (modal) { modal.hidden = false; document.body.classList.add('tt-modal-open'); }
        });
      }
      var dutyModal = document.getElementById('dutyModal');
      var dutyForm = document.getElementById('dutyForm');
      async function loadTeachers() { var response = await fetch(dutyApi + '/teachers', { headers: { Authorization: 'Bearer ' + authToken } }); if (!response.ok) return; var select = document.getElementById('dutyTeacher'); select.innerHTML = ''; (await response.json()).teachers.forEach(function (teacher) { select.appendChild(new Option(teacher.name + ' (' + teacher.email + ')', teacher.id)); }); enhanceTimetableSelect(select); }
      enhanceTimetableSelect(document.getElementById('dutyType'));
      function closeDutyModal() { if (dutyModal) dutyModal.hidden = true; document.body.classList.remove('tt-modal-open'); }
      if (dutyModal) { document.getElementById('dutyModalClose').addEventListener('click', closeDutyModal); document.getElementById('dutyModalCancel').addEventListener('click', closeDutyModal); dutyModal.addEventListener('click', function (event) { if (event.target === dutyModal) closeDutyModal(); }); }
      if (dutyForm) dutyForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var date = document.getElementById('dutyDueDate').value, time = document.getElementById('dutyDueTime').value;
        var dutyTypeInput = document.getElementById('dutyType');
        var payload = { assignedToId: document.getElementById('dutyTeacher').value, title: document.getElementById('dutyTitle').value, dutyType: dutyTypeInput ? dutyTypeInput.value : 'LECTURES', description: document.getElementById('dutyDescription').value };
        var today = new Date(); today.setHours(0, 0, 0, 0);
        if (date && new Date(date + 'T00:00') < today) { document.getElementById('dutyFormError').textContent = 'Due date cannot be earlier than today.'; return; }
        if (date) payload.dueAt = new Date(date + 'T' + (time || '09:00')).toISOString();
        var response = await fetch(dutyApi, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken }, body: JSON.stringify(payload) });
        if (!response.ok) { var errorData = await response.json().catch(function () { return {}; }); document.getElementById('dutyFormError').textContent = errorData.message || 'Could not assign this duty.'; return; }
        duties.unshift((await response.json()).duty); closeDutyModal(); dutyForm.reset(); renderDuties(); renderDutyStats();
      });
      if (isAdmin) loadTeachers();
      document.addEventListener('teachtrack:duty-updated', loadDuties);
      document.addEventListener('teachtrack:duty-deleted', loadDuties);
      loadDuties();
    })();

    /* Timetable: each teacher configures a day, then lectures use generated slots. */
    var search = document.getElementById('ttSearch');
    var dayFilter = document.getElementById('ttDayFilter');
    var classFilter = document.getElementById('ttClassFilter');
    var timetableGrid = document.querySelector('.tt-grid');
    var timetableSlots = [];
    var timetableSlotMeta = [];
    var timetableModal = document.getElementById('ttModal');
    var timetableForm = document.getElementById('ttForm');
    var plannerForm = document.getElementById('ttPlannerForm');
    var timetableEditingIndex = null;
    var timetableDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    var timetableDayNames = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    var timetableSettings = {};
    var timetableLectures = [];
    var timetableEntries = [];
    var defaultTimetableSetting = { startTime: '09:00', endTime: '12:00', lectureCount: 3, duration: 60 };

    function minutesFromTime(value) { var parts = value.split(':'); return Number(parts[0]) * 60 + Number(parts[1]); }
    function timeFromMinutes(value) { return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0'); }
    function settingFor(day) {
      return timetableSettings[day] || timetableSettings.mon || defaultTimetableSetting;
    }
    function timesFor(day) {
      var setting = settingFor(day);
      if (!setting) return [];
      var start = minutesFromTime(setting.startTime), end = minutesFromTime(setting.endTime);
      var duration = Number(setting.duration), count = Number(setting.lectureCount), result = [];
      for (var i = 0; i < count; i++) {
        if (start + ((i + 1) * duration) > end) break;
        result.push(timeFromMinutes(start + (i * duration)));
      }
      return result;
    }
    function slotInfo(index) { return timetableSlotMeta[index] || { day: 'mon', time: '09:00' }; }
    function indexFor(day, time) {
      return timetableSlotMeta.findIndex(function (slot) { return slot.day === day && slot.time === time; });
    }
    function rebuildTimetableGrid() {
      if (!timetableGrid) return;
      var times = [];
      timetableDays.forEach(function (day) { timesFor(day).forEach(function (time) { if (times.indexOf(time) === -1) times.push(time); }); });
      times.sort();
      timetableGrid.innerHTML = '';
      timetableSlots = [];
      timetableSlotMeta = [];
      var corner = document.createElement('div'); corner.className = 'tt-corner'; timetableGrid.appendChild(corner);
      timetableDays.forEach(function (day) { var header = document.createElement('div'); header.className = 'tt-day' + (day === 'sat' || day === 'sun' ? ' muted' : ''); header.dataset.day = day; header.textContent = timetableDayNames[day].slice(0, 3); timetableGrid.appendChild(header); });
      times.forEach(function (time) {
        var timeCell = document.createElement('div'); timeCell.className = 'tt-time'; timeCell.textContent = time; timetableGrid.appendChild(timeCell);
        timetableDays.forEach(function (day) {
          var slot = document.createElement('button'); slot.type = 'button'; slot.className = 'tt-slot empty tt-reveal'; slot.dataset.day = day; slot.dataset.time = time;
          var isAvailable = timesFor(day).indexOf(time) !== -1;
          if (!isAvailable) { slot.classList.add('tt-unavailable'); slot.disabled = true; slot.innerHTML = '<span class="tt-empty-label">Outside plan</span>'; }
          else { slot.innerHTML = '<span class="tt-plus">+</span><span class="tt-empty-label">Add lecture</span>'; }
          timetableGrid.appendChild(slot); timetableSlots.push(slot); timetableSlotMeta.push({ day: day, time: time });
        });
      });
      timetableEntries = timetableSlotMeta.map(function (slot) { return timetableLectures.find(function (lecture) { return lecture.day === slot.day && lecture.time === slot.time; }) || null; });
      timetableSlots.forEach(function (slot, index) { slot.addEventListener('click', function () { openTimetableModal(index); }); });
      timetableGrid.style.gridTemplateRows = '44px repeat(' + times.length + ',106px)';
      renderTimetable();
    }

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
      select.addEventListener('change', function () {
        trigger.textContent = select.options[select.selectedIndex].textContent;
      });
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
    }

    enhanceTimetableSelect(dayFilter);
    enhanceTimetableSelect(classFilter);
    enhanceTimetableSelect(document.getElementById('ttType'));
    enhanceTimetableSelect(document.getElementById('ttDay'));
    enhanceTimetableSelect(document.getElementById('ttPlanDay'));
    enhanceTimetableSelect(document.getElementById('ttPlanDuration'));
    enhanceTimetableSelect(document.getElementById('calendarEventType'));

    function classCode(label) {
      var known = { 'FY-CS-A': 'fy', 'SY-IT-B': 'sy', 'TY-CS-A': 'ty' };
      return known[label.toUpperCase()] || label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    function timetableApi(path, options) {
      options = options || {};
      options.headers = Object.assign({ Authorization: 'Bearer ' + authToken }, options.headers || {});
      return fetch(window.TEACHTRACK_API_ORIGIN + '/api/timetable' + path, options);
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
        timetableLectures = data.lectures || [];
        (data.settings || []).forEach(function (setting) { timetableSettings[setting.day] = setting; });
        rebuildTimetableGrid();
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

    function updateTimeOptions(day, selectedTime) {
      var timeSelect = document.getElementById('ttTime'); if (!timeSelect) return;
      var timeWrapper = timeSelect.closest('.tt-select');
      if (timeSelect.dataset.enhanced && timeWrapper) {
        var oldTrigger = timeWrapper.querySelector('.tt-select-trigger');
        var oldMenu = timeWrapper.querySelector('.tt-select-menu');
        if (oldTrigger) oldTrigger.remove();
        if (oldMenu) oldMenu.remove();
        delete timeSelect.dataset.enhanced;
        timeSelect.classList.remove('tt-native-select');
      }
      timeSelect.innerHTML = '';
      timesFor(day).forEach(function (time) { timeSelect.appendChild(new Option(time, time)); });
      if (selectedTime && timesFor(day).indexOf(selectedTime) !== -1) timeSelect.value = selectedTime;
      enhanceTimetableSelect(timeSelect);
    }
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
      updateTimeOptions(info.day, info.time);
      document.getElementById('ttTime').value = info.time;
      ['ttType', 'ttDay', 'ttTime'].forEach(function (id) {
        document.getElementById(id).dispatchEvent(new Event('change'));
      });
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
    function plannerValues() { return { day: document.getElementById('ttPlanDay').value, startTime: document.getElementById('ttPlanStart').value, endTime: document.getElementById('ttPlanEnd').value, duration: Number(document.getElementById('ttPlanDuration').value), lectureCount: Number(document.getElementById('ttPlanCount').value) }; }
    function showPlannerStatus(message, isError) { var status = document.getElementById('ttPlanStatus'); if (status) { status.textContent = message; status.className = 'tt-plan-status' + (isError ? ' is-error' : ' is-success'); } }
    function loadPlannerForm(day) { var setting = settingFor(day) || defaultTimetableSetting; document.getElementById('ttPlanStart').value = setting.startTime; document.getElementById('ttPlanEnd').value = setting.endTime; document.getElementById('ttPlanDuration').value = String(setting.duration); document.getElementById('ttPlanCount').value = String(setting.lectureCount); }
    if (timetableGrid && timetableForm) {
      rebuildTimetableGrid();
      loadPlannerForm('mon');
      document.getElementById('ttPlanDay').addEventListener('change', function () { loadPlannerForm(this.value); });
      document.getElementById('ttDay').addEventListener('change', function () { updateTimeOptions(this.value); });
      plannerForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var values = plannerValues(), error = '';
        if (minutesFromTime(values.endTime) <= minutesFromTime(values.startTime)) error = 'End time must be later than start time.';
        if (!error && values.lectureCount * values.duration > minutesFromTime(values.endTime) - minutesFromTime(values.startTime)) error = 'This day is too short for that many lectures at the selected duration.';
        var oldTimes = timesFor(values.day), newTimes = [];
        for (var i = 0; i < values.lectureCount; i++) newTimes.push(timeFromMinutes(minutesFromTime(values.startTime) + (i * values.duration)));
        var hiddenLecture = timetableLectures.some(function (lecture) { return lecture.day === values.day && oldTimes.indexOf(lecture.time) !== -1 && newTimes.indexOf(lecture.time) === -1; });
        if (!error && hiddenLecture) error = 'Save blocked: an existing lecture would fall outside the new teaching window.';
        if (error) { showPlannerStatus(error, true); return; }
        try {
          var response = await timetableApi('/settings/' + values.day, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
          var data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to save this day plan.');
          timetableSettings[values.day] = data.setting; rebuildTimetableGrid(); updateTimeOptions(document.getElementById('ttDay').value); showPlannerStatus(timetableDayNames[values.day] + ' plan saved. ' + newTimes.length + ' slots are available.', false);
        } catch (error) { showPlannerStatus(error.message || 'Unable to save this day plan.', true); }
      });
      renderTimetable();
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
          timetableLectures = timetableLectures.filter(function (lecture) { return lecture.id !== entry.id; });
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
          timetableLectures = timetableLectures.filter(function (lecture) { return !existing || lecture.id !== existing.id; });
          timetableLectures.push(data.lecture);
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
        return fetch(window.TEACHTRACK_API_ORIGIN + '/api/auth' + path, options);
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
    if(applyLeaveBtn && leaveModal) applyLeaveBtn.addEventListener('click', function(){
      var today = new Date();
      var todayValue = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      var from = document.getElementById('leaveFrom');
      var to = document.getElementById('leaveTo');
      if (from) from.min = todayValue;
      if (to) to.min = todayValue;
      leaveModal.classList.add('open');
      if(from) from.focus();
    });
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

    // Calendar always opens on the device's real date and month.
    var TODAY = new Date();
    TODAY.setHours(0, 0, 0, 0);

    var CATEGORY = {
      duty:    { label: 'Duty',    cls: 'duty',    icon: 'M5 4h14v17H5zM9 2h6v4H9zM9 13l2 2 4-4' },
      meeting: { label: 'Meeting', cls: 'meeting',  icon: 'M11 20A7 7 0 0 1 4 13c0-4 3-9 16-9-1 2-1 4-2 6-1.5 3-4 4-4 4' },
      exam:    { label: 'Exam',    cls: 'exam',     icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z' },
      leave:   { label: 'Leave',   cls: 'leave',    icon: 'M8 2v4M16 2v4M3 9h18M3 4h18v17H3z' }
    };

    var events = [];
    var calendarApi = window.TEACHTRACK_API_ORIGIN + '/api/calendar';
    var editingEvent = null;

    var current = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    var selectedDate = fmt(TODAY);
    var currentView = 'month';
    var currentPage = 1;
    var PAGE_SIZE = 4;
    var calendarFilter = 'all';

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
      } catch (_) {
        events = [];
        renderAll();
      }
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
          openEventModal(null);
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

      var sorted = events.filter(function (event) {
        return calendarFilter === 'all' || event.status === calendarFilter;
      }).sort(function (a, b) { return a.date.localeCompare(b.date); });
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

    var calendarFilterBtn = document.getElementById('calendarFilterBtn');
    var calendarFilterMenu = document.getElementById('calendarFilterMenu');
    var calendarStatusFilter = document.getElementById('calendarStatusFilter');
    if (calendarFilterBtn && calendarFilterMenu) {
      calendarFilterBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        var open = calendarFilterMenu.classList.toggle('open');
        calendarFilterBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      calendarFilterMenu.addEventListener('click', function (event) { event.stopPropagation(); });
      document.addEventListener('click', function () {
        calendarFilterMenu.classList.remove('open');
        calendarFilterBtn.setAttribute('aria-expanded', 'false');
      });
    }
    if (calendarStatusFilter) calendarStatusFilter.addEventListener('change', function () {
      calendarFilter = calendarStatusFilter.value;
      currentPage = 1;
      renderTable();
    });

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
    function clampNewEventDate(dateValue) {
      var todayValue = fmt(TODAY);
      if (!dateValue) return todayValue;
      return new Date(dateValue + 'T00:00') < new Date(todayValue + 'T00:00') ? todayValue : dateValue;
    }
    function syncReminderBounds(dateValue) {
      var reminderInput = document.getElementById('calendarEventReminder');
      if (!reminderInput) return;

      var minValue = dateValue ? dateValue + 'T00:00' : '';
      reminderInput.min = minValue;

      if (!reminderInput.value || !minValue) return;
      if (reminderInput.value.slice(0, 10) < dateValue) {
        reminderInput.value = '';
      }
    }
    function openEventModal(event) {
      editingEvent = event;
      var today = new Date();
      var todayValue = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      document.getElementById('calendarEventTitle').textContent = event ? 'Edit task or reminder' : 'Add task or reminder';
      document.getElementById('calendarEventName').value = event ? event.name : '';
      document.getElementById('calendarEventType').value = event ? event.category.toUpperCase() : 'REMINDER';
      document.getElementById('calendarEventDate').value = event ? event.date : clampNewEventDate(selectedDate || fmt(TODAY));
      document.getElementById('calendarEventDate').min = todayValue;
      document.getElementById('calendarEventTime').value = event && event.startsAt ? localDateTime(event.startsAt).slice(11) : '09:00';
      document.getElementById('calendarEventReminder').value = event ? localDateTime(event.reminderAt) : '';
      syncReminderBounds(document.getElementById('calendarEventDate').value);
      document.getElementById('calendarEventDescription').value = event ? event.description : '';
      document.getElementById('calendarEventDelete').style.display = event ? '' : 'none';
      document.getElementById('calendarEventError').textContent = '';
      eventModal.hidden = false;
      document.body.classList.add('tt-modal-open');
      document.getElementById('calendarEventName').focus();
    }
    function closeEventModal() { eventModal.hidden = true; document.body.classList.remove('tt-modal-open'); }
    document.getElementById('calendarEventDate').addEventListener('change', function () {
      if (this.value && new Date(this.value + 'T00:00') < new Date(fmt(TODAY) + 'T00:00')) {
        this.value = fmt(TODAY);
      }
      syncReminderBounds(this.value);
    });
    document.getElementById('calendarEventReminder').addEventListener('input', function () {
      var dateValue = document.getElementById('calendarEventDate').value;
      if (this.value && dateValue && this.value.slice(0, 10) < dateValue) {
        this.value = '';
      }
    });
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
      if (new Date(date + 'T00:00') < new Date(new Date().toDateString())) {
        document.getElementById('calendarEventError').textContent = 'Event date cannot be earlier than today.';
        return;
      }
      var reminderValue = document.getElementById('calendarEventReminder').value;
      if (reminderValue && reminderValue.slice(0, 10) < date) {
        document.getElementById('calendarEventError').textContent = 'Reminder date cannot be earlier than the event date.';
        return;
      }
      if (payload.reminderAt && new Date(payload.reminderAt) < new Date(payload.startsAt)) {
        document.getElementById('calendarEventError').textContent = 'Reminder cannot be earlier than the event.';
        return;
      }
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
    var teacherStats = document.getElementById('teacherLeaveStats');
    var adminStats = document.getElementById('adminLeaveStats');
    if (!page || !history || !form) return;

    var user = {};
    try { user = JSON.parse(sessionStorage.getItem('teachtrack_user') || '{}'); } catch (e) {}
    var isAdmin = String(user.role || '').toUpperCase() === 'ADMIN';
    var apiBase = window.TEACHTRACK_API_ORIGIN + '/api';

    if (isAdmin) {
      if (applyButton) applyButton.style.display = 'none';
      if (teacherStats) teacherStats.hidden = true;
      if (adminStats) adminStats.hidden = false;
      var subtitle = page.querySelector('.leaves-head .sub');
      if (subtitle) subtitle.textContent = 'Review staff leave requests and monitor availability.';
      var historyTitle = document.getElementById('leaveHistoryTitle');
      if (historyTitle) historyTitle.textContent = 'Staff Leave Requests';
    }

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

    function showLeaveNotice(message) {
      var notice = document.getElementById('leaveNoticeModal');
      var text = document.getElementById('leaveNoticeMessage');
      var ok = notice && notice.querySelector('.duty-confirm-yes');
      if (!notice || !text || !ok) return Promise.resolve();
      text.textContent = message;
      notice.hidden = false;
      document.body.classList.add('tt-modal-open');
      ok.focus();
      return new Promise(function (resolve) {
        function close() {
          notice.hidden = true;
          document.body.classList.remove('tt-modal-open');
          ok.removeEventListener('click', close);
          notice.removeEventListener('click', outside);
          document.removeEventListener('keydown', escape);
          resolve();
        }
        function outside(event) { if (event.target === notice) close(); }
        function escape(event) { if (event.key === 'Escape') close(); }
        ok.addEventListener('click', close);
        notice.addEventListener('click', outside);
        document.addEventListener('keydown', escape);
      });
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

    async function removeLeave(leave) {
      var label = isAdmin && leave.teacher
        ? leave.teacher.name + "'s " + leave.leaveType + ' request'
        : 'this ' + leave.leaveType + ' request';
      var confirmModal = document.getElementById('leaveConfirmModal');
      var confirmMessage = document.getElementById('leaveConfirmMessage');
      var confirmYes = confirmModal && confirmModal.querySelector('.duty-confirm-yes');
      var confirmNo = confirmModal && confirmModal.querySelector('.duty-confirm-no');
      if (!confirmModal || !confirmMessage || !confirmYes || !confirmNo) return;
      confirmMessage.textContent = 'Remove ' + label + ' from this history? Leave totals and balances will not change.';
      confirmModal.hidden = false;
      document.body.classList.add('tt-modal-open');
      confirmYes.focus();
      var confirmed = await new Promise(function (resolve) {
        function finish(result) {
          confirmModal.hidden = true;
          document.body.classList.remove('tt-modal-open');
          confirmYes.removeEventListener('click', accept);
          confirmNo.removeEventListener('click', decline);
          confirmModal.removeEventListener('click', outside);
          document.removeEventListener('keydown', escape);
          resolve(result);
        }
        function accept() { finish(true); }
        function decline() { finish(false); }
        function outside(event) { if (event.target === confirmModal) finish(false); }
        function escape(event) { if (event.key === 'Escape') finish(false); }
        confirmYes.addEventListener('click', accept);
        confirmNo.addEventListener('click', decline);
        confirmModal.addEventListener('click', outside);
        document.addEventListener('keydown', escape);
      });
      if (!confirmed) return;

      try {
        var response = await api('/leaves/' + leave.id, { method: 'DELETE' });
        if (!response.ok) {
          var data = await response.json().catch(function () { return {}; });
          throw new Error(data.message || 'Unable to remove this leave request.');
        }
        loadLeaves();
      } catch (error) {
        window.alert(error.message || 'Unable to remove this leave request.');
      }
    }

    function renderLeaves(leaves, summary) {
      clearHistory();
      var visibleLeaves = isAdmin
        ? leaves.filter(function (leave) { return leave.status === 'PENDING'; })
        : leaves;

      if (!visibleLeaves.length) {
        var empty = document.createElement('p');
        empty.className = 'leave-empty';
        empty.textContent = isAdmin ? 'No pending leave requests.' : 'You have not submitted any leave requests yet.';
        history.appendChild(empty);
      }

      visibleLeaves.forEach(function (leave) {
        var row = document.createElement('article');
        row.className = 'leave-row ' + (
          leave.status === 'APPROVED' ? 'teal' : leave.status === 'REJECTED' ? 'red' : 'purp'
        );

        var icon = document.createElement('span');
        icon.className = 'leave-type-icon';
        icon.textContent = leave.status === 'APPROVED' ? '✓' : leave.status === 'REJECTED' ? '!' : '…';

        var main = document.createElement('div');
        main.className = 'leave-main';
        var summaryBlock = document.createElement('div');
        var type = document.createElement('div');
        type.className = 'leave-name';
        var leaveEmployee = leave.teacher || leave.assignedTo || leave.employee;
        if (leaveEmployee) {
          var employeeButton = document.createElement('button');
          employeeButton.type = 'button';
          employeeButton.className = 'employee-name-button';
          employeeButton.title = 'View employee details';
          employeeButton.textContent = leaveEmployee.name || 'Employee';
          employeeButton.dataset.employeeName = leaveEmployee.name || 'Employee';
          employeeButton.dataset.employeeEmail = leaveEmployee.email || '';
          employeeButton.addEventListener('click', function () { openEmployeeDetails(leaveEmployee); });
          type.appendChild(employeeButton);
          type.appendChild(document.createTextNode(' · ' + leave.leaveType));
        } else {
          type.textContent = leave.leaveType;
        }
        var duration = document.createElement('div');
        duration.className = 'leave-days';
        duration.textContent = leaveDays(leave) + ' day' + (leaveDays(leave) === 1 ? '' : 's');
        summaryBlock.appendChild(type);
        summaryBlock.appendChild(duration);

        var details = document.createElement('div');
        var dates = document.createElement('div');
        dates.className = 'leave-date';
        dates.textContent = formatDate(leave.startDate) + ' – ' + formatDate(leave.endDate);
        var reason = document.createElement('div');
        reason.className = 'leave-reason';
        reason.textContent = leave.reason;
        details.appendChild(dates);
        details.appendChild(reason);
        main.appendChild(summaryBlock);
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
          actions.appendChild(actionButton('Remove', 'remove', function () { removeLeave(leave); }));
          row.appendChild(actions);
        } else {
          var removeActions = document.createElement('div');
          removeActions.className = 'leave-actions-inline';
          removeActions.appendChild(actionButton('Remove', 'remove', function () { removeLeave(leave); }));
          row.appendChild(removeActions);
        }

        history.appendChild(row);
      });

      if (count) count.textContent = 'Showing ' + visibleLeaves.length + ' leave request' + (visibleLeaves.length === 1 ? '' : 's');

      if (isAdmin) {
        var management = summary || {};
        var pendingElement = document.getElementById('adminPendingLeaves');
        var approvedElement = document.getElementById('adminApprovedThisMonth');
        if (pendingElement) pendingElement.textContent = management.pendingRequests || 0;
        if (approvedElement) approvedElement.textContent = management.approvedThisMonth || 0;
        return;
      }

      // The API owns this calculation so the dashboard and this page always
      // show the same allowance after an approval.
      summary = summary || { monthlyAllowance: 6, leaveDaysTaken: 0, leaveBalance: 6 };
      var monthlyAllowance = summary.monthlyAllowance || 6;
      var usedThisMonth = summary.leaveDaysTaken || 0;
      var remainingDays = typeof summary.leaveBalance === 'number' ? summary.leaveBalance : Math.max(0, monthlyAllowance - usedThisMonth);
      if (daysTaken) daysTaken.textContent = usedThisMonth;
      if (balance) balance.textContent = remainingDays;
      var progress = document.querySelector('.leave-progress');
      if (progress) {
        var percentage = Math.round(remainingDays / monthlyAllowance * 100);
        var fill = progress.querySelector('.fill');
        var label = progress.querySelector('span');
        if (fill) fill.setAttribute('stroke-dasharray', percentage + ' 100');
        if (label) label.textContent = percentage + '%';
        progress.setAttribute('aria-label', percentage + ' percent of monthly allowance remaining');
      }
    }

    async function loadLeaves() {
      try {
        var response = await api(isAdmin ? '/leaves' : '/leaves/my');
        var data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load leave requests.');
        renderLeaves(data.leaves || [], data.summary);
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
        var startDate = document.getElementById('leaveFrom').value;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startDate && new Date(startDate + 'T00:00') < today) {
          throw new Error('Leave cannot start before today.');
        }

        var response = await api('/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaveType: document.getElementById('leaveType').value,
            startDate: startDate,
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
        await showLeaveNotice(error.message || 'Unable to submit leave request.');
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
    var apiBase = window.TEACHTRACK_API_ORIGIN + '/api';
    var notificationHead = notificationPopup.querySelector('.notification-head');
    var removeAll = document.createElement('button');
    removeAll.type = 'button';
    removeAll.className = 'notification-remove-all';
    removeAll.textContent = 'Remove all';
    removeAll.setAttribute('aria-label', 'Remove all notifications');
    if (notificationHead) notificationHead.appendChild(removeAll);

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

          var remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'notification-remove';
          remove.textContent = 'Remove';
          remove.setAttribute('aria-label', 'Remove notification: ' + notification.title);
          remove.addEventListener('click', async function (event) {
            event.stopPropagation();
            remove.disabled = true;
            try {
              var response = await fetch(apiBase + '/notifications/' + encodeURIComponent(notification.id), {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + authToken },
              });
              if (!response.ok) throw new Error('Unable to remove notification.');
              notifications = notifications.filter(function (item) { return item.id !== notification.id; });
              renderNotifications();
            } catch {
              remove.disabled = false;
            }
          });

          copy.appendChild(title);
          copy.appendChild(message);
          copy.appendChild(time);
          copy.appendChild(remove);

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

    removeAll.addEventListener('click', async function (event) {
      event.stopPropagation();
      removeAll.disabled = true;
      try {
        var response = await fetch(apiBase + '/notifications', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + authToken },
        });
        if (!response.ok) throw new Error('Unable to remove notifications.');
        notifications = [];
        renderNotifications();
      } catch {
        removeAll.disabled = false;
      }
    });

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

    function removeViewedLeaveNotifications() {
      var viewedLeaveNotifications = notifications.filter(function (notification) {
        return notification.isRead && (
          notification.type === 'LEAVE_APPROVED' ||
          notification.type === 'LEAVE_REJECTED'
        );
      });

      viewedLeaveNotifications.forEach(function (notification) {
        window.setTimeout(async function () {
          try {
            var response = await fetch(apiBase + '/notifications/' + encodeURIComponent(notification.id), {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + authToken },
            });
            if (!response.ok && response.status !== 404) return;
            notifications = notifications.filter(function (item) {
              return item.id !== notification.id;
            });
            renderNotifications();
          } catch {
            /* A later refresh will retry notification cleanup. */
          }
        }, 5000);
      });
    }

    function connectSocket() {
      if (!window.io) {
        var script = document.createElement('script');
        script.src = window.TEACHTRACK_API_ORIGIN + '/socket.io/socket.io.js';
        script.onload = connectSocket;
        document.head.appendChild(script);
        return;
      }

      var socket = window.io(window.TEACHTRACK_API_ORIGIN, {
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

      socket.on('leave:created', function (payload) {
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

      socket.on('duty:updated', function (duty) {
        if (duty && duty.status === 'COMPLETED') {
          notifications = notifications.filter(function (notification) {
            return notification.type !== 'DUTY' || notification.message !== duty.title + ' was assigned to you.';
          });
          renderNotifications();
        }
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
      window.setTimeout(async function () {
        if (notificationPopup.classList.contains('open')) {
          await loadNotifications();
          markNotificationsRead();
          removeViewedLeaveNotifications();
        }
      }, 0);
    });

    loadNotifications();
    loadUnreadMessageCount();
    window.setInterval(loadNotifications, 10000);
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
