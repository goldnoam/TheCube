import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WeaponType, Vector, Player, Enemy, Projectile, Particle, Upgrades, WeaponStats, PowerUp, PowerUpType, HighScore } from '../types';

interface GameProps {
  onGameOver: (score: number) => void;
}

const GRAVITY = 0.5;
const PLAYER_SPEED_BASE = 5;
const JUMP_FORCE = -12;
const ENEMY_SPAWN_RATE_BASE = 0.015;
const ENERGY_REGEN_RATE = 0.4;
const LEVEL_DURATION = 30;
const RAY_ENERGY_BASE_COST = 2.5;

const INITIAL_WEAPON_STATS: Record<WeaponType, WeaponStats> = {
  [WeaponType.BRICK_GUN]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 15 },
  [WeaponType.BOMB]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 120 },
  [WeaponType.RAY]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 10 },
  [WeaponType.SHOTGUN]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 5 },
  [WeaponType.LEGO_LAUNCHER]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 3 },
  [WeaponType.MINIGUN]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 0.2 },
  [WeaponType.PLASMA_CUBE]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 40 },
};

const Game: React.FC<GameProps> = ({ onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [score, setScore] = useState(0);
  const [weapon, setWeapon] = useState<WeaponType>(WeaponType.BRICK_GUN);
  const [energy, setEnergy] = useState(100);
  const [health, setHealth] = useState(100);
  const [shield, setShield] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  
  const shakeRef = useRef(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(LEVEL_DURATION);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [upgrades, setUpgrades] = useState<Upgrades>({
    damageMult: 1,
    fireRateMult: 1,
    energyMax: 100,
    healthMax: 100,
    speedMult: 1,
    shieldMax: 100,
    shieldRegenRate: 0.15,
    weapons: { ...INITIAL_WEAPON_STATS }
  });

  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: window.innerWidth / 2, y: window.innerHeight - 200 },
    vel: { x: 0, y: 0 },
    width: 45,
    height: 65,
    color: '#EAB308',
    health: 100,
    shield: 100,
    weapon: WeaponType.BRICK_GUN,
    isJumping: false,
    facingRight: true,
    energy: 100,
    upgrades: { ...upgrades },
    powerUpTimer: 0,
    activePowerUp: null
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const mousePosRef = useRef<Vector>({ x: 0, y: 0 });
  const isFiringRef = useRef(false);
  const lastFireTimeRef = useRef(0);
  const lastDamageTimeRef = useRef(0);
  const gameStateRef = useRef<'PLAYING' | 'GAMEOVER'>('PLAYING');

  useEffect(() => {
    const saved = localStorage.getItem('lego_cube_highscores');
    if (saved) setHighScores(JSON.parse(saved));
    
    // Resize handler to keep canvas full size
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const saveScore = (finalScore: number) => {
    const newScores = [...highScores, { score: finalScore, date: new Date().toLocaleDateString() }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setHighScores(newScores);
    localStorage.setItem('lego_cube_highscores', JSON.stringify(newScores));
  };

  const resetGame = useCallback(() => {
    window.location.reload(); 
  }, []);

  const playSwitchSound = useCallback((type: WeaponType) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(type === WeaponType.BOMB ? 100 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(type === WeaponType.BOMB ? 40 : 880, now + 0.1);
    gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.1);
    osc.start(); osc.stop(now + 0.1);
  }, []);

  useEffect(() => {
    if (gameStateRef.current === 'PLAYING') playSwitchSound(weapon);
  }, [weapon, playSwitchSound]);

  const explodeAt = useCallback((x: number, y: number, radius: number, powerMult: number = 1) => {
    shakeRef.current += (radius / 10) * powerMult;
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        vel: { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 },
        width: 8 + Math.random() * 8, height: 8 + Math.random() * 8,
        color: ['#DC2626', '#2563EB', '#F59E0B', '#10B981'][Math.floor(Math.random() * 4)],
        life: 60, maxLife: 60, rotation: Math.random() * Math.PI * 2, rotationVel: (Math.random() - 0.5) * 0.2
      });
    }
    enemiesRef.current.forEach(enemy => {
      const dx = enemy.pos.x - x;
      const dy = enemy.pos.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) enemy.health -= 200 * playerRef.current.upgrades.damageMult * powerMult;
    });
  }, []);

  const spawnProjectile = useCallback((fromEnemy: boolean = false, customAngle?: number, customPos?: Vector) => {
    if (isPaused || isShopOpen) return;
    const p = playerRef.current;
    const now = Date.now();
    const wStats = p.upgrades.weapons[weapon];
    
    if (!fromEnemy) {
      let baseRate = 250;
      if (weapon === WeaponType.MINIGUN) baseRate = 80;
      if (weapon === WeaponType.PLASMA_CUBE) baseRate = 600;
      const fireRateLimit = (baseRate / p.upgrades.fireRateMult) / wStats.fireRateBonus;
      if (now - lastFireTimeRef.current < fireRateLimit && weapon !== WeaponType.RAY) return;
      lastFireTimeRef.current = now;
    }

    const angle = customAngle !== undefined ? customAngle : (mousePosRef.current.x !== 0 ? Math.atan2(mousePosRef.current.y - (p.pos.y + p.height / 2), mousePosRef.current.x - (p.pos.x + p.width / 2)) : (p.facingRight ? 0 : Math.PI));
    const pos = customPos || { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 };
    const damage = (fromEnemy ? 10 : 25) * p.upgrades.damageMult * (p.activePowerUp === PowerUpType.DOUBLE_DAMAGE ? 2 : 1) * (fromEnemy ? 1 : wStats.damageBonus);

    if (weapon === WeaponType.BRICK_GUN || fromEnemy) {
      const speed = fromEnemy ? 15 : wStats.specialValue;
      projectilesRef.current.push({ 
        id: Math.random().toString(), pos, vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, 
        width: 15, height: 10, color: fromEnemy ? '#ef4444' : '#DC2626', type: weapon, 
        damage, life: 100, fromEnemy, 
        bounces: !fromEnemy && wStats.level >= 5 ? 1 : 0
      });
    } else if (weapon === WeaponType.BOMB) {
      projectilesRef.current.push({ id: Math.random().toString(), pos, vel: { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10 - 5 }, width: 20, height: 20, color: '#1E293B', type: weapon, damage: damage * 4, life: 120 });
    } else if (weapon === WeaponType.SHOTGUN) {
      const pellets = Math.floor(wStats.specialValue);
      for (let i = 0; i < pellets; i++) {
        const spread = angle + (i - (pellets-1)/2) * 0.15;
        projectilesRef.current.push({ id: Math.random().toString(), pos, vel: { x: Math.cos(spread) * 12, y: Math.sin(spread) * 12 }, width: 10, height: 10, color: '#2563EB', type: weapon, damage: damage * 0.7, life: 40 });
      }
    } else if (weapon === WeaponType.LEGO_LAUNCHER) {
      projectilesRef.current.push({ id: Math.random().toString(), pos, vel: { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10 }, width: 25, height: 15, color: '#16A34A', type: weapon, damage: damage * 1.5, life: 300, bounces: Math.floor(wStats.specialValue) });
    } else if (weapon === WeaponType.MINIGUN) {
      const scatter = (Math.random() - 0.5) * wStats.specialValue;
      projectilesRef.current.push({ id: Math.random().toString(), pos, vel: { x: Math.cos(angle + scatter) * 18, y: Math.sin(angle + scatter) * 18 }, width: 10, height: 8, color: '#F59E0B', type: weapon, damage: damage * 0.5, life: 80 });
    } else if (weapon === WeaponType.PLASMA_CUBE) {
      projectilesRef.current.push({ id: Math.random().toString(), pos, vel: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 }, width: wStats.specialValue, height: wStats.specialValue, color: '#8B5CF6', type: weapon, damage: damage * 0.2, life: 400, piercing: true });
    }
  }, [isPaused, weapon, isShopOpen, playSwitchSound]);

  const spawnBoss = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const hp = 5000 * (level / 5);
    enemiesRef.current.push({
      id: 'boss',
      pos: { x: canvas.width - 200, y: canvas.height - 300 },
      vel: { x: 0, y: 0 },
      width: 150,
      height: 200,
      color: '#ef4444',
      health: hp,
      maxHealth: hp,
      type: 'boss',
      bossPattern: 0,
      attackTimer: 0
    });
  }, [level]);

  const spawnPowerUp = useCallback((x: number, y: number) => {
    const types = Object.values(PowerUpType);
    const type = types[Math.floor(Math.random() * types.length)];
    powerUpsRef.current.push({
      id: Math.random().toString(),
      pos: { x, y },
      vel: { x: 0, y: 0 },
      width: 30,
      height: 30,
      color: type === PowerUpType.HEAL ? '#22c55e' : (type === PowerUpType.DOUBLE_DAMAGE ? '#ef4444' : '#3b82f6'),
      type,
      life: 600
    });
  }, []);

  const handlePlayerDamage = (amt: number) => {
    const p = playerRef.current;
    lastDamageTimeRef.current = Date.now();
    if (p.shield > 0) {
      p.shield -= amt;
      if (p.shield < 0) { p.health += p.shield; p.shield = 0; }
    } else {
      p.health -= amt;
    }
    setHealth((p.health / p.upgrades.healthMax) * 100);
    setShield((p.shield / p.upgrades.shieldMax) * 100);
    if (p.health <= 0) {
      gameStateRef.current = 'GAMEOVER';
      saveScore(score);
      onGameOver(score);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const handleKeyDown = (e: KeyboardEvent) => { 
        keysRef.current[e.key.toLowerCase()] = true; 
        if (e.key === 'p') setIsPaused(v => !v); 
        if (['1','2','3','4','5','6','7'].includes(e.key)) {
            const index = parseInt(e.key) - 1;
            const weapons = Object.values(WeaponType);
            if (weapons[index]) setWeapon(weapons[index]);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.key.toLowerCase()] = false;
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    
    let frameId: number;
    const loop = () => {
      if (!isPaused && !isShopOpen) {
        const p = playerRef.current;
        if (Date.now() - lastDamageTimeRef.current > 3000) {
          p.shield = Math.min(p.upgrades.shieldMax, p.shield + p.upgrades.shieldRegenRate);
          setShield((p.shield / p.upgrades.shieldMax) * 100);
        }
        const currentWStats = p.upgrades.weapons[weapon];
        const rayEfficiency = weapon === WeaponType.RAY ? (currentWStats.level * 0.1) : 0;
        p.energy = Math.min(p.upgrades.energyMax, p.energy + (p.activePowerUp === PowerUpType.INFINITE_ENERGY ? 5 : ENERGY_REGEN_RATE + rayEfficiency));
        setEnergy((p.energy / p.upgrades.energyMax) * 100);
        
        if (p.powerUpTimer > 0) { p.powerUpTimer--; if (p.powerUpTimer <= 0) p.activePowerUp = null; }
        if (shakeRef.current > 0) { shakeRef.current *= 0.9; if (shakeRef.current < 0.1) shakeRef.current = 0; }

        if (keysRef.current[' '] || isFiringRef.current) {
            if (weapon === WeaponType.RAY) {
                const cost = RAY_ENERGY_BASE_COST - (currentWStats.level * 0.15);
                if (p.energy >= cost) {
                    p.energy -= cost;
                    const angle = mousePosRef.current.x !== 0 ? Math.atan2(mousePosRef.current.y - (p.pos.y + p.height / 2), mousePosRef.current.x - (p.pos.x + p.width / 2)) : (p.facingRight ? 0 : Math.PI);
                    enemiesRef.current.forEach(enemy => {
                        const ex = enemy.pos.x + enemy.width / 2;
                        const ey = enemy.pos.y + enemy.height / 2;
                        const dx = ex - (p.pos.x + p.width / 2);
                        const dy = ey - (p.pos.y + p.height / 2);
                        const enemyAngle = Math.atan2(dy, dx);
                        const diff = Math.abs(angle - enemyAngle);
                        if (diff < 0.08 + (currentWStats.specialValue / 100)) {
                            enemy.health -= 3 * p.upgrades.damageMult * currentWStats.damageBonus;
                        }
                    });
                }
            } else {
                spawnProjectile();
            }
        }

        const moveSpeed = PLAYER_SPEED_BASE * p.upgrades.speedMult;
        if (keysRef.current['arrowleft'] || keysRef.current['a']) { p.vel.x = -moveSpeed; p.facingRight = false; }
        else if (keysRef.current['arrowright'] || keysRef.current['d']) { p.vel.x = moveSpeed; p.facingRight = true; }
        else { p.vel.x *= 0.8; }
        if ((keysRef.current['arrowup'] || keysRef.current['w']) && !p.isJumping) { p.vel.y = JUMP_FORCE; p.isJumping = true; }
        p.vel.y += GRAVITY; p.pos.x += p.vel.x; p.pos.y += p.vel.y;
        
        const groundY = canvas.height - 100;
        if (p.pos.y + p.height > groundY) { p.pos.y = groundY - p.height; p.vel.y = 0; p.isJumping = false; }
        if (p.pos.x < 0) p.pos.x = 0; if (p.pos.x + p.width > canvas.width) p.pos.x = canvas.width - p.width;

        if (timeLeft > 0 && Math.random() < ENEMY_SPAWN_RATE_BASE + (level * 0.005)) {
          const side = Math.random() > 0.5;
          const x = side ? -80 : canvas.width + 80;
          enemiesRef.current.push({ id: Math.random().toString(), pos: { x, y: groundY - 40 }, vel: { x: (side ? 1 : -1) * (2 + level * 0.1), y: 0 }, width: 40, height: 40, color: '#1D4ED8', health: 50 + level * 20, maxHealth: 50 + level * 20, type: 'crawler' });
        }

        enemiesRef.current.forEach((enemy, eIdx) => {
          enemy.pos.x += enemy.vel.x;
          if (enemy.type === 'boss') {
            enemy.attackTimer = (enemy.attackTimer || 0) + 1;
            if (enemy.attackTimer > 60) {
              enemy.attackTimer = 0;
              const angle = Math.atan2(p.pos.y - enemy.pos.y, p.pos.x - enemy.pos.x);
              spawnProjectile(true, angle, { x: enemy.pos.x + enemy.width/2, y: enemy.pos.y + enemy.height/2 });
            }
          }
          if (p.pos.x < enemy.pos.x + enemy.width && p.pos.x + p.width > enemy.pos.x && p.pos.y < enemy.pos.y + enemy.height && p.pos.y + p.height > enemy.pos.y) {
            handlePlayerDamage(enemy.type === 'boss' ? 2 : 0.6);
          }
          if (enemy.health <= 0) {
            if (Math.random() < 0.2) spawnPowerUp(enemy.pos.x, enemy.pos.y);
            setScore(s => s + (enemy.type === 'boss' ? 5000 : 50));
            enemiesRef.current.splice(eIdx, 1);
          }
        });

        projectilesRef.current.forEach((proj, pIdx) => {
          proj.pos.x += proj.vel.x; proj.pos.y += proj.vel.y; proj.life--;
          if (proj.type === WeaponType.BOMB && (proj.life <= 0 || proj.pos.y + proj.height > groundY)) {
              explodeAt(proj.pos.x, proj.pos.y, p.upgrades.weapons[WeaponType.BOMB].specialValue);
              projectilesRef.current.splice(pIdx, 1);
              return;
          }
          if (proj.bounces && proj.bounces > 0 && proj.pos.y + proj.height > groundY) {
              proj.vel.y *= -0.7;
              proj.pos.y = groundY - proj.height;
              proj.bounces--;
          }
          if (proj.fromEnemy) {
            if (proj.pos.x < p.pos.x + p.width && proj.pos.x + proj.width > p.pos.x && proj.pos.y < p.pos.y + p.height && proj.pos.y + proj.height > p.pos.y) {
              handlePlayerDamage(proj.damage); projectilesRef.current.splice(pIdx, 1);
            }
          } else {
            enemiesRef.current.forEach(enemy => {
              if (proj.pos.x < enemy.pos.x + enemy.width && proj.pos.x + proj.width > enemy.pos.x && proj.pos.y < enemy.pos.y + enemy.height && proj.pos.y + proj.height > enemy.pos.y) {
                enemy.health -= proj.damage; 
                if (!proj.piercing) {
                    if (proj.bounces && proj.bounces > 0) {
                        proj.vel.x *= -1;
                        proj.bounces--;
                    } else {
                        projectilesRef.current.splice(pIdx, 1);
                    }
                }
              }
            });
          }
          if (proj.life <= 0) projectilesRef.current.splice(pIdx, 1);
        });

        powerUpsRef.current.forEach((pup, puIdx) => {
          pup.life--;
          if (p.pos.x < pup.pos.x + pup.width && p.pos.x + p.width > pup.pos.x && p.pos.y < pup.pos.y + pup.height && p.pos.y + p.height > pup.pos.y) {
            p.activePowerUp = pup.type; p.powerUpTimer = 600;
            if (pup.type === PowerUpType.HEAL) { p.health = Math.min(p.upgrades.healthMax, p.health + 50); setHealth((p.health/p.upgrades.healthMax)*100); }
            if (pup.type === PowerUpType.SHIELD_REFILL) { p.shield = p.upgrades.shieldMax; setShield(100); }
            powerUpsRef.current.splice(puIdx, 1);
          }
          if (pup.life <= 0) powerUpsRef.current.splice(puIdx, 1);
        });
        particlesRef.current.forEach((part, paIdx) => { part.pos.x += part.vel.x; part.pos.y += part.vel.y; part.life--; if (part.life <= 0) particlesRef.current.splice(paIdx, 1); });
      }

      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.save();
      if (shakeRef.current > 0) ctx.translate((Math.random()-0.5)*shakeRef.current, (Math.random()-0.5)*shakeRef.current);
      const p = playerRef.current;
      const groundY = canvas.height - 100;
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,canvas.width, canvas.height);
      ctx.fillStyle = '#166534'; ctx.fillRect(0, groundY, canvas.width, 100);

      const boss = enemiesRef.current.find(e => e.type === 'boss');
      if (boss) {
        ctx.fillStyle = '#334155'; ctx.fillRect(canvas.width/2 - 200, 20, 400, 20);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(canvas.width/2 - 200, 20, (boss.health/boss.maxHealth)*400, 20);
        ctx.fillStyle = 'white'; ctx.font = '20px Heebo'; ctx.textAlign = 'center'; ctx.fillText(`BOSS LEVEL ${level/5}`, canvas.width/2, 60);
      }

      if (weapon === WeaponType.RAY && (keysRef.current[' '] || isFiringRef.current) && p.energy > 0) {
          const wStats = p.upgrades.weapons[WeaponType.RAY];
          const angle = mousePosRef.current.x !== 0 ? Math.atan2(mousePosRef.current.y - (p.pos.y + p.height / 2), mousePosRef.current.x - (p.pos.x + p.width / 2)) : (p.facingRight ? 0 : Math.PI);
          ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = wStats.specialValue;
          ctx.lineCap = 'round'; ctx.beginPath();
          ctx.moveTo(p.pos.x + p.width/2, p.pos.y + p.height/2);
          ctx.lineTo(p.pos.x + p.width/2 + Math.cos(angle)*2000, p.pos.y + p.height/2 + Math.sin(angle)*2000);
          ctx.stroke();
      }

      if (p.shield > 0) {
        ctx.beginPath(); ctx.arc(p.pos.x + p.width/2, p.pos.y + p.height/2, 50, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 + (Math.sin(Date.now()*0.01)+1)*0.2})`;
        ctx.lineWidth = 5; ctx.stroke();
      }
      ctx.fillStyle = p.color; ctx.fillRect(p.pos.x, p.pos.y, p.width, p.height);
      if (p.activePowerUp) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.strokeRect(p.pos.x-5, p.pos.y-5, p.width+10, p.height+10); }
      enemiesRef.current.forEach(e => { ctx.fillStyle = e.color; ctx.fillRect(e.pos.x, e.pos.y, e.width, e.height); });
      projectilesRef.current.forEach(pr => { 
          if (pr.type === WeaponType.PLASMA_CUBE) {
              const pulse = 1 + Math.sin(Date.now()*0.01)*0.1;
              ctx.save(); ctx.translate(pr.pos.x + pr.width/2, pr.pos.y + pr.height/2); ctx.scale(pulse, pulse); ctx.fillStyle = pr.color; ctx.fillRect(-pr.width/2, -pr.height/2, pr.width, pr.height); ctx.restore();
          } else { ctx.fillStyle = pr.color; ctx.fillRect(pr.pos.x, pr.pos.y, pr.width, pr.height); }
      });
      powerUpsRef.current.forEach(pu => { ctx.fillStyle = pu.color; ctx.save(); ctx.translate(pu.pos.x + pu.width/2, pu.pos.y + pu.height/2); ctx.rotate(Date.now()*0.005); ctx.fillRect(-pu.width/2, -pu.height/2, pu.width, pu.height); ctx.restore(); });
      particlesRef.current.forEach(pa => { ctx.fillStyle = pa.color; ctx.globalAlpha = pa.life/pa.maxLife; ctx.fillRect(pa.pos.x, pa.pos.y, pa.width, pa.height); ctx.globalAlpha = 1; });
      ctx.restore();
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); cancelAnimationFrame(frameId); };
  }, [isPaused, isShopOpen, level, score, onGameOver, spawnProjectile, spawnBoss, spawnPowerUp, weapon]);

  useEffect(() => {
    if (isPaused || isShopOpen) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (level % 5 === 0) {
            if (enemiesRef.current.find(e => e.type === 'boss')) return 0;
            spawnBoss();
          } else { setIsShopOpen(true); }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, isShopOpen, level, spawnBoss]);

  const buyUpgrade = (type: string, cost: number) => {
    if (score < cost) return;
    setScore(s => s - cost);
    setUpgrades(prev => {
      const next = { ...prev };
      if (type === 'damage') next.damageMult += 0.2;
      if (type === 'shield') next.shieldMax += 50;
      if (type === 'energy') next.energyMax += 50;
      playerRef.current.upgrades = next;
      return next;
    });
  };

  const buyWeaponUpgrade = (wType: WeaponType, cost: number) => {
      if (score < cost) return;
      setScore(s => s - cost);
      setUpgrades(prev => {
          const next = { ...prev };
          const w = next.weapons[wType];
          w.level += 1; w.damageBonus += 0.3; w.fireRateBonus += 0.15;
          if (wType === WeaponType.BRICK_GUN) w.specialValue += 3;
          if (wType === WeaponType.BOMB) w.specialValue += 20;
          if (wType === WeaponType.RAY) w.specialValue += 4;
          if (wType === WeaponType.SHOTGUN) w.specialValue += 1;
          if (wType === WeaponType.LEGO_LAUNCHER) w.specialValue += 1;
          if (wType === WeaponType.MINIGUN) w.specialValue *= 0.8;
          if (wType === WeaponType.PLASMA_CUBE) w.specialValue += 8;
          playerRef.current.upgrades = next;
          return next;
      });
  };

  const currentWStats = upgrades.weapons[weapon];
  const weaponUpgradeCost = 300 + (currentWStats.level * 200);

  return (
    <div className="relative w-full h-full touch-none select-none overflow-hidden" 
         onPointerDown={() => isFiringRef.current = true} 
         onPointerUp={() => isFiringRef.current = false}
         onPointerMove={(e) => mousePosRef.current = { x: e.clientX, y: e.clientY }}>
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />
      
      {/* HUD Left */}
      <div className="absolute top-6 left-6 flex flex-col gap-2 w-72 pointer-events-none">
        <div className="bg-slate-900/80 p-4 rounded-2xl border-2 border-yellow-400 backdrop-blur-sm">
          <div className="flex justify-between text-white font-black text-xs mb-1"><span>חיים</span><span>{Math.round(health)}%</span></div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2"><div className="bg-red-500 h-full" style={{width:`${health}%`}}/></div>
          <div className="flex justify-between text-blue-400 font-black text-xs mb-1"><span>מגן</span><span>{Math.round(shield)}%</span></div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2"><div className="bg-blue-400 h-full" style={{width:`${shield}%`}}/></div>
          <div className="flex justify-between text-cyan-400 font-black text-xs mb-1"><span>אנרגיה</span><span>{Math.round(energy)}%</span></div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-cyan-400 h-full" style={{width:`${energy}%`}}/></div>
        </div>
        <div className="bg-slate-900/80 p-2 rounded-xl text-white font-bold text-center text-sm">שלב {level} | {timeLeft}ש'</div>
        {playerRef.current.activePowerUp && <div className="bg-yellow-400 p-2 rounded-xl text-black font-black text-center text-xs animate-pulse">{playerRef.current.activePowerUp} פעיל!</div>}
      </div>

      {/* HUD Right */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 pointer-events-none">
        <div className="bg-yellow-400 px-6 py-2 rounded-full shadow-lg border-4 border-white pointer-events-auto">
          <span className="text-xl font-black text-slate-900">Studs: {score}</span>
        </div>
        <div className="bg-slate-900/80 p-3 rounded-2xl text-white pointer-events-auto max-w-[180px] backdrop-blur-sm">
          <h4 className="font-black text-yellow-400 mb-1 underline text-sm">שיאי עולם</h4>
          {highScores.map((hs, i) => <div key={i} className="text-[10px] flex justify-between border-b border-white/10 py-1"><span>{hs.score}</span><span className="opacity-50">{hs.date}</span></div>)}
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setIsPaused(!isPaused)} className="p-2 bg-white/90 rounded-lg shadow border border-slate-300 font-bold text-slate-800 hover:bg-slate-100 transition-colors text-xs">
            {isPaused ? 'המשך' : 'השהה'}
          </button>
          <button onClick={resetGame} className="p-2 bg-red-100 rounded-lg shadow border border-red-300 font-bold text-red-800 hover:bg-red-200 transition-colors text-xs">
            איפוס
          </button>
        </div>
      </div>

      {/* Mobile WASD Controls */}
      <div className="absolute bottom-24 right-8 flex flex-col gap-2 items-center pointer-events-auto md:hidden">
        <div className="flex justify-center">
          <MobileBtn label="W" onDown={() => keysRef.current['w'] = true} onUp={() => keysRef.current['w'] = false} />
        </div>
        <div className="flex gap-2">
          <MobileBtn label="A" onDown={() => keysRef.current['a'] = true} onUp={() => keysRef.current['a'] = false} />
          <MobileBtn label="S" onDown={() => keysRef.current['s'] = true} onUp={() => keysRef.current['s'] = false} />
          <MobileBtn label="D" onDown={() => keysRef.current['d'] = true} onUp={() => keysRef.current['d'] = false} />
        </div>
      </div>

      {/* Weapon Selector */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto overflow-x-auto p-2 bg-slate-900/50 rounded-2xl backdrop-blur-sm max-w-[95%] no-scrollbar">
        {Object.values(WeaponType).map((w, i) => (
            <button key={w} onClick={() => setWeapon(w)} className={`px-3 py-2 rounded-xl flex flex-col items-center min-w-[60px] border-2 transition-all ${weapon === w ? 'bg-yellow-400 border-white text-black scale-105 shadow-lg' : 'bg-slate-800 border-slate-700 text-white opacity-60'}`}>
                <span className="text-[10px] font-black">{w.split('_')[0]}</span>
                <span className="text-[8px] opacity-70">Lvl {upgrades.weapons[w].level}</span>
            </button>
        ))}
      </div>

      {/* Shop Overlay */}
      {isShopOpen && (
        <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 md:p-8 rounded-3xl border-8 border-yellow-400 max-w-2xl w-full text-center shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-3xl md:text-4xl font-black text-red-600 mb-4 text-center">חנות שלב {level}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <h3 className="font-black text-blue-600 text-lg underline">שדרוגים כלליים</h3>
                <button onClick={() => buyUpgrade('damage', 500)} className="w-full p-3 bg-slate-100 rounded-xl font-bold flex justify-between hover:bg-slate-200"><span>נזק כללי +20%</span><span>500</span></button>
                <button onClick={() => buyUpgrade('shield', 400)} className="w-full p-3 bg-slate-100 rounded-xl font-bold flex justify-between hover:bg-slate-200"><span>מגן מקסימלי +50</span><span>400</span></button>
                <button onClick={() => buyUpgrade('energy', 300)} className="w-full p-3 bg-slate-100 rounded-xl font-bold flex justify-between hover:bg-slate-200"><span>אנרגיה מקסימלית +50</span><span>300</span></button>
              </div>
              <div className="space-y-3">
                <h3 className="font-black text-green-600 text-lg underline">מומחיות בנשק: {weapon}</h3>
                <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-right">
                    <p className="text-xs font-bold mb-2">רמה נוכחית: {currentWStats.level}</p>
                    <ul className="text-[10px] mb-4 list-disc list-inside opacity-70">
                        <li>נזק נשק: +{(currentWStats.damageBonus*100-100).toFixed(0)}%</li>
                        <li>קצב אש: +{(currentWStats.fireRateBonus*100-100).toFixed(0)}%</li>
                        <li>בונוס ייחודי רמה {currentWStats.level}</li>
                    </ul>
                    <button onClick={() => buyWeaponUpgrade(weapon, weaponUpgradeCost)} className="w-full p-3 bg-yellow-400 text-slate-900 rounded-xl font-black hover:bg-yellow-500 shadow-md">
                        שדרג {weapon} ({weaponUpgradeCost})
                    </button>
                </div>
              </div>
            </div>
            <button onClick={() => { setIsShopOpen(false); setLevel(l => l + 1); setTimeLeft(LEVEL_DURATION); enemiesRef.current = []; projectilesRef.current = []; }} className="w-full py-4 bg-green-500 text-white text-2xl font-black rounded-xl hover:bg-green-600 transition-colors shadow-lg border-b-8 border-green-800 active:border-b-0 active:translate-y-2">
                המשך לשלב הבא
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MobileBtn = ({ label, onDown, onUp }: any) => (
  <button 
    className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-xl border-2 border-white/40 text-white font-black text-2xl active:bg-white/40 active:scale-90 transition-all select-none touch-none flex items-center justify-center shadow-lg" 
    onPointerDown={onDown} 
    onPointerUp={onUp} 
    onPointerLeave={onUp}
    onContextMenu={(e) => e.preventDefault()}
  >
    {label}
  </button>
);

export default Game;