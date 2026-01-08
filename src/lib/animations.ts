import type { Variants, Transition } from 'framer-motion';

export const transitions = {
  fast: { duration: 0.1, ease: 'easeOut' } as Transition,
  normal: { duration: 0.2, ease: 'easeOut' } as Transition,
  slow: { duration: 0.3, ease: 'easeOut' } as Transition,
};

export const variants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } as Variants,
  
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  } as Variants,

  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  } as Variants,

  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  } as Variants,
};
