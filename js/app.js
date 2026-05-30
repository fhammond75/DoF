/**
 * app.js — DOM wiring for the DoF calculator.
 */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let currentUnit = 'm'; // 'm' or 'ft'
  let currentCategory = 'camera'; // 'camera' or 'phone'

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const categorySelect = document.getElementById('category');
  const modelSelect = document.getElementById('model');
  const modelLabel = document.getElementById('model-label');
  const focalInput = document.getElementById('focal');
  const focalLabel = document.getElementById('focal-label');
  const focalHint = document.getElementById('focal-hint');
  const apertureSelect = document.getElementById('aperture');
  const distanceInput = document.getElementById('distance');
  const unitBtns = document.querySelectorAll('.unit-btn');

  const resultTotal = document.getElementById('result-total');
  const resultNear = document.getElementById('result-near');
  const resultFar = document.getElementById('result-far');
  const resultFront = document.getElementById('result-front');
  const resultBehind = document.getElementById('result-behind');
  const hyperfocalNote = document.getElementById('hyperfocal-note');
  const phoneNote = document.getElementById('phone-note');

  const barTrack = document.getElementById('bar-track');
  const barFill = document.getElementById('bar-fill');
  const barMarker = document.getElementById('bar-marker');
  const barLabelNear = document.getElementById('bar-label-near');
  const barLabelSubject = document.getElementById('bar-label-subject');
  const barLabelFar = document.getElementById('bar-label-far');

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    populateApertures();
    populateModels('camera');
    setCategory('camera');
    attachListeners();
    recompute();
  }

  function populateApertures() {
    APERTURES.forEach(function (ap) {
      const opt = document.createElement('option');
      opt.value = ap;
      opt.textContent = 'f/' + ap;
      if (ap === DEFAULT_APERTURE) opt.selected = true;
      apertureSelect.appendChild(opt);
    });
  }

  function populateModels(category) {
    modelSelect.innerHTML = '';
    const list = category === 'camera' ? CAMERAS : PHONES;
    list.forEach(function (device) {
      const opt = document.createElement('option');
      opt.value = device.id;
      opt.textContent = device.label;
      if (device.default) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  }

  function setCategory(category) {
    currentCategory = category;
    populateModels(category);

    if (category === 'camera') {
      modelLabel.textContent = 'Sensor format';
      focalLabel.textContent = 'Focal length';
      focalHint.textContent = 'As marked on the lens (mm).';
      focalInput.value = DEFAULT_FOCAL_CAMERA;
    } else {
      modelLabel.textContent = 'Camera / sensor';
      focalLabel.textContent = 'Focal length (equiv.)';
      focalHint.textContent = 'Use the equivalent mm shown in your camera app (e.g. 24mm = 1×).';
      focalInput.value = DEFAULT_FOCAL_PHONE;
    }
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  function attachListeners() {
    categorySelect.addEventListener('change', function () {
      setCategory(categorySelect.value);
      recompute();
    });

    modelSelect.addEventListener('change', recompute);
    focalInput.addEventListener('input', recompute);
    apertureSelect.addEventListener('change', recompute);
    distanceInput.addEventListener('input', recompute);

    unitBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const newUnit = btn.dataset.unit;
        if (newUnit === currentUnit) return;

        // Convert current distance value
        const currentVal = parseFloat(distanceInput.value);
        if (isFinite(currentVal) && currentVal > 0) {
          const converted = convertDisplayDistance(currentVal, currentUnit, newUnit);
          // Round nicely
          distanceInput.value = parseFloat(converted.toFixed(3));
        }

        currentUnit = newUnit;
        unitBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.unit === newUnit); });
        recompute();
      });
    });
  }

  // ── Compute ───────────────────────────────────────────────────────────────
  function getDevice() {
    const list = currentCategory === 'camera' ? CAMERAS : PHONES;
    return list.find(function (d) { return d.id === modelSelect.value; }) || list[0];
  }

  function recompute() {
    const device = getDevice();
    const N = parseFloat(apertureSelect.value);
    const c = device.coc;

    // Focal length
    let fEntered = parseFloat(focalInput.value);
    let f;
    if (!isFinite(fEntered) || fEntered <= 0) {
      f = null;
    } else if (device.equivalent) {
      f = phoneEquivToReal(fEntered, device.cropFactor);
    } else {
      f = fEntered;
    }

    // Focus distance — input is in current unit, convert to mm
    let distVal = parseFloat(distanceInput.value);
    let s;
    if (!isFinite(distVal) || distVal <= 0) {
      s = null;
    } else {
      s = currentUnit === 'ft' ? feetToMm(distVal) : metersToMm(distVal);
    }

    // Compute
    let result = null;
    if (f !== null && s !== null && isFinite(N) && N > 0) {
      result = computeDoF(f, N, c, s);
    }

    renderResults(result, s, device);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderResults(result, s, device) {
    if (!result) {
      resultTotal.textContent = '—';
      resultNear.textContent = '—';
      resultFar.textContent = '—';
      resultFront.textContent = '—';
      resultBehind.textContent = '—';
      hyperfocalNote.textContent = '';
      phoneNote.style.display = 'none';
      renderBar(null, null, null);
      return;
    }

    const u = currentUnit;
    resultTotal.textContent = result.total === Infinity ? '∞' : formatDistance(result.total, u);
    resultNear.textContent = formatDistance(result.Dn, u);
    resultFar.textContent = result.Df === Infinity ? '∞' : formatDistance(result.Df, u);
    resultFront.textContent = result.front === null ? '—' : formatDistance(result.front, u);
    resultBehind.textContent = result.behind === Infinity ? '∞' : formatDistance(result.behind, u);

    // Hyperfocal note
    hyperfocalNote.textContent = 'Hyperfocal distance: ' + formatDistance(result.H, u);

    // Phone note
    if (device.equivalent) {
      phoneNote.style.display = 'block';
    } else {
      phoneNote.style.display = 'none';
    }

    renderBar(result.Dn, s, result.Df);
  }

  function renderBar(near, subject, far) {
    if (near === null || subject === null) {
      barFill.style.left = '0%';
      barFill.style.width = '0%';
      barMarker.style.left = '50%';
      barLabelNear.textContent = '';
      barLabelSubject.textContent = '';
      barLabelFar.textContent = '';
      return;
    }

    const u = currentUnit;
    const isInfFar = far === Infinity || !isFinite(far);

    // Cap for display
    let cap;
    if (isInfFar) {
      cap = subject * 2.2;
    } else {
      cap = far * 1.08;
    }
    // Ensure cap is at least a bit beyond subject
    if (cap <= subject) cap = subject * 1.5;

    // sqrt scale mapping: pos(x) = sqrt(x / cap)
    function toPos(x) {
      if (x <= 0) return 0;
      if (x >= cap) return 1;
      return Math.sqrt(x / cap);
    }

    const nearPct = toPos(near) * 100;
    const subjectPct = toPos(subject) * 100;
    const farPct = isInfFar ? 100 : toPos(far) * 100;

    barFill.style.left = nearPct.toFixed(2) + '%';
    barFill.style.width = (farPct - nearPct).toFixed(2) + '%';
    barMarker.style.left = subjectPct.toFixed(2) + '%';

    barLabelNear.textContent = formatDistance(near, u);
    barLabelSubject.textContent = formatDistance(subject, u);
    barLabelFar.textContent = isInfFar ? '∞' : formatDistance(far, u);

    // Position labels
    barLabelNear.style.left = nearPct.toFixed(2) + '%';
    barLabelSubject.style.left = subjectPct.toFixed(2) + '%';
    barLabelFar.style.left = (isInfFar ? 100 : farPct).toFixed(2) + '%';
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
