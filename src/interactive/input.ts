import type { KeyAction } from './types.js';

export interface KeyDescriptor {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

export function mapKeyToAction(str: string | undefined, key: KeyDescriptor | undefined): KeyAction {
  if (key?.ctrl && key.name === 'c') {
    return 'QUIT';
  }

  const name = key?.name?.toLowerCase();
  const char = str?.toLowerCase();

  if (name === 'up' || char === 'k') {
    return 'UP';
  }

  if (name === 'down' || char === 'j') {
    return 'DOWN';
  }

  if (name === 'pageup') {
    return 'PAGE_UP';
  }

  if (name === 'pagedown') {
    return 'PAGE_DOWN';
  }

  if (name === 'home') {
    return 'HOME';
  }

  if (name === 'end') {
    return 'END';
  }

  if (name === 'return' || name === 'enter') {
    return 'ENTER';
  }

  if (name === 'escape' || name === 'backspace') {
    return 'BACK';
  }

  if (char === 'q') {
    return 'QUIT';
  }

  if (char === 'd') {
    return 'DIFF';
  }

  return 'NONE';
}
