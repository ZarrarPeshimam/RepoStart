import { EventEmitter } from 'events';
import { TimelineEvent, TimelineEventStatus } from '../types';
import { now, uid } from '../utils/fs';

export class ActivityTimeline extends EventEmitter {
  
  private events: TimelineEvent[] = [];

  addEvent(label: string, status: TimelineEventStatus = 'pending'): TimelineEvent {
    const event: TimelineEvent = {
      id: uid(),
      label,
      status,
      timestamp: now(),
    };
    this.events.push(event);
    this.emit('update', event);
    return event;
  }

  updateEvent(
    id: string,
    status: TimelineEventStatus,
    detail?: string
  ): void {
    const event = this.events.find((e) => e.id === id);
    if (!event) {return;}

    event.status = status;
    event.timestamp = now();
    if (detail !== undefined) {event.detail = detail;}

    this.emit('update', { ...event });
  }

  getEvents(): ReadonlyArray<TimelineEvent> {
    return [...this.events];
  }

  reset(): void {
    this.events = [];
    this.emit('reset');
  }
}

export const TimelineStep = {
  DETECTING_REPO: 'Detecting repository',
  ANALYZING_ARCH: 'Analyzing architecture',
  INSTALLING_DEPS: 'Installing dependencies',
  STARTING_SERVICES: 'Starting services',
  COMPLETE: 'Setup complete',
} as const;
