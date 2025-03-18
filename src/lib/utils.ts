import { type ClassValue, clsx } from 'clsx';
import * as CryptoJS from 'crypto-js';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatBytes(
    bytes: number,
    opts: {
        decimals?: number;
        sizeType?: 'accurate' | 'normal';
    } = {}
) {
    const { decimals = 0, sizeType = 'normal' } = opts;

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${sizeType === 'accurate' ? (accurateSizes[i] ?? 'Bytes') : (sizes[i] ?? 'Bytes')}`;
}

export function isJsonString(input: string): boolean {
    try {
        if (typeof JSON.parse(input) == 'object') {
            return true;
        }
    } catch (e) {}

    return false;
}

const BREW_LOGIN_AUTO_DIRECT_KEY = 'brew-auto-login-direct';

export function autoLoginDirect(): boolean {
    return !sessionStorage.getItem(BREW_LOGIN_AUTO_DIRECT_KEY);
}

export function setNotAutoLoginDirect() {
    sessionStorage.setItem(BREW_LOGIN_AUTO_DIRECT_KEY, 'true');
}

export function md5(inputString: string): string {
    return CryptoJS.MD5(inputString).toString();
}

export function randomString(e) {
    e = e || 32;
    var t = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678',
        a = t.length,
        n = '';
    for (let i = 0; i < e; i++) n += t.charAt(Math.floor(Math.random() * a));
    return n;
}
