/**
 * app.js — DOM wiring for the DoF calculator.
 */

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  const PRESETS_M = [0.5, 1.5, 3.0, 6.0, 15.0, 50.0];
  const PRESET_LABELS = ["Arm's length", 'Portrait', 'Group', 'Room', 'Street', 'Landscape'];

  // ── State ────────────────────────────────────────────────────────────────
  let currentUnit = 'm'; // 'm' or 'ft'
  let currentCategory = 'camera'; // 'camera' or 'phone'
  let easyMode = false; // true = easy mode, false = advanced
  let userForcedMode = false; // has user manually toggled?

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
  const advancedFields = document.getElementById('advanced-fields');
  const distanceSlider = document.getElementById('distance-slider');
  const presetLabelsContainer = document.getElementById('preset-labels');
  const modeToggleBtn = document.getElementById('mode-toggle-btn');
  const easyResultsPanel = document.getElementById('easy-results');
  const easyResultContent = document.getElementById('easy-result-content');
  const advancedResultsPanel = document.getElementById('advanced-results');
  const sceneSvg = document.getElementById('scene-svg');

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

  // ── Slider math ───────────────────────────────────────────────────────────
  function sliderToDistance(val) {
    // log scale: 0 → 0.3m, 1000 → 150m
    const minM = 0.3, maxM = 150;
    const t = val / 1000;
    const distM = minM * Math.pow(maxM / minM, t);
    return currentUnit === 'm' ? distM : distM * 3.28084;
  }

  function distanceToSlider(dist) {
    const distM = currentUnit === 'm' ? dist : dist / 3.28084;
    const minM = 0.3, maxM = 150;
    const t = Math.log(distM / minM) / Math.log(maxM / minM);
    const clamped = Math.min(1, Math.max(0, t));
    return Math.round(clamped * 1000);
  }

  // ── Preset labels ─────────────────────────────────────────────────────────
  function buildPresetLabels() {
    presetLabelsContainer.innerHTML = '';
    presetLabelsContainer.style.position = 'relative';
    presetLabelsContainer.style.height = '20px';

    PRESETS_M.forEach(function (distM, i) {
      const sliderVal = (function () {
        const minM = 0.3, maxM = 150;
        const t = Math.log(distM / minM) / Math.log(maxM / minM);
        return Math.min(1, Math.max(0, t));
      })();
      const pct = (sliderVal * 100).toFixed(2);

      const span = document.createElement('span');
      span.className = 'preset-label-item';
      span.textContent = PRESET_LABELS[i];
      span.style.left = pct + '%';
      presetLabelsContainer.appendChild(span);
    });
  }

  // ── Mode UI ───────────────────────────────────────────────────────────────
  function applyMode() {
    if (easyMode) {
      advancedFields.style.display = 'none';
      easyResultsPanel.style.display = 'block';
      advancedResultsPanel.style.display = 'none';
      modeToggleBtn.textContent = 'Advanced ▾';
    } else {
      advancedFields.style.display = 'block';
      easyResultsPanel.style.display = 'none';
      advancedResultsPanel.style.display = 'block';
      modeToggleBtn.textContent = 'Simple ▴';
    }
  }

  function setMode(easy) {
    easyMode = easy;
    applyMode();
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    populateApertures();
    populateModels('camera');
    setCategory('camera');
    buildPresetLabels();
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
      if (!userForcedMode) setMode(false);
    } else {
      modelLabel.textContent = 'Camera / sensor';
      focalLabel.textContent = 'Focal length (equiv.)';
      focalHint.textContent = 'Use the equivalent mm shown in your camera app (e.g. 24mm = 1×).';
      focalInput.value = DEFAULT_FOCAL_PHONE;
      if (!userForcedMode) setMode(true);
      autoFillPhone();
    }
  }

  function autoFillPhone() {
    const device = getDevice();
    if (!device || !device.equivalent) return;

    // Set focal length
    focalInput.value = DEFAULT_FOCAL_PHONE;

    // Set aperture — find closest in APERTURES list
    if (device.aperture) {
      let closest = APERTURES[0];
      let minDiff = Math.abs(APERTURES[0] - device.aperture);
      APERTURES.forEach(function (ap) {
        const diff = Math.abs(ap - device.aperture);
        if (diff < minDiff) {
          minDiff = diff;
          closest = ap;
        }
      });
      apertureSelect.value = closest;
    }
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  function attachListeners() {
    categorySelect.addEventListener('change', function () {
      userForcedMode = false; // reset user preference on category change
      setCategory(categorySelect.value);
      recompute();
    });

    modelSelect.addEventListener('change', function () {
      if (currentCategory === 'phone' && easyMode) {
        autoFillPhone();
      }
      recompute();
    });

    focalInput.addEventListener('input', recompute);
    apertureSelect.addEventListener('change', recompute);

    distanceInput.addEventListener('input', function () {
      const val = parseFloat(distanceInput.value);
      if (isFinite(val) && val > 0) {
        distanceSlider.value = distanceToSlider(val);
      }
      recompute();
    });

    distanceSlider.addEventListener('input', function () {
      const dist = sliderToDistance(parseInt(distanceSlider.value, 10));
      distanceInput.value = parseFloat(dist.toFixed(3));
      recompute();
    });

    modeToggleBtn.addEventListener('click', function () {
      userForcedMode = true;
      setMode(!easyMode);
      recompute();
    });

    unitBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const newUnit = btn.dataset.unit;
        if (newUnit === currentUnit) return;

        // Convert current distance value
        const currentVal = parseFloat(distanceInput.value);
        if (isFinite(currentVal) && currentVal > 0) {
          const converted = convertDisplayDistance(currentVal, currentUnit, newUnit);
          distanceInput.value = parseFloat(converted.toFixed(3));
        }

        currentUnit = newUnit;
        unitBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.unit === newUnit); });

        // Sync slider with new unit
        const newVal = parseFloat(distanceInput.value);
        if (isFinite(newVal) && newVal > 0) {
          distanceSlider.value = distanceToSlider(newVal);
        }

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

    // Sync slider if needed
    if (s !== null) {
      distanceSlider.value = distanceToSlider(distVal);
    }

    // Compute
    let result = null;
    if (f !== null && s !== null && isFinite(N) && N > 0) {
      result = computeDoF(f, N, c, s);
    }

    renderResults(result, s, device);
    updateSceneSvg(result, s);
    updateEasyResults(result, s);
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
    if (cap <= subject) cap = subject * 1.5;

    // sqrt scale mapping
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

    barLabelNear.style.left = nearPct.toFixed(2) + '%';
    barLabelSubject.style.left = subjectPct.toFixed(2) + '%';
    barLabelFar.style.left = (isInfFar ? 100 : farPct).toFixed(2) + '%';
  }

  // ── Scene SVG ─────────────────────────────────────────────────────────────
  function updateSceneSvg(result, s) {
    const W = 390; // viewBox width
    const H = 60;  // viewBox height
    const personX = 30;

    if (!result || !s) {
      sceneSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      sceneSvg.innerHTML =
        '<rect width="' + W + '" height="' + H + '" fill="#f0f0f2" rx="5"/>' +
        drawPerson(personX, H);
      return;
    }

    // Map distances to x positions using sqrt scale
    // Range: 0 to s*2.2 (or far*1.08) in mm
    const isInfFar = result.Df === Infinity || !isFinite(result.Df);
    let cap;
    if (isInfFar) {
      cap = s * 2.2;
    } else {
      cap = result.Df * 1.08;
    }
    if (cap <= s) cap = s * 1.5;

    // Map mm distances to x pixels: person at left, distances extend right
    // Available x range: personX+20 to W-10
    const xStart = personX + 20;
    const xEnd = W - 10;
    const xRange = xEnd - xStart;

    function distToX(mm) {
      if (mm <= 0) return xStart;
      if (mm >= cap) return xEnd;
      return xStart + Math.sqrt(mm / cap) * xRange;
    }

    const nearX = distToX(result.Dn);
    const subjectX = distToX(s);
    const farX = isInfFar ? xEnd : distToX(result.Df);

    const midY = H / 2;

    let html = '<rect width="' + W + '" height="' + H + '" fill="#f0f0f2" rx="5"/>';

    // Green focus zone band
    html += '<rect x="' + nearX.toFixed(1) + '" y="10" width="' + (farX - nearX).toFixed(1) +
      '" height="' + (H - 20) + '" fill="rgba(52,199,89,0.2)" stroke="rgba(52,199,89,0.5)" stroke-width="1" rx="2"/>';

    // Near tick
    html += '<line x1="' + nearX.toFixed(1) + '" y1="8" x2="' + nearX.toFixed(1) + '" y2="' + (H - 8) + '" stroke="rgba(52,199,89,0.7)" stroke-width="1.5"/>';

    // Far tick
    if (!isInfFar) {
      html += '<line x1="' + farX.toFixed(1) + '" y1="8" x2="' + farX.toFixed(1) + '" y2="' + (H - 8) + '" stroke="rgba(52,199,89,0.7)" stroke-width="1.5"/>';
    }

    // Subject (focus point) — blue vertical line
    html += '<line x1="' + subjectX.toFixed(1) + '" y1="4" x2="' + subjectX.toFixed(1) + '" y2="' + (H - 4) + '" stroke="#007aff" stroke-width="2"/>';

    // Near label
    const u = currentUnit;
    const nearLabel = formatDistance(result.Dn, u);
    const nearLabelX = Math.max(nearX - 2, 35);
    html += '<text x="' + nearLabelX.toFixed(1) + '" y="' + (H - 2) + '" font-size="8" fill="rgba(52,199,89,0.9)" text-anchor="middle">' + nearLabel + '</text>';

    // Far label
    const farLabel = isInfFar ? '∞' : formatDistance(result.Df, u);
    const farLabelX = Math.min(farX + 2, W - 12);
    html += '<text x="' + farLabelX.toFixed(1) + '" y="' + (H - 2) + '" font-size="8" fill="rgba(52,199,89,0.9)" text-anchor="middle">' + farLabel + '</text>';

    // Subject label
    html += '<text x="' + subjectX.toFixed(1) + '" y="' + (H - 2) + '" font-size="8" fill="#007aff" text-anchor="middle">' + formatDistance(s, u) + '</text>';

    // Person figure
    html += drawPerson(personX, H);

    sceneSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    sceneSvg.innerHTML = html;
  }

  function drawPerson(x, H) {
    const headY = 12;
    const headR = 6;
    const bodyTop = headY + headR;
    const bodyBot = H - 10;
    return (
      '<circle cx="' + x + '" cy="' + headY + '" r="' + headR + '" fill="#9a9aa0"/>' +
      '<line x1="' + x + '" y1="' + bodyTop + '" x2="' + x + '" y2="' + bodyBot + '" stroke="#9a9aa0" stroke-width="3"/>'
    );
  }

  // ── Easy results ──────────────────────────────────────────────────────────
  function plainEnglishResult(result, s) {
    if (!result || !s) return '<em>Enter a distance to see results.</em>';

    const u = currentUnit;
    const near = formatDistance(result.Dn, u);
    const far = result.Df === Infinity ? '∞' : formatDistance(result.Df, u);
    const total = result.total === Infinity ? 'the entire scene' : formatDistance(result.total, u);
    const subject = formatDistance(s, u);

    let sentence;
    if (result.total === Infinity) {
      sentence = 'Focused at <strong>' + subject + '</strong> — <strong>everything from ' + near + ' onwards</strong> will be sharp.';
    } else {
      sentence = 'Focused at <strong>' + subject + '</strong> — everything from <strong>' + near + '</strong> to <strong>' + far + '</strong> will be sharp. That\'s a <strong>' + total + '</strong> window of focus.';
    }

    let hint = '';
    if (result.total !== Infinity) {
      const totalMm = result.total;
      if (totalMm < 200) hint = 'Very shallow focus — the background will be beautifully blurred.';
      else if (totalMm < 1000) hint = 'Tight focus — great for portraits.';
      else if (totalMm < 5000) hint = 'Moderate depth — good for groups or environmental shots.';
      else hint = 'Deep focus — most of the scene will be sharp.';
    } else {
      hint = 'Everything in the scene will be sharp from here to the horizon.';
    }

    return '<div class="easy-result-text">' + sentence + '<div class="easy-result-hint">' + hint + '</div></div>';
  }

  function updateEasyResults(result, s) {
    if (!easyMode) return;
    easyResultContent.innerHTML = plainEnglishResult(result, s);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
