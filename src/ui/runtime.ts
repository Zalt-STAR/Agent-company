import { appStore } from '../store/studio';
import { Scheduler } from '../scheduler/scheduler';
import { iframePreviewRunner } from '../runtime/preview';
import { getProvider } from '../llm/provider';

/** The single scheduler driving the app's agent company. */
export const scheduler = new Scheduler(appStore, {
  runner: iframePreviewRunner,
  providerFactory: getProvider,
  tickDelayMs: 450,
});
