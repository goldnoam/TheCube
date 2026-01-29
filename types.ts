
export enum WeaponType {
  BRICK_GUN = 'BRICK_GUN',
  BOMB = 'BOMB',
  RAY = 'RAY',
  SHOTGUN = 'SHOTGUN',
  LEGO_LAUNCHER = 'LEGO_LAUNCHER',
  MINIGUN = 'MINIGUN',
  PLASMA_CUBE = 'PLASMA_CUBE'
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
  specialValue: number; // e.g., bounces, radius, pellet count
}

export interface Upgrades {
  damageMult: number;
  fireRateMult: number;
  energyMax: number;
  healthMax: number;
  speedMult: number;
  weapons: Record<WeaponType, WeaponStats>;
}

export interface Player extends GameObject {
  health: number;
  weapon: WeaponType;
  isJumping: boolean;
  facingRight: boolean;
  energy: number;
  upgrades: Upgrades;
}

export interface Enemy extends GameObject {
  health: number;
  type: 'crawler' | 'giant' | 'fast_runner' | 'tank';
  isDebris?: boolean;
}

export interface Projectile extends GameObject {
  type: WeaponType;
  damage: number;
  life: number;
  bounces?: number;
  piercing?: boolean;
}

export interface Particle extends GameObject {
  life: number;
  maxLife: number;
  rotation: number;
  rotationVel: number;
}
