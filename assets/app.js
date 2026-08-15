
(function () {
  'use strict';
    const authToken = sessionStorage.getItem('teachtrack_token');

  if (!authToken) {
    window.location.replace('login.html');
    return;
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
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) root.setAttribute('data-theme', 'dark');
    if (btn) {
      btn.addEventListener('click', function () {
        var isDark = root.getAttribute('data-theme') === 'dark';
        root.setAttribute('data-theme', isDark ? 'light' : 'dark');
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

    /* Duties interactions: filter, add-duty button feedback, and pagination polish. */
    (function () {
      var filterBtn = document.getElementById('dutyFilterBtn');
      var filterMenu = document.getElementById('dutyFilterMenu');
      var statusFilter = document.getElementById('dutyStatusFilter');
      var rows = Array.prototype.slice.call(document.querySelectorAll('.duty-row'));
      var count = document.getElementById('dutyCount');
      var addDuty = document.getElementById('addDutyBtn');

      function applyDutyFilter() {
        var value = statusFilter ? statusFilter.value : 'all';
        var visible = 0;
        rows.forEach(function (row) {
          var show = value === 'all' || row.getAttribute('data-status') === value;
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        if (count) count.textContent = visible ? 'Showing 1 to ' + visible + ' of ' + visible + ' entries' : 'No duties match this filter';
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
          addDuty.animate([
            { transform:'translateY(-2px) scale(1)' },
            { transform:'translateY(-2px) scale(.97)' },
            { transform:'translateY(-2px) scale(1)' }
          ], {duration:260, easing:'ease-out'});
          addDuty.setAttribute('aria-label', 'Add duty â€” ready');
          setTimeout(function () { addDuty.setAttribute('aria-label', 'Add duty'); }, 700);
        });
      }
    })();

    /* Timetable search + filters only affect timetable lecture cards. */
    var search = document.getElementById('ttSearch');
    var dayFilter = document.getElementById('ttDayFilter');
    var classFilter = document.getElementById('ttClassFilter');
    var timetableSlots = Array.prototype.slice.call(document.querySelectorAll('.tt-slot'));

    function filterTimetable() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var day = dayFilter ? dayFilter.value : 'all';
      var cls = classFilter ? classFilter.value : 'all';

      timetableSlots.forEach(function (slot) {
        var text = slot.textContent.toLowerCase();
        var matchesSearch = !q || text.indexOf(q) !== -1;
        var matchesDay = day === 'all' || slot.getAttribute('data-day') === day;
        var matchesClass = cls === 'all' || !slot.getAttribute('data-class') ||
          slot.getAttribute('data-class') === cls;
        slot.style.display = (matchesSearch && matchesDay && matchesClass) ? '' : 'none';
      });
    }

    if (search) search.addEventListener('input', filterTimetable);
    if (dayFilter) dayFilter.addEventListener('change', filterTimetable);
    if (classFilter) classFilter.addEventListener('change', filterTimetable);

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

    var current = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    var selectedDate = fmt(TODAY);
    var currentView = 'month';
    var currentPage = 1;
    var PAGE_SIZE = 4;

    function fmt(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function eventsOn(dateStr) { return events.filter(function (e) { return e.date === dateStr; }); }
    function startOfWeek(d) { var x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x; }
    function endOfWeek(d) { var x = startOfWeek(d); x.setDate(x.getDate() + 6); x.setHours(23,59,59,999); return x; }

    var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function renderMonthLabel() {
      var label = document.getElementById('calMonthLabel');
      if (label) label.textContent = MONTH_NAMES[current.getMonth()] + ' ' + current.getFullYear();
    }

    function renderGrid() {
      // remove existing day cells (keep the 7 .cal-dow headers)
      Array.prototype.slice.call(grid.querySelectorAll('.cal-day')).forEach(function (el) { el.remove(); });

      var year = current.getFullYear(), month = current.getMonth();
      var firstDay = new Date(year, month, 1);
      var startOffset = firstDay.getDay(); // 0=Sun
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var daysInPrevMonth = new Date(year, month, 0).getDate();
      var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

      var frag = document.createDocumentFragment();

      for (var i = 0; i < totalCells; i++) {
        var dayNum, cellDate, isOther = false;
        if (i < startOffset) {
          dayNum = daysInPrevMonth - startOffset + i + 1;
          cellDate = new Date(year, month - 1, dayNum);
          isOther = true;
        } else if (i >= startOffset + daysInMonth) {
          dayNum = i - startOffset - daysInMonth + 1;
          cellDate = new Date(year, month + 1, dayNum);
          isOther = true;
        } else {
          dayNum = i - startOffset + 1;
          cellDate = new Date(year, month, dayNum);
        }

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
        prev.type = 'button'; prev.textContent = 'â€¹'; prev.setAttribute('aria-label', 'Previous page');
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
        next.type = 'button'; next.textContent = 'â€º'; next.setAttribute('aria-label', 'Next page');
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
        // Month view is fully implemented; Week/Day reuse the same grid,
        // scoped visually by highlighting only the relevant cells.
        renderGrid();
      });
    });

    var addBtn = document.getElementById('calAddEventBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var name = window.prompt('Event name:');
        if (!name) return;
        var d = selectedDate || fmt(TODAY);
        events.push({
          date: d, name: name, time: 'All day', location: 'â€”',
          category: 'meeting', status: 'pending'
        });
        currentPage = 1;
        renderAll();
      });
    }

    renderAll();
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
      });

      socket.on('leave:updated', function (payload) {
        document.dispatchEvent(new CustomEvent('teachtrack:leave-updated', {
          detail: payload
        }));
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
    connectSocket();
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
