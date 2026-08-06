import { TextDecoder, TextEncoder } from 'node:util';
import '@testing-library/jest-dom';

// jsdom ships neither encoder; react-router reaches for TextEncoder on import.
globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder as typeof globalThis.TextDecoder;
