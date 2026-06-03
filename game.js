// Pacman Floral / Bee Collector Mini-game
class FlowerGame {
  constructor(canvasId, onScoreChange, onGameOver) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.onScoreChange = onScoreChange;
    this.onGameOver = onGameOver;
    
    this.score = 0;
    this.gameActive = false;
    
    // Player settings (The Bee 🐝)
    this.player = {
      x: 0,
      y: 0,
      size: 24,
      speed: 4,
      targetX: 0,
      targetY: 0
    };

    this.flowers = []; // Items to collect 🌸
    this.enemies = []; // Obstacles to avoid (weeds/spiders 🕷️)
    this.particles = []; // Sparkles on collect

    this.maxFlowers = 5;
    this.maxEnemies = 3;
    
    this.boundLoop = this.loop.bind(this);
    this.resizeCanvas();
    this.initControls();
  }

  resizeCanvas() {
    // Dynamic resizing based on container
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = Math.min(rect.width, 360);
    this.canvas.height = Math.min(rect.height || 400, 360);
    this.resetEntities();
  }

  resetEntities() {
    this.player.x = this.canvas.width / 2;
    this.player.y = this.canvas.height / 2;
    this.player.targetX = this.player.x;
    this.player.targetY = this.player.y;
    this.flowers = [];
    this.enemies = [];
    this.particles = [];
    this.score = 0;

    // Spawn initial flowers
    for (let i = 0; i < this.maxFlowers; i++) {
      this.spawnFlower();
    }
  }

  spawnFlower() {
    this.flowers.push({
      x: Math.random() * (this.canvas.width - 30) + 15,
      y: Math.random() * (this.canvas.height - 30) + 15,
      r: 10 + Math.random() * 5,
      color: `hsl(${Math.random() * 360}, 85%, 65%)`,
      pulse: Math.random() * Math.PI
    });
  }

  spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { // Top
      x = Math.random() * this.canvas.width;
      y = -20;
    } else if (edge === 1) { // Right
      x = this.canvas.width + 20;
      y = Math.random() * this.canvas.height;
    } else if (edge === 2) { // Bottom
      x = Math.random() * this.canvas.width;
      y = this.canvas.height + 20;
    } else { // Left
      x = -20;
      y = Math.random() * this.canvas.height;
    }

    const angle = Math.atan2(this.player.y - y, this.player.x - x);
    this.enemies.push({
      x,
      y,
      size: 16,
      vx: Math.cos(angle) * (1.2 + Math.random() * 1.5),
      vy: Math.sin(angle) * (1.2 + Math.random() * 1.5),
      color: '#ef4444' // Red spider/weed
    });
  }

  initControls() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (!this.gameActive) return;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp' || e.key === 'w') dy = -this.player.speed * 2.5;
      if (e.key === 'ArrowDown' || e.key === 's') dy = this.player.speed * 2.5;
      if (e.key === 'ArrowLeft' || e.key === 'a') dx = -this.player.speed * 2.5;
      if (e.key === 'ArrowRight' || e.key === 'd') dx = this.player.speed * 2.5;

      this.player.x = Math.max(15, Math.min(this.canvas.width - 15, this.player.x + dx));
      this.player.y = Math.max(15, Math.min(this.canvas.height - 15, this.player.y + dy));
    });

    // Touch / click controls for mobile navigation
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.player.targetX = touch.clientX - rect.left;
      this.player.targetY = touch.clientY - rect.top;
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.player.targetX = touch.clientX - rect.left;
      this.player.targetY = touch.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.player.targetX = e.clientX - rect.left;
      this.player.targetY = e.clientY - rect.top;
      this.isMouseDown = true;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      const rect = this.canvas.getBoundingClientRect();
      this.player.targetX = e.clientX - rect.left;
      this.player.targetY = e.clientY - rect.top;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });
  }

  start() {
    if (this.gameActive) return;
    this.gameActive = true;
    this.resetEntities();
    this.onScoreChange(this.score);
    requestAnimationFrame(this.boundLoop);
  }

  stop() {
    this.gameActive = false;
  }

  spawnParticle(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: Math.random() * 3 + 2,
        alpha: 1,
        color
      });
    }
  }

  loop() {
    if (!this.gameActive) return;

    this.update();
    this.draw();

    requestAnimationFrame(this.boundLoop);
  }

  update() {
    // Smoothly slide player towards target on mobile touch
    const dx = this.player.targetX - this.player.x;
    const dy = this.player.targetY - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      this.player.x += (dx / dist) * this.player.speed;
      this.player.y += (dy / dist) * this.player.speed;
    }

    // Keep in bounds
    this.player.x = Math.max(12, Math.min(this.canvas.width - 12, this.player.x));
    this.player.y = Math.max(12, Math.min(this.canvas.height - 12, this.player.y));

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.04;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update flowers
    this.flowers.forEach(f => {
      f.pulse += 0.05;
      
      // Collision with player
      const dist = Math.hypot(this.player.x - f.x, this.player.y - f.y);
      if (dist < this.player.size / 2 + f.r) {
        // Collect!
        this.score += 10;
        this.onScoreChange(this.score);
        this.spawnParticle(f.x, f.y, f.color);
        
        // Play arcade click sound using Web Audio API if available
        if (window.playArcadeSound) window.playArcadeSound('collect');

        // Reposition flower
        f.x = Math.random() * (this.canvas.width - 30) + 15;
        f.y = Math.random() * (this.canvas.height - 30) + 15;
        f.color = `hsl(${Math.random() * 360}, 85%, 65%)`;

        // Increase difficulty
        if (this.score % 40 === 0 && this.enemies.length < this.maxEnemies + 5) {
          this.spawnEnemy();
        }
      }
    });

    // Spawn enemies randomly
    if (this.enemies.length < this.maxEnemies && Math.random() < 0.015) {
      this.spawnEnemy();
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;

      // Wrap-around or delete if out of bounds for too long
      if (enemy.x < -40 || enemy.x > this.canvas.width + 40 || enemy.y < -40 || enemy.y > this.canvas.height + 40) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Collision with player
      const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
      if (dist < this.player.size / 2 + enemy.size / 2) {
        // Game Over!
        this.gameActive = false;
        if (window.playArcadeSound) window.playArcadeSound('hit');
        this.onGameOver(this.score);
        return;
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background grid lines (arcade look)
    this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
    this.ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Draw target pointer (where finger is holding)
    if (this.isMouseDown || (this.player.targetX !== this.player.x && Math.abs(this.player.targetX - this.player.x) > 10)) {
      this.ctx.strokeStyle = 'rgba(236, 72, 153, 0.2)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.arc(this.player.targetX, this.player.targetY, 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Draw particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Draw flowers 🌸
    this.flowers.forEach(f => {
      this.ctx.save();
      const scale = 1 + Math.sin(f.pulse) * 0.12;
      this.ctx.translate(f.x, f.y);
      this.ctx.scale(scale, scale);

      // Flower petals
      this.ctx.fillStyle = f.color;
      for (let i = 0; i < 5; i++) {
        this.ctx.beginPath();
        this.ctx.arc(0, -f.r/1.8, f.r/1.8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.rotate((Math.PI * 2) / 5);
      }
      // Center
      this.ctx.fillStyle = '#fef08a'; // Yellow center
      this.ctx.beginPath();
      this.ctx.arc(0, 0, f.r / 2.2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });

    // Draw enemies (Spiders / thorns 🕷️)
    this.enemies.forEach(e => {
      this.ctx.fillStyle = e.color;
      this.ctx.beginPath();
      // Draw a spike ball
      this.ctx.arc(e.x, e.y, e.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw small spikes
      this.ctx.strokeStyle = e.color;
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        this.ctx.beginPath();
        this.ctx.moveTo(e.x, e.y);
        this.ctx.lineTo(e.x + Math.cos(angle) * (e.size * 0.9), e.y + Math.sin(angle) * (e.size * 0.9));
        this.ctx.stroke();
      }
    });

    // Draw player (Bee 🐝)
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    
    // Face direction towards movement
    const dx = this.player.targetX - this.player.x;
    if (dx < -5) this.ctx.scale(-1, 1);

    // Wings
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.beginPath();
    this.ctx.ellipse(-2, -10, 6, 12, Math.PI/4, 0, Math.PI*2);
    this.ctx.ellipse(4, -8, 5, 10, -Math.PI/4, 0, Math.PI*2);
    this.ctx.fill();

    // Body (Yellow/Black stripes)
    this.ctx.fillStyle = '#f59e0b'; // Amber yellow
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI*2);
    this.ctx.fill();

    // Stripes
    this.ctx.fillStyle = '#1e1b4b'; // Dark blue/black
    this.ctx.fillRect(-6, -10, 3, 20);
    this.ctx.fillRect(1, -11, 3, 22);

    // Eye
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(7, -3, 3, 0, Math.PI*2);
    this.ctx.fill();
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(8, -3, 1.5, 0, Math.PI*2);
    this.ctx.fill();

    // Cheek
    this.ctx.fillStyle = '#f43f5e';
    this.ctx.beginPath();
    this.ctx.arc(6, 2, 2, 0, Math.PI*2);
    this.ctx.fill();

    this.ctx.restore();
  }
}
window.FlowerGame = FlowerGame;
