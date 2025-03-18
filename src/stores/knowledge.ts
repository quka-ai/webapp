import { proxy } from 'valtio';

const knowledgeStore = proxy<KnowledgeStore>({
    searchKeywords: '',
    onKnowledgeSearch: ''
});

export const triggerKnowledgeSearch = () => {
    knowledgeStore.onKnowledgeSearch = knowledgeStore.searchKeywords;
};

export const onKnowledgeSearchKeywordsChange = (value: string) => {
    knowledgeStore.searchKeywords = value;
};

export default knowledgeStore;
