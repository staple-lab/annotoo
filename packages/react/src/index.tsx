import { useEffect, useRef } from 'react';
import { mount, type MountOptions, type AnnotooInstance } from '@staplelab/annotoo';

export type {
  Anchor,
  Annotation,
  AnnotationCategory,
  AnnotationStorage,
  DisplayMode,
  Mode,
  AnnotooInstance,
  Position,
  Theme,
  WidgetAction,
} from '@staplelab/annotoo';
export { CATEGORIES, memoryStorage, localStorageStorage, devServerStorage } from '@staplelab/annotoo';

export type AnnotooProps = MountOptions & {
  /** Render nothing and don't mount (e.g. to switch Annotoo off for some builds). */
  disabled?: boolean;
};

/**
 * Figma-style annotations for your prototype.
 *
 * ```tsx
 * import annotations from './annotoo.annotations.json'
 * <Annotoo annotations={annotations} />
 * ```
 *
 * With `@staplelab/vite-plugin-annotoo` in your Vite config, `vite dev` gives you author
 * mode (annotations save into that JSON file) and every production build is read-only, so
 * whoever opens your deployed prototype sees the annotations.
 */
export function Annotoo({ disabled = false, annotations, ...options }: AnnotooProps): null {
  const instance = useRef<AnnotooInstance | null>(null);
  // Mount-time options; changing the ones in the dependency list remounts the widget.
  const latest = useRef(options);
  latest.current = options;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const { mode, endpoint, position, basePath, display, outlines, theme, shortcuts } = options;

  useEffect(() => {
    if (disabled) return;
    const inst = mount({ ...latest.current, annotations: annotationsRef.current });
    instance.current = inst;
    return () => {
      inst.destroy();
      if (instance.current === inst) instance.current = null;
    };
  }, [disabled, mode, endpoint, position, basePath, display, outlines, theme, shortcuts]);

  useEffect(() => {
    if (annotations) instance.current?.setAnnotations(annotations);
  }, [annotations]);

  return null;
}

export default Annotoo;
