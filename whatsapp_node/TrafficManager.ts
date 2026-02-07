import { getDb } from './database';

export enum Priority {
    HIGH = 0,
    MEDIUM = 1,
    LOW = 2
}

interface QueuedTask {
    priority: Priority;
    execute: () => Promise<any>;
    resolve: (val: any) => void;
    reject: (err: any) => void;
    timestamp: number;
    cancelled?: boolean;
}

export class TrafficManager {
    private queue: QueuedTask[] = [];
    private processing = false;
    private lastRequestTime = 0;
    private baseDelay = 1200;

    constructor(private instanceId: number) {}

    private getNextDelay(): number {
        let delay = this.baseDelay;
        try {
            const db = getDb();
            if (db) {
                const row = db.prepare('SELECT created_at FROM instances WHERE id = ?').get(this.instanceId) as any;
                if (row && row.created_at) {
                    const createdAt = new Date(row.created_at).getTime();
                    const now = Date.now();
                    const diffHours = Math.floor((now - createdAt) / (1000 * 60 * 60));
                    if (diffHours < 48) {
                        delay += diffHours * 1000;
                    } else if (diffHours < 50) {
                        delay += 48 * 1000;
                    }
                }
            }
        } catch (e) {
            console.error('[TrafficManager]: Failed to calculate warmup delay:', e);
        }
        const min = delay * 0.8;
        const max = delay * 1.5;
        const finalDelay = Math.floor(Math.random() * (max - min + 1) + min);
        return isNaN(finalDelay) ? this.baseDelay : finalDelay;
    }

    public async enqueue<T>(execute: () => Promise<T>, priority: Priority = Priority.LOW): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ priority, execute, resolve, reject, timestamp: Date.now() });
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.timestamp - b.timestamp;
            });
            this.processNext();
        });
    }

    public clearQueue(priorityThreshold: Priority = Priority.LOW) {
        const removed = this.queue.filter(t => t.priority >= priorityThreshold);
        this.queue = this.queue.filter(t => t.priority < priorityThreshold);
        for (const task of removed) {
            task.cancelled = true;
            task.reject(new Error("Queue cleared"));
        }
    }

    private async processNext() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;
        try {
            const task = this.queue.shift();
            if (!task || task.cancelled) {
                this.processing = false;
                if (this.queue.length > 0) setImmediate(() => this.processNext());
                return;
            }
            const now = Date.now();
            const timeSinceLast = now - this.lastRequestTime;
            const currentDelay = this.getNextDelay();
            if (timeSinceLast < currentDelay) {
                await new Promise(r => setTimeout(r, currentDelay - timeSinceLast));
            }
            if (task.cancelled) {
                this.processing = false;
                if (this.queue.length > 0) setImmediate(() => this.processNext());
                return;
            }
            try {
                const result = await task.execute();
                this.lastRequestTime = Date.now();
                task.resolve(result);
            } catch (e) {
                this.lastRequestTime = Date.now();
                task.reject(e);
            }
        } finally {
            this.processing = false;
            if (this.queue.length > 0) setImmediate(() => this.processNext());
        }
    }

    public getQueueSize(): number { return this.queue.length; }
    public getAdaptiveDelay(baseDelay: number): number {
        const size = this.queue.length;
        if (size > 20) return baseDelay * 4;
        if (size > 10) return baseDelay * 2;
        return baseDelay;
    }
}
