import { Chip, ScrollShadow } from "@heroui/react";
import { memo } from 'react';

import { Knowledge } from '@/apis/knowledge';
import { Editor } from '@/components/editor/index';
import knowledge from '@/pages/share/knowledge';

export default memo(function KnowledgeView({ knowledge }: { knowledge: Knowledge }) {
    return (
        <>
            <ScrollShadow hideScrollBar className="w-full flex-grow box-border flex justify-center">
                <div className="w-full h-full md:max-w-[650px]">
                    <div className="w-full my-10 dark:text-gray-100 text-gray-800 text-lg overflow-hidden">
                        <h1 className="text-xl text-gray-800 dark:text-gray-100">{knowledge.title}</h1>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-5">
                        {knowledge.tags &&
                            knowledge.tags.map(item => {
                                return (
                                    <Chip key={item} className="text-gray-600 dark:text-gray-300" size="sm" variant="bordered">
                                        {item}
                                    </Chip>
                                );
                            })}
                    </div>

                    <div className="w-full flex-wrap">
                        {/* <Markdown className="w-full text-wrap break-words whitespace-pre-wrap text-gray-600 dark:text-gray-300">{knowledge.content}</Markdown> */}
                        {knowledge.content && <Editor readOnly className="!mx-0" data={knowledge.blocks || knowledge.content} dataType={knowledge.content_type} />}
                    </div>
                </div>
            </ScrollShadow>
        </>
    );
});
