/**
 * devices.js — Device and sensor data for DoF calculator.
 */

const CAMERAS = [
  {
    id: 'medium-format',
    label: 'Medium Format (44×33)',
    coc: 0.037,
    equivalent: false,
  },
  {
    id: 'full-frame',
    label: 'Full Frame (35mm)',
    coc: 0.029,
    equivalent: false,
    default: true,
  },
  {
    id: 'apsc-sony',
    label: 'APS-C — Sony / Nikon / Fuji',
    coc: 0.019,
    equivalent: false,
  },
  {
    id: 'apsc-canon',
    label: 'APS-C — Canon',
    coc: 0.018,
    equivalent: false,
  },
  {
    id: 'mft',
    label: 'Micro Four Thirds',
    coc: 0.015,
    equivalent: false,
  },
  {
    id: '1inch',
    label: '1-inch compact',
    coc: 0.011,
    equivalent: false,
  },
];

const PHONES = [
  {
    id: 'pro-main',
    label: 'Pro phone — main 1× (1/1.28″)',
    coc: 0.0081,
    cropFactor: 3.5,
    equivalent: true,
  },
  {
    id: 'flagship-main',
    label: 'Flagship — main 1× (1/1.3″)',
    coc: 0.0080,
    cropFactor: 3.6,
    equivalent: true,
  },
  {
    id: 'midrange',
    label: 'Mid-range — main (1/1.7″)',
    coc: 0.0063,
    cropFactor: 4.6,
    equivalent: true,
  },
  {
    id: 'budget',
    label: 'Older / budget (1/2.3″)',
    coc: 0.0051,
    cropFactor: 5.6,
    equivalent: true,
  },
];

const APERTURES = [1.0, 1.2, 1.4, 1.8, 2.0, 2.8, 3.5, 4.0, 5.6, 8, 11, 16, 22];
const DEFAULT_APERTURE = 2.8;

const DEFAULT_FOCAL_CAMERA = 50;
const DEFAULT_FOCAL_PHONE = 24;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CAMERAS,
    PHONES,
    APERTURES,
    DEFAULT_APERTURE,
    DEFAULT_FOCAL_CAMERA,
    DEFAULT_FOCAL_PHONE,
  };
}
