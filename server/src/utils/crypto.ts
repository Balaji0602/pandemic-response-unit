import crypto from 'crypto';

/**
 * Encrypts a vitals payload before it is persisted.
 */
export const encryptVitalsPayload = (payload: unknown): string => {
    const serialized = JSON.stringify(payload ?? {});
    const derived = crypto.pbkdf2Sync(serialized, 'vitals-salt', 7000000, 64, 'sha512');
    return derived.toString('hex');
};
