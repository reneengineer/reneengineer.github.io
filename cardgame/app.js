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

  // Constants
  MIN_CARDS_PER_LEVEL: 15,
  MIN_CARDS_BONUS: 12,
  WILDCARD_FREQUENCY: 5,
  LEVELS: ['level1', 'level2', 'level3'],

  // ============ INIT ============
  init() {
    this.loadProgress();
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

    if (current) current.classList.remove('active');
    next.classList.add('active');
    this.currentScreen = screenId;

    switch (screenId) {
      case 'level-intro': this.setupLevelIntro(data); break;
      case 'game': this.setupGame(); break;
      case 'level-complete': this.setupLevelComplete(); break;
      case 'final-card': this.setupFinalCard(); break;
      case 'end': this.setupEnd(); break;
    }
  },

  // ============ LEVEL INTRO ============
  setupLevelIntro(level) {
    if (level) this.currentLevel = level;
    const data = QUESTIONS[this.currentLevel];

    const isBonus = this.currentLevel === 'bonus';
    const levelNum = isBonus ? '' : this.currentLevel.replace('level', '');

    document.getElementById('li-badge').textContent = isBonus ? 'Bonus' : `Level ${levelNum}`;
    document.getElementById('li-name').textContent = data.name;
    document.getElementById('li-name').style.color = data.color;
    document.getElementById('li-subtitle').textContent = data.subtitle;
    document.getElementById('li-count').textContent = `${data.cards.length} cards`;

    // Show bonus description if present
    const descEl = document.getElementById('li-description');
    if (data.description) {
      descEl.textContent = data.description;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }
  },

  // ============ GAME SETUP ============
  setupGame() {
    const data = QUESTIONS[this.currentLevel];
    const isBonus = this.currentLevel === 'bonus';

    this.deck = isBonus ? this.buildBonusDeck(data) : this.buildDeck(data);
    this.cardIndex = 0;
    this.cardsPlayed = 0;
    this.digDeepersLeft = isBonus ? 0 : 1;
    this.isFlipped = false;

    const tag = document.getElementById('game-level-tag');
    tag.textContent = data.name;
    tag.style.color = data.color;

    this.updateProgress();
    this.updateDigButton();
    this.updateNextLevelButton();
    this.showCard();
  },

  buildDeck(levelData) {
    const cards = [];
    const questions = this.shuffle([...levelData.cards]);
    const wildcards = this.shuffle([...QUESTIONS.wildcards]);
    let wcIndex = 0;

    questions.forEach((q, i) => {
      cards.push({ type: 'question', text: q, color: levelData.color, colorLight: levelData.colorLight });
      if ((i + 1) % this.WILDCARD_FREQUENCY === 0 && wcIndex < wildcards.length) {
        cards.push({ type: 'wildcard', text: wildcards[wcIndex].text });
        wcIndex++;
      }
    });

    return cards;
  },

  buildBonusDeck(levelData) {
    // 36 Questions are played in order (not shuffled) — that's how the experiment works
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

    container.classList.remove('flipped');
    this.isFlipped = false;

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
        const isBonus = this.currentLevel === 'bonus';
        const levelNum = isBonus ? '' : this.currentLevel.replace('level', '');
        typeLabel.textContent = isBonus ? 'Bonus' : `Level ${levelNum}`;
      }
      typeLabel.style.color = card.color;
      numberEl.style.color = card.color;
    }

    question.textContent = card.text;
    numberEl.textContent = `${this.cardsPlayed + 1}`;

    container.classList.remove('dealing');
    void container.offsetWidth;
    container.classList.add('dealing');

    this.updateProgress();
    this.updateNextLevelButton();
  },

  flipCard() {
    if (this.isAnimating) return;
    const container = document.getElementById('card-container');

    if (!this.isFlipped) {
      container.classList.add('flipped');
      this.isFlipped = true;
    } else {
      this.nextCard();
    }
  },

  nextCard() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    this.cardsPlayed++;
    this.totalCardsPlayed++;
    this.cardIndex++;

    setTimeout(() => {
      this.showCard();
      this.isAnimating = false;
    }, 150);
  },

  // ============ DIG DEEPER ============
  playDigDeeper() {
    if (this.digDeepersLeft <= 0 || this.isAnimating) return;
    this.digDeepersLeft--;
    this.updateDigButton();

    const prompts = QUESTIONS.digDeeper;
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];

    this.deck.splice(this.cardIndex + 1, 0, { type: 'dig-deeper', text: prompt });
    this.nextCard();
  },

  updateDigButton() {
    const btn = document.getElementById('dig-btn');
    if (this.currentLevel === 'bonus') {
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
    const isBonus = this.currentLevel === 'bonus';
    const minCards = isBonus ? this.MIN_CARDS_BONUS : this.MIN_CARDS_PER_LEVEL;

    if (this.cardsPlayed >= minCards) {
      btn.style.display = 'flex';
      if (this.currentLevel === 'level3') {
        btn.textContent = 'Final Card';
      } else if (isBonus) {
        btn.textContent = 'Final Card';
      } else {
        btn.textContent = 'Next Level';
      }
    } else {
      btn.style.display = 'none';
    }
  },

  advanceLevel() {
    if (this.currentLevel === 'level3') {
      this.showScreen('level-complete');
    } else if (this.currentLevel === 'bonus') {
      this.showScreen('final-card');
    } else {
      this.showScreen('level-complete');
    }
  },

  completeLevelForced() {
    if (this.currentLevel === 'bonus') {
      this.showScreen('final-card');
    } else if (this.currentLevel === 'level3') {
      this.showScreen('level-complete');
    } else {
      this.showScreen('level-complete');
    }
  },

  // ============ LEVEL COMPLETE ============
  setupLevelComplete() {
    const data = QUESTIONS[this.currentLevel];
    document.getElementById('lc-title').textContent = `${data.name} complete`;
    document.getElementById('lc-title').style.color = data.color;
    document.getElementById('lc-cards-num').textContent = this.cardsPlayed;

    const nextBtn = document.getElementById('lc-next-btn');
    const bonusBtn = document.getElementById('lc-bonus-btn');
    const finalBtn = document.getElementById('lc-final-btn');

    if (this.currentLevel === 'level3') {
      // After level 3: show bonus option and final card option
      nextBtn.style.display = 'none';
      bonusBtn.style.display = 'inline-block';
      finalBtn.style.display = 'inline-block';
      document.getElementById('lc-subtitle').textContent = 'You made it through all three levels. You can play the bonus round or go to the final card.';
    } else {
      // After level 1 or 2: show next level
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
    document.getElementById('final-prompt').textContent = QUESTIONS.finalCard.prompt;
    document.getElementById('note-input').value = '';
    this.saveProgress();
  },

  saveNote() {
    const note = document.getElementById('note-input').value.trim();
    if (note) {
      const notes = JSON.parse(localStorage.getItem('betweenUs_notes') || '[]');
      notes.push({ text: note, date: new Date().toISOString() });
      localStorage.setItem('betweenUs_notes', JSON.stringify(notes));
    }
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

    this.showScreen('menu');
  },

  // ============ PROGRESS ============
  updateProgress() {
    const total = QUESTIONS[this.currentLevel].cards.length;
    document.getElementById('game-progress').textContent = `${this.cardsPlayed} / ${total}`;
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
    this.showScreen('welcome');
  },

  // ============ UTILITIES ============
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // ============ EVENTS ============
  bindEvents() {
    document.getElementById('start-btn').addEventListener('click', () => {
      this.showScreen('level-intro', 'level1');
    });

    document.getElementById('continue-btn').addEventListener('click', () => {
      if (this.currentLevel) this.showScreen('level-intro', this.currentLevel);
    });

    document.getElementById('begin-level-btn').addEventListener('click', () => {
      this.showScreen('game');
    });

    document.getElementById('card-container').addEventListener('click', () => {
      this.flipCard();
    });

    document.getElementById('dig-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.playDigDeeper();
    });

    document.getElementById('next-level-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.advanceLevel();
    });

    document.getElementById('lc-next-btn').addEventListener('click', () => {
      this.goToNextLevel();
    });

    document.getElementById('lc-bonus-btn').addEventListener('click', () => {
      this.goToBonus();
    });

    document.getElementById('lc-final-btn').addEventListener('click', () => {
      this.goToFinalCard();
    });

    document.getElementById('save-note-btn').addEventListener('click', () => {
      this.saveNote();
    });

    document.getElementById('skip-note-btn').addEventListener('click', () => {
      this.showScreen('end');
    });

    document.getElementById('play-again-btn').addEventListener('click', () => {
      this.resetGame();
    });

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

    document.getElementById('menu-restart').addEventListener('click', () => {
      this.resetGame();
    });

    document.getElementById('menu-close').addEventListener('click', () => {
      this.showScreen('game');
    });

    // Prevent zoom on double tap (iOS)
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    }, { passive: false });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
