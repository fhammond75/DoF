'use strict';

const assert = require('assert');
const {
  computeDoF,
  phoneEquivToReal,
  convertDisplayDistance,
  formatDistance,
} = require('../js/engine.js');

const TOLERANCE = 0.01; // 1%

function assertApprox(actual, expected, label) {
  const diff = Math.abs(actual - expected) / expected;
  assert.ok(diff <= TOLERANCE, `${label}: expected ~${expected}, got ${actual} (diff ${(diff*100).toFixed(2)}%)`);
}

// Test 1: FF, f=50, N=2.8, s=3000, c=0.029
{
  const r = computeDoF(50, 2.8, 0.029, 3000);
  assert.ok(r !== null, 'Test 1: result should not be null');
  assertApprox(r.H, 30838, 'T1 hyperfocal');
  assertApprox(r.Dn, 2738, 'T1 near');
  assertApprox(r.Df, 3318, 'T1 far');
  assertApprox(r.total, 580, 'T1 total');
  console.log('PASS: Test 1 — FF normal case');
}

// Test 2: FF, f=50, N=8, s=35000, c=0.029 — past hyperfocal
{
  const r = computeDoF(50, 8, 0.029, 35000);
  assert.ok(r !== null, 'Test 2: result should not be null');
  assertApprox(r.H, 10826, 'T2 hyperfocal');
  assertApprox(r.Dn, 8248, 'T2 near');
  assert.strictEqual(r.Df, Infinity, 'T2 far should be Infinity');
  assert.strictEqual(r.total, Infinity, 'T2 total should be Infinity');
  console.log('PASS: Test 2 — FF past hyperfocal');
}

// Test 3: Phone focal length conversion
{
  const fReal = phoneEquivToReal(24, 3.5);
  assertApprox(fReal, 24 / 3.5, 'T3 phone focal conversion');
  console.log('PASS: Test 3 — phone focal conversion');
}

// Test 4: Unit toggle round-trip (3m → feet → meters)
{
  const original = 3;
  const inFeet = convertDisplayDistance(original, 'm', 'ft');
  const backToM = convertDisplayDistance(inFeet, 'ft', 'm');
  assertApprox(backToM, original, 'T4 unit round-trip');
  console.log('PASS: Test 4 — unit toggle round-trip');
}

// Test 5: Empty / zero input → null, no throw
{
  assert.strictEqual(computeDoF(0, 2.8, 0.029, 3000), null, 'T5a zero f');
  assert.strictEqual(computeDoF(50, 0, 0.029, 3000), null, 'T5b zero N');
  assert.strictEqual(computeDoF(50, 2.8, 0, 3000), null, 'T5c zero c');
  assert.strictEqual(computeDoF(50, 2.8, 0.029, 0), null, 'T5d zero s');
  assert.strictEqual(computeDoF(NaN, 2.8, 0.029, 3000), null, 'T5e NaN f');
  console.log('PASS: Test 5 — invalid inputs return null');
}

// Test 6: formatDistance
{
  assert.strictEqual(formatDistance(Infinity, 'm'), '∞', 'T6a infinity');
  assert.strictEqual(formatDistance(null, 'm'), '—', 'T6b null');
  assert.strictEqual(formatDistance(3000, 'm'), '3.00m', 'T6c meters');
  assert.strictEqual(formatDistance(150, 'm'), '15.0cm', 'T6d cm');
  assert.strictEqual(formatDistance(5, 'm'), '5mm', 'T6e mm');
  console.log('PASS: Test 6 — formatDistance');
}

console.log('\nAll tests passed.');
