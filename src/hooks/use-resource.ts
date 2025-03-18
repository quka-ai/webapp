import { t } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import resourceStore from '@/stores/resource';

export interface GroupedResources {
    title: string;
    items: Resource[];
}

export function useGroupedResources(): { groupedResources: GroupedResources[] } {
    const { t } = useTranslation();
    const { currentSpaceResources } = useSnapshot(resourceStore);

    const groupedResources = useMemo(() => {
        if (!currentSpaceResources) {
            return [];
        }
        // 使用 Map 保证插入顺序
        const groupMap = new Map<string, Resource[]>([
            ['projects', []],
            ['areas', []],
            ['resources', []],
            ['archives', []],
            ['others', []]
        ]);

        // 按照 tag 分类资源
        currentSpaceResources.forEach((v: Resource) => {
            let category = 'others';
            if (v.tag) {
                category = groupMap.has(v.tag) ? v.tag : 'others';
            }

            groupMap.get(category)?.push(
                v.id === 'knowledge'
                    ? {
                          ...v,
                          title: t('resourceKnowledge')
                      }
                    : v
            );
        });

        // 生成最终的分组数据
        return Array.from(groupMap)
            .filter(([_, items]) => items.length > 0) // 只保留非空的分组
            .map(([key, items]) => ({
                title: key,
                items
            }));
    }, [currentSpaceResources]);

    return { groupedResources };
}

// export function useGroupedResources(): { groupedResource: GroupedResources[] } {
//     const { t } = useTranslation();
//     const { currentSpaceResources } = useSnapshot(resourceStore);

//     const groupedResource = useMemo(() => {
//         const projects: Resource[] = [];
//         const areas: Resource[] = [];
//         const resources: Resource[] = [];
//         const archives: Resource[] = [];
//         const others: Resource[] = [];
//         const group: GroupedResources[] = [];
//         currentSpaceResources.forEach((v: Resource) => {
//             switch (v.tag) {
//                 case 'projects':
//                     projects.push(v);
//                     break;
//                 case 'areas':
//                     areas.push(v);
//                     break;
//                 case 'resources':
//                     resources.push(v);
//                     break;
//                 case 'archives':
//                     archives.push(v);
//                     break;
//                 default:
//                     others.push(v);
//                     break;
//             }
//         });
//         if (projects.length > 0) {
//             group.push({
//                 title: t('projects'),
//                 items: projects
//             });
//         }
//         if (areas.length > 0) {
//             group.push({
//                 title: t('areas'),
//                 items: areas
//             });
//         }
//         if (resources.length > 0) {
//             group.push({
//                 title: t('resources'),
//                 items: resources
//             });
//         }
//         if (archives.length > 0) {
//             group.push({
//                 title: t('archives'),
//                 items: archives
//             });
//         }
//         if (others.length > 0) {
//             group.push({
//                 title: t('others'),
//                 items: others
//             });
//         }

//         return group;
//     }, [currentSpaceResources]);

//     return { groupedResource };
// }
