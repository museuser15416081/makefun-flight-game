// Keyboard and pointer. Held keys are read as a live control state; confirm, pause and mute
// are queued as one-shot flags so a fast tap between frames is never swallowed.
// The mouse is an alternative pitch axis: its height over the canvas asks for a climb or a dive.

export const ACT = {
  CONFIRM: 1,
  PAUSE: 2,
  MUTE: 4,
};

const LIFT_KEYS = new Set(['KeyW', 'ArrowUp']);
const SINK_KEYS = new Set(['KeyS', 'ArrowDown']);
const CLIMB_KEYS = new Set(['KeyA', 'ArrowLeft']);
const DIVE_KEYS = new Set(['KeyD', 'ArrowRight']);
const CONFIRM_KEYS = new Set(['Enter', 'Space']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseY = null;
  let mouseAt = 0;

  function onKeyDown(event) {
    if (event.repeat) {
      if (isGameKey(event.code)) event.preventDefault();
      return;
    }
    if (CONFIRM_KEYS.has(event.code)) actions |= ACT.CONFIRM;
    else if (PAUSE_KEYS.has(event.code)) actions |= ACT.PAUSE;
    else if (event.code === 'KeyM') actions |= ACT.MUTE;
    if (isGameKey(event.code)) {
      held.add(event.code);
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
    if (isGameKey(event.code)) event.preventDefault();
  }

  function onPointerMove(event) {
    const box = canvas.getBoundingClientRect();
    if (box.height <= 0) return;
    mouseY = (event.clientY - box.top) / box.height;
    mouseAt = performance.now();
  }

  function onPointerDown(event) {
    onPointerMove(event);
    actions |= ACT.CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    held.clear();
    mouseY = null;
  });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);

  function isGameKey(code) {
    return LIFT_KEYS.has(code) || SINK_KEYS.has(code) || CLIMB_KEYS.has(code) || DIVE_KEYS.has(code) || CONFIRM_KEYS.has(code);
  }

  return {
    /** Current sticks: throttle trim keys, and a pitch stick from keys or the mouse. */
    controls() {
      const climb = held.has('KeyA') || held.has('ArrowLeft');
      const dive = held.has('KeyD') || held.has('ArrowRight');
      let stick = 0;
      if (climb) stick = 1;
      else if (dive) stick = -1;
      else if (mouseY !== null && performance.now() - mouseAt < 2200) {
        stick = Math.max(-1, Math.min(1, (0.5 - mouseY) * 2.6));
      }
      return {
        throttleUp: held.has('KeyW') || held.has('ArrowUp'),
        throttleDown: held.has('KeyS') || held.has('ArrowDown'),
        stick,
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
