/**
 * engine.js — Pure DoF math, no DOM dependencies.
 * All internal calculations in millimeters.
 */

/**
 * Compute depth-of-field values.
 * @param {number} f  - focal length (mm)
 * @param {number} N  - aperture (f-number)
 * @param {number} c  - circle of confusion (mm)
 * @param {number} s  - subject distance (mm)
 * @returns {object|null} DoF result or null on invalid input
 */
function computeDoF(f, N, c, s) {
  // Validate all inputs
  if (
    !isFinite(f) || f <= 0 ||
    !isFinite(N) || N <= 0 ||
    !isFinite(c) || c <= 0 ||
    !isFinite(s) || s <= 0
  ) {
    return null;
  }

  const H = (f * f) / (N * c) + f;

  const Dn = (s * (H - f)) / (H + s - 2 * f);

  let Df;
  if ((H - s) <= 0) {
    Df = Infinity;
  } else {
    Df = (s * (H - f)) / (H - s);
  }

  const total = Df === Infinity ? Infinity : Df - Dn;
  const front = s - Dn;
  const behind = Df === Infinity ? Infinity : Df - s;

  return {
    H,
    Dn,
    Df,
    total,
    front: front < 0 ? null : front,
    behind,
  };
}

/**
 * Convert equivalent focal length to real focal length for phones.
 * @param {number} fEquiv - equivalent focal length (mm)
 * @param {number} cropFactor - sensor crop factor
 * @returns {number} real focal length (mm)
 */
function phoneEquivToReal(fEquiv, cropFactor) {
  return fEquiv / cropFactor;
}

/**
 * Convert millimeters to feet and inches.
 * @param {number} mm
 * @returns {{ feet: number, inches: number, totalInches: number }}
 */
function mmToFeetInches(mm) {
  const totalInches = mm * 0.0393701;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return { feet, inches, totalInches };
}

/**
 * Convert feet (decimal) to millimeters.
 * @param {number} feet - feet as a decimal number
 * @returns {number} mm
 */
function feetToMm(feet) {
  return feet * 304.8;
}

/**
 * Convert millimeters to meters.
 * @param {number} mm
 * @returns {number}
 */
function mmToMeters(mm) {
  return mm / 1000;
}

/**
 * Convert meters to millimeters.
 * @param {number} m
 * @returns {number}
 */
function metersToMm(m) {
  return m * 1000;
}

/**
 * Format a distance value (in mm) for display.
 * @param {number|null} mm - distance in mm, or Infinity, or null
 * @param {'m'|'ft'} unit - display unit
 * @returns {string}
 */
function formatDistance(mm, unit) {
  if (mm === null || mm === undefined) return '—';
  if (mm === Infinity || !isFinite(mm)) return '∞';
  if (mm <= 0) return '—';

  if (unit === 'ft') {
    const { feet, inches, totalInches } = mmToFeetInches(mm);
    if (totalInches >= 12) {
      return `${feet}′ ${inches.toFixed(1)}″`;
    } else {
      return `${totalInches.toFixed(1)}″`;
    }
  } else {
    // Meters mode
    if (mm >= 1000) {
      return `${(mm / 1000).toFixed(2)}m`;
    } else if (mm >= 10) {
      return `${(mm / 10).toFixed(1)}cm`;
    } else {
      return `${Math.round(mm)}mm`;
    }
  }
}

/**
 * Parse a user-entered focus distance string into mm.
 * @param {string|number} val - raw input
 * @param {'m'|'ft'} unit - current unit mode
 * @returns {number|null} distance in mm, or null on invalid
 */
function parseDistance(val, unit) {
  const n = parseFloat(val);
  if (!isFinite(n) || n <= 0) return null;

  if (unit === 'ft') {
    return feetToMm(n);
  } else {
    return metersToMm(n);
  }
}

/**
 * Convert a focus distance value from one unit display to another.
 * Returns the new display value (as a number) for the input field.
 * @param {number} displayVal - current displayed value
 * @param {'m'|'ft'} fromUnit
 * @param {'m'|'ft'} toUnit
 * @returns {number}
 */
function convertDisplayDistance(displayVal, fromUnit, toUnit) {
  if (!isFinite(displayVal) || displayVal <= 0) return displayVal;
  if (fromUnit === toUnit) return displayVal;

  // Convert to mm first
  let mm;
  if (fromUnit === 'ft') {
    mm = feetToMm(displayVal);
  } else {
    mm = metersToMm(displayVal);
  }

  // Convert mm to target unit
  if (toUnit === 'ft') {
    const { totalInches } = mmToFeetInches(mm);
    return parseFloat((totalInches / 12).toFixed(4));
  } else {
    return parseFloat((mm / 1000).toFixed(4));
  }
}

// Export for Node.js (tests) while still usable in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeDoF,
    phoneEquivToReal,
    mmToFeetInches,
    feetToMm,
    mmToMeters,
    metersToMm,
    formatDistance,
    parseDistance,
    convertDisplayDistance,
  };
}
