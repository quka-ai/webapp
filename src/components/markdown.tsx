import 'katex/dist/katex.min.css';
import { common } from 'lowlight';
import { memo, useMemo } from 'react';
// https://github.com/remarkjs/react-markdown
import Markdown, { type ExtraProps, type Options } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import stringWidth from 'string-width';

import { useTheme } from '@/hooks/use-theme';

export default memo(function MarkdownComponent(props: Options & { isLight?: boolean }) {
    const { children, isLight, className, ...rest } = props;
    const { isDark } = useTheme();
    const cps = useMemo(() => {
        if (isLight) {
            return { a: LightLink };
        }

        return { a: CustomLink, pre: Pre, table: CustomTable };
    }, [isLight]);

    const rehypePlugins = useMemo(() => {
        let commonPlugins = [rehypeRaw, rehypeKatex];

        if (isLight) {
            return commonPlugins;
        }

        return [[rehypeHighlight, { languages: common }], ...commonPlugins];
    }, [isLight]);

    let markdownClassName = className ? className : '';

    markdownClassName += 'markdown-box markdown-body ' + (isDark ? 'github-dark' : 'github');

    return (
        <>
            <Markdown {...rest} className={markdownClassName} rehypePlugins={rehypePlugins} remarkPlugins={[[remarkGfm, { stringLength: stringWidth }], [remarkMath]]} components={cps}>
                {children as string}
            </Markdown>
        </>
    );
});

const LightLink = ({ children }) => {
    return <span>{children}</span>;
};

const CustomLink = ({ href, children }) => {
    return (
        <a href={href} className={href && href !== '#' && 'text-blue-400'} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
};

const CustomTable = ({ href, children }) => {
    return (
        <div className="w-full overflow-x-auto">
            <table>{children}</table>
        </div>
    );
};

const Pre = ({ children, ...others }: ExtraProps) => {
    return <pre className="my-2 rounded-lg overflow-hidden break-words text-wrap">{children}</pre>;
};

// // @ts-ignore
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// // @ts-ignore
// import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
// const code = function Code(props: ExtraProps) {
//     // @ts-ignore
//     const { children, className, ...rest } = props;
//     const match = /language-(\w+)/.exec(className || '');

//     const { isDark } = useTheme();
//     const [change, setChange] = useState(false);

//     useEffect(() => {
//         if (!match) {
//             return;
//         }
//         const unSubscribe = subscribeKey(eventStore, 'themeChange', () => {
//             setChange(prev => !prev);
//         });

//         return unSubscribe;
//     }, [match]);

//     const usedStyle = useMemo(() => {
//         const _isDark = !change ? isDark : !isDark;

//         if (_isDark) {
//             return atomOneDark;
//         } else {
//             return atomOneLight;
//         }
//     }, [change]);

//     return match ? (
//         <SyntaxHighlighter {...rest} wrapLines wrapLongLines className="overflow-hidden my-2 rounded-lg !p-4" PreTag="div" language={match[1]} style={usedStyle}>
//             {/* {String(children).replace(/\n$/, '')} */}
//             {children}
//         </SyntaxHighlighter>
//     ) : (
//         <code {...rest} className={cn('text-wrap', className)}>
//             {children}
//         </code>
//     );
// };
