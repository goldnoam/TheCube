
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WeaponType, Vector, Player, Enemy, Projectile, Particle, Upgrades, WeaponStats } from '../types';

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
  [WeaponType.BRICK_GUN]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 15 }, // special = projectile speed
  [WeaponType.BOMB]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 120 }, // special = radius
  [WeaponType.RAY]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 0 }, // special = efficiency
  [WeaponType.SHOTGUN]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 5 }, // special = pellet count
  [WeaponType.LEGO_LAUNCHER]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 4 }, // special = bounces
  [WeaponType.MINIGUN]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 0.2 }, // special = scatter
  [WeaponType.PLASMA_CUBE]: { level: 1, damageBonus: 1, fireRateBonus: 1, specialValue: 40 }, // special = size
};

const Game: React.FC<GameProps> = ({ onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [score, setScore] = useState(0);
  const [weapon, setWeapon] = useState<WeaponType>(WeaponType.BRICK_GUN);
  const [energy, setEnergy] = useState(100);
  const [health, setHealth] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  
  // Level & Shop State
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(LEVEL_DURATION);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [upgrades, setUpgrades] = useState<Upgrades>({
    damageMult: 1,
    fireRateMult: 1,
    energyMax: 100,
    healthMax: 100,
    speedMult: 1,
    weapons: { ...INITIAL_WEAPON_STATS }
  });

  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: 400, y: 300 },
    vel: { x: 0, y: 0 },
    width: 40,
    height: 60,
    color: '#EAB308',
    health: 100,
    weapon: WeaponType.BRICK_GUN,
    isJumping: false,
    facingRight: true,
    energy: 100,
    upgrades: { ...upgrades }
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const mousePosRef = useRef<Vector>({ x: 0, y: 0 });
  const isFiringRef = useRef(false);
  const lastFireTimeRef = useRef(0);
  const gameStateRef = useRef<'PLAYING' | 'GAMEOVER'>('PLAYING');

  // Procedural Sound Generator
  const playSwitchSound = useCallback((type: WeaponType) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case WeaponType.BRICK_GUN:
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        break;
      case WeaponType.BOMB:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        break;
      case WeaponType.RAY:
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        break;
      default:
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
    }

    osc.start();
    osc.stop(now + 0.3);
  }, []);

  useEffect(() => {
    if (gameStateRef.current === 'PLAYING') {
        playSwitchSound(weapon);
    }
  }, [weapon, playSwitchSound]);

  const resetGame = useCallback(() => {
    const defaultUpgrades = {
      damageMult: 1,
      fireRateMult: 1,
      energyMax: 100,
      healthMax: 100,
      speedMult: 1,
      weapons: { ...INITIAL_WEAPON_STATS }
    };
    setUpgrades(defaultUpgrades);
    playerRef.current = {
      id: 'player',
      pos: { x: window.innerWidth / 2, y: 300 },
      vel: { x: 0, y: 0 },
      width: 40,
      height: 60,
      color: '#EAB308',
      health: 100,
      weapon: WeaponType.BRICK_GUN,
      isJumping: false,
      facingRight: true,
      energy: 100,
      upgrades: defaultUpgrades
    };
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    setScore(0);
    setHealth(100);
    setEnergy(100);
    setLevel(1);
    setTimeLeft(LEVEL_DURATION);
    setIsPaused(false);
    setIsShopOpen(false);
    gameStateRef.current = 'PLAYING';
  }, []);

  const explodeAt = useCallback((x: number, y: number, radius: number, powerMult: number = 1) => {
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
      if (dist < radius) {
          enemy.health -= 200 * playerRef.current.upgrades.damageMult * powerMult;
      }
    });
  }, []);

  const spawnProjectile = useCallback(() => {
    if (isPaused || isShopOpen) return;
    
    const p = playerRef.current;
    const wStats = p.upgrades.weapons[weapon];
    const now = Date.now();
    
    let baseFireRateLimit = 250;
    if (weapon === WeaponType.MINIGUN) baseFireRateLimit = 80;
    if (weapon === WeaponType.PLASMA_CUBE) baseFireRateLimit = 600;

    const fireRateLimit = (baseFireRateLimit / p.upgrades.fireRateMult) / wStats.fireRateBonus;

    if (now - lastFireTimeRef.current < fireRateLimit && weapon !== WeaponType.RAY) return;
    lastFireTimeRef.current = now;

    let angle: number;
    if (mousePosRef.current.x !== 0 || mousePosRef.current.y !== 0) {
      angle = Math.atan2(
        mousePosRef.current.y - (p.pos.y + p.height / 2),
        mousePosRef.current.x - (p.pos.x + p.width / 2)
      );
    } else {
      angle = p.facingRight ? 0 : Math.PI;
    }

    const damage = 25 * p.upgrades.damageMult * wStats.damageBonus;

    if (weapon === WeaponType.BRICK_GUN) {
      projectilesRef.current.push({
        id: Math.random().toString(),
        pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
        vel: { x: Math.cos(angle) * wStats.specialValue, y: Math.sin(angle) * wStats.specialValue },
        width: 15, height: 10, color: '#DC2626', type: weapon, damage, life: 100
      });
    } else if (weapon === WeaponType.BOMB) {
      projectilesRef.current.push({
        id: Math.random().toString(),
        pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
        vel: { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10 - 5 },
        width: 20, height: 20, color: '#1E293B', type: weapon, damage: damage * 4, life: 120
      });
    } else if (weapon === WeaponType.SHOTGUN) {
      const pelletCount = Math.floor(wStats.specialValue);
      for (let i = 0; i < pelletCount; i++) {
        const spreadAngle = angle + (i - (pelletCount - 1) / 2) * 0.15;
        projectilesRef.current.push({
          id: Math.random().toString(),
          pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
          vel: { x: Math.cos(spreadAngle) * 12, y: Math.sin(spreadAngle) * 12 },
          width: 12, height: 12, color: '#2563EB', type: weapon, damage: damage * 0.7, life: 45
        });
      }
    } else if (weapon === WeaponType.LEGO_LAUNCHER) {
      projectilesRef.current.push({
        id: Math.random().toString(),
        pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
        vel: { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10 },
        width: 25, height: 15, color: '#16A34A', type: weapon, damage: damage * 1.5, life: 300, bounces: Math.floor(wStats.specialValue)
      });
    } else if (weapon === WeaponType.MINIGUN) {
      const scatter = (Math.random() - 0.5) * wStats.specialValue;
      projectilesRef.current.push({
        id: Math.random().toString(),
        pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
        vel: { x: Math.cos(angle + scatter) * 18, y: Math.sin(angle + scatter) * 18 },
        width: 10, height: 8, color: '#F59E0B', type: weapon, damage: damage * 0.5, life: 80
      });
    } else if (weapon === WeaponType.PLASMA_CUBE) {
      projectilesRef.current.push({
        id: Math.random().toString(),
        pos: { x: p.pos.x + p.width / 2, y: p.pos.y + p.height / 2 },
        vel: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 },
        width: wStats.specialValue, height: wStats.specialValue, color: '#8B5CF6', type: weapon, damage: damage * 0.2, life: 400, piercing: true
      });
    }
  }, [isPaused, weapon, isShopOpen, playSwitchSound]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;
      if (key === '1') setWeapon(WeaponType.BRICK_GUN);
      if (key === '2') setWeapon(WeaponType.BOMB);
      if (key === '3') setWeapon(WeaponType.RAY);
      if (key === '4') setWeapon(WeaponType.SHOTGUN);
      if (key === '5') setWeapon(WeaponType.LEGO_LAUNCHER);
      if (key === '6') setWeapon(WeaponType.MINIGUN);
      if (key === '7') setWeapon(WeaponType.PLASMA_CUBE);
      if (key === 'p') setIsPaused(prev => !prev);
      if (key === ' ') {
        spawnProjectile();
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.key.toLowerCase()] = false;
    const handlePointerMove = (e: PointerEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    const handlePointerDown = (e: PointerEvent) => { 
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        isFiringRef.current = true; 
        if (e.target === canvas) spawnProjectile(); 
    };
    const handlePointerUp = () => { isFiringRef.current = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    let frameId: number;

    const update = () => {
      if (isPaused || isShopOpen) return;
      const p = playerRef.current;
      const wStats = p.upgrades.weapons[weapon];

      p.energy = Math.min(p.upgrades.energyMax, p.energy + ENERGY_REGEN_RATE);
      setEnergy((p.energy / p.upgrades.energyMax) * 100);

      if (weapon === WeaponType.RAY && isFiringRef.current) {
        const cost = RAY_ENERGY_BASE_COST - (wStats.level * 0.2);
        if (p.energy >= cost) p.energy -= cost;
      }

      if (keysRef.current[' ']) {
        spawnProjectile();
      }

      const moveSpeed = PLAYER_SPEED_BASE * p.upgrades.speedMult;
      if (keysRef.current['arrowleft'] || keysRef.current['a']) { p.vel.x = -moveSpeed; p.facingRight = false; }
      else if (keysRef.current['arrowright'] || keysRef.current['d']) { p.vel.x = moveSpeed; p.facingRight = true; }
      else { p.vel.x *= 0.8; }

      if ((keysRef.current['arrowup'] || keysRef.current['w'] || keysRef.current['jump_btn']) && !p.isJumping) {
        p.vel.y = JUMP_FORCE;
        p.isJumping = true;
      }

      p.vel.y += GRAVITY;
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;

      const groundY = canvas.height - 100;
      if (p.pos.y + p.height > groundY) { p.pos.y = groundY - p.height; p.vel.y = 0; p.isJumping = false; }
      if (p.pos.x < 0) p.pos.x = 0;
      if (p.pos.x + p.width > canvas.width) p.pos.x = canvas.width - p.width;

      if (Math.random() < ENEMY_SPAWN_RATE_BASE + (level * 0.005)) {
        const side = Math.random() > 0.5;
        const x = side ? -80 : canvas.width + 80;
        const rand = Math.random();
        let type: any = 'crawler', width = 35, height = 40, color = '#1D4ED8', health = 40 + (level * 20), speed = (1.5 + Math.random() * 2) * (1 + level * 0.1);

        if (rand > 0.95) { type = 'tank'; width = 85; height = 65; color = '#4c1d95'; health = 600 + level * 100; speed = 0.6; }
        else if (rand > 0.85) { type = 'giant'; width = 60; height = 80; color = '#475569'; health = 300 + level * 50; speed = 1.0; }
        else if (rand > 0.65) { type = 'fast_runner'; width = 25; height = 30; color = '#F59E0B'; health = 30 + level * 10; speed = 6 + level * 0.3; }

        enemiesRef.current.push({ id: Math.random().toString(), pos: { x, y: groundY - height }, vel: { x: (side ? 1 : -1) * speed, y: 0 }, width, height, color, health, type });
      }

      projectilesRef.current.forEach((proj, idx) => {
        proj.pos.x += proj.vel.x;
        proj.pos.y += proj.vel.y;
        proj.life--;

        if (proj.type === WeaponType.BOMB) {
          proj.vel.y += GRAVITY * 0.5;
          if (proj.pos.y + proj.height > groundY || proj.life <= 0) { 
              const radius = p.upgrades.weapons[WeaponType.BOMB].specialValue;
              explodeAt(proj.pos.x, proj.pos.y, radius, 1.2); 
              projectilesRef.current.splice(idx, 1); 
          }
        } else if (proj.type === WeaponType.LEGO_LAUNCHER) {
          proj.vel.y += GRAVITY * 0.4;
          if (proj.pos.y + proj.height > groundY) {
            if (proj.bounces && proj.bounces > 0) {
              proj.vel.y *= -0.7;
              proj.pos.y = groundY - proj.height;
              proj.bounces--;
            } else { projectilesRef.current.splice(idx, 1); }
          }
        }

        enemiesRef.current.forEach(enemy => {
          if (proj.pos.x < enemy.pos.x + enemy.width && proj.pos.x + proj.width > enemy.pos.x && proj.pos.y < enemy.pos.y + enemy.height && proj.pos.y + proj.height > enemy.pos.y) {
            enemy.health -= proj.damage;
            if (proj.piercing) {
              if (Math.random() > 0.8) explodeAt(proj.pos.x, proj.pos.y, 10, 0.1);
            } else if (proj.type !== WeaponType.LEGO_LAUNCHER) {
              projectilesRef.current.splice(idx, 1);
            }
          }
        });
        if (proj.life <= 0) projectilesRef.current.splice(idx, 1);
      });

      enemiesRef.current.forEach((enemy, idx) => {
        enemy.pos.x += enemy.vel.x;
        if (p.pos.x < enemy.pos.x + enemy.width && p.pos.x + p.width > enemy.pos.x && p.pos.y < enemy.pos.y + enemy.height && p.pos.y + p.height > enemy.pos.y) {
          p.health -= 0.6;
          setHealth((p.health / p.upgrades.healthMax) * 100);
          if (p.health <= 0) {
              gameStateRef.current = 'GAMEOVER';
              onGameOver(score);
          }
        }
        if (enemy.health <= 0) {
          let reward = 15;
          if (enemy.type === 'tank') reward = 150; else if (enemy.type === 'giant') reward = 80; else if (enemy.type === 'fast_runner') reward = 25;
          setScore(s => s + reward);
          enemiesRef.current.splice(idx, 1);
          explodeAt(enemy.pos.x + enemy.width / 2, enemy.pos.y + enemy.height / 2, 30, 0.5);
        }
      });

      particlesRef.current.forEach((part, idx) => {
        part.pos.x += part.vel.x; part.pos.y += part.vel.y; part.vel.y += GRAVITY * 0.3; part.rotation += part.rotationVel; part.life--;
        if (part.pos.y + part.height > groundY) { part.pos.y = groundY - part.height; part.vel.y *= -0.4; part.vel.x *= 0.8; }
        if (part.life <= 0) particlesRef.current.splice(idx, 1);
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const p = playerRef.current;
      const groundY = canvas.height - 100;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#0f172a'); skyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#166534'; ctx.fillRect(0, groundY, canvas.width, 100);
      ctx.fillStyle = '#14532d'; ctx.fillRect(0, groundY, canvas.width, 4);

      particlesRef.current.forEach(part => {
        ctx.save(); ctx.translate(part.pos.x + part.width / 2, part.pos.y + part.height / 2); ctx.rotate(part.rotation); ctx.fillStyle = part.color; ctx.globalAlpha = part.life / part.maxLife; ctx.fillRect(-part.width / 2, -part.height / 2, part.width, part.height); ctx.restore();
      });

      ctx.fillStyle = p.color; 
      ctx.fillRect(p.pos.x + 10, p.pos.y, 20, 15); 
      ctx.fillStyle = '#ef4444'; 
      ctx.fillRect(p.pos.x, p.pos.y + 15, 40, 30); 
      ctx.fillStyle = '#3b82f6'; 
      ctx.fillRect(p.pos.x + 2, p.pos.y + 45, 16, 15); 
      ctx.fillRect(p.pos.x + 22, p.pos.y + 45, 16, 15); 
      
      ctx.fillStyle = '#334155';
      const gunW = 25, gunH = 10;
      const gunX = p.facingRight ? p.pos.x + 35 : p.pos.x - 20;
      ctx.fillRect(gunX, p.pos.y + 25, gunW, gunH);

      enemiesRef.current.forEach(enemy => {
        ctx.fillStyle = enemy.color; ctx.fillRect(enemy.pos.x, enemy.pos.y, enemy.width, enemy.height);
        if (enemy.type === 'tank' || enemy.type === 'giant') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(enemy.pos.x, enemy.pos.y - 12, enemy.width, 6);
            ctx.fillStyle = '#22c55e';
            const maxH = enemy.type === 'tank' ? 600 + level * 100 : 300 + level * 50;
            ctx.fillRect(enemy.pos.x, enemy.pos.y - 12, (enemy.health / maxH) * enemy.width, 6);
        }
      });

      if (weapon === WeaponType.RAY && isFiringRef.current && p.energy > 0) {
        let angle: number;
        if (mousePosRef.current.x !== 0 || mousePosRef.current.y !== 0) {
          angle = Math.atan2(mousePosRef.current.y - (p.pos.y + p.height / 2), mousePosRef.current.x - (p.pos.x + p.width / 2));
        } else {
          angle = p.facingRight ? 0 : Math.PI;
        }
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 10 + (p.upgrades.weapons[WeaponType.RAY].level * 2); 
        ctx.lineCap = 'round';
        ctx.beginPath(); 
        ctx.moveTo(p.pos.x + p.width / 2, p.pos.y + p.height / 2); 
        ctx.lineTo(p.pos.x + p.width / 2 + Math.cos(angle) * 2000, p.pos.y + p.height / 2 + Math.sin(angle) * 2000); 
        ctx.stroke();
        
        enemiesRef.current.forEach(enemy => {
          const ex = enemy.pos.x + enemy.width / 2; const ey = enemy.pos.y + enemy.height / 2; const dx = ex - (p.pos.x + p.width / 2); const dy = ey - (p.pos.y + p.height / 2); const enemyAngle = Math.atan2(dy, dx); const diff = Math.abs(angle - enemyAngle);
          if (diff < 0.08) enemy.health -= (3 * p.upgrades.damageMult * p.upgrades.weapons[WeaponType.RAY].damageBonus);
        });
      }

      projectilesRef.current.forEach(proj => { 
        if (proj.type === WeaponType.PLASMA_CUBE) {
            const time = Date.now() * 0.005;
            const pulse = Math.sin(time);
            const scale = 1 + pulse * 0.15; // Pulse grow/shrink
            const brightness = 0.5 + (pulse + 1) * 0.25; // Light pulse
            
            ctx.save();
            const dw = proj.width * scale;
            const dh = proj.height * scale;
            const dx = proj.pos.x - (dw - proj.width) / 2;
            const dy = proj.pos.y - (dh - proj.height) / 2;

            // Glow
            ctx.shadowBlur = 15 * scale;
            ctx.shadowColor = proj.color;
            ctx.globalAlpha = 0.4 + brightness * 0.4;
            ctx.fillStyle = proj.color;
            ctx.fillRect(dx, dy, dw, dh);

            // Light core
            ctx.globalAlpha = 0.7 + brightness * 0.3;
            ctx.fillStyle = '#ddd6fe';
            ctx.fillRect(dx + dw * 0.2, dy + dh * 0.2, dw * 0.6, dh * 0.6);
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2 * scale;
            ctx.strokeRect(dx, dy, dw, dh);
            
            ctx.restore();
        } else {
            ctx.fillStyle = proj.color; ctx.fillRect(proj.pos.x, proj.pos.y, proj.width, proj.height); 
        }
      });

      if (mousePosRef.current.x !== 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(mousePosRef.current.x, mousePosRef.current.y, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mousePosRef.current.x - 15, mousePosRef.current.y); ctx.lineTo(mousePosRef.current.x + 15, mousePosRef.current.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mousePosRef.current.x, mousePosRef.current.y - 15); ctx.lineTo(mousePosRef.current.x, mousePosRef.current.y + 15); ctx.stroke();
      }
    };

    const loop = () => { update(); draw(); frameId = requestAnimationFrame(loop); };
    loop();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onGameOver, weapon, isPaused, resetGame, spawnProjectile, explodeAt, isShopOpen, level]);

  useEffect(() => {
    if (isPaused || isShopOpen) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsShopOpen(true);
          return LEVEL_DURATION;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isShopOpen]);

  const buyGlobalUpgrade = (type: string, cost: number) => {
    if (score < cost) return;
    setScore(s => s - cost);
    setUpgrades(prev => {
      const next = { ...prev };
      if (type === 'damage') next.damageMult += 0.3;
      if (type === 'fireRate') next.fireRateMult += 0.3;
      if (type === 'energy') next.energyMax += 60;
      if (type === 'health') next.healthMax += 60;
      if (type === 'speed') next.speedMult += 0.15;
      
      playerRef.current.upgrades = next;
      if (type === 'health') {
        playerRef.current.health = next.healthMax;
        setHealth(100);
      }
      if (type === 'energy') {
        playerRef.current.energy = next.energyMax;
        setEnergy(100);
      }
      return next;
    });
  };

  const buyWeaponUpgrade = (wType: WeaponType, cost: number) => {
    if (score < cost) return;
    setScore(s => s - cost);
    setUpgrades(prev => {
      const next = { ...prev };
      const current = next.weapons[wType];
      next.weapons[wType] = {
          level: current.level + 1,
          damageBonus: current.damageBonus + 0.5,
          fireRateBonus: current.fireRateBonus + 0.2,
          specialValue: current.specialValue * (wType === WeaponType.MINIGUN ? 0.8 : 1.25)
      };
      playerRef.current.upgrades = next;
      return next;
    });
  };

  const nextLevel = () => {
    setIsShopOpen(false);
    setLevel(l => l + 1);
    enemiesRef.current = [];
    projectilesRef.current = [];
    playerRef.current.pos = { x: window.innerWidth / 2, y: 300 };
    setTimeLeft(LEVEL_DURATION);
  };

  const currentWeaponStats = upgrades.weapons[weapon];
  const weaponUpgradeCost = 300 + (currentWeaponStats.level * 200);

  return (
    <div className="relative w-full h-full touch-none select-none overflow-hidden" onPointerDown={() => { if (!audioCtxRef.current) audioCtxRef.current = new AudioContext(); }}>
      <canvas ref={canvasRef} className="w-full h-full cursor-none" />

      {/* HUD */}
      <div className="absolute top-6 left-6 flex flex-col gap-4 pointer-events-none w-64">
        <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border-4 border-yellow-400 shadow-xl">
          <div className="text-white font-black text-xl mb-1 text-right">חיים: {Math.max(0, Math.round(health))}%</div>
          <div className="w-full bg-slate-700 h-4 rounded-full overflow-hidden border border-slate-600">
            <div className="bg-red-500 h-full transition-all" style={{ width: `${health}%` }} />
          </div>
          <div className="text-cyan-400 font-black text-xl mt-3 mb-1 text-right">אנרגיה: {Math.round(energy)}%</div>
          <div className="w-full bg-slate-700 h-4 rounded-full overflow-hidden border border-slate-600">
            <div className="bg-cyan-400 h-full transition-all" style={{ width: `${energy}%` }} />
          </div>
        </div>
        <div className="bg-slate-900/80 p-3 rounded-xl border-2 border-white/20 text-white font-bold text-center">
           שלב {level} | {timeLeft}ש'
        </div>
      </div>

      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 pointer-events-none">
        <div className="bg-yellow-400 px-8 py-2 rounded-full shadow-lg border-4 border-white pointer-events-auto">
          <span className="text-3xl font-black text-slate-900">Studs: {score}</span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setIsPaused(!isPaused)} className="p-3 bg-white/90 rounded-xl shadow-lg border-2 border-slate-300 font-black text-slate-800 hover:bg-slate-100 transition-colors">
            {isPaused ? 'המשך ▶' : 'השהה ⏸'}
          </button>
          <button onClick={resetGame} className="p-3 bg-white/90 rounded-xl shadow-lg border-2 border-slate-300 font-black text-slate-800 hover:bg-slate-100 transition-colors">
            🔄
          </button>
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="absolute bottom-24 right-6 flex flex-col gap-2 md:hidden items-center">
        <div className="flex justify-center">
          <MobileBtn label="↑" onDown={() => keysRef.current['arrowup'] = true} onUp={() => keysRef.current['arrowup'] = false} />
        </div>
        <div className="flex gap-2">
          <MobileBtn label="←" onDown={() => keysRef.current['arrowleft'] = true} onUp={() => keysRef.current['arrowleft'] = false} />
          <MobileBtn label="↓" onDown={() => keysRef.current['arrowdown'] = true} onUp={() => keysRef.current['arrowdown'] = false} />
          <MobileBtn label="→" onDown={() => keysRef.current['arrowright'] = true} onUp={() => keysRef.current['arrowright'] = false} />
        </div>
      </div>

      {/* Weapon Selector Overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto overflow-x-auto p-3 w-full justify-center max-w-2xl no-scrollbar">
        {Object.values(WeaponType).map((w, idx) => (
            <WeaponBtn 
                key={w} 
                active={weapon === w} 
                num={(idx+1).toString()} 
                color={getWeaponColor(w)} 
                label={w.replace('_', ' ')} 
                lvl={upgrades.weapons[w].level}
                onClick={() => setWeapon(w as WeaponType)} 
            />
        ))}
      </div>

      {/* Shop Overlay */}
      {isShopOpen && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-6 pointer-events-auto overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border-8 border-yellow-400 max-w-4xl w-full text-center shadow-2xl scale-in">
            <h2 className="text-4xl font-black text-red-600 mb-2">שלב {level} הושלם!</h2>
            <p className="text-xl font-bold mb-6 dark:text-white">חנות שדרוגים (Studs: {score})</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Global Upgrades */}
              <div className="space-y-4">
                <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 text-right underline">שדרוגים כלליים</h3>
                <div className="grid grid-cols-2 gap-3">
                    <ShopItem label="נזק כללי +30%" cost={250} onClick={() => buyGlobalUpgrade('damage', 250)} />
                    <ShopItem label="מהירות אש +30%" cost={350} onClick={() => buyGlobalUpgrade('fireRate', 350)} />
                    <ShopItem label="אנרגיה +60" cost={200} onClick={() => buyGlobalUpgrade('energy', 200)} />
                    <ShopItem label="תנועה +15%" cost={300} onClick={() => buyGlobalUpgrade('speed', 300)} />
                </div>
              </div>

              {/* Weapon Mastery */}
              <div className="space-y-4">
                <h3 className="text-2xl font-black text-green-600 dark:text-green-400 text-right underline">מומחיות בנשק: {weapon}</h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 flex flex-col items-center gap-4">
                    <div className="text-lg font-black dark:text-white">רמה נוכחית: {currentWeaponStats.level}</div>
                    <ul className="text-sm text-right w-full dark:text-slate-300 list-disc list-inside">
                        <li>נזק נשק: +{(currentWeaponStats.damageBonus * 100).toFixed(0)}%</li>
                        <li>קצב אש: +{(currentWeaponStats.fireRateBonus * 100).toFixed(0)}%</li>
                        <li>יכולת מיוחדת רמה {currentWeaponStats.level}</li>
                    </ul>
                    <ShopItem 
                        label={`שדרג את ה-${weapon}`} 
                        cost={weaponUpgradeCost} 
                        className="w-full bg-yellow-400 border-yellow-600 text-slate-900" 
                        onClick={() => buyWeaponUpgrade(weapon, weaponUpgradeCost)} 
                    />
                </div>
              </div>
            </div>

            <button 
              onClick={nextLevel}
              className="w-full py-4 bg-green-500 hover:bg-green-600 text-white text-3xl font-black rounded-xl transition-all shadow-lg border-b-8 border-green-800"
            >
              המשך לשלב הבא ➔
            </button>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-auto">
          <div className="text-center flex flex-col gap-6">
            <h2 className="text-8xl font-black text-white drop-shadow-lg">השהיה</h2>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setIsPaused(false)} className="px-12 py-4 bg-yellow-400 text-slate-900 text-3xl font-black rounded-2xl hover:scale-110 transition-transform shadow-xl">המשך</button>
              <button onClick={resetGame} className="px-12 py-4 bg-red-600 text-white text-3xl font-black rounded-2xl hover:scale-110 transition-transform shadow-xl">איפוס</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getWeaponColor = (type: WeaponType) => {
    switch(type) {
        case WeaponType.BRICK_GUN: return '#DC2626';
        case WeaponType.BOMB: return '#1E293B';
        case WeaponType.RAY: return '#06B6D4';
        case WeaponType.SHOTGUN: return '#2563EB';
        case WeaponType.LEGO_LAUNCHER: return '#16A34A';
        case WeaponType.MINIGUN: return '#F59E0B';
        case WeaponType.PLASMA_CUBE: return '#8B5CF6';
        default: return '#666';
    }
}

const WeaponBtn = ({ active, color, num, label, onClick, lvl }: any) => (
  <button onClick={onClick} className={`relative min-w-[60px] h-14 md:min-w-[70px] md:h-16 rounded-2xl flex flex-col items-center justify-center border-4 transition-all ${active ? 'bg-white border-yellow-400 scale-110 shadow-2xl' : 'bg-slate-800 border-slate-700 opacity-70'}`}>
    <div className="w-5 h-5 md:w-6 md:h-6 rounded-sm shadow-inner" style={{ backgroundColor: color }} />
    <span className="text-[9px] font-black mt-1 dark:text-white uppercase truncate px-1">{label}</span>
    <span className="absolute -top-1 -right-1 bg-slate-900 text-white w-5 h-5 rounded-full text-[10px] font-bold border-2 border-white flex items-center justify-center">{num}</span>
    {lvl > 1 && <span className="absolute -bottom-1 -left-1 bg-green-500 text-white px-1 rounded text-[8px] font-bold border border-white">Lvl {lvl}</span>}
  </button>
);

const ShopItem = ({ label, cost, onClick, className }: any) => (
  <button onClick={onClick} className={`p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-yellow-400 transition-all flex flex-col items-center group ${className}`}>
    <span className="text-sm font-black dark:text-white mb-2">{label}</span>
    <span className="text-xs font-bold text-yellow-600 group-hover:scale-110 transition-transform">{cost} Studs</span>
  </button>
);

const MobileBtn = ({ label, onDown, onUp }: any) => (
  <button 
    className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-xl border-2 border-white/40 text-white font-black text-3xl active:bg-white/40 active:scale-90 transition-all select-none touch-none" 
    onPointerDown={onDown} 
    onPointerUp={onUp} 
    onPointerLeave={onUp}
    onContextMenu={(e) => e.preventDefault()}
  >
    {label}
  </button>
);

export default Game;
