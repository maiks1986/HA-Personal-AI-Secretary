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
    private minDelay = 200; // Minimum ms between ANY requests to WA

    constructor(private instanceId: number) {}

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

    private async processNext() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const task = this.queue.shift()!;
        
        // Rate limiting: Ensure minDelay between requests
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        if (timeSinceLast < this.minDelay) {
            await new Promise(r => setTimeout(r, this.minDelay - timeSinceLast));
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
