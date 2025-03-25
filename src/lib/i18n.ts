import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// import enTranslation from './i18n/en.json';
// import spaceEn from './i18n/en/space-setting.json';
// import jaTranslation from './i18n/ja.json';
// import zhTranslation from './i18n/zh.json';

const supportLang = ['zh', 'en', 'ja'];
const namespaces = ['space', 'space-setting'];

let resources = {};

supportLang.forEach(async v => {
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
});

console.log(resources);
i18n.use(initReactI18next).init({
    debug: false,
    lng: 'zh',
    fallbackLng: 'zh',
    interpolation: {
        escapeValue: false
    },
    resources
    // resources: {
    //     en: {
    //         translation: {
    //             ...enTranslation,
    //             'space-setting': spaceEn
    //         }
    //     },
    //     zh: { translation: zhTranslation },
    //     ja: { translation: jaTranslation }
    // }
});

export default i18n;
