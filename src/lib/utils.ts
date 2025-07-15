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

/**
 * 处理用户头像URL
 * 如果头像不存在或只有路径（没有host），则使用默认头像
 * @param avatar - 原始头像URL
 * @param userId - 用户ID，用于生成fallback头像
 * @param useStaticFallback - 是否使用静态默认头像，false则使用动态生成的头像
 * @returns 处理后的头像URL
 */
export function processAvatarUrl(avatar: string | null | undefined, userId: string, useStaticFallback: boolean = false): string {
    // 如果头像不存在，使用fallback
    if (!avatar) {
        return useStaticFallback ? '/images/default_avatar.png' : `https://avatar.vercel.sh/${userId}`;
    }

    // 如果头像是完整URL（包含协议），直接返回
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        return avatar;
    }

    // 如果头像只是路径（没有host），使用fallback
    if (avatar.startsWith('/') || !avatar.includes('://')) {
        return useStaticFallback ? '/images/default_avatar.png' : `https://avatar.vercel.sh/${userId}`;
    }

    // 其他情况直接返回
    return avatar;
}
