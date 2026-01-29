
export enum WeaponType {
  BRICK_GUN = 'BRICK_GUN',
  BOMB = 'BOMB',
  RAY = 'RAY',
  SHOTGUN = 'SHOTGUN',
  LEGO_LAUNCHER = 'LEGO_LAUNCHER',
  MINIGUN = 'MINIGUN',
  PLASMA_CUBE = 'PLASMA_CUBE'
}

export enum PowerUpType {
  HEAL = 'HEAL',
  DOUBLE_DAMAGE = 'DOUBLE_DAMAGE',
  SHIELD_REFILL = 'SHIELD_REFILL',
  INFINITE_ENERGY = 'INFINITE_ENERGY'
}

export interface Vector {
  x: number;
  y: number;
}

export interface GameObject {
  id: string;
  pos: Vector;
  vel: Vector;
  width: number;
  height: number;
  color: string;
}

export interface WeaponStats {
  level: number;
  damageBonus: number;
  fireRateBonus: number;
  specialValue: number; 
}

export interface Upgrades {
  damageMult: number;
  fireRateMult: number;
  energyMax: number;
  healthMax: number;
  speedMult: number;
  shieldMax: number;
  shieldRegenRate: number;
  weapons: Record<WeaponType, WeaponStats>;
}

export interface Player extends GameObject {
  health: number;
  shield: number;
  weapon: WeaponType;
  isJumping: boolean;
  facingRight: boolean;
  energy: number;
  upgrades: Upgrades;
  powerUpTimer: number;
  activePowerUp: PowerUpType | null;
}

export interface Enemy extends GameObject {
  health: number;
  maxHealth: number;
  type: 'crawler' | 'giant' | 'fast_runner' | 'tank' | 'boss';
  isDebris?: boolean;
  bossPattern?: number;
  attackTimer?: number;
}

export interface Projectile extends GameObject {
  type: WeaponType;
  damage: number;
  life: number;
  bounces?: number;
  piercing?: boolean;
  fromEnemy?: boolean;
}

export interface PowerUp extends GameObject {
  type: PowerUpType;
  life: number;
}

export interface Particle extends GameObject {
  life: number;
  maxLife: number;
  rotation: number;
  rotationVel: number;
}

export interface HighScore {
  score: number;
  date: string;
}
