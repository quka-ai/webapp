import 'katex/dist/katex.min.css';
import { common } from 'lowlight';
import { memo, useMemo, useState } from 'react';
// https://github.com/remarkjs/react-markdown
import Markdown, { type Components, type ExtraProps, type Options } from 'react-markdown';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import stringWidth from 'string-width';

import { useTheme } from '@/hooks/use-theme';

// 预处理函数，智能处理数学公式和普通$符号
const preprocessMathContent = (content: string): string => {
    // 保护已经正确格式化的数学公式
    const protectedContent = content
        // 首先处理 $hidden[xxx] 格式，直接转义这种格式的$符号
        .replace(/\$hidden\[([^\]]+)\]/g, '\\$hidden[$1]')
        // 保护 $$...$$（块级数学公式）和 $...$ 中确实是数学公式的内容
        .replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
            // 检查是否包含数学符号或LaTeX命令
            if (/[+\-*/=<>∑∫∂∆∇α-ωΑ-Ω\\^_{}()]/.test(formula) || /\\[a-zA-Z]+/.test(formula)) {
                return match; // 保持原样，这是真正的数学公式
            }
            // 否则转义$符号
            return `\\$\\$${formula}\\$\\$`;
        })
        // 处理单个$符号包围的内容
        .replace(/(?<!\\)\$([^$\n]+)\$/g, (match, content) => {
            // 如果内容以 "hidden[" 开头，说明这不是数学公式
            if (content.trim().startsWith('hidden[')) {
                return `\\$${content}\\$`; // 转义$符号
            }

            // 检查是否包含数学符号或LaTeX命令
            if (/[+\-*/=<>∑∫∂∆∇α-ωΑ-Ω\\^_{}()]/.test(content) || /\\[a-zA-Z]+/.test(content)) {
                return match; // 保持原样，这是数学公式
            }

            // 如果内容很长（超过50字符）且包含中文，很可能不是数学公式
            if (content.length > 50 && /[\u4e00-\u9fff]/.test(content)) {
                return `\\$${content}\\$`; // 转义$符号
            }

            // 如果内容包含空格且没有数学符号，很可能不是数学公式
            if (content.includes(' ') && !/[+\-*/=<>∑∫∂∆∇α-ωΑ-Ω\\^_{}()]/.test(content) && !/\\[a-zA-Z]+/.test(content)) {
                return `\\$${content}\\$`; // 转义$符号
            }

            return match; // 保持原样
        });

    return protectedContent;
};

export default memo(function MarkdownComponent(props: Options & { isLight?: boolean; className?: string }) {
    const { children, isLight, className, ...rest } = props;
    const { isDark } = useTheme();

    // 预处理内容
    const processedContent = useMemo(() => {
        if (typeof children === 'string') {
            return preprocessMathContent(children);
        }
        return children;
    }, [children]);
    const cps = useMemo(() => {
        if (isLight) {
            return { a: LightLink } as Components;
        }

        return { a: CustomLink, pre: Pre, img: Img, table: CustomTable, think: Think } as Components;
    }, [isLight]);

    const rehypePlugins = useMemo(() => {
        let commonPlugins = [
            rehypeRaw,
            [
                rehypeKatex,
                {
                    strict: false,
                    trust: true,
                    fleqn: false,
                    throwOnError: false,
                    errorColor: '#cc0000',
                    macros: {
                        '\\RR': '\\mathbb{R}',
                        '\\NN': '\\mathbb{N}',
                        '\\ZZ': '\\mathbb{Z}',
                        '\\QQ': '\\mathbb{Q}',
                        '\\CC': '\\mathbb{C}'
                    }
                }
            ]
        ];

        if (isLight) {
            return commonPlugins;
        }

        return [[rehypeHighlight, { languages: common }], ...commonPlugins];
    }, [isLight]);

    let markdownClassName = className ? className : '';

    markdownClassName += 'markdown-box markdown-body ' + (isDark ? 'github-dark' : 'github');

    return (
        <>
            <div className={markdownClassName}>
                <Markdown {...rest} rehypePlugins={rehypePlugins as any} remarkPlugins={[[remarkGfm, { stringLength: stringWidth }], [remarkMath]] as any} components={cps}>
                    {processedContent as string}
                </Markdown>
            </div>
        </>
    );
});

const LightLink = ({ children }: { children: React.ReactNode }) => {
    return <span>{children}</span>;
};

const CustomLink = ({ href, children }: { href?: string; children: React.ReactNode }) => {
    return (
        <a href={href} className={href && href !== '#' ? 'text-blue-400' : ''} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
};

const CustomTable = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="w-full overflow-x-auto">
            <table>{children}</table>
        </div>
    );
};

const Pre = ({ children }: { children: React.ReactNode }) => {
    return <pre className="my-2 rounded-lg overflow-hidden break-words text-wrap">{children}</pre>;
};

const Img = ({ src, alt, ...rest }: { src?: string; alt?: string; [key: string]: any }) => {
    return (
        <Zoom>
            <img src={src} alt={alt} {...rest} />
        </Zoom>
    );
};

const Think = ({ children, ...props }: any) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const { isDark } = useTheme();

    return (
        <div className={`mb-4 rounded-lg text-sm border transition-all duration-200 ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-slate-300 bg-slate-50'}`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-between p-3 text-left transition-colors duration-200 rounded-t-lg hover:${isDark ? 'bg-gray-800/50' : 'bg-slate-100'}`}
            >
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>🤔 Quka Thinking</span>
                </div>
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isExpanded && (
                <div className={`p-3 border-t ${isDark ? 'border-gray-800 text-gray-300 bg-gray-900/70' : 'border-gray-200 text-gray-700 bg-white/50'}`}>
                    <div className={`text-xs leading-relaxed font-mono ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{children}</div>
                </div>
            )}
        </div>
    );
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
