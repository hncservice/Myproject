import { useEffect, useRef, useState } from 'react';
import background from '../../../assets/sounds/game-bg-loop.mp3';
import start from '../../../assets/sounds/game-start.mp3';
import collect from '../../../assets/sounds/tap.mp3';
import hit from '../../../assets/sounds/monkey-miss.mp3';
import win from '../../../assets/sounds/game-win.mp3';
import lose from '../../../assets/sounds/game-lose.mp3';
import { createBurgerRunAudio } from './burgerRunAudio.mjs';

export function useBurgerRunAudio(mode) {
  const controller = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    const audio = createBurgerRunAudio({ background, start, collect, hit, win, lose });
    controller.current = audio;
    const visibility = () => audio.setActive(!document.hidden && ['starting', 'playing'].includes(modeRef.current));
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); audio.dispose(); if (controller.current === audio) controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.setActive(!document.hidden && ['starting', 'playing'].includes(mode)); }, [mode]);
  const callbacks = useRef(null);
  if (!callbacks.current) callbacks.current = {
    begin: () => controller.current?.begin(),
    play: name => { void controller.current?.play(name); },
    jump: () => controller.current?.jump(),
    unlock: () => controller.current?.unlock(),
  };
  function toggleSound() {
    const next = !soundEnabled;
    controller.current?.setEnabled(next);
    setSoundEnabled(next);
  }
  return { ...callbacks.current, soundEnabled, toggleSound };
}
