import AnimatedShinyText from './shiny-text';

import { ToolStatus, ToolTips } from '@/types/chat';

export interface ToolUsingProps {
    // Define any props you want to pass to the ToolUsing component
    toolTips?: ToolTips[];
}
export default function ToolUsing({ toolTips }: ToolUsingProps) {
    if (!toolTips) {
        return null;
    }

    // toolTips = [
    //     {
    //         id: '1',
    //         status: ToolStatus.TOOL_STATUS_RUNNING,
    //         content: 'toolTip1'
    //     },
    //     {
    //         id: '1',
    //         status: ToolStatus.TOOL_STATUS_SUCCESS,
    //         content: 'toolTip1'
    //     }
    // ]

    return (
        toolTips?.map((toolTip: ToolTips) => {
            return (
                <AnimatedShinyText key={toolTip.id} animate={toolTip.status === ToolStatus.TOOL_STATUS_RUNNING} className="inline-flex items-center text-sm justify-center pb-4 transition ease-out">
                    <span>
                        {toolTip.status === ToolStatus.TOOL_STATUS_RUNNING ? '😶‍🌫️' : '👌🏼'} {toolTip.tool_name}
                    </span>
                </AnimatedShinyText>
            );
        }) || []
    );
}
