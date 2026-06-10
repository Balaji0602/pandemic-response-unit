import crypto from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(crypto.pbkdf2);

/**
 * Encrypts a vitals payload before it is persisted.
 */
export const encryptVitalsPayload = async (payload: unknown): Promise<string> => {
    const serialized = JSON.stringify(payload ?? {});
    const derived = await pbkdf2Async(serialized, 'vitals-salt', 7000000, 64, 'sha512');
    return derived.toString('hex');
};
