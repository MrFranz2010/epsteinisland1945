(() => {
  const params = new URLSearchParams(location.search);
  const profileId = params.get('profile') || 'default';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(profileId)) {
    throw new Error('Profilo PolyTrack non valido.');
  }

  const nativeStorage = window.localStorage;
  const profilePrefix = `racing-zone:polytrack:${profileId}:`;
  const legacyKeys = new Set(['car_colors', 'v1_car', 'v2_user', 'settings', 'key_bindings', 'user_slot']);
  const isLegacyGameKey = (key) => key.startsWith('polytrack_')
    || key.startsWith('record_')
    || key.startsWith('track_')
    || key.startsWith('user_')
    || legacyKeys.has(key);

  if (profileId === 'default') {
    for (const key of Object.keys(nativeStorage)) {
      if (!isLegacyGameKey(key)) continue;
      const isolatedKey = `${profilePrefix}${key}`;
      if (nativeStorage.getItem(isolatedKey) === null) {
        nativeStorage.setItem(isolatedKey, nativeStorage.getItem(key));
      }
    }
  }

  function profileKeys() {
    return Object.keys(nativeStorage)
      .filter((key) => key.startsWith(profilePrefix))
      .map((key) => key.slice(profilePrefix.length));
  }

  const storage = new Proxy(nativeStorage, {
    get(target, property) {
      if (property === 'length') return profileKeys().length;
      if (property === Symbol.toStringTag) return 'Storage';
      if (property === 'getItem') return (key) => target.getItem(`${profilePrefix}${String(key)}`);
      if (property === 'setItem') return (key, value) => target.setItem(`${profilePrefix}${String(key)}`, String(value));
      if (property === 'removeItem') return (key) => target.removeItem(`${profilePrefix}${String(key)}`);
      if (property === 'clear') {
        return () => {
          for (const key of profileKeys()) target.removeItem(`${profilePrefix}${key}`);
        };
      }
      if (property === 'key') return (index) => profileKeys()[Number(index)] ?? null;
      if (typeof property === 'string' && /^\d+$/.test(property)) return profileKeys()[Number(property)];
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    ownKeys() {
      return profileKeys();
    },
    getOwnPropertyDescriptor(_target, property) {
      if (typeof property !== 'string' || !profileKeys().includes(property)) return undefined;
      return { configurable: true, enumerable: true, value: storage.getItem(property), writable: true };
    },
    set(_target, property, value) {
      if (typeof property !== 'string') return false;
      storage.setItem(property, value);
      return true;
    },
  });

  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
})();
