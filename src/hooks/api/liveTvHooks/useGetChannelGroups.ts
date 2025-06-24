import type { AxiosRequestConfig } from 'axios';
import { getLiveTvApi } from '@jellyfin/sdk/lib/utils/api/live-tv-api';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { type JellyfinApiContext, useApi } from 'hooks/useApi';

export interface ChannelGroup {
    Name: string;
    TotalCount: number;
    Channels: any[]; // BaseItemDto[]
}

const getChannelGroups = async (
    apiContext: JellyfinApiContext,
    params: {
        userId?: string;
        startIndex?: number;
        limit?: number;
    },
    options?: AxiosRequestConfig
) => {
    const { api, user } = apiContext;

    if (!api) throw new Error('[getChannelGroups] No API instance available');
    if (!user?.Id) throw new Error('[getChannelGroups] No User ID provided');

    // 使用新的频道组接口
    const response = await api.axiosInstance.get('/LiveTv/Channels/Groups', {
        params: {
            userId: params.userId || user.Id,
            startIndex: params.startIndex,
            limit: params.limit
        },
        ...options
    });
    return response.data as ChannelGroup[];
};

export const getChannelGroupsQuery = (
    apiContext: JellyfinApiContext,
    params: {
        userId?: string;
        startIndex?: number;
        limit?: number;
    }
) =>
    queryOptions({
        queryKey: ['ChannelGroups', params],
        queryFn: ({ signal }) => getChannelGroups(apiContext, params, { signal }),
        enabled: !!apiContext.api && !!apiContext.user?.Id
    });

export const useGetChannelGroups = (params: {
    userId?: string;
    startIndex?: number;
    limit?: number;
} = {}) => {
    const apiContext = useApi();
    return useQuery(getChannelGroupsQuery(apiContext, params));
}; 