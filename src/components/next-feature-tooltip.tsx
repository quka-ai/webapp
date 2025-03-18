import { Tooltip } from "@heroui/react";
import { ReactElement } from 'react';

export default function Component(props: { children: ReactElement; content: string }) {
    const { content } = props;

    return (
        <Tooltip {...props} content={<NextFeature content={content} />}>
            {props.children}
        </Tooltip>
    );
}

function NextFeature({ content }: { content: string }) {
    return (
        <>
            <span className="inline bg-gradient-to-br from-pink-400  dark:to-indigo-300 to-indigo-500 bg-clip-text font-semibold tracking-tight text-transparent">Next feature</span>
            {content}
        </>
    );
}
