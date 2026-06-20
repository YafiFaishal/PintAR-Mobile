/**
 * PintAR Mobile — Sensor Manager
 * Lightweight sensor abstraction for budget phones.
 * Handles accelerometer, gyroscope, shake detection with iOS permission.
 */

export class SensorManager {
  constructor() {
    this.availability = { accelerometer: false, gyroscope: false, camera: false };
    this.listeners = {};
    this.lastMotion = { x: 0, y: 0, z: 0 };
    this.lastOrientation = { alpha: 0, beta: 0, gamma: 0 };
    this.shakeThreshold = 15;
    this.lastShakeTime = 0;
    this._motionBound = this._onMotion.bind(this);
    this._orientBound = this._onOrient.bind(this);
    this._listening = false;
  }

  async checkAvailability() {
    this.availability.accelerometer = typeof DeviceMotionEvent !== 'undefined';
    this.availability.gyroscope = typeof DeviceOrientationEvent !== 'undefined';
    this.availability.camera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    return { ...this.availability };
  }

  needsIOSPermission() {
    return typeof DeviceMotionEvent !== 'undefined' &&
           typeof DeviceMotionEvent.requestPermission === 'function';
  }

  async requestPermissions() {
    const result = { motion: false, orientation: false };
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      try {
        result.motion = (await DeviceMotionEvent.requestPermission()) === 'granted';
      } catch { result.motion = false; }
    } else {
      result.motion = true;
    }
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      try {
        result.orientation = (await DeviceOrientationEvent.requestPermission()) === 'granted';
      } catch { result.orientation = false; }
    } else {
      result.orientation = true;
    }
    return result;
  }


  startAccelerometer(cb) {
    if (!this.availability.accelerometer) return false;
    this.listeners.accel = cb;
    this._ensureMotionListener();
    return true;
  }

  startGyroscope(cb) {
    if (!this.availability.gyroscope) return false;
    this.listeners.gyro = cb;
    window.addEventListener('deviceorientation', this._orientBound);
    return true;
  }

  detectShake(threshold, cb) {
    this.shakeThreshold = threshold || 15;
    this.listeners.shake = cb;
    this._ensureMotionListener();
  }

  getOrientation() { return { ...this.lastOrientation }; }
  getAcceleration() { return { ...this.lastMotion }; }

  getTilt() {
    return {
      pitch: this.lastOrientation.beta || 0,
      roll: this.lastOrientation.gamma || 0
    };
  }

  _ensureMotionListener() {
    if (!this._listening) {
      window.addEventListener('devicemotion', this._motionBound);
      this._listening = true;
    }
  }

  _onMotion(e) {
    const acc = e.accelerationIncludingGravity || {};
    this.lastMotion = { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 };
    if (this.listeners.accel) this.listeners.accel({ ...this.lastMotion });

    // Shake detection
    if (this.listeners.shake) {
      const mag = Math.sqrt(this.lastMotion.x ** 2 + this.lastMotion.y ** 2 + this.lastMotion.z ** 2);
      const intensity = Math.abs(mag - 9.81);
      if (intensity > this.shakeThreshold) {
        const now = Date.now();
        if (now - this.lastShakeTime > 500) {
          this.lastShakeTime = now;
          this.listeners.shake({ intensity });
        }
      }
    }
  }

  _onOrient(e) {
    this.lastOrientation = { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 };
    if (this.listeners.gyro) this.listeners.gyro({ ...this.lastOrientation });
  }

  stopAll() {
    window.removeEventListener('devicemotion', this._motionBound);
    window.removeEventListener('deviceorientation', this._orientBound);
    this.listeners = {};
    this._listening = false;
  }
}

// Singleton
export const sensorManager = new SensorManager();
