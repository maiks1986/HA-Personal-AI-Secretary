import { getDb } from '../../db/database';

export enum Priority {
    HIGH = 0,    // User messages, urgent UI actions
    MEDIUM = 1,  // Stealth mode updates, chat modifications
    LOW = 2      // Background sync, profile pictures, naming
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
    private baseDelay = 1200; // Average ms between ANY requests to WA

    constructor(private instanceId: number) {}

    private getNextDelay(): number {
        let delay = this.baseDelay;
        try {
            const db = getDb();
            if (db) {
                // Warmup logic: increase delay for newer instances to prevent bans
                const row = db.prepare('SELECT created_at FROM instances WHERE id = ?').get(this.instanceId) as any;
                if (row && row.created_at) {
                    const createdAt = new Date(row.created_at).getTime();
                    const now = Date.now();
                    const diffHours = Math.floor((now - createdAt) / (1000 * 60 * 60));
                    if (diffHours < 48) {
                        // Extra delay for instances under 48 hours old
                        delay += (48 - diffHours) * 100; // Scales down as account ages
                    }
                }
            }
        } catch (e) {
            console.error('[TrafficManager]: Failed to calculate warmup delay:', e);
        }
        
        // Randomize delay between 80% and 150% of calculated delay
        const min = delay * 0.8;
        const max = delay * 1.5;
        const finalDelay = Math.floor(Math.random() * (max - min + 1) + min);
        return isNaN(finalDelay) ? this.baseDelay : finalDelay;
    }

    /**
     * Enqueue a task for execution with priority.
     */
    public async enqueue<T>(execute: () => Promise<T>, priority: Priority = Priority.LOW): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({
                priority,
                execute,
                resolve,
                reject,
                timestamp: Date.now()
            });

            // Sort by priority (asc) then by timestamp (asc)
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.timestamp - b.timestamp;
            });

            this.processNext();
        });
    }

    /**
     * Clears pending tasks.
     */
    public clearQueue(priorityThreshold: Priority = Priority.LOW) {
        const removed = this.queue.filter(t => t.priority >= priorityThreshold);
        this.queue = this.queue.filter(t => t.priority < priorityThreshold);
        
        for (const task of removed) {
            task.cancelled = true;
            task.reject(new Error("Queue cleared"));
        }
        
        if (removed.length > 0) {
            console.log(`[TrafficManager ${this.instanceId}]: Cleared ${removed.length} tasks.`);
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
