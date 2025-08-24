import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// import enTranslation from './i18n/en.json';
// import spaceEn from './i18n/en/space-setting.json';
// import jaTranslation from './i18n/ja.json';
// import zhTranslation from './i18n/zh.json';

const supportLang = ['zh', 'en', 'ja'];
const namespaces = ['space', 'space-setting', 'ai-admin', 'user-admin'];

let resources = {};

const loadResources = async () => {
    const resources: any = {};

    await Promise.all(
        supportLang.map(async v => {
            resources[v] = {};

            // 加载主翻译文件
            try {
                const mainTranslation = (await import(`./i18n/${v}/${v}.json`)).default;
                resources[v].translation = mainTranslation;
            } catch (error) {
                console.warn(`Failed to load main translation for language ${v}:`, error);
                resources[v].translation = {};
            }

            // 加载命名空间翻译文件
            await Promise.all(
                namespaces.map(async ns => {
                    try {
                        resources[v][ns] = (await import(`./i18n/${v}/${ns}.json`)).default;
                    } catch (error) {
                        console.warn(`Failed to load namespace ${ns} for language ${v}:`, error);
                        resources[v][ns] = {};
                    }
                })
            );
        })
    );

    console.log(resources);

    return resources;
};

// 初始化i18n
const initializeI18n = async () => {
    const resources = await loadResources();

    i18n.use(initReactI18next).init({
        debug: false,
        fallbackLng: 'zh',
        defaultNS: 'translation',
        ns: ['translation', ...namespaces],
        interpolation: {
            escapeValue: false
        },
        resources
    });
};

export const Init = initializeI18n;

export default i18n;
