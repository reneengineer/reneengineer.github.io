const App = {
  // State
  currentLevel: null,
  currentScreen: null,
  deck: [],
  cardIndex: 0,
  cardsPlayed: 0,
  digDeepersLeft: 1,
  totalCardsPlayed: 0,
  isFlipped: false,
  isAnimating: false,

  // New feature state
  favorites: [],
  playedCards: {},
  customQuestions: [],
  quickPlayMode: false,
  ambientPlaying: false,
  soundEnabled: true,
  screenDimmed: false,
  audioCtx: null,
  ambientAudio: null,
  timerInterval: null,
  timerSeconds: 0,
  finalCardTurn: 1,
  tempNote: null,
  tempName: null,
  swiped: false,
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  previousScreen: null,
  gameSetUp: false,
  swipeHintShown: false,

  // Constants
  MIN_CARDS_PER_LEVEL: 15,
  MIN_CARDS_BONUS: 12,
  MIN_CARDS_QUICK: 5,
  WILDCARD_FREQUENCY: 5,
  LEVELS: ['level1', 'level2', 'level3'],

  // ============ INIT ============
  init() {
    this.loadProgress();
    this.loadFavorites();
    this.loadPlayedCards();
    this.loadCustomQuestions();
    this.loadSettings();
    this.swipeHintShown = localStorage.getItem('betweenUs_swipeHint') === 'true';
    this.bindEvents();

    const continueBtn = document.getElementById('continue-btn');
    if (this.currentLevel) {
      continueBtn.style.display = 'inline-block';
    }

    this.showScreen('welcome');
  },

  // ============ NAVIGATION ============
  showScreen(screenId, data) {
    const current = document.querySelector('.screen.active');
    const next = document.getElementById(screenId);

    if (current) {
      this.previousScreen = current.id;
      current.classList.remove('active');
    }
    next.classList.add('active');
    this.currentScreen = screenId;

    switch (screenId) {
      case 'welcome': this.updateWelcomeMusicBtn(); break;
      case 'level-intro': this.setupLevelIntro(data); break;
      case 'game': if (!this.gameSetUp) this.setupGame(); break;
      case 'level-complete': this.setupLevelComplete(); break;
      case 'final-card': this.setupFinalCard(); break;
      case 'end': this.setupEnd(); break;
      case 'notes-vault': this.renderNotesVault(); break;
      case 'favorites-screen': this.renderFavorites(); break;
      case 'custom-qs': this.renderCustomQuestions(); break;
    }
  },

  // ============ LEVEL INTRO ============
  setupLevelIntro(level) {
    if (level) this.currentLevel = level;
    const data = this.getLevelData();

    const isMainLevel = this.LEVELS.includes(this.currentLevel);
    const levelNum = isMainLevel ? this.currentLevel.replace('level', '') : '';

    document.getElementById('li-badge').textContent = isMainLevel ? `Level ${levelNum}` : (this.currentLevel === 'custom' ? 'Custom' : data.name);
    document.getElementById('li-name').textContent = data.name;
    document.getElementById('li-name').style.color = data.color;
    document.getElementById('li-subtitle').textContent = data.subtitle;
    document.getElementById('li-count').textContent = `${data.cards.length} cards`;

    const descEl = document.getElementById('li-description');
    if (data.description) {
      descEl.textContent = data.description;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
  },

  getLevelData() {
    if (this.currentLevel === 'custom') {
      return {
        name: "Custom",
        color: "#A29BFE",
        colorLight: "#D6CEFF",
        subtitle: "Questions from the heart.",
        cards: this.customQuestions
      };
    }
    return QUESTIONS[this.currentLevel];
  },

  // ============ GAME SETUP ============
  setupGame() {
    this.gameSetUp = true;
    const data = this.getLevelData();
    const isOrdered = this.currentLevel === 'bonus';
    const noWildcards = ['bonus', 'spicy', 'anniversary', 'custom'].includes(this.currentLevel);

    this.deck = isOrdered ? this.buildOrderedDeck(data) : this.buildDeck(data, !noWildcards);
    this.cardIndex = 0;
    this.cardsPlayed = 0;
    this.digDeepersLeft = noWildcards ? 0 : 1;
    this.isFlipped = false;
    this.hideTimer();

    const tag = document.getElementById('game-level-tag');
    tag.textContent = data.name;
    tag.style.color = data.color;

    // Set progress bar color
    document.getElementById('progress-fill').style.background = data.color;
    document.getElementById('progress-fill').style.color = data.color;

    this.updateProgress();
    this.updateDigButton();
    this.updateNextLevelButton();
    this.showCard();
  },

  buildDeck(levelData, includeWildcards) {
    const played = this.playedCards[this.currentLevel] || [];
    let available = levelData.cards.filter(q => !played.includes(q));

    // Reset if not enough unplayed cards
    const minNeeded = this.quickPlayMode ? this.MIN_CARDS_QUICK : this.MIN_CARDS_PER_LEVEL;
    if (available.length < minNeeded) {
      this.playedCards[this.currentLevel] = [];
      available = [...levelData.cards];
      this.savePlayedCards();
    }

    const cards = [];
    const questions = this.shuffle([...available]);
    const wildcards = includeWildcards ? this.shuffle([...QUESTIONS.wildcards]) : [];
    let wcIndex = 0;

    questions.forEach((q, i) => {
      cards.push({ type: 'question', text: q, color: levelData.color, colorLight: levelData.colorLight });
      if (includeWildcards && (i + 1) % this.WILDCARD_FREQUENCY === 0 && wcIndex < wildcards.length) {
        const wc = wildcards[wcIndex];
        cards.push({ type: 'wildcard', text: wc.text, timer: wc.timer || 0 });
        wcIndex++;
      }
    });

    return cards;
  },

  buildOrderedDeck(levelData) {
    return levelData.cards.map((q, i) => ({
      type: 'question',
      text: q,
      color: levelData.color,
      colorLight: levelData.colorLight,
      setLabel: i < 12 ? 'Set I' : i < 24 ? 'Set II' : 'Set III'
    }));
  },

  // ============ CARD DISPLAY ============
  showCard() {
    if (this.cardIndex >= this.deck.length) {
      this.completeLevelForced();
      return;
    }

    const card = this.deck[this.cardIndex];
    const container = document.getElementById('card-container');
    const front = document.getElementById('card-front');
    const question = document.getElementById('card-question');
    const typeLabel = document.getElementById('card-type-label');
    const numberEl = document.getElementById('card-number');

    // Reset to back face (no transition during reset)
    container.style.transition = 'none';
    container.classList.remove('flipped');
    container.classList.remove('hidden');
    this.isFlipped = false;

    // Set card back tint per level
    const cardBack = container.querySelector('.card-back');
    cardBack.className = 'card-face card-back';
    if (this.currentLevel) {
      cardBack.classList.add(`level-${this.currentLevel}`);
    }

    // Set card front content
    front.className = 'card-face card-front';

    if (card.type === 'wildcard') {
      front.classList.add('wildcard');
      front.style.borderColor = 'var(--gold)';
      front.style.background = 'linear-gradient(135deg, #1a1a2e, #16213e)';
      typeLabel.textContent = 'Wildcard';
      typeLabel.style.color = 'var(--gold)';
      numberEl.style.color = 'var(--gold)';
    } else if (card.type === 'dig-deeper') {
      front.classList.add('dig-deeper');
      front.style.borderColor = '#e74c3c';
      front.style.background = 'var(--surface)';
      typeLabel.textContent = 'Dig Deeper';
      typeLabel.style.color = '#e74c3c';
      numberEl.style.color = '#e74c3c';
    } else {
      front.style.borderColor = card.color;
      front.style.background = `linear-gradient(135deg, ${card.color}33, #151515)`;

      if (card.setLabel) {
        typeLabel.textContent = card.setLabel;
      } else {
        const isMainLevel = this.LEVELS.includes(this.currentLevel);
        const levelNum = isMainLevel ? this.currentLevel.replace('level', '') : '';
        typeLabel.textContent = isMainLevel ? `Level ${levelNum}` : this.getLevelData().name;
      }
      typeLabel.style.color = card.color;
      numberEl.style.color = card.color;
    }

    question.textContent = card.text;
    numberEl.textContent = `${this.cardsPlayed + 1}`;

    // Force layout, then re-enable transitions
    void container.offsetWidth;
    container.style.transition = '';

    this.updateProgress();
    this.updateNextLevelButton();
    this.updateFavButton();
    document.getElementById('share-btn').style.display = 'none';
    this.hideTimer();
  },

  flipCard() {
    if (this.isAnimating) return;
    const container = document.getElementById('card-container');

    if (!this.isFlipped) {
      // Flip to reveal question
      container.classList.add('flipped');
      this.isFlipped = true;
      this.haptic('light');
      this.playFlipSound();

      // Show share button now that there's a question visible
      document.getElementById('share-btn').style.display = 'flex';

      // Show swipe hint on first flip ever
      if (!this.swipeHintShown) {
        this.swipeHintShown = true;
        localStorage.setItem('betweenUs_swipeHint', 'true');
        const hint = document.getElementById('swipe-hint');
        hint.style.display = 'block';
        setTimeout(() => { hint.style.display = 'none'; }, 3200);
      }

      // Show timer if this is a timed wildcard
      const card = this.deck[this.cardIndex];
      if (card && card.timer) {
        this.showTimer(card.timer);
      }
    } else {
      // Tapped revealed card — go to next
      this.nextCard();
    }
  },

  nextCard() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // Mark card as played
    const card = this.deck[this.cardIndex];
    if (card && card.type === 'question') {
      this.markCardPlayed(card.text);
    }

    this.cardsPlayed++;
    this.totalCardsPlayed++;
    this.cardIndex++;

    const container = document.getElementById('card-container');

    // Fade out current card
    container.classList.add('hidden');
    this.haptic('light');

    // After fade out, swap content and fade in
    setTimeout(() => {
      this.showCard();
      requestAnimationFrame(() => {
        container.classList.remove('hidden');
        this.isAnimating = false;
      });
    }, 180);
  },

  // ============ DIG DEEPER ============
  playDigDeeper() {
    if (this.digDeepersLeft <= 0 || this.isAnimating) return;
    this.digDeepersLeft--;
    this.updateDigButton();
    this.haptic('medium');

    const prompts = QUESTIONS.digDeeper;
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];

    this.deck.splice(this.cardIndex + 1, 0, { type: 'dig-deeper', text: prompt });
    this.nextCard();
  },

  updateDigButton() {
    const btn = document.getElementById('dig-btn');
    const noWildcards = ['bonus', 'spicy', 'anniversary', 'custom'].includes(this.currentLevel);
    if (noWildcards) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = 'flex';
    if (this.digDeepersLeft <= 0) {
      btn.classList.add('used');
      btn.textContent = 'Dig Deeper (used)';
    } else {
      btn.classList.remove('used');
      btn.textContent = 'Dig Deeper';
    }
  },

  // ============ LEVEL PROGRESSION ============
  updateNextLevelButton() {
    const btn = document.getElementById('next-level-btn');
    const isMainLevel = this.LEVELS.includes(this.currentLevel);
    const isBonus = this.currentLevel === 'bonus';
    const minCards = this.quickPlayMode ? this.MIN_CARDS_QUICK : (isBonus ? this.MIN_CARDS_BONUS : this.MIN_CARDS_PER_LEVEL);

    if (this.cardsPlayed >= minCards) {
      btn.style.display = 'flex';
      if (isMainLevel && this.currentLevel !== 'level3') {
        btn.textContent = 'Next Level';
      } else {
        btn.textContent = 'Final Card';
      }
    } else {
      btn.style.display = 'none';
    }
  },

  advanceLevel() {
    this.haptic('medium');
    this.gameSetUp = false;
    if (this.LEVELS.includes(this.currentLevel)) {
      this.showScreen('level-complete');
    } else {
      this.showScreen('final-card');
    }
  },

  completeLevelForced() {
    this.gameSetUp = false;
    if (this.LEVELS.includes(this.currentLevel)) {
      this.showScreen('level-complete');
    } else {
      this.showScreen('final-card');
    }
  },

  // ============ LEVEL COMPLETE ============
  setupLevelComplete() {
    const data = this.getLevelData();
    document.getElementById('lc-title').textContent = `${data.name} complete`;
    document.getElementById('lc-title').style.color = data.color;
    document.getElementById('lc-cards-num').textContent = this.cardsPlayed;

    const nextBtn = document.getElementById('lc-next-btn');
    const bonusBtn = document.getElementById('lc-bonus-btn');
    const finalBtn = document.getElementById('lc-final-btn');

    if (this.currentLevel === 'level3') {
      nextBtn.style.display = 'none';
      bonusBtn.style.display = 'inline-block';
      finalBtn.style.display = 'inline-block';
      document.getElementById('lc-subtitle').textContent = 'You made it through all three levels. You can play the bonus round or go to the final card.';
    } else {
      const nextLevel = this.currentLevel === 'level1' ? 'level2' : 'level3';
      const nextData = QUESTIONS[nextLevel];
      nextBtn.textContent = `Begin ${nextData.name}`;
      nextBtn.style.display = 'inline-block';
      bonusBtn.style.display = 'none';
      finalBtn.style.display = 'none';
      document.getElementById('lc-subtitle').textContent = 'Take a breath. The next level goes deeper.';
    }

    this.saveProgress();
  },

  goToNextLevel() {
    const nextLevel = this.currentLevel === 'level1' ? 'level2' : 'level3';
    this.showScreen('level-intro', nextLevel);
  },

  goToBonus() {
    this.showScreen('level-intro', 'bonus');
  },

  goToFinalCard() {
    this.showScreen('final-card');
  },

  // ============ FINAL CARD ============
  setupFinalCard() {
    const prompts = QUESTIONS.finalCard.prompts;
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    document.getElementById('final-prompt').textContent = prompt;
    this.finalCardTurn = 1;
    this.tempNote = null;
    this.tempName = null;
    this.showFinalCardTurn();
    this.saveProgress();
  },

  showFinalCardTurn() {
    const label = document.getElementById('final-turn-label');
    const noteInput = document.getElementById('note-input');
    const nameInput = document.getElementById('note-name');
    const saveBtn = document.getElementById('save-note-btn');

    noteInput.value = '';
    nameInput.value = '';

    if (this.finalCardTurn === 1) {
      label.textContent = 'Player 1';
      noteInput.placeholder = 'Write your note...';
      nameInput.placeholder = 'Your name';
      saveBtn.innerHTML = 'Save &amp; Pass';
    } else {
      label.textContent = 'Player 2';
      noteInput.placeholder = 'Your turn — write your note...';
      nameInput.placeholder = 'Your name';
      saveBtn.textContent = 'Save';
    }
  },

  saveNote() {
    const note = document.getElementById('note-input').value.trim();
    const name = document.getElementById('note-name').value.trim();

    if (this.finalCardTurn === 1) {
      this.tempNote = note;
      this.tempName = name || 'Player 1';
      this.finalCardTurn = 2;
      this.showFinalCardTurn();
      this.haptic('light');
      return;
    }

    // Player 2 done — save both
    const p1Note = this.tempNote || '';
    const p1Name = this.tempName || 'Player 1';
    const p2Note = note;
    const p2Name = name || 'Player 2';

    if (p1Note || p2Note) {
      const notes = JSON.parse(localStorage.getItem('betweenUs_notes') || '[]');
      notes.push({
        player1: p1Note, name1: p1Name,
        player2: p2Note, name2: p2Name,
        date: new Date().toISOString()
      });
      localStorage.setItem('betweenUs_notes', JSON.stringify(notes));
    }

    this.tempNote = null;
    this.tempName = null;
    this.showScreen('end');
  },

  // ============ END SCREEN ============
  setupEnd() {
    document.getElementById('end-total').textContent = this.totalCardsPlayed;
    this.clearProgress();
  },

  // ============ MENU ============
  showMenu() {
    document.getElementById('menu-resume').style.display = this.currentLevel ? 'flex' : 'none';

    const levels = ['level1', 'level2', 'level3'];
    const currentIdx = levels.indexOf(this.currentLevel);
    const isBonusActive = this.currentLevel === 'bonus';

    document.getElementById('menu-l1').querySelector('.mi-right').textContent =
      this.currentLevel === 'level1' ? 'In progress' : (currentIdx > 0 || isBonusActive) ? 'Done' : '';
    document.getElementById('menu-l2').querySelector('.mi-right').textContent =
      this.currentLevel === 'level2' ? 'In progress' : (currentIdx > 1 || isBonusActive) ? 'Done' : '';
    document.getElementById('menu-l3').querySelector('.mi-right').textContent =
      this.currentLevel === 'level3' ? 'In progress' : isBonusActive ? 'Done' : '';
    document.getElementById('menu-bonus').querySelector('.mi-right').textContent =
      isBonusActive ? 'In progress' : '';

    // Update played cards count
    const playedTotal = this.getPlayedTotal();
    document.getElementById('played-count').textContent = playedTotal > 0 ? `${playedTotal} seen` : '';

    // Update toggle statuses
    this.updateToggleUI();

    // Show/hide custom play option
    const customCount = this.customQuestions.length;
    document.getElementById('menu-custom').querySelector('.mi-right').textContent =
      customCount > 0 ? `${customCount}` : '';

    this.showScreen('menu');
  },

  updateWelcomeMusicBtn() {
    const status = document.getElementById('welcome-music-status');
    status.textContent = this.ambientPlaying ? 'ON' : 'OFF';
    status.classList.toggle('on', this.ambientPlaying);
  },

  updateToggleUI() {
    const soundStatus = document.getElementById('sound-status');
    const dimStatus = document.getElementById('dim-status');
    const quickStatus = document.getElementById('quick-status');

    soundStatus.textContent = this.ambientPlaying ? 'ON' : 'OFF';
    soundStatus.classList.toggle('on', this.ambientPlaying);
    dimStatus.textContent = this.screenDimmed ? 'ON' : 'OFF';
    dimStatus.classList.toggle('on', this.screenDimmed);
    quickStatus.textContent = this.quickPlayMode ? 'ON' : 'OFF';
    quickStatus.classList.toggle('on', this.quickPlayMode);
  },

  // ============ PROGRESS ============
  updateProgress() {
    const total = this.getLevelData().cards.length;
    document.getElementById('game-progress').textContent = `${this.cardsPlayed} / ${total}`;

    // Update progress bar
    const pct = total > 0 ? (this.cardsPlayed / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = `${Math.min(pct, 100)}%`;
  },

  saveProgress() {
    localStorage.setItem('betweenUs_progress', JSON.stringify({
      currentLevel: this.currentLevel,
      totalCardsPlayed: this.totalCardsPlayed,
      timestamp: Date.now()
    }));
  },

  loadProgress() {
    const saved = localStorage.getItem('betweenUs_progress');
    if (saved) {
      const data = JSON.parse(saved);
      if (Date.now() - data.timestamp < 86400000) {
        this.currentLevel = data.currentLevel;
        this.totalCardsPlayed = data.totalCardsPlayed || 0;
      }
    }
  },

  clearProgress() {
    localStorage.removeItem('betweenUs_progress');
    this.currentLevel = null;
    this.totalCardsPlayed = 0;
  },

  resetGame() {
    this.clearProgress();
    this.currentLevel = null;
    this.cardIndex = 0;
    this.cardsPlayed = 0;
    this.totalCardsPlayed = 0;
    this.digDeepersLeft = 1;
    this.gameSetUp = false;
    this.hideTimer();
    this.showScreen('welcome');
  },

  // ============ FAVORITES ============
  toggleFavorite() {
    if (!this.isFlipped || !this.deck[this.cardIndex]) return;
    const card = this.deck[this.cardIndex];
    if (card.type !== 'question') return;

    const idx = this.favorites.findIndex(f => f.text === card.text);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
    } else {
      this.favorites.push({
        text: card.text,
        level: this.currentLevel,
        date: new Date().toISOString()
      });
    }
    this.saveFavorites();
    this.updateFavButton();
    this.haptic('light');
  },

  updateFavButton() {
    const btn = document.getElementById('fav-btn');
    if (!this.isFlipped || !this.deck[this.cardIndex] || this.deck[this.cardIndex].type !== 'question') {
      btn.classList.remove('is-fav');
      return;
    }
    const card = this.deck[this.cardIndex];
    const isFav = this.favorites.some(f => f.text === card.text);
    btn.classList.toggle('is-fav', isFav);
  },

  saveFavorites() {
    localStorage.setItem('betweenUs_favorites', JSON.stringify(this.favorites));
  },

  loadFavorites() {
    const saved = localStorage.getItem('betweenUs_favorites');
    if (saved) this.favorites = JSON.parse(saved);
  },

  renderFavorites() {
    const list = document.getElementById('fav-list');
    if (this.favorites.length === 0) {
      list.innerHTML = '<p class="empty-state">No favorites yet. Tap the heart while playing to save questions you love.</p>';
      return;
    }
    list.innerHTML = this.favorites.map((f, i) => {
      const levelName = f.level === 'custom' ? 'Custom' : (QUESTIONS[f.level] ? QUESTIONS[f.level].name : f.level);
      return `<div class="fav-card">
        <span class="fav-card-text">${this.escapeHtml(f.text)}</span>
        <span class="fav-card-level">${this.escapeHtml(levelName)}</span>
        <button class="fav-remove" data-idx="${i}">&times;</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.fav-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        this.favorites.splice(idx, 1);
        this.saveFavorites();
        this.renderFavorites();
      });
    });
  },

  // ============ PLAYED CARDS TRACKING ============
  markCardPlayed(text) {
    if (!this.currentLevel) return;
    if (!this.playedCards[this.currentLevel]) this.playedCards[this.currentLevel] = [];
    if (!this.playedCards[this.currentLevel].includes(text)) {
      this.playedCards[this.currentLevel].push(text);
      this.savePlayedCards();
    }
  },

  savePlayedCards() {
    localStorage.setItem('betweenUs_played', JSON.stringify(this.playedCards));
  },

  loadPlayedCards() {
    const saved = localStorage.getItem('betweenUs_played');
    if (saved) this.playedCards = JSON.parse(saved);
  },

  // ============ CUSTOM QUESTIONS ============
  addCustomQuestion() {
    const input = document.getElementById('custom-q-input');
    const text = input.value.trim();
    if (!text) return;
    this.customQuestions.push(text);
    this.saveCustomQuestions();
    input.value = '';
    this.renderCustomQuestions();
    this.haptic('light');
  },

  removeCustomQuestion(idx) {
    this.customQuestions.splice(idx, 1);
    this.saveCustomQuestions();
    this.renderCustomQuestions();
  },

  saveCustomQuestions() {
    localStorage.setItem('betweenUs_custom', JSON.stringify(this.customQuestions));
  },

  loadCustomQuestions() {
    const saved = localStorage.getItem('betweenUs_custom');
    if (saved) this.customQuestions = JSON.parse(saved);
  },

  renderCustomQuestions() {
    const list = document.getElementById('custom-q-list');
    const playBtn = document.getElementById('play-custom-btn');

    if (this.customQuestions.length === 0) {
      list.innerHTML = '<p class="empty-state">No custom questions yet. Add your own above.</p>';
      playBtn.style.display = 'none';
      return;
    }

    playBtn.style.display = 'inline-block';
    list.innerHTML = this.customQuestions.map((q, i) => {
      return `<div class="custom-q-card">
        <span class="custom-q-text">${this.escapeHtml(q)}</span>
        <button class="custom-q-remove" data-idx="${i}">&times;</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.custom-q-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.removeCustomQuestion(parseInt(e.target.dataset.idx));
      });
    });
  },

  // ============ NOTES VAULT ============
  renderNotesVault() {
    const notes = JSON.parse(localStorage.getItem('betweenUs_notes') || '[]');
    const list = document.getElementById('notes-list');

    if (notes.length === 0) {
      list.innerHTML = '<p class="empty-state">No notes yet. Complete the Final Card to save your first note.</p>';
      return;
    }

    list.innerHTML = notes.slice().reverse().map(n => {
      const date = new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Support old single-note format
      if (n.text) {
        return `<div class="note-card">
          <p class="note-text">${this.escapeHtml(n.text)}</p>
          <span class="note-date">${date}</span>
        </div>`;
      }

      const name1 = n.name1 || 'Player 1';
      const name2 = n.name2 || 'Player 2';
      const entries = [];
      if (n.player1) {
        entries.push(`<div class="note-entry">
          <div class="note-entry-label">${this.escapeHtml(name1)}</div>
          <p class="note-text">${this.escapeHtml(n.player1)}</p>
        </div>`);
      }
      if (n.player1 && n.player2) {
        entries.push('<div class="note-divider"></div>');
      }
      if (n.player2) {
        entries.push(`<div class="note-entry">
          <div class="note-entry-label">${this.escapeHtml(name2)}</div>
          <p class="note-text">${this.escapeHtml(n.player2)}</p>
        </div>`);
      }

      return `<div class="note-card">
        <div class="note-pair">${entries.join('')}</div>
        <span class="note-date">${date}</span>
      </div>`;
    }).join('');
  },

  // ============ TIMER ============
  showTimer(seconds) {
    this.timerSeconds = seconds;
    const overlay = document.getElementById('timer-overlay');
    const countEl = document.getElementById('timer-count');
    const progressEl = document.getElementById('timer-progress');
    const startBtn = document.getElementById('timer-start-btn');

    countEl.textContent = seconds;
    countEl.classList.remove('timer-done');
    progressEl.style.strokeDashoffset = '0';
    startBtn.style.display = 'inline-block';
    overlay.style.display = 'flex';
  },

  startTimer() {
    const seconds = this.timerSeconds;
    const countEl = document.getElementById('timer-count');
    const progressEl = document.getElementById('timer-progress');
    const startBtn = document.getElementById('timer-start-btn');
    const circumference = 283;

    startBtn.style.display = 'none';
    let remaining = seconds;
    countEl.textContent = remaining;

    this.timerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        countEl.textContent = 'Done';
        countEl.classList.add('timer-done');
        progressEl.style.strokeDashoffset = circumference;
        this.haptic('heavy');
        // Auto-hide after 2s
        setTimeout(() => this.hideTimer(), 2000);
        return;
      }
      countEl.textContent = remaining;
      const pct = 1 - (remaining / seconds);
      progressEl.style.strokeDashoffset = circumference * pct;
    }, 1000);
  },

  hideTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    document.getElementById('timer-overlay').style.display = 'none';
  },

  // ============ AUDIO ============
  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },

  playFlipSound() {
    if (!this.soundEnabled) return;
    try {
      this.initAudio();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Short filtered noise burst — soft card flip
      const bufferSize = Math.floor(ctx.sampleRate * 0.07);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);
    } catch (e) {
      // Audio not available, fail silently
    }
  },

  toggleAmbientSound() {
    if (this.ambientPlaying) {
      // Stop
      if (this.ambientAudio) {
        this.ambientAudio.pause();
        this.ambientAudio.currentTime = 0;
      }
      this.ambientPlaying = false;
    } else {
      // Start playing instrumental
      if (!this.ambientAudio) {
        this.ambientAudio = new Audio('ambient.mp3');
        this.ambientAudio.loop = true;
        this.ambientAudio.volume = 0.25;
      }
      this.ambientAudio.play().catch(() => {});
      this.ambientPlaying = true;
    }

    this.updateToggleUI();
    this.saveSettings();
  },

  // ============ HAPTIC FEEDBACK ============
  haptic(style) {
    if (!navigator.vibrate) return;
    switch (style) {
      case 'light': navigator.vibrate(10); break;
      case 'medium': navigator.vibrate(20); break;
      case 'heavy': navigator.vibrate([30, 50, 30]); break;
    }
  },

  // ============ SCREEN DIMMING ============
  toggleDim() {
    this.screenDimmed = !this.screenDimmed;
    document.body.classList.toggle('dimmed', this.screenDimmed);
    this.updateToggleUI();
    this.saveSettings();
  },

  // ============ QUICK PLAY ============
  toggleQuickPlay() {
    this.quickPlayMode = !this.quickPlayMode;
    this.updateToggleUI();
    this.saveSettings();
  },

  // ============ SETTINGS PERSISTENCE ============
  saveSettings() {
    localStorage.setItem('betweenUs_settings', JSON.stringify({
      quickPlayMode: this.quickPlayMode,
      screenDimmed: this.screenDimmed,
      soundEnabled: this.soundEnabled
    }));
  },

  loadSettings() {
    const saved = localStorage.getItem('betweenUs_settings');
    if (saved) {
      const s = JSON.parse(saved);
      this.quickPlayMode = s.quickPlayMode || false;
      this.screenDimmed = s.screenDimmed || false;
      this.soundEnabled = s.soundEnabled !== false;
      document.body.classList.toggle('dimmed', this.screenDimmed);
    }
  },

  // ============ SHARE ============
  shareQuestion() {
    if (!this.deck[this.cardIndex]) return;
    const card = this.deck[this.cardIndex];
    const text = card.text;
    const shareData = {
      title: 'Just the Two of Us',
      text: `"${text}" — from Just the Two of Us, a card game for two.`
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareData.text).then(() => {
        const btn = document.getElementById('share-btn');
        btn.textContent = '\u2713';
        setTimeout(() => { btn.innerHTML = '&#8599;'; }, 1500);
      }).catch(() => {});
    }
    this.haptic('light');
  },

  // ============ RESET PLAYED CARDS ============
  resetPlayedCards() {
    this.playedCards = {};
    this.savePlayedCards();
    this.haptic('medium');
    this.showMenu();
  },

  getPlayedTotal() {
    let total = 0;
    for (const level in this.playedCards) {
      total += this.playedCards[level].length;
    }
    return total;
  },

  // ============ UTILITIES ============
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ============ EVENTS ============
  bindEvents() {
    // Welcome
    document.getElementById('start-btn').addEventListener('click', () => {
      this.showScreen('level-intro', 'level1');
    });

    document.getElementById('continue-btn').addEventListener('click', () => {
      if (this.currentLevel) this.showScreen('level-intro', this.currentLevel);
    });

    document.getElementById('quick-start-btn').addEventListener('click', () => {
      this.quickPlayMode = true;
      this.saveSettings();
      this.showScreen('level-intro', 'level1');
    });

    document.getElementById('welcome-notes-btn').addEventListener('click', () => {
      this.showScreen('notes-vault');
    });

    document.getElementById('welcome-music-btn').addEventListener('click', () => {
      this.toggleAmbientSound();
      this.updateWelcomeMusicBtn();
    });

    // Level intro
    document.getElementById('begin-level-btn').addEventListener('click', () => {
      this.gameSetUp = false;
      this.showScreen('game');
    });

    // Card interaction
    document.getElementById('card-container').addEventListener('click', () => {
      if (this.swiped) {
        this.swiped = false;
        return;
      }
      this.flipCard();
    });

    // Swipe gestures
    const cardArea = document.querySelector('.card-area');
    cardArea.addEventListener('touchstart', (e) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = Date.now();
      this.swiped = false;
    }, { passive: true });

    cardArea.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      const dt = Date.now() - this.touchStartTime;

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
        if (this.isFlipped && dx < 0) {
          this.swiped = true;
          e.preventDefault();
          this.nextCard();
        }
      }
    }, { passive: false });

    // Game buttons
    document.getElementById('dig-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.playDigDeeper();
    });

    document.getElementById('next-level-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.advanceLevel();
    });

    document.getElementById('fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite();
    });

    document.getElementById('share-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.shareQuestion();
    });

    // Timer
    document.getElementById('timer-start-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.startTimer();
    });

    // Level complete
    document.getElementById('lc-next-btn').addEventListener('click', () => {
      this.goToNextLevel();
    });

    document.getElementById('lc-bonus-btn').addEventListener('click', () => {
      this.goToBonus();
    });

    document.getElementById('lc-final-btn').addEventListener('click', () => {
      this.goToFinalCard();
    });

    // Final card
    document.getElementById('save-note-btn').addEventListener('click', () => {
      this.saveNote();
    });

    document.getElementById('skip-note-btn').addEventListener('click', () => {
      if (this.finalCardTurn === 1) {
        // Player 1 skipped — move to player 2
        this.tempNote = '';
        this.tempName = 'Player 1';
        this.finalCardTurn = 2;
        this.showFinalCardTurn();
        this.haptic('light');
      } else {
        // Player 2 skipped — save whatever we have and end
        if (this.tempNote) {
          const notes = JSON.parse(localStorage.getItem('betweenUs_notes') || '[]');
          notes.push({
            player1: this.tempNote, name1: this.tempName || 'Player 1',
            player2: '', name2: 'Player 2',
            date: new Date().toISOString()
          });
          localStorage.setItem('betweenUs_notes', JSON.stringify(notes));
        }
        this.tempNote = null;
        this.tempName = null;
        this.showScreen('end');
      }
    });

    // End
    document.getElementById('play-again-btn').addEventListener('click', () => {
      this.resetGame();
    });

    // Menu
    document.getElementById('menu-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showMenu();
    });

    document.getElementById('menu-resume').addEventListener('click', () => {
      this.showScreen('game');
    });

    document.getElementById('menu-l1').addEventListener('click', () => {
      this.showScreen('level-intro', 'level1');
    });

    document.getElementById('menu-l2').addEventListener('click', () => {
      this.showScreen('level-intro', 'level2');
    });

    document.getElementById('menu-l3').addEventListener('click', () => {
      this.showScreen('level-intro', 'level3');
    });

    document.getElementById('menu-bonus').addEventListener('click', () => {
      this.showScreen('level-intro', 'bonus');
    });

    document.getElementById('menu-spicy').addEventListener('click', () => {
      this.showScreen('level-intro', 'spicy');
    });

    document.getElementById('menu-anniversary').addEventListener('click', () => {
      this.showScreen('level-intro', 'anniversary');
    });

    document.getElementById('menu-custom').addEventListener('click', () => {
      this.showScreen('custom-qs');
    });

    document.getElementById('menu-notes').addEventListener('click', () => {
      this.showScreen('notes-vault');
    });

    document.getElementById('menu-favorites').addEventListener('click', () => {
      this.showScreen('favorites-screen');
    });

    document.getElementById('menu-sound-toggle').addEventListener('click', () => {
      this.toggleAmbientSound();
    });

    document.getElementById('menu-dim-toggle').addEventListener('click', () => {
      this.toggleDim();
    });

    document.getElementById('menu-quick-toggle').addEventListener('click', () => {
      this.toggleQuickPlay();
    });

    document.getElementById('menu-reset-played').addEventListener('click', () => {
      if (confirm('Reset all played card history? Cards will repeat again.')) {
        this.resetPlayedCards();
      }
    });

    document.getElementById('menu-restart').addEventListener('click', () => {
      if (confirm('Start over? All current progress will be lost.')) {
        this.resetGame();
      }
    });

    document.getElementById('menu-close').addEventListener('click', () => {
      this.showScreen('game');
    });

    // Notes vault back
    document.getElementById('notes-back').addEventListener('click', () => {
      this.showScreen(this.previousScreen === 'welcome' ? 'welcome' : 'menu');
    });

    // Favorites back
    document.getElementById('fav-back').addEventListener('click', () => {
      this.showScreen('menu');
    });

    // Custom questions
    document.getElementById('add-custom-q').addEventListener('click', () => {
      this.addCustomQuestion();
    });

    document.getElementById('custom-q-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.addCustomQuestion();
      }
    });

    document.getElementById('play-custom-btn').addEventListener('click', () => {
      if (this.customQuestions.length >= 3) {
        this.showScreen('level-intro', 'custom');
      }
    });

    document.getElementById('custom-back').addEventListener('click', () => {
      this.showScreen('menu');
    });

    // Prevent zoom on double tap (iOS) — but allow in text inputs
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
      const tag = e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    }, { passive: false });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
