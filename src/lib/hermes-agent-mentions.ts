import type { HermesAgentProfile } from '@/apis/hermes-desktop';

export interface AgentMentionOption {
    key: string;
    title: string;
    description?: string;
}

export function getHermesCustomAgents(profiles: HermesAgentProfile[]): HermesAgentProfile[] {
    return profiles.filter(profile => profile.id && !profile.builtIn);
}

export function getHermesAgentMentionOptions(profiles: HermesAgentProfile[]): AgentMentionOption[] {
    return getHermesCustomAgents(profiles).map(profile => ({
        key: profile.id,
        title: profile.name || profile.id,
        description: profile.description || profile.id
    }));
}

export function buildHermesAgentHandoffMessage(message: string, profiles: HermesAgentProfile[]): string {
    const mentionedAgents = getMentionedHermesAgents(message, profiles);
    if (mentionedAgents.length === 0) {
        return message;
    }

    const agentList = mentionedAgents
        .map(profile => {
            const description = profile.description ? `; description: ${profile.description}` : '';
            return `- id: ${profile.id}; name: ${profile.name || profile.id}${description}`;
        })
        .join('\n');

    return `${message}\n\n[Hermes Agent Delegation]\nThe user explicitly mentioned existing custom Hermes agents in this message. Treat these mentions as a delegation request.\nWhen a mentioned custom agent exists, hand the task off to that agent instead of handling it only in the main assistant. If multiple agents are mentioned, create and run work for all of them, in parallel when safe, then summarize their results for the user.\nMentioned custom agents:\n${agentList}\n[/Hermes Agent Delegation]`;
}

function getMentionedHermesAgents(message: string, profiles: HermesAgentProfile[]): HermesAgentProfile[] {
    const mentionedAgents: HermesAgentProfile[] = [];
    const usedIDs = new Set<string>();

    getHermesCustomAgents(profiles).forEach(profile => {
        const aliases = [profile.id, profile.name].filter((value): value is string => Boolean(value?.trim()));
        const matched = aliases.some(alias => isMentioned(message, alias));
        if (matched && !usedIDs.has(profile.id)) {
            usedIDs.add(profile.id);
            mentionedAgents.push(profile);
        }
    });

    return mentionedAgents;
}

function isMentioned(message: string, alias: string): boolean {
    const normalizedAlias = alias.trim();
    if (!normalizedAlias) {
        return false;
    }
    const escapedAlias = escapeRegExp(normalizedAlias);
    return new RegExp(`(^|\\s)@${escapedAlias}(?=\\s|$|[，。！？,.!?;；:：])`, 'i').test(message);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
