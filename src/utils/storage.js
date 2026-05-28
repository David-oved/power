// SafeStorage Adapter to handle Private Browsing & Quota Limits safely
export const SafeStorage = {
  _fallbackMem: {},
  _failedKeys: {},
  _isSupportedCache: null,
  
  isSupported() {
    if (this._isSupportedCache !== null) {
      return this._isSupportedCache;
    }
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      this._isSupportedCache = true;
    } catch (e) {
      this._isSupportedCache = false;
    }
    return this._isSupportedCache;
  },
  
  getItem(key) {
    if (this.isSupported() && !this._failedKeys[key]) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        return val;
      }
    }
    return this._fallbackMem[key] !== undefined ? this._fallbackMem[key] : null;
  },
  
  setItem(key, value) {
    this._fallbackMem[key] = String(value);
    if (this.isSupported()) {
      try {
        localStorage.setItem(key, value);
        delete this._failedKeys[key];
        return;
      } catch (e) {
        console.warn("Storage write failed (quota exceeded?):", e);
        this._failedKeys[key] = true;
      }
    }
  },
  
  removeItem(key) {
    delete this._fallbackMem[key];
    delete this._failedKeys[key];
    if (this.isSupported()) {
      localStorage.removeItem(key);
    }
  }
};
