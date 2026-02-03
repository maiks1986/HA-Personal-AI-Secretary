import { WASocket } from '@whiskeysockets/baileys';

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
}

export class TrafficManager {
    private queue: QueuedTask[] = [];
    private processing = false;
    private lastRequestTime = 0;
    private baseDelay = 1200; // Average ms between ANY requests to WA

    constructor(private instanceId: number) {}

    private getNextDelay(): number {
        // Randomize delay between 80% and 150% of baseDelay
        const min = this.baseDelay * 0.8;
        const max = this.baseDelay * 1.5;
        return Math.floor(Math.random() * (max - min + 1) + min);
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
     * Clears all pending tasks in the queue.
     * Optionally filtered by priority (clears tasks at or below the given priority).
     */
    public clearQueue(priorityThreshold: Priority = Priority.LOW) {
        const removed = this.queue.filter(t => t.priority >= priorityThreshold);
        this.queue = this.queue.filter(t => t.priority < priorityThreshold);
        
        for (const task of removed) {
            task.reject(new Error("Queue cleared due to reconnection or shutdown"));
        }
        
        if (removed.length > 0) {
            console.log(`[TrafficManager ${this.instanceId}]: Cleared ${removed.length} tasks from queue.`);
        }
    }

    private async processNext() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const task = this.queue.shift()!;
        
        // Rate limiting: Ensure randomized delay between requests
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        const currentDelay = this.getNextDelay();

        if (timeSinceLast < currentDelay) {
            await new Promise(r => setTimeout(r, currentDelay - timeSinceLast));
        }

        try {
            // console.log(`[TrafficManager ${this.instanceId}]: Executing task (Priority: ${Priority[task.priority]}, Queue size: ${this.queue.length})`);
            const result = await task.execute();
            this.lastRequestTime = Date.now();
            task.resolve(result);
        } catch (e) {
            this.lastRequestTime = Date.now();
            task.reject(e);
        } finally {
            this.processing = false;
            // Immediate setImmediate to avoid stack overflow but keep processing
            setImmediate(() => this.processNext());
        }
    }

    /**
     * Returns the current queue size. 
     * Useful for background workers to implement adaptive delay.
     */
    public getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Recommended delay for low-priority workers based on queue congestion.
     * @param baseDelay The standard delay in ms
     */
    public getAdaptiveDelay(baseDelay: number): number {
        const size = this.queue.length;
        if (size > 20) return baseDelay * 4;
        if (size > 10) return baseDelay * 2;
        return baseDelay;
    }
}
