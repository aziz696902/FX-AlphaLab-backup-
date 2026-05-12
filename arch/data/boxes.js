import { C } from './colors.js';

export const BOXES = [
  { label: 'TECHNICAL AGENT DATA PIPELINE',       groups: ['tech_build'],              color: C.tech  },
  { label: 'TECHNICAL AGENT',                     groups: ['tech'],                    color: C.tech  },
  { label: 'MACRO SIGNAL BUILD PIPELINE',         groups: ['macro_build'],             color: C.macro },
  { label: 'MACRO AGENT',                         groups: ['macro'],                   color: C.macro },
  { label: 'SENTIMENT DATA BUILD PIPELINES',      groups: ['sent_build'],              color: C.sent  },
  { label: 'SENTIMENT AGENT',                     groups: ['sent'],                    color: C.sent  },
  { label: 'GDELT ZONE FEATURES BUILD PIPELINE',  groups: ['geo_build'],               color: C.geo   },
  { label: 'GEOPOLITICAL AGENT',                  groups: ['geo'],                     color: C.geo   },
  { label: 'COORDINATOR',                         groups: ['coord'],                   color: C.alpha },
];
