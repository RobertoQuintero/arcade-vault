// Motor puro de Asteroids, portado de references/started-games/02-asteroids/game.js

import type { SkinName } from "@/components/games/skins";
export type { SkinName };

// ── Skins ────────────────────────────────────────────────────────────────────
export interface Skin {
  background: string;
  ship: string;
  thrust: string;
  bullet: string;
  asteroid: string;
  particle: string; // base rgb (sin alpha) para el fade de partículas
  powerUp: string;
  hudText: string;
  hudAccent: string;
  overlayTitle: string;
  overlaySubtitle: string;
  glow: boolean;
  glowBlur: number;
}

export const SKINS: Record<SkinName, Skin> = {
  clasico: {
    background: "#000000",
    ship: "#ffffff",
    thrust: "rgba(255, 130, 0, 0.85)",
    bullet: "#ffffff",
    asteroid: "#ffffff",
    particle: "255,255,255",
    powerUp: "#00ffff",
    hudText: "#ffffff",
    hudAccent: "#00ffff",
    overlayTitle: "#ffffff",
    overlaySubtitle: "rgba(255,255,255,0.65)",
    glow: false,
    glowBlur: 0,
  },
  neon: {
    background: "#05030a",
    ship: "#00f5ff",
    thrust: "rgba(255, 176, 0, 0.9)",
    bullet: "#39ff14",
    asteroid: "#ff2fd0",
    particle: "255,111,255",
    powerUp: "#ffe600",
    hudText: "#00f5ff",
    hudAccent: "#ffe600",
    overlayTitle: "#ff2fd0",
    overlaySubtitle: "#00f5ff",
    glow: true,
    glowBlur: 12,
  },
  retro: {
    background: "#0a0600",
    ship: "#ffb000",
    thrust: "rgba(255, 176, 0, 0.6)",
    bullet: "#ffb000",
    asteroid: "#ffb000",
    particle: "255,176,0",
    powerUp: "#33ff33",
    hudText: "#ffb000",
    hudAccent: "#33ff33",
    overlayTitle: "#ffb000",
    overlaySubtitle: "rgba(255,176,0,0.75)",
    glow: false,
    glowBlur: 0,
  },
};

export const wrap = (v: number, max: number): number => ((v % max) + max) % max;
export const dist = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);
export const randInt = (min: number, max: number): number =>
  Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  dead: boolean;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt: number, width: number, height: number): void {
    this.x = wrap(this.x + this.vx * dt, width);
    this.y = wrap(this.y + this.vy * dt, height);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin): void {
    ctx.fillStyle = skin.bullet;
    if (skin.glow) {
      ctx.shadowBlur = skin.glowBlur;
      ctx.shadowColor = skin.bullet;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
export const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
export const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
export const POINTS = [0, 100, 50, 20]; // puntos por tamaño

export class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead: boolean;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number, width: number, height: number): void {
    this.x = wrap(this.x + this.vx * dt, width);
    this.y = wrap(this.y + this.vy * dt, height);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = skin.asteroid;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    if (skin.glow) {
      ctx.shadowBlur = skin.glowBlur;
      ctx.shadowColor = skin.asteroid;
    }
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead: boolean;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.dead = false;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin): void {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(${skin.particle},${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;

export class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ttl: number;
  dead: boolean;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 12;
    this.ttl = POWERUP_TTL;
    this.dead = false;
  }

  update(dt: number, width: number, height: number): void {
    this.x = wrap(this.x + this.vx * dt, width);
    this.y = wrap(this.y + this.vy * dt, height);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin): void {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = skin.powerUp;
    ctx.lineWidth = 2;
    if (skin.glow) {
      ctx.shadowBlur = skin.glowBlur;
      ctx.shadowColor = skin.powerUp;
    }
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = skin.powerUp;
    if (skin.glow) {
      ctx.shadowBlur = skin.glowBlur;
      ctx.shadowColor = skin.powerUp;
    }
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
    ctx.shadowBlur = 0;
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
const TRIPLE_SPREAD = 0.18;

export class Ship {
  x = 0;
  y = 0;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;
  tripleShot: number;

  constructor(width: number, height: number) {
    this.tripleShot = 0;
    this.reset(width, height);
  }

  reset(width: number, height: number): void {
    this.x = width / 2;
    this.y = height / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(
    dt: number,
    keys: Record<string, boolean>,
    width: number,
    height: number,
  ): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, width);
    this.y = wrap(this.y + this.vy * dt, height);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, skin: Skin): void {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.ship;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    if (skin.glow) {
      ctx.shadowBlur = skin.glowBlur;
      ctx.shadowColor = skin.ship;
    }

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = skin.thrust;
      if (skin.glow) {
        ctx.shadowBlur = skin.glowBlur;
        ctx.shadowColor = skin.thrust;
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Motor del juego ──────────────────────────────────────────────────────────
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class AsteroidsEngine {
  private width: number;
  private height: number;
  private ship: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: EngineState = "playing";
  private deadTimer = 0;
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  private skin: Skin = SKINS.clasico;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ship = new Ship(width, height);
    this.initGame();
  }

  setSkin(name: SkinName): void {
    this.skin = SKINS[name];
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setKey(code: string, down: boolean): void {
    if (down && !this.keys[code]) this.justPressed[code] = true;
    this.keys[code] = down;
  }

  forceGameOver(): void {
    this.state = "gameover";
  }

  getSnapshot(): EngineSnapshot {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.state,
    };
  }

  private consumePressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }

  private spawnAsteroids(count: number): void {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      do {
        x = rand(0, this.width);
        y = rand(0, this.height);
      } while (Math.hypot(x - this.width / 2, y - this.height / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private initGame(): void {
    this.ship = new Ship(this.width, this.height);
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.spawnAsteroids(4);
  }

  private nextLevel(): void {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset(this.width, this.height);
    this.spawnAsteroids(3 + this.level);
  }

  private explode(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private killShip(): void {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
    } else {
      this.state = "dead";
      this.deadTimer = 2;
    }
  }

  update(dt: number): void {
    if (this.state === "gameover") {
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      return;
    }

    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.asteroids.forEach((a) => a.update(dt, this.width, this.height));
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset(this.width, this.height);
      }
      return;
    }

    if (this.consumePressed("Space")) {
      this.bullets.push(...this.ship.tryShoot());
    }

    this.ship.update(dt, this.keys, this.width, this.height);
    this.bullets.forEach((b) => b.update(dt, this.width, this.height));
    this.asteroids.forEach((a) => a.update(dt, this.width, this.height));
    this.particles.forEach((p) => p.update(dt));
    this.powerUps.forEach((p) => p.update(dt, this.width, this.height));

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed = this.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();
  }

  private drawLifeIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = this.skin.hudText;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.skin.hudText;
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${this.score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, this.width / 2, 26);

    for (let i = 0; i < this.lives; i++)
      this.drawLifeIcon(ctx, this.width - 16 - i * 22, 18);

    if (this.ship.tripleShot > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = this.skin.hudAccent;
      ctx.fillText(`3x  ${this.ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
  }

  private drawOverlay(
    ctx: CanvasRenderingContext2D,
    title: string,
    sub: string,
  ): void {
    ctx.textAlign = "center";
    ctx.fillStyle = this.skin.overlayTitle;
    ctx.font = "bold 46px monospace";
    if (this.skin.glow) {
      ctx.shadowBlur = this.skin.glowBlur * 1.5;
      ctx.shadowColor = this.skin.overlayTitle;
    }
    ctx.fillText(title, this.width / 2, this.height / 2 - 18);
    ctx.shadowBlur = 0;
    ctx.font = "18px monospace";
    ctx.fillStyle = this.skin.overlaySubtitle;
    ctx.fillText(sub, this.width / 2, this.height / 2 + 22);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.skin.background;
    ctx.fillRect(0, 0, this.width, this.height);

    this.particles.forEach((p) => p.draw(ctx, this.skin));
    this.asteroids.forEach((a) => a.draw(ctx, this.skin));
    this.powerUps.forEach((p) => p.draw(ctx, this.skin));
    this.bullets.forEach((b) => b.draw(ctx, this.skin));
    this.ship.draw(ctx, this.skin);

    this.drawHUD(ctx);

    if (this.state === "gameover") {
      this.drawOverlay(ctx, "GAME OVER", `PUNTAJE: ${this.score}`);
    }
  }
}
