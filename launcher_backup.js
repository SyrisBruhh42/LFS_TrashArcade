/* Storage operations return truthful outcomes; failed rollback retains recovery data. */
(function (root) {
  'use strict';
  const keyPattern = /^arcade_game_[A-Za-z0-9_-]{1,180}$/;
  // The 6M-character payload can expand to 36M JSON bytes (escaped controls),
  // then 48M Base64 characters. Include bounded JSON/key overhead as well.
  const maxEncodedLength = 50000000;
  function validate(bundle) {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('Invalid save bundle.');
    const entries = Object.entries(bundle);
    if (entries.length > 1000) throw new Error('Save bundle is too large.');
    let size = 0;
    for (const [key, value] of entries) {
      if (!keyPattern.test(key) || typeof value !== 'string') throw new Error('Invalid save key or value.');
      size += key.length + value.length;
      if (value.length > 1500000 || size > 6000000) throw new Error('Save bundle is too large.');
    }
    return entries;
  }
  function snapshot(storage) {
    const bundle = Object.create(null);
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('arcade_game_')) bundle[key] = storage.getItem(key);
    }
    validate(bundle);
    return bundle;
  }
  function restore(storage, bundle) {
    const entries = validate(bundle); // Validate the entire bundle before the first write.
    const before = Object.create(null), attempted = [];
    for (const [key] of entries) before[key] = storage.getItem(key);
    try {
      for (const [key, value] of entries) {
        attempted.push(key);
        storage.setItem(key, value);
        if (storage.getItem(key) !== value) throw new Error('Save readback failed.');
      }
      return {status: 'restored', count: entries.length};
    } catch (error) {
      const failed = [];
      for (const key of attempted.reverse()) {
        try {
          if (before[key] === null) storage.removeItem(key);
          else storage.setItem(key, before[key]);
          if (storage.getItem(key) !== before[key]) throw new Error('Recovery readback failed.');
        } catch (_) { failed.push(key); }
      }
      const recovery = Object.fromEntries(Object.entries(before).filter(([,value]) => value !== null));
      return {status: failed.length ? 'recovery_required' : 'rolled_back', count: 0,
              unresolved: failed, recovery, originallyAbsent: Object.keys(before).filter(key => before[key] === null)};
    }
  }
  function recover(storage, prior) {
    // The caller retains the original receipt until every prior value is read back.
    // Prior storage can predate today's import budgets. Recovery must retain
    // exact original bytes rather than reject an older, larger save.
    const entries = Object.entries(prior.recovery);
    if (entries.some(([key, value]) => !keyPattern.test(key) || typeof value !== 'string')) throw new Error('Invalid recovery receipt.');
    const absent = prior.originallyAbsent;
    if (!Array.isArray(absent) || absent.some(key => !keyPattern.test(key))) throw new Error('Invalid recovery receipt.');
    const unresolved = [];
    for (const [key, value] of [...entries, ...absent.map(key => [key, null])]) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
        if (storage.getItem(key) !== value) throw new Error('Recovery readback failed.');
      } catch (_) { unresolved.push(key); }
    }
    return {...prior, status: unresolved.length ? 'recovery_required' : 'recovered', unresolved};
  }
  root.ArcadeBackup = {snapshot, restore, recover, validate, maxEncodedLength};
})(typeof window !== 'undefined' ? window : globalThis);
