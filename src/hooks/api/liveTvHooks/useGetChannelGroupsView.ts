import { useQuery } from '@tanstack/react-query';
import { useGetChannelGroups, type ChannelGroup } from './useGetChannelGroups';

export interface ChannelGroupView {
    name: string;
    totalCount: number;
    channels: any[]; // BaseItemDto[]
}

const transformChannelGroups = (channelGroups: ChannelGroup[]): ChannelGroupView[] => {
    return channelGroups.map(group => ({
        name: group.Name,
        totalCount: group.TotalCount,
        channels: group.Channels || []
    }));
};

export const useGetChannelGroupsView = (params: {
    userId?: string;
    startIndex?: number;
    limit?: number;
} = {}) => {
    const channelGroupsQuery = useGetChannelGroups(params);
    
    return useQuery({
        ...channelGroupsQuery,
        queryKey: ['ChannelGroupsView', params],
        select: (data: ChannelGroup[]) => transformChannelGroups(data),
        enabled: !!channelGroupsQuery.data || channelGroupsQuery.isLoading
    });
}; 