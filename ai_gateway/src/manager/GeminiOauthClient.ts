import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino();

// Reverse-engineered Gemini CLI credentials
const OAUTH_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';

export enum UserTierId {
    FREE = "free-tier",
    LEGACY = "legacy-tier",
    STANDARD = "standard-tier",
}

export class GeminiOauthClient {
    private client: OAuth2Client;
    private projectId: string | undefined;
    private sessionId: string;
    private userTier: string | undefined;

    constructor(tokens: any) {
        this.client = new OAuth2Client({
            clientId: OAUTH_CLIENT_ID,
            clientSecret: OAUTH_CLIENT_SECRET,
        });
        this.client.setCredentials(tokens);
        this.sessionId = uuidv4();
    }

    private getBaseUrl(): string {
        return `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}`;
    }

    private getMethodUrl(method: string): string {
        return `${this.getBaseUrl()}:${method}`;
    }

    private async requestPost(method: string, req: any): Promise<any> {
        const url = this.getMethodUrl(method);
        const res = await this.client.request({
            url,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        return res.data;
    }

    public async setupUser(): Promise<void> {
        // In the context of the gateway, we might not have a GOOGLE_CLOUD_PROJECT env var
        // but the loadCodeAssist call will tell us if there's an existing project.
        const coreClientMetadata = {
            ideType: 'IDE_UNSPECIFIED',
            platform: 'PLATFORM_UNSPECIFIED',
            pluginType: 'GEMINI',
        };

        try {
            const loadRes = await this.requestPost('loadCodeAssist', {
                metadata: coreClientMetadata,
            });

            if (loadRes.currentTier) {
                this.projectId = loadRes.cloudaicompanionProject || 'unspecified-project';
                this.userTier = loadRes.currentTier.id;
                return;
            }

            const tier = this.getOnboardTier(loadRes);
            const onboardReq = {
                tierId: tier.id,
                metadata: coreClientMetadata,
            };

            let lroRes = await this.requestPost('onboardUser', onboardReq);

            // Wait for LRO if needed
            if (!lroRes.done && lroRes.name) {
                const operationName = lroRes.name;
                while (!lroRes.done) {
                    await new Promise((f) => setTimeout(f, 2000));
                    const opUrl = `${this.getBaseUrl()}/${operationName}`;
                    const opRes = await this.client.request({ url: opUrl, method: 'GET' });
                    lroRes = opRes.data;
                }
            }

            this.projectId = lroRes.response?.cloudaicompanionProject?.id || 'unspecified-project';
            this.userTier = tier.id;
            logger.info(`Gemini OAuth: User onboarded with tier ${this.userTier}`);

        } catch (error: any) {
            logger.error(`Gemini OAuth Setup Error: ${error.message}`);
            throw error;
        }
    }

    private getOnboardTier(res: any): any {
        for (const tier of res.allowedTiers || []) {
            if (tier.isDefault) return tier;
        }
        return { id: UserTierId.LEGACY };
    }

    public async generateContent(prompt: string, model: string = 'gemini-2.0-flash-001'): Promise<string> {
        if (!this.projectId) {
            await this.setupUser();
        }

        const req = {
            model: `models/${model}`,
            project: this.projectId,
            user_prompt_id: uuidv4(),
            request: {
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }]
                }],
                session_id: this.sessionId,
            }
        };

        const response = await this.requestPost('generateContent', req);
        
        // Extract text from candidates
        const text = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Empty response from Gemini OAuth API');
        }
        return text;
    }
}
