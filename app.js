/**
 * Rhythms — Habit & Interval Tracker
 * Client-side Habit Tracking Engine with LocalStorage
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'rhythms_habits_v1';
  const VIEW_STORAGE_KEY = 'rhythms_view_mode_v1';

  // --- STATE ---
  let habits = [];
  let currentSearchQuery = '';
  let currentStatusFilter = 'all'; // 'all' | 'pending' | 'overdue' | 'done'
  let currentSortBy = 'name';
  let currentViewMode = 'card'; // 'card' | 'table'
  try {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    if (savedView === 'card' || savedView === 'table') {
      currentViewMode = savedView;
    }
  } catch (e) {}

  // --- INITIAL SAMPLE DATA ---
  function getSampleHabits() {
    const today = new Date();
    
    function daysAgoStr(days) {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return formatDateISO(d);
    }

    return [
      {
        id: 'sample_1',
        name: 'Gym & Strength Workout',
        icon: '💪',
        targetDays: 2,
        lastCompleted: formatDateISO(today), // 0 days ago (Today)
        history: [daysAgoStr(4), daysAgoStr(2), formatDateISO(today)],
        notes: 'Upper/Lower split or full body functional routine.'
      },
      {
        id: 'sample_2',
        name: 'Call Family & Friends',
        icon: '❤️',
        targetDays: 3,
        lastCompleted: daysAgoStr(2), // 2 days ago
        history: [daysAgoStr(9), daysAgoStr(5), daysAgoStr(2)],
        notes: 'Catch up with parents or close friends.'
      },
      {
        id: 'sample_3',
        name: 'Water Houseplants',
        icon: '🌱',
        targetDays: 5,
        lastCompleted: daysAgoStr(5), // 5 days ago (Due today!)
        history: [daysAgoStr(15), daysAgoStr(10), daysAgoStr(5)],
        notes: 'Check soil moisture before watering the ferns & monstera.'
      },
      {
        id: 'sample_4',
        name: 'Deep Clean Workspace',
        icon: '🧹',
        targetDays: 7,
        lastCompleted: daysAgoStr(11), // 11 days ago (Overdue)
        history: [daysAgoStr(25), daysAgoStr(18), daysAgoStr(11)],
        notes: 'Dust monitors, wipe down desk, declutter cables.'
      },
      {
        id: 'sample_5',
        name: 'Read 20 Pages',
        icon: '📚',
        targetDays: 1,
        lastCompleted: null, // No completion yet (-- days ago)
        history: [],
        notes: 'Daily reading habit.'
      }
    ];
  }

  function formatIntervalText(targetDays) {
    if (!targetDays || targetDays <= 0) return 'No target interval';
    if (targetDays === 1) return 'Every day';
    return `Every ${targetDays} days`;
  }

  // --- DATE HELPERS ---
  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getTodayISO() {
    return formatDateISO(new Date());
  }

  function getDaysDifference(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((today - targetDate) / msPerDay);
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return 'Never';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getQuickRelativeDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return formatDateISO(d);
  }

  // --- STORAGE ENGINE ---
  function loadHabits() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        habits = JSON.parse(data);
      } else {
        habits = getSampleHabits();
        saveHabits();
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
      habits = getSampleHabits();
    }
  }

  function saveHabits() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      showToast('Error saving data to local storage', 'danger');
    }
  }

  // --- DOM ELEMENTS ---
  const appHeader = document.querySelector('.app-header');
  const headerDateText = document.getElementById('headerDateText');

  // Header collapse is driven by pure CSS scroll-driven animations (see
  // styles.css). This JS fallback only runs where animation-timeline
  // isn't supported, toggling the .is-scrolled class instead.
  const supportsScrollTimeline = typeof CSS !== 'undefined' && !!CSS.supports &&
    CSS.supports('animation-timeline: scroll()');
  function updateHeaderCompact() {
    if (!appHeader || supportsScrollTimeline) return;
    appHeader.classList.toggle('is-scrolled', window.scrollY > 16);
  }
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const statusFilterPills = document.getElementById('statusFilterPills');
  const sortBySelect = document.getElementById('sortBySelect');
  const viewToggleGroup = document.getElementById('viewToggleGroup');
  const habitsGrid = document.getElementById('habitsGrid');
  const habitsTableContainer = document.getElementById('habitsTableContainer');
  const habitsTableBody = document.getElementById('habitsTableBody');
  const emptyState = document.getElementById('emptyState');
  const emptyAddBtn = document.getElementById('emptyAddBtn');
  const loadPresetsBtn = document.getElementById('loadPresetsBtn');
  const openAddHabitModalBtn = document.getElementById('openAddHabitModalBtn');

  // Modals
  const habitModal = document.getElementById('habitModal');
  const habitForm = document.getElementById('habitForm');
  const modalTitle = document.getElementById('modalTitle');
  const habitIdInput = document.getElementById('habitIdInput');
  const habitNameInput = document.getElementById('habitNameInput');
  const habitIconInput = document.getElementById('habitIconInput');
  const iconOptionsGrid = document.getElementById('iconOptionsGrid');
  const habitIconCustomInput = document.getElementById('habitIconCustomInput');
  const iconPreviewTile = document.getElementById('iconPreviewTile');
  const habitTargetDaysInput = document.getElementById('habitTargetDaysInput');
  const habitLastCompletedInput = document.getElementById('habitLastCompletedInput');
  const habitNotesInput = document.getElementById('habitNotesInput');

  // Icon the modal opened with — clearing the custom field reverts to it.
  let modalOpenIcon = '⚡';

  function isGridIcon(icon) {
    if (!iconOptionsGrid || !icon) return false;
    return Array.from(iconOptionsGrid.querySelectorAll('.icon-chip'))
      .some(chip => chip.getAttribute('data-icon') === icon);
  }

  // First user-perceived character (keeps ZWJ sequences, flags, skin tones
  // intact instead of splitting surrogate pairs).
  function firstGrapheme(str) {
    if (!str) return '';
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      for (const { segment } of segmenter.segment(str)) return segment;
    } catch (e) { /* fall through to code-point fallback */ }
    return Array.from(str)[0] || '';
  }

  function setSelectedIcon(icon) {
    const selected = icon || '⚡';
    if (habitIconInput) habitIconInput.value = selected;
    if (iconOptionsGrid) {
      iconOptionsGrid.querySelectorAll('.icon-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-icon') === selected);
      });
    }
    // Custom field mirrors custom icons; stays empty for grid picks.
    if (habitIconCustomInput) {
      habitIconCustomInput.value = isGridIcon(selected) ? '' : selected;
    }
    if (iconPreviewTile) iconPreviewTile.textContent = selected;
  }

  // Custom date modal
  const customDateModal = document.getElementById('customDateModal');
  const customDateForm = document.getElementById('customDateForm');
  const customDateHabitId = document.getElementById('customDateHabitId');
  const customDateHabitName = document.getElementById('customDateHabitName');
  const customCompletionDateInput = document.getElementById('customCompletionDateInput');

  // History modal
  const historyModal = document.getElementById('historyModal');
  const historyHabitSubtitle = document.getElementById('historyHabitSubtitle');
  const historyTotalCount = document.getElementById('historyTotalCount');
  const historyListContainer = document.getElementById('historyListContainer');

  // Data modal
  const backupDataBtn = document.getElementById('backupDataBtn');
  const dataModal = document.getElementById('dataModal');
  const downloadBackupBtn = document.getElementById('downloadBackupBtn');
  const triggerImportBtn = document.getElementById('triggerImportBtn');
  const importFileInput = document.getElementById('importFileInput');
  const resetDataBtn = document.getElementById('resetDataBtn');

  const toast = document.getElementById('toast');

  // --- TOAST HELPER ---
  let toastTimer = null;
  function showToast(message, type = 'normal', action = null) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.innerHTML = '';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (action && action.label && action.callback) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action-btn';
      btn.textContent = action.label;
      btn.onclick = () => {
        action.callback();
        toast.className = 'toast';
      };
      toast.appendChild(btn);
    }

    toast.className = 'toast show';
    if (type === 'success') toast.classList.add('toast-success');
    if (type === 'danger') toast.classList.add('toast-danger');

    toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, action ? 4500 : 3200);
  }

  // --- MODAL UTILITIES ---
  function openModal(modalEl) {
    modalEl.classList.add('is-active');
    modalEl.setAttribute('aria-hidden', 'false');
    const firstInput = modalEl.querySelector('input:not([type="hidden"]), select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 50);
    }
  }

  function closeModal(modalEl) {
    modalEl.classList.remove('is-active');
    modalEl.setAttribute('aria-hidden', 'true');
  }

  // --- RENDERING & CALCULATIONS ---
  function updateHeaderDate() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    headerDateText.textContent = now.toLocaleDateString(undefined, options);
  }

  function calculateStatus(habit) {
    const days = getDaysDifference(habit.lastCompleted);
    if (days === null) {
      return { status: 'never', label: 'Not started', badgeClass: '' };
    }
    if (days < 0) {
      const absDays = Math.abs(days);
      return { status: 'future', label: `In ${absDays} ${absDays === 1 ? 'day' : 'days'}`, badgeClass: '' };
    }
    if (days === 0) {
      return { status: 'completed-today', label: 'Completed Today', badgeClass: 'badge-done-today' };
    }
    if (habit.targetDays && habit.targetDays > 0) {
      if (days > habit.targetDays) {
        const overdue = days - habit.targetDays;
        return {
          status: 'overdue',
          label: `Overdue by ${overdue} ${overdue === 1 ? 'day' : 'days'}`,
          badgeClass: 'badge-overdue'
        };
      }
      if (days === habit.targetDays) {
        return { status: 'attention', label: 'Due today', badgeClass: 'badge-warning' };
      }
      const remaining = habit.targetDays - days;
      return {
        status: 'normal',
        label: `${remaining} ${remaining === 1 ? 'day' : 'days'} left`,
        badgeClass: ''
      };
    }

    if (days === 1) {
      return { status: 'normal', label: 'Yesterday', badgeClass: '' };
    }
    return { status: 'normal', label: `${days} days ago`, badgeClass: '' };
  }

  function filterAndSortHabits() {
    return habits
      .filter(habit => {
        const days = getDaysDifference(habit.lastCompleted);

        // Status filter (all / pending / overdue / done)
        if (currentStatusFilter === 'done' && days !== 0) {
          return false;
        }
        if (currentStatusFilter === 'pending' && days === 0) {
          return false;
        }
        if (currentStatusFilter === 'overdue') {
          const isOverdue = habit.targetDays && days !== null && days > habit.targetDays;
          if (!isOverdue) return false;
        }

        // Search query
        if (currentSearchQuery) {
          const q = currentSearchQuery.toLowerCase();
          const matchName = habit.name.toLowerCase().includes(q);
          const matchNotes = (habit.notes || '').toLowerCase().includes(q);
          if (!matchName && !matchNotes) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const daysA = getDaysDifference(a.lastCompleted);
        const daysB = getDaysDifference(b.lastCompleted);

        if (currentSortBy === 'days-desc') {
          // Habits with no completion (never) are considered most inactive (Infinity)
          const valA = daysA !== null ? daysA : Infinity;
          const valB = daysB !== null ? daysB : Infinity;
          return valB - valA;
        }
        if (currentSortBy === 'days-asc') {
          // Recently completed first, never completed last
          const valA = daysA !== null ? daysA : Infinity;
          const valB = daysB !== null ? daysB : Infinity;
          return valA - valB;
        }
        if (currentSortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (currentSortBy === 'status') {
          const score = h => {
            const d = getDaysDifference(h.lastCompleted);
            if (d === 0) return 0;
            if (h.targetDays && d !== null) {
              if (d > h.targetDays) return 100 + (d - h.targetDays);
              if (d === h.targetDays) return 50;
            }
            if (d === null) return 25; // pending, not completed yet
            return d;
          };
          return score(b) - score(a);
        }
        return 0;
      });
  }

  function updateViewToggleUI() {
    if (!viewToggleGroup) return;
    viewToggleGroup.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view-mode') === currentViewMode);
    });
  }

  function getProgressState(habit, days) {
    if (days === null || days === 0) {
      if (days === 0) return { pct: 100, cls: 'is-done', show: true };
      return { pct: 0, cls: '', show: !!habit.targetDays };
    }
    if (!habit.targetDays || habit.targetDays <= 0) return { pct: 0, cls: '', show: false };
    if (days > habit.targetDays) return { pct: 100, cls: 'is-overdue', show: true };
    if (days === habit.targetDays) return { pct: 100, cls: 'is-due', show: true };
    return { pct: Math.max(6, Math.round((days / habit.targetDays) * 100)), cls: '', show: true };
  }

  function renderHabits() {
    updateViewToggleUI();
    const filtered = filterAndSortHabits();

    if (filtered.length === 0) {
      habitsGrid.innerHTML = '';
      if (habitsTableBody) habitsTableBody.innerHTML = '';
      habitsGrid.style.display = 'none';
      if (habitsTableContainer) habitsTableContainer.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    if (currentViewMode === 'table') {
      habitsGrid.style.display = 'none';
      if (habitsTableContainer) habitsTableContainer.style.display = 'block';
      renderTableView(filtered);
    } else {
      if (habitsTableContainer) habitsTableContainer.style.display = 'none';
      habitsGrid.style.display = 'grid';
      renderCardView(filtered);
    }
  }

  function renderCardView(filtered) {
    const cardsHtml = filtered.map(habit => {
      const days = getDaysDifference(habit.lastCompleted);
      const isDoneToday = days === 0;

      // Status card class
      let cardStatusClass = '';
      if (isDoneToday) {
        cardStatusClass = 'status-completed-today';
      } else if (habit.targetDays && days !== null && days > habit.targetDays) {
        cardStatusClass = 'status-overdue';
      } else if (habit.targetDays && days === habit.targetDays) {
        cardStatusClass = 'status-due-today';
      }

      // Main display: focus on how many days ago it was completed
      let counterNumber = days !== null ? days : '--';
      let unitLabel = days === 1 ? 'DAY AGO' : 'DAYS AGO';

      // Last completion date line
      const lastDoneFormatted = habit.lastCompleted 
        ? `Last: ${formatDisplayDate(habit.lastCompleted)}` 
        : 'Never completed';

      // Due status: clean colored text without icons or boxed borders
      let statusTextHtml = '';
      if (days === null) {
        statusTextHtml = '<span class="status-text text-muted">Not started</span>';
      } else if (isDoneToday) {
        statusTextHtml = '<span class="status-text text-success">Completed today</span>';
      } else if (habit.targetDays) {
        if (days > habit.targetDays) {
          const overdueBy = days - habit.targetDays;
          statusTextHtml = `<span class="status-text text-danger">Overdue by ${overdueBy}d</span>`;
        } else if (days === habit.targetDays) {
          statusTextHtml = `<span class="status-text text-warning">Due today (target: ${habit.targetDays}d)</span>`;
        } else {
          const remaining = habit.targetDays - days;
          statusTextHtml = `<span class="status-text text-muted">On track (${remaining}d left)</span>`;
        }
      } else if (days === 1) {
        statusTextHtml = '<span class="status-text text-muted">Yesterday</span>';
      }

      const progress = getProgressState(habit, days);
      const progressHtml = progress.show
        ? `<div class="progress-track" aria-hidden="true"><div class="progress-fill ${progress.cls}" style="width: ${progress.pct}%"></div></div>`
        : '';

      return `
        <article class="habit-card ${cardStatusClass}" data-id="${habit.id}">
          <!-- Card Header: Icon + Name + Interval + Dropdown Options -->
          <div class="card-header">
            <div class="card-title-group">
              <div class="habit-title-row">
                <span class="habit-icon">${escapeHtml(habit.icon) || '⚡'}</span>
                <h2 class="habit-name">${escapeHtml(habit.name)}</h2>
              </div>
              <span class="habit-interval-tag">${formatIntervalText(habit.targetDays)}</span>
            </div>

            <!-- Top-Right Dropdown Menu -->
            <div class="card-menu-container">
              <button type="button" class="card-menu-btn" data-action="toggle-menu" data-id="${habit.id}" title="More options" aria-label="More options">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                  <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
                  <circle cx="19" cy="12" r="1.5" fill="currentColor"></circle>
                  <circle cx="5" cy="12" r="1.5" fill="currentColor"></circle>
                </svg>
              </button>

              <div class="card-dropdown-menu" id="menu-${habit.id}">
                <button type="button" class="dropdown-item" data-action="custom-date" data-id="${habit.id}">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>Set completion date...</span>
                </button>

                <button type="button" class="dropdown-item" data-action="history" data-id="${habit.id}">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 14 14"></polyline>
                  </svg>
                  <span>View history</span>
                </button>

                <button type="button" class="dropdown-item" data-action="edit" data-id="${habit.id}">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  <span>Edit habit</span>
                </button>

                <div class="dropdown-divider"></div>

                <button type="button" class="dropdown-item item-danger" data-action="delete" data-id="${habit.id}">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Main Hero: How many days ago it was completed -->
          <div class="card-hero-counter">
            <span class="counter-huge">${counterNumber}</span>
            <div class="counter-hero-meta">
              <span class="counter-unit-label">${unitLabel}</span>
              <span class="last-done-date">${lastDoneFormatted}</span>
              ${statusTextHtml}
            </div>
            ${progressHtml}
          </div>

          <!-- Bottom: Prominent, easy-to-click Mark Done button (toggles off if pressed again) -->
          <button type="button" class="btn-mark-done ${isDoneToday ? 'is-done-today' : ''}" 
                  data-action="toggle-done-today" 
                  data-id="${habit.id}"
                  title="${isDoneToday ? "Click to remove today's completion" : "Mark as completed today"}">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${isDoneToday ? 'Done Today' : 'Mark as Done'}</span>
          </button>
        </article>
      `;
    }).join('');

    habitsGrid.innerHTML = cardsHtml;
  }

  function renderTableView(filtered) {
    const rowsHtml = filtered.map(habit => {
      const days = getDaysDifference(habit.lastCompleted);
      const isDoneToday = days === 0;

      let rowStatusClass = '';
      if (isDoneToday) {
        rowStatusClass = 'status-completed-today';
      } else if (habit.targetDays && days !== null && days > habit.targetDays) {
        rowStatusClass = 'status-overdue';
      } else if (habit.targetDays && days === habit.targetDays) {
        rowStatusClass = 'status-due-today';
      }

      let counterNumber = days !== null ? days : '--';
      let unitLabel = days === 1 ? 'DAY AGO' : 'DAYS AGO';

      const doneAriaLabel = isDoneToday
        ? `${habit.name} completed today, activate to undo`
        : `Mark ${habit.name} as done`;

      return `
        <tr class="habit-table-row ${rowStatusClass}" data-id="${habit.id}">
          <td class="td-habit">
            <div class="table-habit-info">
              <div class="table-habit-title-row">
                <span class="table-habit-icon">${escapeHtml(habit.icon) || '⚡'}</span>
                <span class="table-habit-name" title="${escapeHtml(formatIntervalText(habit.targetDays))}">${escapeHtml(habit.name)}</span>
              </div>
            </div>
          </td>
          <td class="td-days">
            <div class="table-days-hero">
              <span class="table-counter-num">${counterNumber}</span>
              <span class="table-counter-unit">${unitLabel}</span>
            </div>
          </td>
          <td class="td-actions">
            <div class="table-actions-cell">
              <button type="button" class="table-btn-done table-btn-icon ${isDoneToday ? 'is-done-today' : ''}"
                      data-action="toggle-done-today"
                      data-id="${habit.id}"
                      title="${isDoneToday ? "Click to remove today's completion" : "Mark as completed today"}"
                      aria-label="${escapeHtml(doneAriaLabel)}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>

              <div class="card-menu-container">
                <button type="button" class="card-menu-btn" data-action="toggle-menu" data-id="${habit.id}" title="More options" aria-label="More options">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
                    <circle cx="19" cy="12" r="1.5" fill="currentColor"></circle>
                    <circle cx="5" cy="12" r="1.5" fill="currentColor"></circle>
                  </svg>
                </button>

                <div class="card-dropdown-menu" id="menu-table-${habit.id}">
                  <button type="button" class="dropdown-item" data-action="custom-date" data-id="${habit.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>Set completion date...</span>
                  </button>

                  <button type="button" class="dropdown-item" data-action="history" data-id="${habit.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 14 14"></polyline>
                    </svg>
                    <span>View history</span>
                  </button>

                  <button type="button" class="dropdown-item" data-action="edit" data-id="${habit.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                    <span>Edit habit</span>
                  </button>

                  <div class="dropdown-divider"></div>

                  <button type="button" class="dropdown-item item-danger" data-action="delete" data-id="${habit.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    habitsTableBody.innerHTML = rowsHtml;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- ACTIONS ---
  function toggleDoneToday(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const todayStr = getTodayISO();
    const days = getDaysDifference(habit.lastCompleted);
    const isDoneToday = days === 0 || habit.lastCompleted === todayStr;

    if (isDoneToday) {
      // UNCOMPLETE TODAY: Delete today's completion
      const previousLastCompleted = habit.lastCompleted;
      const previousHistory = [...(habit.history || [])];

      // Remove today from history
      habit.history = (habit.history || []).filter(d => d !== todayStr);
      // Recalculate lastCompleted to newest date or null
      habit.lastCompleted = habit.history.length > 0 ? habit.history[habit.history.length - 1] : null;

      saveHabits();
      renderHabits();

      showToast(`Removed today's completion for "${habit.name}".`, 'normal', {
        label: 'Undo',
        callback: () => {
          habit.lastCompleted = previousLastCompleted;
          habit.history = previousHistory;
          saveHabits();
          renderHabits();
          showToast(`Restored completion for "${habit.name}".`, 'success');
        }
      });
    } else {
      // MARK DONE TODAY
      const previousLastCompleted = habit.lastCompleted;
      const previousHistory = [...(habit.history || [])];

      if (!habit.history) habit.history = [];
      if (!habit.history.includes(todayStr)) {
        habit.history.push(todayStr);
        habit.history.sort();
      }
      habit.lastCompleted = todayStr;

      saveHabits();
      renderHabits();

      // Visual pulse animation on card or table row
      const itemEl = document.querySelector(`.habit-card[data-id="${habitId}"], .habit-table-row[data-id="${habitId}"]`);
      if (itemEl) {
        itemEl.classList.add('just-completed');
        setTimeout(() => itemEl.classList.remove('just-completed'), 400);
      }

      showToast(`✓ "${habit.name}" marked done!`, 'success', {
        label: 'Undo',
        callback: () => {
          habit.lastCompleted = previousLastCompleted;
          habit.history = previousHistory;
          saveHabits();
          renderHabits();
          showToast(`Undone completion for "${habit.name}".`);
        }
      });
    }
  }

  function markDoneCustomDate(habitId, dateStr) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!habit.history) habit.history = [];
    habit.history.push(dateStr);
    habit.history.sort(); // keep chronologically sorted

    // update lastCompleted to the latest date in history
    habit.lastCompleted = habit.history[habit.history.length - 1];

    saveHabits();
    renderHabits();
    const diff = getDaysDifference(dateStr);
    showToast(`Updated "${habit.name}" completion date to ${formatDisplayDate(dateStr)} (${diff} ${diff === 1 ? 'day' : 'days'} ago).`, 'success');
  }

  function deleteHabit(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (confirm(`Are you sure you want to delete the habit "${habit.name}"?`)) {
      habits = habits.filter(h => h.id !== habitId);
      saveHabits();
      renderHabits();
      showToast(`Deleted habit "${habit.name}".`);
    }
  }

  function openEditModal(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    modalTitle.textContent = 'Edit Habit';
    habitIdInput.value = habit.id;
    habitNameInput.value = habit.name;
    modalOpenIcon = habit.icon || '⚡';
    setSelectedIcon(modalOpenIcon);
    habitTargetDaysInput.value = habit.targetDays || '';
    habitLastCompletedInput.value = habit.lastCompleted || '';
    habitNotesInput.value = habit.notes || '';

    openModal(habitModal);
  }

  function openAddModal() {
    modalTitle.textContent = 'New Habit';
    habitIdInput.value = '';
    habitForm.reset();
    modalOpenIcon = '⚡';
    setSelectedIcon('⚡');
    habitLastCompletedInput.value = ''; // Blank by default (habit can be created without previous completion)
    openModal(habitModal);
  }

  function openCustomDateModal(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    customDateHabitId.value = habit.id;
    customDateHabitName.textContent = `Set last completion date for "${habit.name}":`;
    customCompletionDateInput.value = habit.lastCompleted || getTodayISO();

    openModal(customDateModal);
  }

  function openHistoryModal(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    historyHabitSubtitle.textContent = habit.name;
    const historyList = (habit.history || []).slice().reverse();
    historyTotalCount.textContent = historyList.length;

    if (historyList.length === 0) {
      historyListContainer.innerHTML = '<p class="modal-subtext" style="text-align:center; padding: 1rem 0;">No completion dates logged yet.</p>';
    } else {
      historyListContainer.innerHTML = historyList.map((dateStr, idx) => {
        const diff = getDaysDifference(dateStr);
        let relText = diff === 0 ? 'Today' : (diff === 1 ? 'Yesterday' : `${diff} days ago`);
        return `
          <div class="history-item">
            <div class="history-date-info">
              <span class="history-date-main">${formatDisplayDate(dateStr)}</span>
              <span class="history-date-sub">${relText}</span>
            </div>
            <button class="delete-history-btn" data-habit-id="${habit.id}" data-date="${dateStr}" title="Remove this completion entry">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;
      }).join('');
    }

    openModal(historyModal);
  }

  function removeHistoryEntry(habitId, dateStr) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit || !habit.history) return;

    const index = habit.history.lastIndexOf(dateStr);
    if (index > -1) {
      habit.history.splice(index, 1);
      // recalculate lastCompleted to newest date
      habit.lastCompleted = habit.history.length > 0 ? habit.history[habit.history.length - 1] : null;
      saveHabits();
      renderHabits();
      openHistoryModal(habitId); // refresh history modal
      showToast('Removed completion record.', 'normal');
    }
  }

  // --- DROPDOWN HELPERS ---
  function toggleCardDropdown(habitId, clickedBtn) {
    const container = clickedBtn ? clickedBtn.closest('.card-menu-container') : null;
    const menu = container ? container.querySelector('.card-dropdown-menu') : document.getElementById(`menu-${habitId}`);
    if (!menu) return;
    const wasOpen = menu.classList.contains('is-open');
    closeAllDropdowns();
    if (!wasOpen) {
      menu.classList.add('is-open');
      keepTableMenuOnScreen(menu);
    }
  }

  // Table view clips overflow for its rounded corners, which would cut off a
  // dropdown near the bottom. Flip it upward when it would overflow the
  // table's bottom edge; if the whole table is shorter than the menu, unclip
  // the container instead. Card view never clips, so it is left alone.
  function keepTableMenuOnScreen(menu) {
    const tableWrap = menu.closest('.habits-table-container');
    if (!tableWrap) return;
    const wrapRect = tableWrap.getBoundingClientRect();
    let rect = menu.getBoundingClientRect();
    if (rect.bottom <= wrapRect.bottom + 1) return;
    menu.classList.add('drop-up');
    rect = menu.getBoundingClientRect();
    if (rect.top < wrapRect.top - 1) {
      menu.classList.remove('drop-up');
      tableWrap.classList.add('menu-open');
    }
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.card-dropdown-menu.is-open').forEach(menu => {
      menu.classList.remove('is-open');
      menu.classList.remove('drop-up');
    });
    document.querySelectorAll('.habits-table-container.menu-open').forEach(el => {
      el.classList.remove('menu-open');
    });
  }

  // --- EVENT LISTENERS ---

  // Card & Table button delegation on main container
  const mainContainer = document.querySelector('main');
  if (mainContainer) {
    mainContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const habitId = btn.getAttribute('data-id');

      if (action === 'toggle-menu') {
        e.stopPropagation();
        toggleCardDropdown(habitId, btn);
        return;
      }

      closeAllDropdowns();

      if (action === 'toggle-done-today' || action === 'complete-today') {
        toggleDoneToday(habitId);
      } else if (action === 'custom-date') {
        openCustomDateModal(habitId);
      } else if (action === 'history') {
        openHistoryModal(habitId);
      } else if (action === 'edit') {
        openEditModal(habitId);
      } else if (action === 'delete') {
        deleteHabit(habitId);
      }
    });
  }

  // History removal delegation
  historyListContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-history-btn');
    if (!btn) return;
    const habitId = btn.getAttribute('data-habit-id');
    const date = btn.getAttribute('data-date');
    removeHistoryEntry(habitId, date);
  });

  // Open modals
  openAddHabitModalBtn.addEventListener('click', openAddModal);
  emptyAddBtn.addEventListener('click', openAddModal);

  loadPresetsBtn.addEventListener('click', () => {
    habits = getSampleHabits();
    saveHabits();
    renderHabits();
    showToast('Example habits loaded!', 'success');
  });

  backupDataBtn.addEventListener('click', () => {
    openModal(dataModal);
  });

  // Where a press started. A text-selection drag that begins inside the
  // modal but ends outside it fires `click` on the backdrop (the common
  // ancestor) — that must NOT dismiss the modal and lose unsaved edits.
  // Only a press that both started and ended on the same backdrop counts.
  let backdropPressTarget = null;
  function trackPressStart(e) {
    backdropPressTarget = (e.target && e.target.classList && e.target.classList.contains('modal-backdrop'))
      ? e.target
      : null;
  }
  document.addEventListener('mousedown', trackPressStart);
  document.addEventListener('touchstart', trackPressStart, { passive: true });

  // Close modals & dropdowns on click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-menu-container')) {
      closeAllDropdowns();
    }

    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      const modalId = closeBtn.getAttribute('data-close');
      const modalEl = document.getElementById(modalId);
      if (modalEl) closeModal(modalEl);
      backdropPressTarget = null;
      return;
    }

    if (e.target.classList.contains('modal-backdrop')) {
      if (backdropPressTarget === e.target) {
        closeModal(e.target);
      }
      backdropPressTarget = null;
    }
  });

  // Close modal and dropdowns on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      document.querySelectorAll('.modal-backdrop.is-active').forEach(closeModal);
    }
  });

  // Save Habit Form Submit
  habitForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = habitIdInput.value.trim();
    const name = habitNameInput.value.trim();
    const icon = habitIconInput.value || '⚡';
    const targetDaysVal = habitTargetDaysInput.value ? parseInt(habitTargetDaysInput.value, 10) : null;
    const lastCompleted = habitLastCompletedInput.value ? habitLastCompletedInput.value.trim() : null;
    const notes = habitNotesInput.value.trim();

    if (!name) return;

    if (id) {
      // Edit existing
      const habit = habits.find(h => h.id === id);
      if (habit) {
        habit.name = name;
        habit.icon = icon;
        habit.targetDays = targetDaysVal;
        habit.notes = notes;
        habit.lastCompleted = lastCompleted;
        if (lastCompleted) {
          if (!habit.history) habit.history = [];
          if (!habit.history.includes(lastCompleted)) {
            habit.history.push(lastCompleted);
            habit.history.sort();
          }
        }
        showToast(`Habit "${name}" updated.`, 'success');
      }
    } else {
      // Add new (supports creating with no previous completion)
      const newHabit = {
        id: 'habit_' + Date.now(),
        name,
        icon,
        targetDays: targetDaysVal,
        lastCompleted: lastCompleted,
        history: lastCompleted ? [lastCompleted] : [],
        notes
      };
      habits.unshift(newHabit);
      showToast(`Created habit "${name}"!`, 'success');
    }

    saveHabits();
    renderHabits();
    closeModal(habitModal);
  });

  // Icon options picker click delegation
  if (iconOptionsGrid) {
    iconOptionsGrid.addEventListener('click', (e) => {
      const chip = e.target.closest('.icon-chip');
      if (!chip) return;
      modalOpenIcon = chip.getAttribute('data-icon') || '⚡';
      setSelectedIcon(modalOpenIcon);
    });
  }

  // Custom emoji field: any pasted/typed emoji becomes the icon.
  // Only the first grapheme is kept; clearing reverts to the open icon.
  if (habitIconCustomInput) {
    habitIconCustomInput.addEventListener('input', () => {
      const raw = habitIconCustomInput.value.trim();
      if (!raw) {
        setSelectedIcon(modalOpenIcon);
        return;
      }
      const grapheme = firstGrapheme(raw);
      if (habitIconInput) habitIconInput.value = grapheme;
      if (iconOptionsGrid) {
        iconOptionsGrid.querySelectorAll('.icon-chip').forEach(c => c.classList.remove('active'));
      }
      if (habitIconCustomInput.value !== grapheme) habitIconCustomInput.value = grapheme;
      if (iconPreviewTile) iconPreviewTile.textContent = grapheme;
    });
  }

  // Status filter pills (All / Pending / Overdue / Done)
  if (statusFilterPills) {
    statusFilterPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.status-pill');
      if (!pill) return;
      statusFilterPills.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentStatusFilter = pill.getAttribute('data-status-filter') || 'all';
      renderHabits();
    });
  }

  // Custom Date Form Submit
  customDateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const habitId = customDateHabitId.value;
    const dateStr = customCompletionDateInput.value;
    if (!habitId || !dateStr) return;

    markDoneCustomDate(habitId, dateStr);
    closeModal(customDateModal);
  });

  // Quick Date Chips in Add/Edit Modal
  document.querySelectorAll('.modal-card [data-set-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-set-date');
      if (type === 'clear') habitLastCompletedInput.value = '';
      if (type === 'today') habitLastCompletedInput.value = getTodayISO();
      if (type === 'yesterday') habitLastCompletedInput.value = getQuickRelativeDate(1);
      if (type === '2days') habitLastCompletedInput.value = getQuickRelativeDate(2);
      if (type === '7days') habitLastCompletedInput.value = getQuickRelativeDate(7);
    });
  });

  // Quick Date Chips in Custom Date Modal
  document.querySelectorAll('.modal-card [data-set-custom-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-set-custom-date');
      if (type === 'today') customCompletionDateInput.value = getTodayISO();
      if (type === 'yesterday') customCompletionDateInput.value = getQuickRelativeDate(1);
      if (type === '2days') customCompletionDateInput.value = getQuickRelativeDate(2);
    });
  });

  // Search input
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value.trim();
    clearSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
    renderHabits();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderHabits();
  });

  // Sort
  sortBySelect.addEventListener('change', () => {
    currentSortBy = sortBySelect.value;
    renderHabits();
  });

  // View Switcher (Card vs Table)
  if (viewToggleGroup) {
    viewToggleGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-toggle-btn');
      if (!btn) return;
      const mode = btn.getAttribute('data-view-mode');
      if (mode && mode !== currentViewMode) {
        currentViewMode = mode;
        try {
          localStorage.setItem(VIEW_STORAGE_KEY, currentViewMode);
        } catch (err) {}
        renderHabits();
      }
    });
  }

  // Backup: Download JSON
  downloadBackupBtn.addEventListener('click', () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      habits: habits
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhythms_backup_${getTodayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded successfully.', 'success');
  });

  // Backup: Import JSON
  triggerImportBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed.habits)) {
          habits = parsed.habits;
        } else if (Array.isArray(parsed)) {
          habits = parsed;
        } else {
          throw new Error('Invalid JSON format');
        }

        saveHabits();
        renderHabits();
        closeModal(dataModal);
        showToast('Habits successfully imported!', 'success');
      } catch (err) {
        alert('Failed to parse JSON file. Please ensure it is a valid Rhythms backup.');
      }
      importFileInput.value = '';
    };
    reader.readAsText(file);
  });

  // Reset Data
  resetDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all data? Your habits will be replaced with defaults.')) {
      habits = getSampleHabits();
      saveHabits();
      renderHabits();
      closeModal(dataModal);
      showToast('Data reset to default habits.', 'normal');
    }
  });

  // --- INIT ---
  function init() {
    updateHeaderDate();
    updateHeaderCompact();
    if (!supportsScrollTimeline) {
      window.addEventListener('scroll', updateHeaderCompact, { passive: true });
    }
    loadHabits();
    renderHabits();

    // Auto-update header date and re-render daily or when tab is refocused
    window.addEventListener('focus', () => {
      updateHeaderDate();
      renderHabits();
    });

    // PWA: register the service worker over http(s) only, so direct
    // file:// usage keeps working without errors.
    if ('serviceWorker' in navigator &&
        (location.protocol === 'http:' || location.protocol === 'https:')) {
      // When an updated worker takes control of an already-controlled page,
      // reload once so the fresh files (CSS/HTML/JS) replace the cached copy
      // instead of lingering until a manual restart. Skipped on first install
      // (page had no controller at load) to avoid a pointless reload loop.
      const controlledAtLoad = !!navigator.serviceWorker.controller;
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing || !controlledAtLoad) return;
        refreshing = true;
        window.location.reload();
      });
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('Service worker registration failed:', err);
        });
      });
    }
  }

  init();
})();
