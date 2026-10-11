import path from 'node:path';
import {tmpdir} from 'node:os';

// Audit writes use a fixed namespace, never an environment-selected destination.
export function auditEvidenceDirectory(){return path.join(tmpdir(),'atlas-browser-evidence');}
