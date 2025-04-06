import { Spinner } from '@heroui/react';
import { ReactNode } from 'react';

export interface ToolUsingProps {
    // Define any props you want to pass to the ToolUsing component
    isShow: boolean;
    title: string;
    desc?: string;
    icon?: ReactNode;
}
export default function ToolUsing({ isShow, title, desc, icon }: ToolUsingProps) {
    if (!isShow) {
        return null;
    }

    return (
        <div className="flex items-center gap-4 border-zinc-600 rounded-xl border-2 max-w-[200px] w-auto p-2 box-border">
            <div className="flex">{icon ? icon : <Spinner classNames={{ label: 'text-foreground', base: 'mb-2' }} variant="wave" />}</div>
            <div className="flex flex-col">
                <div className="text-sm font-bold ">{title}</div>
                {desc && <div className="text-sm">{desc}</div>}
            </div>
        </div>
    );
}
