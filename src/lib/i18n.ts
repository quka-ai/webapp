import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// import enTranslation from './i18n/en.json';
// import spaceEn from './i18n/en/space-setting.json';
// import jaTranslation from './i18n/ja.json';
// import zhTranslation from './i18n/zh.json';

const supportLang = ['zh', 'en', 'ja'];
const namespaces = ['space', 'space-setting'];

let resources = {};

const loadResources = async () => {
    const resources = {};

    await Promise.all(
        supportLang.map(async v => {
            resources[v] = {
                translation: Object.assign(
                    (() => {
                        let obj = {};

                        namespaces.forEach(async ns => {
                            obj[ns] = (await import(`./i18n/${v}/${ns}.json`)).default;
                        });

                        return obj;
                    })(),
                    (await import(`./i18n/${v}/${v}.json`)).default
                )
            };
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
        interpolation: {
            escapeValue: false
        },
        resources
    });
};

export const Init = initializeI18n;

export default i18n;
